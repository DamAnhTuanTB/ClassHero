import { ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { LessonsService } from "#api/modules/learning-paths/services/lessons.service";
import type { PrismaService } from "#api/common/prisma/prisma.service";
import type { SourceDocumentsService } from "#api/modules/learning-paths/services/source-documents.service";

const chapterId = "00000000-0000-0000-0000-000000000002";
const lessonId = "00000000-0000-0000-0000-000000000003";
const learningPathId = "00000000-0000-0000-0000-000000000001";

function expectDuplicatedTitleError(error: unknown) {
  expect(error).toBeInstanceOf(ConflictException);
  expect((error as ConflictException).getResponse()).toMatchObject({
    code: "LESSON_TITLE_DUPLICATE",
    message: "Buổi học đã trùng tên",
  });
}

describe("M3.2 lesson title uniqueness", () => {
  it("rejects a duplicate title in the same chapter when creating a lesson", async () => {
    const transaction = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      learningPathChapter: {
        findFirst: vi.fn().mockResolvedValue({
          id: chapterId,
          learningPathId,
        }),
      },
      lesson: {
        findFirst: vi.fn().mockResolvedValue({ id: lessonId }),
        create: vi.fn(),
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
    );

    try {
      await service.create(chapterId, "admin-id", {
        orderIndex: 1,
        title: "  Bài   1  ",
      });
      throw new Error("Expected duplicate title validation to fail");
    } catch (error) {
      expectDuplicatedTitleError(error);
    }

    expect(transaction.lesson.findFirst).toHaveBeenCalledWith({
      where: {
        chapterId,
        deletedAt: null,
        title: {
          equals: "Bài 1",
          mode: "insensitive",
        },
      },
      select: {
        id: true,
      },
    });
    expect(transaction.$executeRaw).toHaveBeenCalledOnce();
    expect(transaction.lesson.create).not.toHaveBeenCalled();
  });

  it("excludes the current lesson while checking a renamed lesson", async () => {
    const transaction = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      lesson: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            id: lessonId,
            learningPathId,
            chapterId,
            orderIndex: 1,
            title: "Bài cũ",
          })
          .mockResolvedValueOnce({ id: "another-lesson-id" }),
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
    );

    try {
      await service.update(lessonId, "admin-id", {
        title: "Bài 1",
      });
      throw new Error("Expected duplicate title validation to fail");
    } catch (error) {
      expectDuplicatedTitleError(error);
    }

    expect(transaction.lesson.findFirst).toHaveBeenLastCalledWith({
      where: {
        chapterId,
        deletedAt: null,
        title: {
          equals: "Bài 1",
          mode: "insensitive",
        },
        id: {
          not: lessonId,
        },
      },
      select: {
        id: true,
      },
    });
    expect(transaction.$executeRaw).toHaveBeenCalledOnce();
    expect(transaction.lesson.update).not.toHaveBeenCalled();
  });
});
