import "reflect-metadata";

import {
  AiGenerationType,
  Prisma,
  ProviderCatalogCategory,
  ProviderUsageStatus,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { ProviderUsageEventsQueryDto } from "#api/modules/provider-operations/dto/provider-operations-query.dto";
import { ProviderOperationsAdminService } from "#api/modules/provider-operations/services/provider-operations-admin.service";

describe("ProviderOperationsAdminService usage events", () => {
  it("returns both provider-call cost and parent generation total", async () => {
    const aiGenerationId = "2abfd94b-39fe-43b4-b3c1-65e91d237ac0";
    const findMany = vi.fn(async () => [
      {
        id: "usage-figure",
        category: ProviderCatalogCategory.AI_MODEL,
        provider: "OPENAI",
        feature: AiGenerationType.SUMMARY,
        status: ProviderUsageStatus.SUCCEEDED,
        costVnd: 179,
        estimatedCostUsd: new Prisma.Decimal("0.007"),
        fxRateVndPerUsd: new Prisma.Decimal("25500"),
        estimatedSavedCostUsd: new Prisma.Decimal(0),
        catalogItem: { displayName: "GPT-5.6 Terra", externalKey: "gpt-5.6-terra" },
        priceVersion: null,
        backgroundJob: { queue: "DIAGRAM_RENDERING", resourceType: "STEM_FIGURE" },
        aiGeneration: {
          id: aiGenerationId,
          type: AiGenerationType.SUMMARY,
        },
      },
    ]);
    const prisma = {
      providerUsageEvent: {
        findMany,
        count: vi.fn(async () => 1),
        aggregate: vi.fn(async () => ({ _sum: { costVnd: 179 } })),
        groupBy: vi.fn(async () => [
          {
            aiGenerationId,
            _sum: { costVnd: 1_096 },
            _count: { _all: 9 },
          },
        ]),
      },
    };
    const service = new ProviderOperationsAdminService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const query = new ProviderUsageEventsQueryDto();
    query.aiGenerationId = aiGenerationId;

    const result = await service.events(query);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ aiGenerationId }),
        include: expect.objectContaining({
          backgroundJob: expect.any(Object),
          aiGeneration: expect.any(Object),
        }),
      }),
    );
    expect(result.items[0]).toMatchObject({
      costVnd: 179,
      backgroundJob: { resourceType: "STEM_FIGURE" },
      aiGeneration: {
        id: aiGenerationId,
        totalCostVnd: 1_096,
        usageEventCount: 9,
      },
    });
    expect(result.summary).toEqual({ totalCostVnd: 179, totalCalls: 1 });
    expect(findMany.mock.calls[0]?.[0].where).not.toHaveProperty("createdAt");
  });
});
