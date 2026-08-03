import { Injectable } from "@nestjs/common";
import { LessonProgressStatus, Prisma } from "@prisma/client";
import { throwConflict } from "#api/common/errors/api-exception";

type TopLevelItem = {
  id: string;
  orderIndex: number;
  type: "CHAPTER" | "LESSON";
};

type ChapterState = {
  id: string;
  lessonIds: string[];
  orderIndex: number;
};

type StructureState = {
  chapters: ChapterState[];
  topLevelItems: TopLevelItem[];
};

@Injectable()
export class LearningPathStructureService {
  async getTemporaryChapterOrder(tx: Prisma.TransactionClient, learningPathId: string) {
    await this.lock(tx, learningPathId);
    const aggregate = await tx.learningPathChapter.aggregate({
      where: { learningPathId },
      _min: { orderIndex: true },
    });
    return (aggregate._min.orderIndex ?? 0) - 1;
  }

  async getTemporaryLessonOrder(
    tx: Prisma.TransactionClient,
    learningPathId: string,
    chapterId: string | null,
  ) {
    await this.lock(tx, learningPathId);
    const aggregate = await tx.lesson.aggregate({
      where: { learningPathId, chapterId },
      _min: { orderIndex: true },
    });
    return (aggregate._min.orderIndex ?? 0) - 1;
  }

  async insertChapter(
    tx: Prisma.TransactionClient,
    learningPathId: string,
    chapterId: string,
  ) {
    await this.lock(tx, learningPathId);
    const state = await this.loadState(tx, learningPathId);
    state.topLevelItems = state.topLevelItems.filter(
      (item) => !(item.type === "CHAPTER" && item.id === chapterId),
    );
    const targetOrderIndex = state.topLevelItems.length + 1;
    state.topLevelItems.push({
      id: chapterId,
      orderIndex: targetOrderIndex,
      type: "CHAPTER",
    });
    await this.writeTopLevelOrder(tx, learningPathId, state.topLevelItems);
  }

  async moveChapter(
    tx: Prisma.TransactionClient,
    learningPathId: string,
    chapterId: string,
    targetOrderIndex: number,
  ) {
    await this.lock(tx, learningPathId);
    const state = await this.loadState(tx, learningPathId);
    const chapter = state.chapters.find((item) => item.id === chapterId);
    const current = state.topLevelItems.find(
      (item) => item.type === "CHAPTER" && item.id === chapterId,
    );
    if (!chapter || !current) {
      return;
    }

    state.topLevelItems = state.topLevelItems.filter((item) => item !== current);
    state.topLevelItems.splice(
      normalizeInsertIndex(targetOrderIndex, state.topLevelItems.length),
      0,
      current,
    );
    await this.assertCompletionGuard(tx, state, new Set(chapter.lessonIds));
    await this.writeTopLevelOrder(tx, learningPathId, state.topLevelItems);
  }

  async removeChapter(tx: Prisma.TransactionClient, learningPathId: string) {
    await this.lock(tx, learningPathId);
    const state = await this.loadState(tx, learningPathId);
    await this.writeTopLevelOrder(tx, learningPathId, state.topLevelItems);
  }

  async insertLesson(
    tx: Prisma.TransactionClient,
    input: {
      chapterId: string | null;
      learningPathId: string;
      lessonId: string;
    },
  ) {
    await this.moveLessonInternal(tx, input);
  }

  async moveLesson(
    tx: Prisma.TransactionClient,
    input: {
      chapterId: string | null;
      learningPathId: string;
      lessonId: string;
      targetOrderIndex: number;
    },
  ) {
    await this.moveLessonInternal(tx, input);
  }

  async removeLesson(
    tx: Prisma.TransactionClient,
    learningPathId: string,
    chapterId: string | null,
  ) {
    await this.lock(tx, learningPathId);
    const state = await this.loadState(tx, learningPathId);
    if (chapterId === null) {
      await this.writeTopLevelOrder(tx, learningPathId, state.topLevelItems);
      return;
    }

    const chapter = state.chapters.find((item) => item.id === chapterId);
    if (chapter) {
      await this.writeChapterLessonOrder(
        tx,
        learningPathId,
        chapter.id,
        chapter.lessonIds,
      );
    }
  }

  private async moveLessonInternal(
    tx: Prisma.TransactionClient,
    input: {
      chapterId: string | null;
      learningPathId: string;
      lessonId: string;
      targetOrderIndex?: number;
    },
  ) {
    await this.lock(tx, input.learningPathId);
    const state = await this.loadState(tx, input.learningPathId);
    const sourceChapter = state.chapters.find((chapter) =>
      chapter.lessonIds.includes(input.lessonId),
    );
    const sourceWasTopLevel = state.topLevelItems.some(
      (item) => item.type === "LESSON" && item.id === input.lessonId,
    );
    const sourceOrderIndex = sourceWasTopLevel
      ? state.topLevelItems.findIndex(
          (item) => item.type === "LESSON" && item.id === input.lessonId,
        ) + 1
      : (sourceChapter?.lessonIds.indexOf(input.lessonId) ?? -1) + 1;
    const sourceChapterId = sourceWasTopLevel ? null : (sourceChapter?.id ?? null);
    if (
      input.targetOrderIndex !== undefined &&
      sourceChapterId === input.chapterId &&
      sourceOrderIndex === input.targetOrderIndex
    ) {
      return;
    }

    state.topLevelItems = state.topLevelItems.filter(
      (item) => !(item.type === "LESSON" && item.id === input.lessonId),
    );
    for (const chapter of state.chapters) {
      chapter.lessonIds = chapter.lessonIds.filter((id) => id !== input.lessonId);
    }

    if (input.chapterId === null) {
      const targetOrderIndex = input.targetOrderIndex ?? state.topLevelItems.length + 1;
      state.topLevelItems.splice(
        normalizeInsertIndex(targetOrderIndex, state.topLevelItems.length),
        0,
        {
          id: input.lessonId,
          orderIndex: targetOrderIndex,
          type: "LESSON",
        },
      );
    } else {
      const destination = state.chapters.find(
        (chapter) => chapter.id === input.chapterId,
      );
      if (!destination) {
        throwConflict("CONFLICT", "Chương đích không còn khả dụng");
      }
      const targetOrderIndex = input.targetOrderIndex ?? destination.lessonIds.length + 1;
      destination.lessonIds.splice(
        normalizeInsertIndex(targetOrderIndex, destination.lessonIds.length),
        0,
        input.lessonId,
      );
    }

    await this.assertCompletionGuard(tx, state, new Set([input.lessonId]));

    const temporaryOrder = await this.getGlobalTemporaryLessonOrder(
      tx,
      input.learningPathId,
    );
    await tx.lesson.update({
      where: { id: input.lessonId },
      data: {
        chapterId: input.chapterId,
        orderIndex: temporaryOrder,
      },
    });

    if (sourceWasTopLevel || input.chapterId === null) {
      await this.writeTopLevelOrder(tx, input.learningPathId, state.topLevelItems);
    }

    const affectedChapterIds = new Set<string>();
    if (sourceChapter) {
      affectedChapterIds.add(sourceChapter.id);
    }
    if (input.chapterId) {
      affectedChapterIds.add(input.chapterId);
    }
    for (const chapterId of affectedChapterIds) {
      const chapter = state.chapters.find((item) => item.id === chapterId);
      if (chapter) {
        await this.writeChapterLessonOrder(
          tx,
          input.learningPathId,
          chapterId,
          chapter.lessonIds,
        );
      }
    }
  }

  private async loadState(
    tx: Prisma.TransactionClient,
    learningPathId: string,
  ): Promise<StructureState> {
    const [chapters, topLevelLessons] = await Promise.all([
      tx.learningPathChapter.findMany({
        where: { learningPathId, deletedAt: null },
        select: {
          id: true,
          orderIndex: true,
          lessons: {
            where: { deletedAt: null },
            select: { id: true },
            orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
          },
        },
        orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
      }),
      tx.lesson.findMany({
        where: { learningPathId, chapterId: null, deletedAt: null },
        select: { id: true, orderIndex: true },
        orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
      }),
    ]);

    const chapterStates = chapters.map((chapter) => ({
      id: chapter.id,
      lessonIds: chapter.lessons.map((lesson) => lesson.id),
      orderIndex: chapter.orderIndex,
    }));
    const topLevelItems: TopLevelItem[] = [
      ...chapterStates.map((chapter) => ({
        id: chapter.id,
        orderIndex: chapter.orderIndex,
        type: "CHAPTER" as const,
      })),
      ...topLevelLessons.map((lesson) => ({
        id: lesson.id,
        orderIndex: lesson.orderIndex,
        type: "LESSON" as const,
      })),
    ].sort(compareTopLevelItems);

    return { chapters: chapterStates, topLevelItems };
  }

  private async assertCompletionGuard(
    tx: Prisma.TransactionClient,
    state: StructureState,
    movedLessonIds: Set<string>,
  ) {
    if (movedLessonIds.size === 0) {
      return;
    }

    const flattenedLessonIds = flattenLessonIds(state);
    const firstMovedIndex = flattenedLessonIds.findIndex((id) => movedLessonIds.has(id));
    if (firstMovedIndex < 0) {
      return;
    }

    const lessonsAfterMove = flattenedLessonIds
      .slice(firstMovedIndex + 1)
      .filter((id) => !movedLessonIds.has(id));
    if (lessonsAfterMove.length === 0) {
      return;
    }

    const completed = await tx.lessonProgress.findMany({
      where: {
        lessonId: { in: lessonsAfterMove },
        status: LessonProgressStatus.COMPLETED,
      },
      select: { lessonId: true },
      distinct: ["lessonId"],
    });
    const completedIds = new Set(completed.map((item) => item.lessonId));
    const blockedLessonId = lessonsAfterMove.find((id) => completedIds.has(id));
    if (!blockedLessonId) {
      return;
    }

    const blockedLesson = await tx.lesson.findUnique({
      where: { id: blockedLessonId },
      select: { id: true, title: true },
    });
    throwConflict(
      "LESSON_MOVE_BEFORE_COMPLETED",
      "Không thể di chuyển trước buổi học đã có học sinh hoàn thành",
      {
        blockedLessonId,
        blockedLessonTitle: blockedLesson?.title ?? null,
      },
    );
  }

  private async writeTopLevelOrder(
    tx: Prisma.TransactionClient,
    learningPathId: string,
    items: TopLevelItem[],
  ) {
    const [chapterAggregate, lessonAggregate] = await Promise.all([
      tx.learningPathChapter.aggregate({
        where: { learningPathId },
        _min: { orderIndex: true },
      }),
      tx.lesson.aggregate({
        where: { learningPathId, chapterId: null },
        _min: { orderIndex: true },
      }),
    ]);
    let chapterTemporary = (chapterAggregate._min.orderIndex ?? 0) - items.length - 1;
    let lessonTemporary = (lessonAggregate._min.orderIndex ?? 0) - items.length - 1;

    for (const item of items) {
      if (item.type === "CHAPTER") {
        await tx.learningPathChapter.update({
          where: { id: item.id },
          data: { orderIndex: chapterTemporary-- },
        });
      } else {
        await tx.lesson.update({
          where: { id: item.id },
          data: { orderIndex: lessonTemporary-- },
        });
      }
    }

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index]!;
      if (item.type === "CHAPTER") {
        await tx.learningPathChapter.update({
          where: { id: item.id },
          data: { orderIndex: index + 1 },
        });
      } else {
        await tx.lesson.update({
          where: { id: item.id },
          data: { orderIndex: index + 1 },
        });
      }
    }
  }

  private async writeChapterLessonOrder(
    tx: Prisma.TransactionClient,
    learningPathId: string,
    chapterId: string,
    lessonIds: string[],
  ) {
    const aggregate = await tx.lesson.aggregate({
      where: { learningPathId, chapterId },
      _min: { orderIndex: true },
    });
    let temporaryOrder = (aggregate._min.orderIndex ?? 0) - lessonIds.length - 1;

    for (const lessonId of lessonIds) {
      await tx.lesson.update({
        where: { id: lessonId },
        data: { orderIndex: temporaryOrder-- },
      });
    }
    for (let index = 0; index < lessonIds.length; index += 1) {
      await tx.lesson.update({
        where: { id: lessonIds[index]! },
        data: { orderIndex: index + 1 },
      });
    }
  }

  private async getGlobalTemporaryLessonOrder(
    tx: Prisma.TransactionClient,
    learningPathId: string,
  ) {
    const aggregate = await tx.lesson.aggregate({
      where: { learningPathId },
      _min: { orderIndex: true },
    });
    return (aggregate._min.orderIndex ?? 0) - 1;
  }

  private lock(tx: Prisma.TransactionClient, learningPathId: string) {
    return tx.$executeRaw`
      SELECT pg_advisory_xact_lock(
        hashtext('learning-path-structure'),
        hashtext(${learningPathId})
      )
    `;
  }
}

function normalizeInsertIndex(targetOrderIndex: number, currentLength: number) {
  return Math.min(Math.max(targetOrderIndex, 1), currentLength + 1) - 1;
}

function compareTopLevelItems(left: TopLevelItem, right: TopLevelItem) {
  return left.orderIndex - right.orderIndex || left.type.localeCompare(right.type);
}

function flattenLessonIds(state: StructureState) {
  const chapterById = new Map(state.chapters.map((chapter) => [chapter.id, chapter]));
  return state.topLevelItems.flatMap((item) =>
    item.type === "LESSON" ? [item.id] : (chapterById.get(item.id)?.lessonIds ?? []),
  );
}
