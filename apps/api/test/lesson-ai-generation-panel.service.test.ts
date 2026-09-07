import { AiGenerationType, AiProviderName, DocumentStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "#api/common/prisma/prisma.service";
import { LessonAiGenerationPanelService } from "#api/modules/learning-paths/services/lesson-ai-generation-panel.service";

describe("LessonAiGenerationPanelService", () => {
  it("uses confirmed printed-page numbers for an extracted document range", async () => {
    const prisma = {
      lesson: {
        findFirst: vi.fn(async () => ({
          id: "lesson-1",
          title: "Bài học",
          learningPath: {
            domain: { name: "Toán", slug: "toan" },
            targetAudiences: [],
          },
          documents: [
            {
              id: "document-1",
              title: "Toán 12 tập 2",
              kind: "PRIMARY_FROM_SOURCE",
              status: DocumentStatus.READY,
              chunkCount: 2,
              embeddingProvider: AiProviderName.OPENAI,
              embeddingModel: "text-embedding-3-small",
              embeddingDimensions: 1536,
              activeOcrArtifactId: "ocr-1",
              sourceDocumentId: "source-1",
              file: {
                originalName: "toan-12-tap-2.pdf",
                mimeType: "application/pdf",
                checksum: "checksum-1",
                status: "READY",
              },
              pageRange: {
                pageStart: 30,
                pageEnd: 41,
              },
              sourceDocument: {
                status: DocumentStatus.READY,
                activeOcrArtifactId: "ocr-1",
              },
            },
            {
              id: "document-uploaded-primary",
              title: "Phiếu mua hàng",
              kind: "PRIMARY_FROM_SOURCE",
              status: DocumentStatus.READY,
              chunkCount: 0,
              embeddingProvider: null,
              embeddingModel: null,
              embeddingDimensions: null,
              activeOcrArtifactId: null,
              sourceDocumentId: null,
              file: {
                originalName: "receipt.pdf",
                mimeType: "application/pdf",
                checksum: "checksum-uploaded-primary",
                status: "READY",
              },
              pageRange: null,
              sourceDocument: null,
            },
          ],
        })),
      },
      sourceDocumentPage: {
        findMany: vi.fn(async () => [
          {
            sourceDocumentId: "source-1",
            pageNumber: 30,
            metadataJson: { printedPage: { printedPageNumber: 29 } },
          },
          {
            sourceDocumentId: "source-1",
            pageNumber: 41,
            metadataJson: { printedPage: { printedPageNumber: 40 } },
          },
        ]),
      },
      aiGeneration: {
        findFirst: vi.fn(async ({ where }: { where: { type: AiGenerationType } }) =>
          where.type === AiGenerationType.SUMMARY
            ? {
                id: "generation-summary",
                type: AiGenerationType.SUMMARY,
                status: "SUCCEEDED",
                errorMessage: null,
                createdAt: new Date("2026-08-17T08:00:00.000Z"),
                startedAt: new Date("2026-08-17T08:00:01.000Z"),
                finishedAt: new Date("2026-08-17T08:01:00.000Z"),
                model: "gpt-pdf",
                latencyMs: 59_000,
                estimatedCostVnd: 1_030,
                inputMetaJson: null,
                providerUsageEvents: [
                  { costVnd: 120 },
                  { costVnd: 110 },
                  { costVnd: 100 },
                  { costVnd: 90 },
                  { costVnd: 130 },
                  { costVnd: 140 },
                  { costVnd: 160 },
                  { costVnd: 180 },
                  { costVnd: 66 },
                ],
                backgroundJob: null,
                lessonSummaries: [],
                quizSets: [],
                flashcardSets: [],
                testSets: [],
              }
            : null,
        ),
      },
    };
    const aiService = {
      getEmbeddingConfig: () => ({
        model: "text-embedding-3-small",
        dimensions: 1536,
      }),
    };
    const modelRouting = {
      resolve: vi.fn(async () => ({
        candidates: [
          {
            provider: "OPENAI",
            model: "gpt-pdf",
            available: true,
            capabilitiesJson: {
              pdfInput: true,
              pdfDetailLevels: ["high"],
            },
          },
        ],
        hasConfiguration: true,
        temperature: null,
        reasoningEffort: null,
        maxOutputTokens: 20_000,
      })),
      getAllActiveModels: vi.fn(async () => [
        {
          provider: "OPENAI",
          model: "gpt-pdf",
          available: true,
          capabilitiesJson: {
            pdfInput: true,
            pdfDetailLevels: ["high"],
          },
        },
      ]),
    };
    const service = new LessonAiGenerationPanelService(
      prisma as unknown as PrismaService,
      aiService as never,
      modelRouting as never,
    );

    const panel = await service.getForAdmin("lesson-1");

    expect(prisma.aiGeneration.findFirst).toHaveBeenCalledTimes(4);
    expect(panel.documents[0]?.pageRange).toEqual({ pageStart: 29, pageEnd: 40 });
    expect(panel.documents[1]).toMatchObject({
      title: "Phiếu mua hàng",
      chunkCount: 0,
      pageRange: null,
      embeddingReady: false,
      canUseForSummary: true,
      canUseForQuiz: true,
      unavailableReason: null,
      quizUnavailableReason: null,
    });
    expect(panel.summaryConfiguration).toMatchObject({
      isDefaultConfigured: true,
      resolvedProvider: "OPENAI",
      resolvedModel: "gpt-pdf",
      modelOptions: [expect.objectContaining({ model: "gpt-pdf" })],
    });
    expect(panel.quizConfiguration).toMatchObject({
      isDefaultConfigured: true,
      resolvedProvider: "OPENAI",
      resolvedModel: "gpt-pdf",
      modelOptions: [expect.objectContaining({ model: "gpt-pdf" })],
    });
    expect(panel.readiness).toMatchObject({
      quizReady: true,
      quizReason: null,
    });
    expect(panel.lesson.subjectKey).toBe("MATH");
    expect(panel.jobs.SUMMARY).toMatchObject({
      aiGenerationId: "generation-summary",
      estimatedCostVnd: 1_096,
      usageEventCount: 9,
    });
  });
});
