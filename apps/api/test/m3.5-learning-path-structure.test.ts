import { ConflictException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { LearningPathStructureService } from "#api/modules/learning-paths/services/learning-path-structure.service";

const learningPathId = "00000000-0000-0000-0000-000000000001";
const firstChapterId = "00000000-0000-0000-0000-000000000002";
const secondChapterId = "00000000-0000-0000-0000-000000000003";
const completedLessonId = "00000000-0000-0000-0000-000000000004";
const movingLessonId = "00000000-0000-0000-0000-000000000005";

describe("M3.5 optional chapter learning-path structure", () => {
  it("rejects moving a lesson before a lesson completed by at least one student", async () => {
    const transaction = createTransaction({
      chapters: [
        {
          id: firstChapterId,
          orderIndex: 1,
          lessons: [{ id: completedLessonId }],
        },
      ],
      topLevelLessons: [{ id: movingLessonId, orderIndex: 2 }],
      completedLessonIds: [completedLessonId],
    });
    const service = new LearningPathStructureService();

    await expect(
      service.moveLesson(transaction as unknown as Prisma.TransactionClient, {
        chapterId: null,
        learningPathId,
        lessonId: movingLessonId,
        targetOrderIndex: 1,
      }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: "LESSON_MOVE_BEFORE_COMPLETED",
        details: {
          blockedLessonId: completedLessonId,
        },
      });
      return true;
    });

    expect(transaction.lesson.update).not.toHaveBeenCalled();
  });

  it("allows moving a top-level lesson after the completed lesson into a chapter", async () => {
    const transaction = createTransaction({
      chapters: [
        {
          id: firstChapterId,
          orderIndex: 1,
          lessons: [{ id: completedLessonId }],
        },
        {
          id: secondChapterId,
          orderIndex: 2,
          lessons: [],
        },
      ],
      topLevelLessons: [{ id: movingLessonId, orderIndex: 3 }],
      completedLessonIds: [completedLessonId],
    });
    const service = new LearningPathStructureService();

    await service.moveLesson(transaction as unknown as Prisma.TransactionClient, {
      chapterId: firstChapterId,
      learningPathId,
      lessonId: movingLessonId,
      targetOrderIndex: 2,
    });

    expect(transaction.lessonProgress.findMany).not.toHaveBeenCalled();
    expect(transaction.lesson.update).toHaveBeenCalledWith({
      where: { id: movingLessonId },
      data: {
        chapterId: firstChapterId,
        orderIndex: 0,
      },
    });
    expect(transaction.lesson.update).toHaveBeenCalledWith({
      where: { id: movingLessonId },
      data: { orderIndex: 2 },
    });
  });

  it("appends a new lesson and normalizes its temporary order", async () => {
    const transaction = createTransaction({
      chapters: [
        {
          id: firstChapterId,
          orderIndex: 1,
          lessons: [{ id: movingLessonId }],
        },
      ],
      topLevelLessons: [],
      completedLessonIds: [],
    });
    const service = new LearningPathStructureService();

    await service.insertLesson(transaction as unknown as Prisma.TransactionClient, {
      chapterId: firstChapterId,
      learningPathId,
      lessonId: movingLessonId,
    });

    expect(transaction.lesson.update).toHaveBeenLastCalledWith({
      where: { id: movingLessonId },
      data: { orderIndex: 1 },
    });
  });

  it("appends a new lesson after existing lessons in its chapter", async () => {
    const transaction = createTransaction({
      chapters: [
        {
          id: firstChapterId,
          orderIndex: 1,
          lessons: [{ id: movingLessonId }, { id: completedLessonId }],
        },
      ],
      topLevelLessons: [],
      completedLessonIds: [],
    });
    const service = new LearningPathStructureService();

    await service.insertLesson(transaction as unknown as Prisma.TransactionClient, {
      chapterId: firstChapterId,
      learningPathId,
      lessonId: movingLessonId,
    });

    expect(transaction.lesson.update).toHaveBeenCalledWith({
      where: { id: completedLessonId },
      data: { orderIndex: 1 },
    });
    expect(transaction.lesson.update).toHaveBeenLastCalledWith({
      where: { id: movingLessonId },
      data: { orderIndex: 2 },
    });
  });

  it("appends a new chapter after existing top-level items", async () => {
    const transaction = createTransaction({
      chapters: [
        { id: secondChapterId, orderIndex: -1, lessons: [] },
        { id: firstChapterId, orderIndex: 1, lessons: [] },
      ],
      topLevelLessons: [{ id: completedLessonId, orderIndex: 2 }],
      completedLessonIds: [],
    });
    const service = new LearningPathStructureService();

    await service.insertChapter(
      transaction as unknown as Prisma.TransactionClient,
      learningPathId,
      secondChapterId,
    );

    expect(transaction.learningPathChapter.update).toHaveBeenLastCalledWith({
      where: { id: secondChapterId },
      data: { orderIndex: 3 },
    });
  });
});

function createTransaction({
  chapters,
  completedLessonIds,
  topLevelLessons,
}: {
  chapters: Array<{
    id: string;
    orderIndex: number;
    lessons: Array<{ id: string }>;
  }>;
  completedLessonIds: string[];
  topLevelLessons: Array<{ id: string; orderIndex: number }>;
}) {
  return {
    $executeRaw: vi.fn().mockResolvedValue(1),
    learningPathChapter: {
      aggregate: vi.fn().mockResolvedValue({ _min: { orderIndex: 1 } }),
      findMany: vi.fn().mockResolvedValue(chapters),
      update: vi.fn().mockResolvedValue({}),
    },
    lesson: {
      aggregate: vi.fn().mockResolvedValue({ _min: { orderIndex: 1 } }),
      findMany: vi.fn().mockResolvedValue(topLevelLessons),
      findUnique: vi
        .fn()
        .mockImplementation(({ where }: { where: { id: string } }) =>
          Promise.resolve({ id: where.id, title: "Buổi học đã hoàn thành" }),
        ),
      update: vi.fn().mockResolvedValue({}),
    },
    lessonProgress: {
      findMany: vi
        .fn()
        .mockResolvedValue(completedLessonIds.map((lessonId) => ({ lessonId }))),
    },
  };
}
