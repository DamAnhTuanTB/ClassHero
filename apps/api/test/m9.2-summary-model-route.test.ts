import {
  AiGenerationType,
  AiProviderName,
  ProviderCatalogCategory,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { LessonSummariesService } from "#api/modules/learning-paths/services/lesson-summaries.service";
import type { AiFeatureRoute } from "#api/modules/provider-operations/types/provider-operations.types";

describe("M9.2 lesson summary model route", () => {
  it("keeps the route model aligned with an explicitly selected candidate", async () => {
    const baseRoute: AiFeatureRoute = {
      feature: AiGenerationType.SUMMARY,
      version: 4,
      model: "gpt-5.6-luna",
      temperature: null,
      reasoningEffort: null,
      maxOutputTokens: 16_000,
      candidates: [candidate("gpt-5.6-luna")],
      hasConfiguration: true,
    };
    const selectedCandidate = candidate("gpt-4.1");
    const modelRouting = {
      resolve: vi.fn(async () => baseRoute),
      resolveCandidateByModel: vi.fn(async () => selectedCandidate),
    };
    const service = new LessonSummariesService(
      {} as never,
      {} as never,
      {} as never,
      modelRouting as never,
      {} as never,
      {} as never,
    );

    const { route } = await (
      service as unknown as {
        resolveSummaryRoute(input: {
          model: string;
          maxOutputTokens: number;
        }): Promise<{ route: AiFeatureRoute }>;
      }
    ).resolveSummaryRoute({ model: "gpt-4.1", maxOutputTokens: 16_000 });

    expect(route.model).toBe("gpt-4.1");
    expect(route.candidates).toEqual([selectedCandidate]);
  });
});

function candidate(model: string) {
  return {
    catalogItemId: `catalog-${model}`,
    priceVersionId: `price-${model}`,
    category: ProviderCatalogCategory.AI_MODEL,
    provider: AiProviderName.OPENAI,
    model,
    maxInputTokens: 30_000,
    available: true,
    capabilitiesJson: {
      pdfInput: true,
      pdfDetailLevels: ["high"],
    },
    rates: [],
  };
}
