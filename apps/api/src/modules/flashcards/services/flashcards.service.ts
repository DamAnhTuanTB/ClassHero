import { Inject, Injectable } from "@nestjs/common";
import {
  AiExplanationTargetType,
  AttemptStatus,
  ContentSource,
  Difficulty,
  FavoriteTargetType,
  Prisma,
  ReviewStatus,
} from "@prisma/client";
import { badRequestException, notFoundException } from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { hasTiptapContent } from "#api/common/validation/rich-text-content";
import {
  adminFlashcardSelect,
  adminFlashcardSetSelect,
  studentFlashcardSetSelect,
} from "#api/modules/flashcards/selectors/flashcard.selects";
import {
  serializeAdminFlashcard,
  serializeAdminFlashcardSet,
  serializeStudentFlashcardSet,
} from "#api/modules/flashcards/serializers/flashcard.serializers";
import type {
  CreateFlashcardInput,
  CreateFlashcardSetInput,
  FlashcardRequestContext,
  ReviewFlashcardSetInput,
  UpdateFlashcardInput,
  UpdateFlashcardSetInput,
} from "#api/modules/flashcards/types/flashcard.types";
import {
  toFlashcardInputJson,
  toFlashcardRecord,
} from "#api/modules/flashcards/utils/flashcard-json";
import { StudentLessonAccessService } from "#api/modules/learning-paths/services/student-lesson-access.service";
import type { ToggleStudentFavoriteDto } from "#api/modules/flashcards/dto/student-flashcard-progress.dto";

@Injectable()
export class FlashcardsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StudentLessonAccessService)
    private readonly studentLessonAccessService: StudentLessonAccessService,
  ) {}

  async listAdminSetsByLesson(lessonId: string) {
    const records = await this.prisma.flashcardSet.findMany({
      where: { lessonId, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: adminFlashcardSetSelect,
    });
    return records.map(serializeAdminFlashcardSet);
  }

  async createSet(
    lessonId: string,
    actorUserId: string,
    input: CreateFlashcardSetInput,
    context: FlashcardRequestContext = {},
  ) {
    const title = normalizeTitle(input.title);
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true },
    });
    if (!lesson) {
      throw notFoundException("NOT_FOUND", "Không tìm thấy buổi học");
    }

    const record = await this.prisma.$transaction(async (transaction) => {
      const lastSet = await transaction.flashcardSet.findFirst({
        where: { lessonId, deletedAt: null },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      const created = await transaction.flashcardSet.create({
        data: {
          lessonId,
          title,
          difficulty: input.difficulty ?? Difficulty.MIXED,
          source: ContentSource.ADMIN,
          reviewStatus: ReviewStatus.APPROVED,
          sortOrder: (lastSet?.sortOrder ?? -1) + 1,
          createdById: actorUserId,
          updatedById: actorUserId,
        },
        select: adminFlashcardSetSelect,
      });
      await transaction.auditLog.create({
        data: {
          actorUserId,
          action: "FLASHCARD_SET_CREATED",
          entityType: "FlashcardSet",
          entityId: created.id,
          after: toFlashcardInputJson(serializeAdminFlashcardSet(created)),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });
      return created;
    });

    return serializeAdminFlashcardSet(record);
  }

  async updateSet(
    setId: string,
    actorUserId: string,
    input: UpdateFlashcardSetInput,
    context: FlashcardRequestContext = {},
  ) {
    if (input.title === undefined && input.difficulty === undefined) {
      throw badRequestException(
        "VALIDATION_ERROR",
        "Cần cung cấp ít nhất một trường để cập nhật",
      );
    }
    const current = await this.findActiveSet(setId);
    const record = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.flashcardSet.update({
        where: { id: setId },
        data: {
          ...(input.title !== undefined ? { title: normalizeTitle(input.title) } : {}),
          ...(input.difficulty !== undefined ? { difficulty: input.difficulty } : {}),
          updatedById: actorUserId,
        },
        select: adminFlashcardSetSelect,
      });
      await transaction.auditLog.create({
        data: {
          actorUserId,
          action: "FLASHCARD_SET_UPDATED",
          entityType: "FlashcardSet",
          entityId: setId,
          before: toFlashcardInputJson(serializeAdminFlashcardSet(current)),
          after: toFlashcardInputJson(serializeAdminFlashcardSet(updated)),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });
      return updated;
    });
    return serializeAdminFlashcardSet(record);
  }

  async reviewSet(
    setId: string,
    actorUserId: string,
    input: ReviewFlashcardSetInput,
    context: FlashcardRequestContext = {},
  ) {
    const current = await this.findActiveSet(setId);
    const record = await this.prisma.$transaction(async (transaction) => {
      const cards = await transaction.flashcard.findMany({
        where: { flashcardSetId: setId, deletedAt: null },
        select: { explanationId: true },
      });
      await transaction.flashcard.updateMany({
        where: { flashcardSetId: setId, deletedAt: null },
        data: { reviewStatus: input.reviewStatus },
      });
      const explanationIds = cards.flatMap((card) =>
        card.explanationId ? [card.explanationId] : [],
      );
      if (explanationIds.length > 0) {
        await transaction.aiExplanation.updateMany({
          where: { id: { in: explanationIds } },
          data: { reviewStatus: input.reviewStatus },
        });
      }
      const updated = await transaction.flashcardSet.update({
        where: { id: setId },
        data: {
          reviewStatus: input.reviewStatus,
          updatedById: actorUserId,
        },
        select: adminFlashcardSetSelect,
      });
      await transaction.auditLog.create({
        data: {
          actorUserId,
          action: "FLASHCARD_SET_REVIEWED",
          entityType: "FlashcardSet",
          entityId: setId,
          before: toFlashcardInputJson(serializeAdminFlashcardSet(current)),
          after: toFlashcardInputJson(serializeAdminFlashcardSet(updated)),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });
      return updated;
    });
    return serializeAdminFlashcardSet(record);
  }

  async deleteSet(
    setId: string,
    actorUserId: string,
    context: FlashcardRequestContext = {},
  ) {
    const current = await this.findActiveSet(setId);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.flashcardSet.update({
        where: { id: setId },
        data: {
          deletedAt: new Date(),
          updatedById: actorUserId,
        },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId,
          action: "FLASHCARD_SET_DELETED",
          entityType: "FlashcardSet",
          entityId: setId,
          before: toFlashcardInputJson(serializeAdminFlashcardSet(current)),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });
    });
    return { success: true };
  }

  async listCardsBySet(setId: string) {
    await this.findActiveSet(setId);
    const records = await this.prisma.flashcard.findMany({
      where: { flashcardSetId: setId, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: adminFlashcardSelect,
    });
    return records.map(serializeAdminFlashcard);
  }

  async createCard(
    setId: string,
    actorUserId: string,
    input: CreateFlashcardInput,
    context: FlashcardRequestContext = {},
  ) {
    validateCardContent(input);
    const set = await this.findActiveSet(setId);

    const record = await this.prisma.$transaction(async (transaction) => {
      const lastCard = await transaction.flashcard.findFirst({
        where: { flashcardSetId: setId, deletedAt: null },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      const created = await transaction.flashcard.create({
        data: {
          flashcardSetId: setId,
          lessonId: set.lessonId,
          frontJson: toFlashcardInputJson(input.frontJson),
          backJson: toFlashcardInputJson(input.backJson),
          difficulty: normalizeCardDifficulty(input.difficulty),
          reviewStatus: ReviewStatus.APPROVED,
          sortOrder: input.sortOrder ?? (lastCard?.sortOrder ?? -1) + 1,
        },
        select: { id: true },
      });
      const explanationId = await syncFlashcardExplanation(transaction, {
        currentExplanationId: null,
        explanationJson: input.explanationJson,
        flashcardId: created.id,
        lessonId: set.lessonId,
      });
      const flashcard = await transaction.flashcard.update({
        where: { id: created.id },
        data: explanationId ? { explanationId } : {},
        select: adminFlashcardSelect,
      });
      await transaction.flashcardSet.update({
        where: { id: setId },
        data: {
          cardCount: { increment: 1 },
          updatedById: actorUserId,
        },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId,
          action: "FLASHCARD_CREATED",
          entityType: "Flashcard",
          entityId: created.id,
          after: toFlashcardInputJson(serializeAdminFlashcard(flashcard)),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });
      return flashcard;
    });
    return serializeAdminFlashcard(record);
  }

  async updateCard(
    flashcardId: string,
    actorUserId: string,
    input: UpdateFlashcardInput,
    context: FlashcardRequestContext = {},
  ) {
    if (Object.keys(input).length === 0) {
      throw badRequestException(
        "VALIDATION_ERROR",
        "Cần cung cấp ít nhất một trường để cập nhật",
      );
    }
    const current = await this.findActiveCard(flashcardId);
    const merged: CreateFlashcardInput = {
      frontJson: input.frontJson ?? toFlashcardRecord(current.frontJson, "frontJson"),
      backJson: input.backJson ?? toFlashcardRecord(current.backJson, "backJson"),
      explanationJson: input.explanationJson,
      difficulty: input.difficulty ?? current.difficulty,
      sortOrder: input.sortOrder ?? current.sortOrder,
    };
    validateCardContent(merged);

    const record = await this.prisma.$transaction(async (transaction) => {
      if (
        current.explanationId &&
        input.explanationJson === undefined &&
        [input.frontJson, input.backJson].some((value) => value !== undefined)
      ) {
        await transaction.aiExplanation.update({
          where: { id: current.explanationId },
          data: { staleAt: new Date() },
        });
      }
      const explanationId = await syncFlashcardExplanation(transaction, {
        currentExplanationId: current.explanationId,
        explanationJson: input.explanationJson,
        flashcardId,
        lessonId: current.lessonId,
      });

      const updated = await transaction.flashcard.update({
        where: { id: flashcardId },
        data: {
          ...(input.frontJson !== undefined
            ? { frontJson: toFlashcardInputJson(input.frontJson) }
            : {}),
          ...(input.backJson !== undefined
            ? { backJson: toFlashcardInputJson(input.backJson) }
            : {}),
          ...(input.explanationJson !== undefined
            ? {
                explanation:
                  explanationId === null
                    ? { disconnect: true }
                    : { connect: { id: explanationId } },
              }
            : {}),
          ...(input.difficulty !== undefined
            ? { difficulty: normalizeCardDifficulty(input.difficulty) }
            : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        },
        select: adminFlashcardSelect,
      });
      await transaction.flashcardSet.update({
        where: { id: current.flashcardSetId },
        data: { updatedById: actorUserId },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId,
          action: "FLASHCARD_UPDATED",
          entityType: "Flashcard",
          entityId: flashcardId,
          before: toFlashcardInputJson(serializeAdminFlashcard(current)),
          after: toFlashcardInputJson(serializeAdminFlashcard(updated)),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });
      return updated;
    });
    return serializeAdminFlashcard(record);
  }

  async deleteCard(
    flashcardId: string,
    actorUserId: string,
    context: FlashcardRequestContext = {},
  ) {
    const current = await this.findActiveCard(flashcardId);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.flashcard.update({
        where: { id: flashcardId },
        data: { deletedAt: new Date() },
      });
      await transaction.flashcardSet.update({
        where: { id: current.flashcardSetId },
        data: {
          cardCount: { decrement: 1 },
          updatedById: actorUserId,
        },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId,
          action: "FLASHCARD_DELETED",
          entityType: "Flashcard",
          entityId: flashcardId,
          before: toFlashcardInputJson(serializeAdminFlashcard(current)),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });
    });
    return { success: true };
  }

  async listStudentSetsByLesson(lessonId: string, studentUserId: string) {
    await this.studentLessonAccessService.assertCanRead(lessonId, studentUserId);
    const records = await this.prisma.flashcardSet.findMany({
      where: {
        lessonId,
        deletedAt: null,
        isReserve: false,
        reviewStatus: ReviewStatus.APPROVED,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: studentFlashcardSetSelect,
    });
    const cardIds = records.flatMap((record) =>
      record.flashcards.map((flashcard) => flashcard.id),
    );
    const [progressEntries, favoriteEntries] = await Promise.all([
      cardIds.length === 0
        ? []
        : this.prisma.flashcardProgress.findMany({
            where: {
              studentUserId,
              flashcardId: { in: cardIds },
            },
            select: {
              flashcardId: true,
              isKnown: true,
              lastReviewedAt: true,
              reviewCount: true,
            },
          }),
      cardIds.length === 0
        ? []
        : this.prisma.favorite.findMany({
            where: {
              studentUserId,
              lessonId,
              targetType: FavoriteTargetType.FLASHCARD,
              targetId: { in: cardIds },
            },
            select: { targetId: true },
          }),
    ]);
    const progressByCardId = new Map(
      progressEntries.map(({ flashcardId, ...progress }) => [flashcardId, progress]),
    );
    const favoriteCardIds = new Set(favoriteEntries.map((favorite) => favorite.targetId));

    return records.map((record) =>
      serializeStudentFlashcardSet(record, progressByCardId, favoriteCardIds),
    );
  }

  async getStudentStudyHistory(lessonId: string, studentUserId: string) {
    await this.studentLessonAccessService.assertCanRead(lessonId, studentUserId);
    const where = {
      lessonId,
      studentUserId,
      status: { in: [AttemptStatus.IN_PROGRESS, AttemptStatus.SUBMITTED] },
      flashcardSet: {
        deletedAt: null,
        isReserve: false,
        reviewStatus: ReviewStatus.APPROVED,
      },
    } satisfies Prisma.FlashcardStudySessionWhereInput;
    const [total, sessions] = await Promise.all([
      this.prisma.flashcardStudySession.count({ where }),
      this.prisma.flashcardStudySession.findMany({
        where,
        orderBy: [{ status: "asc" }, { startedAt: "desc" }, { createdAt: "desc" }],
        take: 50,
        select: {
          id: true,
          flashcardSetId: true,
          status: true,
          startedAt: true,
          completedAt: true,
          reviewedCount: true,
          knownCount: true,
          unknownCount: true,
          totalCount: true,
        },
      }),
    ]);
    const sequenceBySessionId = new Map(
      [...sessions]
        .sort((left, right) => left.startedAt.getTime() - right.startedAt.getTime())
        .map((session, index) => [session.id, total - sessions.length + index + 1]),
    );

    return {
      total,
      items: sessions.map((session) => ({
        id: session.id,
        setId: session.flashcardSetId,
        displayName: `Bộ ${sequenceBySessionId.get(session.id) ?? 1}`,
        state:
          session.status === AttemptStatus.IN_PROGRESS
            ? ("IN_PROGRESS" as const)
            : ("COMPLETED" as const),
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        reviewedCount: session.reviewedCount,
        knownCount: session.knownCount,
        unknownCount: session.unknownCount,
        totalCount: session.totalCount,
      })),
    };
  }

  async getStudentStudySession(sessionId: string, studentUserId: string) {
    const session = await this.prisma.flashcardStudySession.findFirst({
      where: {
        id: sessionId,
        studentUserId,
        status: { in: [AttemptStatus.IN_PROGRESS, AttemptStatus.SUBMITTED] },
        flashcardSet: {
          deletedAt: null,
          isReserve: false,
          reviewStatus: ReviewStatus.APPROVED,
        },
      },
      select: {
        id: true,
        lessonId: true,
        flashcardSetId: true,
        status: true,
        startedAt: true,
        completedAt: true,
        reviewedCount: true,
        knownCount: true,
        unknownCount: true,
        totalCount: true,
        items: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: {
            flashcardId: true,
            isKnown: true,
            reviewedAt: true,
          },
        },
      },
    });
    if (!session) {
      throw notFoundException(
        "FLASHCARD_SESSION_NOT_FOUND",
        "Không tìm thấy lượt học Flashcard",
      );
    }
    await this.studentLessonAccessService.assertCanRead(session.lessonId, studentUserId);

    return {
      ...session,
      state:
        session.status === AttemptStatus.IN_PROGRESS
          ? ("IN_PROGRESS" as const)
          : ("COMPLETED" as const),
    };
  }

  async startStudentStudySession(
    flashcardSetId: string,
    studentUserId: string,
    resumeExistingProgress = false,
    restartSessionId?: string,
  ) {
    const set = await this.prisma.flashcardSet.findFirst({
      where: {
        id: flashcardSetId,
        deletedAt: null,
        isReserve: false,
        reviewStatus: ReviewStatus.APPROVED,
      },
      select: {
        id: true,
        lessonId: true,
        flashcards: {
          where: {
            deletedAt: null,
            reviewStatus: ReviewStatus.APPROVED,
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: { id: true, sortOrder: true },
        },
      },
    });
    if (!set) {
      throw notFoundException("FLASHCARD_SET_NOT_FOUND", "Không tìm thấy bộ Flashcard");
    }
    if (set.flashcards.length === 0) {
      throw badRequestException(
        "FLASHCARD_SET_EMPTY",
        "Bộ Flashcard chưa có thẻ được duyệt",
      );
    }
    await this.studentLessonAccessService.assertCanRead(set.lessonId, studentUserId);

    if (restartSessionId) {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.flashcardStudySession.updateMany({
          where: {
            lessonId: set.lessonId,
            studentUserId,
            status: AttemptStatus.IN_PROGRESS,
            id: { not: restartSessionId },
          },
          data: { status: AttemptStatus.CANCELLED },
        });

        await transaction.flashcardStudySessionItem.deleteMany({
          where: { sessionId: restartSessionId },
        });

        await transaction.flashcardStudySessionItem.createMany({
          data: set.flashcards.map((flashcard, index) => ({
            sessionId: restartSessionId,
            flashcardId: flashcard.id,
            sortOrder: flashcard.sortOrder || index,
            isKnown: undefined,
            reviewedAt: undefined,
          })),
        });

        await transaction.flashcardStudySession.update({
          where: { id: restartSessionId },
          data: {
            status: AttemptStatus.IN_PROGRESS,
            startedAt: new Date(),
            completedAt: null,
            reviewedCount: 0,
            knownCount: 0,
            unknownCount: 0,
            totalCount: set.flashcards.length,
          },
        });
      });

      return this.getStudentStudySession(restartSessionId, studentUserId);
    }

    const savedProgress = resumeExistingProgress
      ? await this.prisma.flashcardProgress.findMany({
          where: {
            studentUserId,
            flashcardId: { in: set.flashcards.map((flashcard) => flashcard.id) },
          },
          select: {
            flashcardId: true,
            isKnown: true,
            lastReviewedAt: true,
          },
        })
      : [];
    const savedProgressByCardId = new Map(
      savedProgress.map((progress) => [progress.flashcardId, progress]),
    );
    const knownCount = savedProgress.filter((progress) => progress.isKnown).length;

    const session = await this.prisma.$transaction(async (transaction) => {
      await transaction.flashcardStudySession.updateMany({
        where: {
          lessonId: set.lessonId,
          studentUserId,
          status: AttemptStatus.IN_PROGRESS,
        },
        data: { status: AttemptStatus.CANCELLED },
      });
      return transaction.flashcardStudySession.create({
        data: {
          studentUserId,
          lessonId: set.lessonId,
          flashcardSetId: set.id,
          reviewedCount: savedProgress.length,
          knownCount,
          unknownCount: savedProgress.length - knownCount,
          totalCount: set.flashcards.length,
          items: {
            create: set.flashcards.map((flashcard, index) => {
              const progress = savedProgressByCardId.get(flashcard.id);
              return {
                flashcardId: flashcard.id,
                sortOrder: flashcard.sortOrder || index,
                isKnown: progress?.isKnown,
                reviewedAt: progress?.lastReviewedAt,
              };
            }),
          },
        },
        select: { id: true },
      });
    });

    return this.getStudentStudySession(session.id, studentUserId);
  }

  async updateStudentProgress(
    flashcardId: string,
    studentUserId: string,
    isKnown: boolean,
    sessionId?: string,
  ) {
    const flashcard = await this.prisma.flashcard.findFirst({
      where: {
        id: flashcardId,
        deletedAt: null,
        reviewStatus: ReviewStatus.APPROVED,
        flashcardSet: {
          deletedAt: null,
          isReserve: false,
          reviewStatus: ReviewStatus.APPROVED,
        },
      },
      select: {
        id: true,
        lessonId: true,
        flashcardSetId: true,
      },
    });
    if (!flashcard) {
      throw notFoundException("FLASHCARD_NOT_FOUND", "Không tìm thấy flashcard");
    }
    await this.studentLessonAccessService.assertCanRead(
      flashcard.lessonId,
      studentUserId,
    );
    if (sessionId) {
      const sessionItem = await this.prisma.flashcardStudySessionItem.findFirst({
        where: {
          sessionId,
          flashcardId,
           session: {
            studentUserId,
            flashcardSetId: flashcard.flashcardSetId,
            status: { in: [AttemptStatus.IN_PROGRESS, AttemptStatus.SUBMITTED] },
          },
        },
        select: { id: true },
      });
      if (!sessionItem) {
        throw notFoundException(
          "FLASHCARD_SESSION_ITEM_NOT_FOUND",
          "Thẻ không thuộc lượt học Flashcard đang làm",
        );
      }
    }

    const reviewedAt = new Date();
    const { progress, studySession } = await this.prisma.$transaction(
      async (transaction) => {
        const nextProgress = await transaction.flashcardProgress.upsert({
          where: {
            studentUserId_flashcardId: {
              studentUserId,
              flashcardId,
            },
          },
          create: {
            studentUserId,
            lessonId: flashcard.lessonId,
            flashcardId,
            isKnown,
            lastReviewedAt: reviewedAt,
            reviewCount: 1,
          },
          update: {
            isKnown,
            lastReviewedAt: reviewedAt,
            reviewCount: { increment: 1 },
          },
          select: {
            flashcardId: true,
            isKnown: true,
            lastReviewedAt: true,
            reviewCount: true,
          },
        });
        if (!sessionId) {
          return { progress: nextProgress, studySession: null };
        }

        await transaction.flashcardStudySessionItem.update({
          where: {
            sessionId_flashcardId: {
              sessionId,
              flashcardId,
            },
          },
          data: { isKnown, reviewedAt },
        });
        const sessionItems = await transaction.flashcardStudySessionItem.findMany({
          where: { sessionId },
          select: { isKnown: true },
        });
        const reviewedCount = sessionItems.filter((item) => item.isKnown !== null).length;
        const knownCount = sessionItems.filter((item) => item.isKnown === true).length;
        const isCompleted = reviewedCount === sessionItems.length;
        const nextSession = await transaction.flashcardStudySession.update({
          where: { id: sessionId },
          data: {
            reviewedCount,
            knownCount,
            unknownCount: reviewedCount - knownCount,
            status: isCompleted ? AttemptStatus.SUBMITTED : AttemptStatus.IN_PROGRESS,
            completedAt: isCompleted ? reviewedAt : null,
          },
          select: {
            id: true,
            status: true,
            reviewedCount: true,
            knownCount: true,
            unknownCount: true,
            totalCount: true,
            completedAt: true,
          },
        });
        return {
          progress: nextProgress,
          studySession: {
            ...nextSession,
            state:
              nextSession.status === AttemptStatus.IN_PROGRESS
                ? ("IN_PROGRESS" as const)
                : ("COMPLETED" as const),
          },
        };
      },
    );

    return {
      ...progress,
      studySession,
      setProgress: await this.getStudentSetProgressSummary(
        flashcard.flashcardSetId,
        studentUserId,
      ),
    };
  }

  async toggleStudentFavorite(studentUserId: string, input: ToggleStudentFavoriteDto) {
    await this.studentLessonAccessService.assertCanRead(input.lessonId, studentUserId);
    const targetExists =
      input.targetType === FavoriteTargetType.FLASHCARD
        ? await this.prisma.flashcard.findFirst({
            where: {
              id: input.targetId,
              lessonId: input.lessonId,
              deletedAt: null,
              reviewStatus: ReviewStatus.APPROVED,
            },
            select: { id: true },
          })
        : await this.prisma.quizQuestion.findFirst({
            where: {
              id: input.targetId,
              lessonId: input.lessonId,
              deletedAt: null,
              reviewStatus: ReviewStatus.APPROVED,
            },
            select: { id: true },
          });
    if (!targetExists) {
      throw notFoundException(
        "FAVORITE_TARGET_NOT_FOUND",
        "Không tìm thấy nội dung cần lưu",
      );
    }

    const key = {
      studentUserId_targetType_targetId: {
        studentUserId,
        targetType: input.targetType,
        targetId: input.targetId,
      },
    };
    const existing = await this.prisma.favorite.findUnique({
      where: key,
      select: { id: true },
    });
    if (existing) {
      await this.prisma.favorite.delete({ where: { id: existing.id } });
      return { isFavorite: false };
    }
    await this.prisma.favorite.create({
      data: {
        studentUserId,
        lessonId: input.lessonId,
        targetType: input.targetType,
        targetId: input.targetId,
      },
    });
    return { isFavorite: true };
  }

  private async getStudentSetProgressSummary(
    flashcardSetId: string,
    studentUserId: string,
  ) {
    const [cards, progress] = await Promise.all([
      this.prisma.flashcard.findMany({
        where: {
          flashcardSetId,
          deletedAt: null,
          reviewStatus: ReviewStatus.APPROVED,
        },
        select: { id: true },
      }),
      this.prisma.flashcardProgress.findMany({
        where: {
          studentUserId,
          flashcard: {
            flashcardSetId,
            deletedAt: null,
            reviewStatus: ReviewStatus.APPROVED,
          },
        },
        select: { isKnown: true },
      }),
    ]);
    const knownCount = progress.filter((entry) => entry.isKnown).length;
    return {
      totalCount: cards.length,
      reviewedCount: progress.length,
      knownCount,
      unknownCount: progress.length - knownCount,
      unreviewedCount: cards.length - progress.length,
      isCompleted: cards.length === 0 || progress.length === cards.length,
    };
  }

  private async findActiveSet(setId: string) {
    const set = await this.prisma.flashcardSet.findFirst({
      where: { id: setId, deletedAt: null },
      select: adminFlashcardSetSelect,
    });
    if (!set) {
      throw notFoundException("NOT_FOUND", "Không tìm thấy bộ flashcard");
    }
    return set;
  }

  private async findActiveCard(flashcardId: string) {
    const card = await this.prisma.flashcard.findFirst({
      where: {
        id: flashcardId,
        deletedAt: null,
        flashcardSet: { deletedAt: null },
      },
      select: adminFlashcardSelect,
    });
    if (!card) {
      throw notFoundException("NOT_FOUND", "Không tìm thấy flashcard");
    }
    return card;
  }
}

function normalizeTitle(title: string) {
  const normalized = title.trim();
  if (!normalized) {
    throw badRequestException(
      "FLASHCARD_SET_TITLE_REQUIRED",
      "Tên bộ flashcard không được để trống",
    );
  }
  return normalized;
}

function normalizeCardDifficulty(difficulty: Difficulty | undefined) {
  if (difficulty === Difficulty.MIXED) {
    throw badRequestException(
      "FLASHCARD_DIFFICULTY_INVALID",
      "Mỗi flashcard phải có một mức độ cụ thể",
    );
  }
  return difficulty ?? Difficulty.MEDIUM;
}

function validateCardContent(input: CreateFlashcardInput) {
  if (!hasTiptapContent(input.frontJson)) {
    throw badRequestException(
      "FLASHCARD_FRONT_REQUIRED",
      "Mặt trước flashcard không được để trống",
    );
  }
  if (!hasTiptapContent(input.backJson)) {
    throw badRequestException(
      "FLASHCARD_BACK_REQUIRED",
      "Mặt sau flashcard không được để trống",
    );
  }
  normalizeCardDifficulty(input.difficulty);
}

async function syncFlashcardExplanation(
  transaction: Prisma.TransactionClient,
  input: {
    currentExplanationId: string | null;
    explanationJson: Record<string, unknown> | null | undefined;
    flashcardId: string;
    lessonId: string;
  },
) {
  if (input.explanationJson === undefined) {
    return input.currentExplanationId;
  }

  if (input.explanationJson === null || !hasTiptapContent(input.explanationJson)) {
    if (input.currentExplanationId) {
      await transaction.aiExplanation.delete({
        where: { id: input.currentExplanationId },
      });
    }
    return null;
  }

  if (input.currentExplanationId) {
    const explanation = await transaction.aiExplanation.update({
      where: { id: input.currentExplanationId },
      data: {
        contentJson: toFlashcardInputJson(input.explanationJson),
        source: ContentSource.ADMIN,
        reviewStatus: ReviewStatus.APPROVED,
        staleAt: null,
      },
      select: { id: true },
    });
    return explanation.id;
  }

  const explanation = await transaction.aiExplanation.create({
    data: {
      targetType: AiExplanationTargetType.FLASHCARD,
      targetId: input.flashcardId,
      lessonId: input.lessonId,
      contentJson: toFlashcardInputJson(input.explanationJson),
      source: ContentSource.ADMIN,
      reviewStatus: ReviewStatus.APPROVED,
    },
    select: { id: true },
  });
  return explanation.id;
}
