import { ContentSource, ReviewStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { LessonSummariesService } from "#api/modules/learning-paths/services/lesson-summaries.service";

describe("LessonSummariesService file cleanup", () => {
  it("cleans detached figure assets when an admin deletes a Summary", async () => {
    const now = new Date("2026-09-04T00:00:00.000Z");
    const transaction = {
      lesson: { findFirst: vi.fn(async () => ({ id: "lesson-1" })) },
      lessonSummary: {
        findUnique: vi.fn(async () => ({
          id: "summary-1",
          lessonId: "lesson-1",
          contentJson: {
            type: "lesson_summary_blocks",
            version: 3,
            data: {
              lessonId: "lesson-1",
              title: "Bài học",
              objectives: null,
              sections: [
                {
                  order: 1,
                  displayHeading: "Phần 1",
                  sourceEvidence: {
                    kind: "CONTENT",
                    text: "Nguồn 1",
                    packetPageNumbers: [1],
                  },
                  blocks: [
                    {
                      type: "knowledge",
                      title: "Kiến thức 1",
                      content: "Nội dung 1",
                      figures: [],
                    },
                  ],
                },
                {
                  order: 2,
                  displayHeading: "Phần 2",
                  sourceEvidence: {
                    kind: "CONTENT",
                    text: "Nguồn 2",
                    packetPageNumbers: [1],
                  },
                  blocks: [
                    {
                      type: "knowledge",
                      title: "Kiến thức 2",
                      content: "Nội dung 2",
                      figures: [],
                    },
                  ],
                },
              ],
            },
          },
          source: ContentSource.AI,
          reviewStatus: ReviewStatus.NEEDS_REVIEW,
          aiGenerationId: "generation-1",
          createdById: "actor-1",
          updatedById: "actor-1",
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          stemFigures: [
            {
              revisions: [
                { deliveryFileId: "file-1" },
                { deliveryFileId: "file-1" },
                { deliveryFileId: null },
              ],
            },
          ],
        })),
        delete: vi.fn(async () => ({ id: "summary-1" })),
      },
      auditLog: { create: vi.fn(async () => ({ id: "audit-1" })) },
    };
    const prisma = {
      $transaction: vi.fn(
        async (callback: (tx: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    };
    const fileCleanup = {
      stageDetachedFigureFiles: vi.fn(async () => ["file-1"]),
      deleteStagedFiles: vi.fn(async () => ({
        deletedFileCount: 1,
        pendingFileCleanupCount: 0,
      })),
    };
    const service = new LessonSummariesService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      fileCleanup as never,
    );

    await expect(service.deleteForAdmin("lesson-1", "actor-1")).resolves.toEqual({
      deleted: true,
      deletedFileCount: 1,
      pendingFileCleanupCount: 0,
    });
    expect(transaction.lessonSummary.delete).toHaveBeenCalledWith({
      where: { id: "summary-1" },
    });
    expect(fileCleanup.stageDetachedFigureFiles).toHaveBeenCalledWith(transaction, [
      "file-1",
      "file-1",
    ]);
    expect(fileCleanup.deleteStagedFiles).toHaveBeenCalledWith(["file-1"]);
  });
});
