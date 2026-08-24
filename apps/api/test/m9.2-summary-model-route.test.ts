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

  it("persists and exposes requested/resolved schema strategy with schema bytes", async () => {
    const route: AiFeatureRoute = {
      feature: AiGenerationType.SUMMARY,
      version: 4,
      model: "gpt-5.6-luna",
      temperature: 0.2,
      reasoningEffort: null,
      maxOutputTokens: 16_000,
      candidates: [candidate("gpt-5.6-luna")],
      hasConfiguration: true,
    };
    const createDraft = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "00000000-0000-4000-8000-000000000099",
      ...data,
    }));
    const prisma = {
      lessonSummaryRequestDraft: {
        findMany: vi.fn(async () => []),
        deleteMany: vi.fn(async () => ({ count: 0 })),
        create: createDraft,
      },
      providerAccountingSetting: { findUnique: vi.fn(async () => null) },
    };
    const sourceContext = {
      lessonTitle: "Hệ thức lượng",
      targetGrade: 9,
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      documentIds: ["00000000-0000-4000-8000-000000000003"],
      sourceHash: "a".repeat(64),
      packet: {
        filename: "lesson-source-packet.pdf",
        bytes: Buffer.from("%PDF-test"),
        packetHash: "b".repeat(64),
        manifestHash: "c".repeat(64),
        objectKey: "lesson-source-packets/test.pdf",
        modelManifest: {
          version: 1,
          pages: [
            {
              packetPageNumber: 1,
              sourceKey: "source-1",
              documentTitle: "Toán 9",
              sourcePdfPageNumber: 12,
              printedPageLabel: "12",
            },
          ],
        },
        manifest: {
          version: 1,
          lessonId: "00000000-0000-4000-8000-000000000001",
          packetHash: "b".repeat(64),
          pageCount: 1,
          pages: [
            {
              packetPageNumber: 1,
              sourceKey: "source-1",
              lessonDocumentId: "00000000-0000-4000-8000-000000000003",
              sourceDocumentId: null,
              sourceFileId: "00000000-0000-4000-8000-000000000004",
              sourcePdfPageNumber: 12,
              printedPageLabel: "12",
              pageRangeId: null,
              documentTitle: "Toán 9",
              segmentOrder: 1,
            },
          ],
        },
        sourceSnapshot: { version: 1 },
      },
    };
    const config = {
      get: vi.fn((key: string) => {
        if (key === "AI_SUMMARY_SCHEMA_REFERENCE_STRATEGY") return "ref_v2";
        if (key === "AI_SUMMARY_PROMPT_CACHE_KEY_ENABLED") return false;
        if (key === "AI_SUMMARY_PROMPT_CACHE_RETENTION") return undefined;
        if (key === "AI_SUMMARY_REQUEST_DRAFT_TTL_SECONDS") return 900;
        throw new Error(`Unexpected config key: ${key}`);
      }),
    };
    const modelRouting = {
      resolve: vi.fn(async () => route),
      getAllActiveModels: vi.fn(async () => route.candidates),
    };
    const service = new LessonSummariesService(
      prisma as never,
      {} as never,
      { loadPacket: vi.fn(async () => sourceContext) } as never,
      modelRouting as never,
      config as never,
      { cleanup: vi.fn(async () => undefined) } as never,
    );

    const preview = await service.previewPrompt(
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
      {
        documentIds: sourceContext.documentIds,
        style: "student_friendly",
      },
    );
    const persistedModelConfig = createDraft.mock.calls[0]?.[0].data
      .modelConfigJson as Record<string, unknown>;

    expect(preview.configuration.schemaReferenceStrategy).toBe("ref_v2");
    expect(preview.configuration.resolvedSchemaReferenceStrategy).toBe("ref_v2");
    expect(preview.configuration.schemaBytes).toBeGreaterThan(0);
    expect(persistedModelConfig).toMatchObject({
      schemaReferenceStrategy: "ref_v2",
      resolvedSchemaReferenceStrategy: "ref_v2",
      schemaBytes: preview.configuration.schemaBytes,
    });
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
