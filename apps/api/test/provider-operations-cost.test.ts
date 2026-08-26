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
import { AiProviderOutputError } from "#api/modules/ai/utils/ai-output-validation";
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

  it("prices GPT-5.6 cache writes at 1.25x regular input", () => {
    const result = calculateProviderCost(
      {
        promptTokens: 1_000_000,
        cachedInputTokens: 200_000,
        cacheWriteInputTokens: 300_000,
        completionTokens: 0,
      },
      [
        rate(ProviderUsageMetric.INPUT_TOKEN, 1_000_000, 1),
        rate(ProviderUsageMetric.CACHED_INPUT_TOKEN, 1_000_000, 0.1),
      ],
      25_000,
    );

    expect(result.costUsd).toBe(0.895);
    expect(result.costVnd).toBe(22_375);
  });

  it("reserves the 1.25x worst case when every input token may be a cache write", () => {
    const estimate = estimateProviderReservation(
      { promptTokens: 1_000, cacheWriteInputTokens: 1_000 },
      [rate(ProviderUsageMetric.INPUT_TOKEN, 1_000, 1)],
      25_000,
      [ProviderUsageMetric.INPUT_TOKEN],
    );

    expect(estimate.costUsd).toBe(1.25);
    expect(estimate.costVnd).toBe(31_250);
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
      usage: {
        promptTokens: 1_579,
        cachedInputTokens: 0,
        cacheWriteInputTokens: 1_400,
        completionTokens: 1_930,
        reasoningTokens: 1_258,
        totalTokens: 3_509,
      },
      providerUsageRaw: {
        input_tokens: 1_579,
        input_tokens_details: {
          cached_tokens: 0,
          cache_write_tokens: 1_400,
        },
        output_tokens: 1_930,
        output_tokens_details: { reasoning_tokens: 1_258 },
        total_tokens: 3_509,
      },
      inputFileOperations: [
        {
          providerFileId: "file-packet-1",
          uploadLatencyMs: 25,
          cleanupStatus: "deleted" as const,
        },
      ],
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
    const onResolvedRequest = vi.fn(async () => undefined);

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
        onResolvedRequest,
      },
      {
        systemPrompt: "system",
        userPrompt: "user",
        outputName: "summary",
        promptVersion: "v1",
        schemaVersion: "v1",
        promptCache: {
          namespace: "ls",
          keyEnabled: true,
          retention: "in_memory",
        },
      },
      z.object({ title: z.string() }),
    );

    expect(aiService.generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({ reasoningEffort: "xhigh" }),
      expect.anything(),
      AiProviderName.OPENAI,
    );
    expect(usage.reserveAndStart).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        usageUpperBound: expect.objectContaining({
          promptTokens: 32_000,
          cacheWriteInputTokens: 32_000,
        }),
      }),
    );
    expect(onResolvedRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: AiProviderName.OPENAI,
        model: "gpt-5.6",
        reasoningEffort: "xhigh",
        maxOutputTokens: 8_000,
        promptVersion: "v1",
        schemaVersion: "v1",
        resolvedSchemaReferenceStrategy: "inline",
        schemaBytes: expect.any(Number),
        inputTokenEstimate: expect.objectContaining({
          textInputTokens: expect.any(Number),
          imageInputTokens: 0,
          estimatedTokens: expect.any(Number),
        }),
        textFormat: expect.objectContaining({ type: "json_schema" }),
      }),
    );
    expect(usage.succeed).toHaveBeenCalledWith(
      "usage-1",
      expect.objectContaining({
        promptTokens: 1_579,
        cacheWriteInputTokens: 1_400,
        completionTokens: 1_930,
        totalTokens: 3_509,
        rawUsage: {
          providerUsage: {
            input_tokens: 1_579,
            input_tokens_details: {
              cached_tokens: 0,
              cache_write_tokens: 1_400,
            },
            output_tokens: 1_930,
            output_tokens_details: { reasoning_tokens: 1_258 },
            total_tokens: 3_509,
          },
          fileOperations: [
            {
              providerFileId: "file-packet-1",
              uploadLatencyMs: 25,
              cleanupStatus: "deleted",
            },
          ],
        },
      }),
    );
  });

  it("aggregates every paid figure call into the parent generation cost", async () => {
    const candidate = {
      catalogItemId: "openai-catalog",
      priceVersionId: "openai-price",
      category: ProviderCatalogCategory.AI_MODEL,
      provider: AiProviderName.OPENAI,
      model: "gpt-5.4",
      maxInputTokens: 32_000,
      available: true,
      rates: [
        rate(ProviderUsageMetric.INPUT_TOKEN, 1_000_000, 1),
        rate(ProviderUsageMetric.OUTPUT_TOKEN, 1_000_000, 2),
      ],
    };
    const route = {
      feature: AiGenerationType.SUMMARY,
      version: 1,
      model: "gpt-5.4",
      temperature: null,
      reasoningEffort: "medium",
      maxOutputTokens: 6_000,
      candidates: [candidate],
      hasConfiguration: true,
    };
    const aiService = {
      generateStructured: vi.fn(async () => ({
        data: { title: "Figure" },
        provider: AiProviderName.OPENAI,
        model: "gpt-5.4",
      })),
    };
    const usage = {
      reserveAndStart: vi
        .fn()
        .mockResolvedValueOnce({ id: "usage-figure-1" })
        .mockResolvedValueOnce({ id: "usage-figure-2" }),
      succeed: vi
        .fn()
        .mockResolvedValueOnce({ costVnd: 400 })
        .mockResolvedValueOnce({ costVnd: 600 }),
      fail: vi.fn(),
    };
    const aggregate = vi
      .fn()
      .mockResolvedValueOnce({ _sum: { costVnd: 400 } })
      .mockResolvedValueOnce({ _sum: { costVnd: 1_000 } });
    const update = vi.fn();
    const service = new AiProviderCallService(
      aiService as never,
      { resolve: vi.fn() } as never,
      usage as never,
      {
        providerUsageEvent: { aggregate },
        aiGeneration: { update },
      } as never,
    );

    for (const figureId of ["figure-1", "figure-2"]) {
      await service.generateStructured(
        {
          feature: AiGenerationType.SUMMARY,
          aiGenerationId: "generation-with-two-figures",
          backgroundJobId: `job-${figureId}`,
          routeSnapshot: route,
          idempotencyKey: `stem-figure-create-new:${figureId}`,
        },
        {
          systemPrompt: "Draw one figure.",
          userPrompt: figureId,
          outputName: "new_stem_figure",
          promptVersion: "v1",
          schemaVersion: "v1",
        },
        z.object({ title: z.string() }),
      );
    }

    expect(aggregate).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenNthCalledWith(1, {
      where: { id: "generation-with-two-figures" },
      data: { estimatedCostVnd: 400 },
    });
    expect(update).toHaveBeenNthCalledWith(2, {
      where: { id: "generation-with-two-figures" },
      data: { estimatedCostVnd: 1_000 },
    });
  });

  it("settles and assigns measured cost when a structured response is incomplete", async () => {
    const providerError = new AiProviderOutputError(
      "OPENAI_INCOMPLETE_MAX_OUTPUT_TOKENS",
      "OpenAI đã dừng vì chạm giới hạn token đầu ra.",
      {
        provider: AiProviderName.OPENAI,
        model: "gpt-5.1",
        providerRequestId: "resp-incomplete",
        responseStatus: "incomplete",
        incompleteReason: "max_output_tokens",
        hasRefusal: false,
        maxOutputTokens: 16_000,
        latencyMs: 2_000,
        usage: {
          promptTokens: 100,
          completionTokens: 16_000,
          totalTokens: 16_100,
        },
      },
    );
    const aiService = {
      generateStructured: vi.fn(async () => Promise.reject(providerError)),
    };
    const rates = [
      rate(ProviderUsageMetric.INPUT_TOKEN, 1_000_000, 1),
      rate(ProviderUsageMetric.OUTPUT_TOKEN, 1_000_000, 2),
    ];
    const usage = {
      reserveAndStart: vi.fn(async () => ({ id: "usage-incomplete" })),
      succeed: vi.fn(),
      fail: vi.fn(async () => ({ costVnd: 815, costMeasured: true })),
    };
    const update = vi.fn();
    const service = new AiProviderCallService(
      aiService as never,
      { resolve: vi.fn() } as never,
      usage as never,
      { aiGeneration: { update } } as never,
    );

    await expect(
      service.generateStructured(
        {
          feature: AiGenerationType.SUMMARY,
          aiGenerationId: "generation-incomplete",
          backgroundJobId: "job-incomplete",
          routeSnapshot: {
            feature: AiGenerationType.SUMMARY,
            version: 1,
            model: "gpt-5.1",
            temperature: null,
            reasoningEffort: "medium",
            maxOutputTokens: 16_000,
            candidates: [
              {
                catalogItemId: "openai-catalog",
                priceVersionId: "openai-price",
                category: ProviderCatalogCategory.AI_MODEL,
                provider: AiProviderName.OPENAI,
                model: "gpt-5.1",
                maxInputTokens: 32_000,
                available: true,
                rates,
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
      ),
    ).rejects.toBe(providerError);
    expect(usage.fail).toHaveBeenCalledWith("usage-incomplete", providerError, { rates });
    expect(update).toHaveBeenCalledWith({
      where: { id: "generation-incomplete" },
      data: { estimatedCostVnd: 815 },
    });
    expect(usage.succeed).not.toHaveBeenCalled();
  });

  it("does not overwrite generation cost when failed response usage is unknown", async () => {
    const providerError = new AiProviderOutputError(
      "OPENAI_STRUCTURED_OUTPUT_MISSING",
      "OpenAI không trả về dữ liệu có cấu trúc hoàn chỉnh.",
      {
        provider: AiProviderName.OPENAI,
        model: "gpt-5.1",
        providerRequestId: "resp-missing-usage",
        responseStatus: "completed",
        incompleteReason: null,
        hasRefusal: false,
      },
    );
    const usage = {
      reserveAndStart: vi.fn(async () => ({ id: "usage-missing" })),
      succeed: vi.fn(),
      fail: vi.fn(async () => ({ costVnd: 0, costMeasured: false })),
    };
    const update = vi.fn();
    const service = new AiProviderCallService(
      {
        generateStructured: vi.fn(async () => Promise.reject(providerError)),
      } as never,
      { resolve: vi.fn() } as never,
      usage as never,
      { aiGeneration: { update } } as never,
    );

    await expect(
      service.generateStructured(
        {
          feature: AiGenerationType.SUMMARY,
          aiGenerationId: "generation-missing",
          routeSnapshot: {
            feature: AiGenerationType.SUMMARY,
            version: 1,
            model: "gpt-5.1",
            temperature: null,
            reasoningEffort: "medium",
            maxOutputTokens: 16_000,
            candidates: [
              {
                catalogItemId: "openai-catalog",
                priceVersionId: "openai-price",
                category: ProviderCatalogCategory.AI_MODEL,
                provider: AiProviderName.OPENAI,
                model: "gpt-5.1",
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
      ),
    ).rejects.toBe(providerError);
    expect(update).not.toHaveBeenCalled();
  });

  it("disables provider fallback for the compiler-only figure retry contract", async () => {
    const transient = Object.assign(new Error("provider unavailable"), { status: 503 });
    const aiService = {
      generateStructured: vi.fn(async () => Promise.reject(transient)),
    };
    const usage = {
      reserveAndStart: vi.fn(async () => ({ id: "usage-no-fallback" })),
      succeed: vi.fn(),
      fail: vi.fn(async () => ({ costVnd: 0, costMeasured: false })),
    };
    const candidate = (provider: AiProviderName) => ({
      catalogItemId: `${provider}-catalog`,
      priceVersionId: `${provider}-price`,
      category: ProviderCatalogCategory.AI_MODEL,
      provider,
      model: `${provider}-model`,
      maxInputTokens: 32_000,
      available: true,
      rates: [
        rate(ProviderUsageMetric.INPUT_TOKEN, 1_000_000, 1),
        rate(ProviderUsageMetric.OUTPUT_TOKEN, 1_000_000, 2),
      ],
    });
    const service = new AiProviderCallService(
      aiService as never,
      { resolve: vi.fn() } as never,
      usage as never,
      { aiGeneration: { update: vi.fn() } } as never,
    );

    await expect(
      service.generateStructured(
        {
          feature: AiGenerationType.SUMMARY,
          allowProviderFallback: false,
          routeSnapshot: {
            feature: AiGenerationType.SUMMARY,
            version: 1,
            model: "OPENAI-model",
            temperature: null,
            reasoningEffort: "medium",
            maxOutputTokens: 8_000,
            candidates: [
              candidate(AiProviderName.OPENAI),
              candidate(AiProviderName.GEMINI),
            ],
            hasConfiguration: true,
          },
        },
        {
          systemPrompt: "system",
          userPrompt: "user",
          outputName: "figure",
          promptVersion: "v1",
          schemaVersion: "v1",
        },
        z.object({ title: z.string() }),
      ),
    ).rejects.toBe(transient);
    expect(aiService.generateStructured).toHaveBeenCalledOnce();
    expect(usage.reserveAndStart).toHaveBeenCalledOnce();
    expect(usage.fail).toHaveBeenCalledOnce();
  });
});

function rate(metric: ProviderUsageMetric, unitSize: number, unitPriceUsd: number) {
  return { metric, unitSize, unitPriceUsd, tierFrom: null, tierTo: null };
}
