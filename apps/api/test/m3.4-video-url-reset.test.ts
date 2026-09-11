import { LessonType, PublishStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "#api/common/prisma/prisma.service";
import type { LearningPathStructureService } from "#api/modules/learning-paths/services/learning-path-structure.service";
import { LessonsService } from "#api/modules/learning-paths/services/lessons.service";
import type { SourceDocumentsService } from "#api/modules/learning-paths/services/source-documents.service";

const lessonId = "00000000-0000-0000-0000-000000000003";

function createLessonRecord() {
  const now = new Date("2026-09-11T08:00:00.000Z");
  return {
    id: lessonId,
    learningPathId: "00000000-0000-0000-0000-000000000001",
    chapterId: null,
    orderIndex: 1,
    title: "Bài 1",
    shortDescription: null,
    overviewContentJson: null,
    lessonType: LessonType.BASIC,
    liveUrl: null,
    scheduledAt: null,
    examOpenAt: null,
    videoUrl: "https://youtube.com/watch?v=old-video",
    customVideoSettings: {
      isDisabled: false,
      startTimeInSeconds: 10,
      seekStepInSeconds: 5,
      chapters: [{ time: 12, title: "Mở đầu" }],
      transcriptLanguage: "vi",
      transcript: [{ time: 12, endTime: 14, text: "Nội dung cũ" }],
    },
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

function createService() {
  const before = createLessonRecord();
  const videoSummary = {
    id: "00000000-0000-0000-0000-000000000004",
    lessonId,
    contentJson: { type: "doc", content: [] },
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
    lessonVideoSummary: {
      findUnique: vi.fn().mockResolvedValue(videoSummary),
      delete: vi.fn().mockResolvedValue(videoSummary),
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

  return { lessonUpdate, service, transaction, videoSummary };
}

describe("M3.4 lesson video URL reset", () => {
  it.each([
    ["a different URL", "  https://youtu.be/new-video  ", "https://youtu.be/new-video"],
    ["an empty URL", "", null],
  ])(
    "clears video-derived content when saving %s",
    async (_caseName, requestedVideoUrl, expectedVideoUrl) => {
      const { lessonUpdate, service, transaction, videoSummary } = createService();

      await service.update(lessonId, "admin-id", {
        videoUrl: requestedVideoUrl,
      });

      expect(lessonUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: lessonId },
          data: expect.objectContaining({
            videoUrl: expectedVideoUrl,
            customVideoSettings: {
              isDisabled: false,
              startTimeInSeconds: 10,
              seekStepInSeconds: 5,
              chapters: [],
              transcript: [],
            },
          }),
        }),
      );
      expect(transaction.lessonVideoSummary.delete).toHaveBeenCalledWith({
        where: { id: videoSummary.id },
      });
      expect(transaction.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "LESSON_VIDEO_SUMMARY_RESET_AFTER_VIDEO_URL_CHANGE",
          entityType: "LessonVideoSummary",
          entityId: videoSummary.id,
          before: videoSummary,
        }),
      });
    },
  );

  it("keeps chapters, transcript and summary when the normalized URL is unchanged", async () => {
    const { lessonUpdate, service, transaction } = createService();

    await service.update(lessonId, "admin-id", {
      videoUrl: "  https://youtube.com/watch?v=old-video  ",
    });

    expect(lessonUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ customVideoSettings: expect.anything() }),
      }),
    );
    expect(transaction.lessonVideoSummary.findUnique).not.toHaveBeenCalled();
    expect(transaction.lessonVideoSummary.delete).not.toHaveBeenCalled();
  });
});
