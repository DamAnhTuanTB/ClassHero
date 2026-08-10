import { describe, expect, it, vi } from "vitest";
import {
  AiGenerationType,
  AiProviderName,
  ProviderCatalogCategory,
  ProviderUsageMetric,
} from "@prisma/client";
import { z } from "zod";

import {
  AiProviderCallService,
  isTransientProviderError,
} from "#api/modules/ai/services/ai-provider-call.service";
import {
  ProviderBudgetError,
  providerBudgetErrorCodes,
} from "#api/modules/provider-operations/utils/provider-budget-error";
import {
  calculateProviderCost,
  estimateProviderReservation,
} from "#api/modules/provider-operations/utils/provider-cost-calculator";
import { getProviderBudgetPeriod } from "#api/modules/provider-operations/utils/provider-budget-period";

describe("provider operations cost accounting", () => {
  it("separates cached input, regular input and output token prices", () => {
    const result = calculateProviderCost(
      {
        promptTokens: 1_000_000,
        cachedInputTokens: 250_000,
        completionTokens: 100_000,
      },
      [
        rate(ProviderUsageMetric.INPUT_TOKEN, 1_000_000, 0.4),
        rate(ProviderUsageMetric.CACHED_INPUT_TOKEN, 1_000_000, 0.1),
        rate(ProviderUsageMetric.OUTPUT_TOKEN, 1_000_000, 1.6),
      ],
      25_000,
    );

    expect(result.costUsd).toBe(0.485);
    expect(result.costVnd).toBe(12_125);
  });

  it("calculates page pricing and keeps zero-usage events free", () => {
    const rates = [rate(ProviderUsageMetric.PAGE, 1, 0.005)];
    expect(calculateProviderCost({ pages: 20 }, rates, 25_000)).toEqual({
      costUsd: 0.1,
      costVnd: 2_500,
    });
    expect(calculateProviderCost({ pages: 0, requestCount: 0 }, rates, 25_000)).toEqual({
      costUsd: 0,
      costVnd: 0,
    });
  });

  it("only treats provider availability failures as fallback candidates", () => {
    expect(
      isTransientProviderError(Object.assign(new Error("rate limit"), { status: 429 })),
    ).toBe(true);
    expect(
      isTransientProviderError(Object.assign(new Error("server"), { status: 503 })),
    ).toBe(true);
    expect(isTransientProviderError(new Error("schema validation failed"))).toBe(false);
    expect(
      isTransientProviderError(Object.assign(new Error("bad request"), { status: 400 })),
    ).toBe(false);
  });

  it("reserves with the most expensive applicable rate and rounds VND upward", () => {
    const estimate = estimateProviderReservation(
      { promptTokens: 1_001, completionTokens: 500 },
      [
        rate(ProviderUsageMetric.INPUT_TOKEN, 1_000, 0.001),
        rate(ProviderUsageMetric.INPUT_TOKEN, 1_000, 0.002),
        rate(ProviderUsageMetric.OUTPUT_TOKEN, 1_000, 0.004),
      ],
      25_000,
      [ProviderUsageMetric.INPUT_TOKEN, ProviderUsageMetric.OUTPUT_TOKEN],
    );

    expect(estimate.costVnd).toBe(101);
    expect(estimate.missingMetrics).toEqual([]);
  });

  it("fails the estimate closed when a required price is missing", () => {
    const estimate = estimateProviderReservation(
      { promptTokens: 100, completionTokens: 100 },
      [rate(ProviderUsageMetric.INPUT_TOKEN, 1_000, 0.001)],
      25_000,
      [ProviderUsageMetric.INPUT_TOKEN, ProviderUsageMetric.OUTPUT_TOKEN],
    );

    expect(estimate.missingMetrics).toEqual([ProviderUsageMetric.OUTPUT_TOKEN]);
  });

  it("uses the configured local timezone at month boundaries", () => {
    const beforeLocalMonth = getProviderBudgetPeriod(
      new Date("2026-07-31T16:59:59.000Z"),
      "Asia/Ho_Chi_Minh",
    );
    const newLocalMonth = getProviderBudgetPeriod(
      new Date("2026-07-31T17:00:00.000Z"),
      "Asia/Ho_Chi_Minh",
    );

    expect(beforeLocalMonth.key).toBe("2026-07");
    expect(newLocalMonth).toMatchObject({
      key: "2026-08",
      start: new Date("2026-07-31T17:00:00.000Z"),
      end: new Date("2026-08-31T17:00:00.000Z"),
    });
  });

  it("does not call or fall back to a provider after a budget rejection", async () => {
    const aiService = { generateStructured: vi.fn() };
    const usage = {
      reserveAndStart: vi.fn(async () => {
        throw new ProviderBudgetError(
          providerBudgetErrorCodes.HARD_LIMIT,
          "Đã hết ngân sách.",
        );
      }),
      succeed: vi.fn(),
      fail: vi.fn(),
    };
    const candidate = (provider: AiProviderName) => ({
      catalogItemId: `${provider}-catalog`,
      priceVersionId: `${provider}-price`,
      category: ProviderCatalogCategory.AI_MODEL,
      provider,
      model: `${provider}-model`,
      maxInputTokens: 1_000,
      available: true,
      rates: [
        rate(ProviderUsageMetric.INPUT_TOKEN, 1_000_000, 1),
        rate(ProviderUsageMetric.OUTPUT_TOKEN, 1_000_000, 2),
      ],
    });
    const routing = {
      resolve: vi.fn(async () => ({
        feature: AiGenerationType.SUMMARY,
        version: 1,
        temperature: 0.2,
        maxOutputTokens: 100,
        candidates: [candidate(AiProviderName.OPENAI), candidate(AiProviderName.GEMINI)],
      })),
    };
    const service = new AiProviderCallService(
      aiService as never,
      routing as never,
      usage as never,
      { aiGeneration: { update: vi.fn() } } as never,
    );

    await expect(
      service.generateStructured(
        { feature: AiGenerationType.SUMMARY, backgroundJobId: "job-1" },
        {
          systemPrompt: "system",
          userPrompt: "user",
          outputName: "summary",
          promptVersion: "v1",
          schemaVersion: "v1",
        },
        z.object({ title: z.string() }),
      ),
    ).rejects.toBeInstanceOf(ProviderBudgetError);
    expect(usage.reserveAndStart).toHaveBeenCalledOnce();
    expect(aiService.generateStructured).not.toHaveBeenCalled();
    expect(usage.fail).not.toHaveBeenCalled();
  });

  it("passes extended reasoning effort from the route to the provider", async () => {
    const output = {
      data: { title: "Summary" },
      provider: AiProviderName.OPENAI,
      model: "gpt-5.6",
    };
    const aiService = { generateStructured: vi.fn(async () => output) };
    const usage = {
      reserveAndStart: vi.fn(async () => ({ id: "usage-1" })),
      succeed: vi.fn(async () => ({ costVnd: 0 })),
      fail: vi.fn(),
    };
    const service = new AiProviderCallService(
      aiService as never,
      { resolve: vi.fn() } as never,
      usage as never,
      { aiGeneration: { update: vi.fn() } } as never,
    );

    await service.generateStructured(
      {
        feature: AiGenerationType.SUMMARY,
        routeSnapshot: {
          feature: AiGenerationType.SUMMARY,
          version: 1,
          model: "gpt-5.6",
          temperature: null,
          reasoningEffort: "xhigh",
          maxOutputTokens: 8_000,
          candidates: [
            {
              catalogItemId: "openai-catalog",
              priceVersionId: "openai-price",
              category: ProviderCatalogCategory.AI_MODEL,
              provider: AiProviderName.OPENAI,
              model: "gpt-5.6",
              maxInputTokens: 32_000,
              available: true,
              rates: [
                rate(ProviderUsageMetric.INPUT_TOKEN, 1_000_000, 1),
                rate(ProviderUsageMetric.OUTPUT_TOKEN, 1_000_000, 2),
              ],
            },
          ],
          hasConfiguration: true,
        },
      },
      {
        systemPrompt: "system",
        userPrompt: "user",
        outputName: "summary",
        promptVersion: "v1",
        schemaVersion: "v1",
      },
      z.object({ title: z.string() }),
    );

    expect(aiService.generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({ reasoningEffort: "xhigh" }),
      expect.anything(),
      AiProviderName.OPENAI,
    );
  });
});

function rate(metric: ProviderUsageMetric, unitSize: number, unitPriceUsd: number) {
  return { metric, unitSize, unitPriceUsd, tierFrom: null, tierTo: null };
}
