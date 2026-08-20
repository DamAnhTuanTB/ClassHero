import {
  AiGenerationType,
  AiProviderName,
  Prisma,
  ProviderCatalogCategory,
  ProviderCatalogStatus,
  ProviderUsageMetric,
} from "@prisma/client";
import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

import { AiProviderCallService } from "#api/modules/ai/services/ai-provider-call.service";
import { AiModelRoutingService } from "#api/modules/provider-operations/services/ai-model-routing.service";
import { ProviderOperationsAdminService } from "#api/modules/provider-operations/services/provider-operations-admin.service";
import type { AiFeatureRoute } from "#api/modules/provider-operations/types/provider-operations.types";

describe("AI feature input limits", () => {
  it("requires both input and output limits when saving a configured feature", async () => {
    const prisma = {
      $transaction: vi.fn(async (callback: (transaction: object) => unknown) =>
        callback({}),
      ),
    };
    const service = new ProviderOperationsAdminService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.updateAiConfigurations("admin-user", {
        configurations: [
          {
            feature: AiGenerationType.SUMMARY,
            primaryCatalogItemId: "00000000-0000-4000-8000-000000000001",
            maxOutputTokens: 16_000,
            expectedVersion: 1,
          },
        ],
      }),
    ).rejects.toMatchObject({
      response: { code: "AI_CONFIGURATION_TOKEN_LIMIT_REQUIRED" },
    });
  });

  it("resolves maxInputTokens from the feature configuration", async () => {
    const routing = new AiModelRoutingService(
      {
        aiFeatureModelConfig: {
          findUnique: vi.fn(async () => ({
            version: 3,
            temperature: new Prisma.Decimal(0.2),
            reasoningEffort: null,
            maxInputTokens: 200_000,
            maxOutputTokens: 16_000,
            primaryCatalogItem: catalogItem(),
            fallbackCatalogItem: null,
          })),
        },
      } as never,
      configService() as never,
    );

    await expect(routing.resolve(AiGenerationType.SUMMARY)).resolves.toEqual(
      expect.objectContaining({
        maxInputTokens: 200_000,
        maxOutputTokens: 16_000,
      }),
    );
  });

  it("uses the feature input limit instead of legacy model metadata for reservation", async () => {
    const reserveAndStart = vi.fn(async () => ({ id: "usage-event" }));
    const usage = {
      reserveAndStart,
      succeed: vi.fn(async () => ({ costVnd: 0 })),
      fail: vi.fn(),
    };
    const service = new AiProviderCallService(
      {
        generateStructured: vi.fn(async () => ({
          data: { title: "Bài học" },
          usage: {
            promptTokens: 100,
            cachedInputTokens: 0,
            completionTokens: 20,
            totalTokens: 120,
          },
        })),
      } as never,
      {} as never,
      usage as never,
      {} as never,
    );
    const route: AiFeatureRoute = {
      feature: AiGenerationType.SUMMARY,
      version: 2,
      model: "gpt-4.1-mini",
      temperature: 0.2,
      reasoningEffort: null,
      maxInputTokens: 45_000,
      maxOutputTokens: 1_000,
      hasConfiguration: true,
      candidates: [
        {
          catalogItemId: "catalog-item",
          priceVersionId: "price-version",
          category: ProviderCatalogCategory.AI_MODEL,
          provider: AiProviderName.OPENAI,
          model: "gpt-4.1-mini",
          maxInputTokens: 30_000,
          available: true,
          rates: [
            {
              metric: ProviderUsageMetric.INPUT_TOKEN,
              unitSize: 1_000_000,
              unitPriceUsd: 0.4,
              tierFrom: null,
              tierTo: null,
            },
            {
              metric: ProviderUsageMetric.OUTPUT_TOKEN,
              unitSize: 1_000_000,
              unitPriceUsd: 1.6,
              tierFrom: null,
              tierTo: null,
            },
          ],
        },
      ],
    };

    await service.generateStructured(
      {
        feature: AiGenerationType.SUMMARY,
        routeSnapshot: route,
        allowProviderFallback: false,
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

    expect(reserveAndStart).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        usageUpperBound: {
          promptTokens: 45_000,
          completionTokens: 1_000,
        },
        estimateUnavailableReason: undefined,
      }),
    );
  });
});

function catalogItem() {
  return {
    id: "catalog-item",
    category: ProviderCatalogCategory.AI_MODEL,
    provider: AiProviderName.OPENAI,
    externalKey: "gpt-4.1-mini",
    status: ProviderCatalogStatus.ACTIVE,
    capabilitiesJson: { features: [AiGenerationType.SUMMARY] },
    priceVersions: [
      {
        id: "price-version",
        effectiveFrom: new Date("2026-08-20T00:00:00.000Z"),
        rates: [
          {
            metric: ProviderUsageMetric.INPUT_TOKEN,
            unitSize: new Prisma.Decimal(1_000_000),
            unitPriceUsd: new Prisma.Decimal(0.4),
            tierFrom: null,
            tierTo: null,
            conditionsJson: { maxInputTokens: 30_000 },
          },
        ],
      },
    ],
  };
}

function configService() {
  return {
    get: vi.fn((key: string) => (key === "OPENAI_API_KEY" ? "test-key" : undefined)),
  };
}
