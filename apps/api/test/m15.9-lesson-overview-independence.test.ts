import { BadRequestException } from "@nestjs/common";
import { LessonType, PublishStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "#api/common/prisma/prisma.service";
import { LessonsService } from "#api/modules/learning-paths/services/lessons.service";
import type { LearningPathStructureService } from "#api/modules/learning-paths/services/learning-path-structure.service";
import type { SourceDocumentsService } from "#api/modules/learning-paths/services/source-documents.service";

const lessonId = "00000000-0000-0000-0000-000000000003";
const learningPathId = "00000000-0000-0000-0000-000000000001";

function createLessonRecord() {
  const now = new Date("2026-09-10T08:00:00.000Z");
  return {
    id: lessonId,
    learningPathId,
    chapterId: null,
    orderIndex: 1,
    title: "Bài 1",
    shortDescription: "Tổng quan cũ",
    overviewContentJson: null,
    lessonType: LessonType.BASIC,
    liveUrl: null,
    scheduledAt: null,
    examOpenAt: null,
    videoUrl: "https://youtube.com/watch?v=demo",
    customVideoSettings: null,
    completionMinScore: 7,
    trialEnabled: false,
    status: PublishStatus.PUBLISHED,
    createdById: "admin-id",
    updatedById: "admin-id",
    createdAt: now,
    updatedAt: now,
    _count: { progressEntries: 0 },
  };
}

describe("M15.9 lesson overview independence", () => {
  it("persists lesson overview through the lesson record only", async () => {
    const before = createLessonRecord();
    const overviewContentJson = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Tổng quan buổi học mới" }],
        },
      ],
    };
    const lessonUpdate = vi.fn().mockImplementation(({ data }) => ({
      ...before,
      ...data,
    }));
    const transaction = {
      lesson: {
        findFirst: vi.fn().mockResolvedValue(before),
        update: lessonUpdate,
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: "audit-id" }),
      },
    };
    const prisma = {
      $transaction: vi.fn(
        async (callback: (tx: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    };
    const service = new LessonsService(
      prisma as unknown as PrismaService,
      {
        enqueueLessonDocumentProcessingJobs: vi.fn(),
      } as unknown as SourceDocumentsService,
      {} as LearningPathStructureService,
    );

    const result = await service.update(lessonId, "admin-id", {
      overviewContentJson,
      shortDescription: "Tổng quan buổi học mới",
    });

    expect(lessonUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: lessonId },
        data: expect.objectContaining({
          overviewContentJson,
          shortDescription: "Tổng quan buổi học mới",
        }),
      }),
    );
    expect(result).toMatchObject({
      id: lessonId,
      overviewContentJson,
      shortDescription: "Tổng quan buổi học mới",
    });
  });

  it("rejects non-Tiptap lesson overview content", async () => {
    const before = createLessonRecord();
    const transaction = {
      lesson: {
        findFirst: vi.fn().mockResolvedValue(before),
        update: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn(
        async (callback: (tx: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    };
    const service = new LessonsService(
      prisma as unknown as PrismaService,
      {} as SourceDocumentsService,
      {} as LearningPathStructureService,
    );

    await expect(
      service.update(lessonId, "admin-id", {
        overviewContentJson: { type: "lesson_summary_blocks" },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction.lesson.update).not.toHaveBeenCalled();
  });
});
