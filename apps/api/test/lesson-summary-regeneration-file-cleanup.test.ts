import { ContentSource, ReviewStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { LessonSummaryGenerationService } from "#api/workers/services/lesson-summary-generation.service";

describe("LessonSummaryGenerationService file cleanup", () => {
  it("cleans files from the replaced Summary only after the new Summary persists", async () => {
    const transaction = {
      lesson: { findFirst: vi.fn(async () => ({ id: "lesson-1" })) },
      lessonSummary: {
        findUnique: vi.fn(async () => ({
          id: "summary-1",
          aiGenerationId: "old-generation",
          stemFigures: [
            {
              revisions: [
                { deliveryFileId: "old-file-1" },
                { deliveryFileId: "old-file-1" },
              ],
            },
          ],
        })),
        upsert: vi.fn(async () => ({ id: "summary-1" })),
        update: vi.fn(async () => ({
          id: "summary-1",
          lessonId: "lesson-1",
          source: ContentSource.AI,
          reviewStatus: ReviewStatus.NEEDS_REVIEW,
          aiGenerationId: "new-generation",
          updatedAt: new Date("2026-09-04T00:00:00.000Z"),
        })),
      },
      stemFigure: {
        deleteMany: vi.fn(async () => ({ count: 1 })),
        create: vi.fn(),
        update: vi.fn(),
      },
      stemFigureRevision: { create: vi.fn() },
      auditLog: { create: vi.fn(async () => ({ id: "audit-1" })) },
    };
    const prisma = {
      $transaction: vi.fn(
        async (callback: (tx: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    };
    const figureReferences = { resolveMany: vi.fn(async () => []) };
    const fileCleanup = {
      stageDetachedFigureFiles: vi.fn(async () => ["old-file-1"]),
      deleteStagedFiles: vi.fn(async () => ({
        deletedFileCount: 1,
        pendingFileCleanupCount: 0,
      })),
    };
    const service = new LessonSummaryGenerationService(
      prisma as never,
      {} as never,
      {} as never,
      { enqueue: vi.fn() } as never,
      figureReferences as never,
      {} as never,
      undefined,
      fileCleanup as never,
    );
    const summaryOutput = {
      lessonId: "lesson-1",
      targetGrade: 10,
      title: "Bài học mới",
      objectives: null,
      sections: [
        {
          order: 1,
          displayHeading: "Phần 1",
          sourceEvidence: {
            kind: "CONTENT",
            text: "Nội dung trang 1",
            packetPageNumbers: [1],
          },
          blocks: [
            {
              type: "knowledge",
              title: "Kiến thức 1",
              content: "Nội dung mới 1",
              figures: [],
            },
          ],
        },
        {
          order: 2,
          displayHeading: "Phần 2",
          sourceEvidence: {
            kind: "CONTENT",
            text: "Nội dung trang 1",
            packetPageNumbers: [1],
          },
          blocks: [
            {
              type: "knowledge",
              title: "Kiến thức 2",
              content: "Nội dung mới 2",
              figures: [],
            },
          ],
        },
      ],
      warnings: null,
      reviewIssues: [],
    };

    await service.persist(
      {
        lessonId: "lesson-1",
        aiGenerationId: "new-generation",
        backgroundJobId: "job-1",
        ownerUserId: "actor-1",
        inputMeta: {},
      } as never,
      {
        action: "SUMMARY",
        output: { data: summaryOutput },
        contextMetadata: {
          figures: [],
          subject: { key: "MATH", name: "Toán", slug: "toan" },
          targetGrade: 10,
          packetManifest: {
            version: 1,
            lessonId: "lesson-1",
            packetHash: "packet-hash",
            pageCount: 1,
            pages: [
              {
                packetPageNumber: 1,
                sourceKey: "D01",
                lessonDocumentId: "lesson-document-1",
                sourceDocumentId: null,
                sourceFileId: "source-file-1",
                sourcePdfPageNumber: 1,
                printedPageLabel: "1",
                pageRangeId: null,
                documentTitle: "SGK",
                segmentOrder: 0,
              },
            ],
          },
        },
      } as never,
    );

    expect(transaction.lessonSummary.upsert).toHaveBeenCalledOnce();
    expect(transaction.stemFigure.deleteMany).toHaveBeenCalledWith({
      where: { lessonSummaryId: "summary-1" },
    });
    expect(fileCleanup.stageDetachedFigureFiles).toHaveBeenCalledWith(transaction, [
      "old-file-1",
      "old-file-1",
    ]);
    expect(fileCleanup.deleteStagedFiles).toHaveBeenCalledWith(["old-file-1"]);
    expect(transaction.lessonSummary.upsert.mock.invocationCallOrder[0]).toBeLessThan(
      fileCleanup.deleteStagedFiles.mock.invocationCallOrder[0]!,
    );
  });
});
