import { Inject, Injectable } from "@nestjs/common";
import {
  AiGenerationType,
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
  serializeAdminFlashcardAccessUrls,
  serializeAdminFlashcardSet,
  serializeStudentFlashcardSet,
} from "#api/modules/flashcards/serializers/flashcard.serializers";
import { FilesService } from "#api/modules/files/services/files.service";
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
import { readFlashcardGenerationReference } from "#api/modules/flashcards/utils/flashcard-generation-reference";
import { StudentLessonAccessService } from "#api/modules/learning-paths/services/student-lesson-access.service";
import type { ToggleStudentFavoriteDto } from "#api/modules/flashcards/dto/student-flashcard-progress.dto";

@Injectable()
export class FlashcardsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StudentLessonAccessService)
    private readonly studentLessonAccessService: StudentLessonAccessService,
    @Inject(FilesService) private readonly files: FilesService,
  ) {}

  async listAdminSetsByLesson(lessonId: string) {
    const records = await this.prisma.flashcardSet.findMany({
      where: { lessonId, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: adminFlashcardSetSelect,
    });
    if (records.length === 0) return [];
    const setIds = records.map((set) => set.id);
    const [pendingGroups, unpublishedGroups, aiGenerations, usageGroups] =
      await Promise.all([
        this.prisma.flashcard.groupBy({
          by: ["flashcardSetId"],
          where: {
            flashcardSetId: { in: setIds },
            deletedAt: null,
            reviewStatus: ReviewStatus.NEEDS_REVIEW,
          },
          _count: { _all: true },
        }),
        this.prisma.flashcard.groupBy({
          by: ["flashcardSetId"],
          where: {
            flashcardSetId: { in: setIds },
            deletedAt: null,
            reviewStatus: ReviewStatus.APPROVED,
            publishedAt: null,
          },
          _count: { _all: true },
        }),
        this.prisma.aiGeneration.findMany({
          where: {
            type: AiGenerationType.FLASHCARD,
            targetType: "FLASHCARD_SET",
            targetId: { in: setIds },
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            targetId: true,
            status: true,
            model: true,
            inputMetaJson: true,
            startedAt: true,
            finishedAt: true,
            createdAt: true,
          },
        }),
        this.prisma.providerUsageEvent.groupBy({
          by: ["aiGenerationId"],
          where: {
            aiGenerationId: { not: null },
            aiGeneration: {
              type: AiGenerationType.FLASHCARD,
              targetType: "FLASHCARD_SET",
              targetId: { in: setIds },
            },
          },
          _count: { _all: true },
          _sum: { costVnd: true },
        }),
      ]);
    const pendingBySetId = new Map(
      pendingGroups.map((group) => [group.flashcardSetId, group._count._all]),
    );
    const unpublishedBySetId = new Map(
      unpublishedGroups.map((group) => [group.flashcardSetId, group._count._all]),
    );
    const usageByGenerationId = new Map(
      usageGroups.flatMap((group) =>
        group.aiGenerationId
          ? [
              [
                group.aiGenerationId,
                {
                  totalCostVnd: group._sum.costVnd ?? 0,
                  usageEventCount: group._count._all,
                },
              ] as const,
            ]
          : [],
      ),
    );
    type FlashcardGenerationListItem = (typeof aiGenerations)[number] & {
      totalCostVnd: number;
      usageEventCount: number;
    };
    const generationsBySetId = new Map<string, FlashcardGenerationListItem[]>();
    aiGenerations.forEach((generation) => {
      if (!generation.targetId) return;
      const current = generationsBySetId.get(generation.targetId) ?? [];
      const usage = usageByGenerationId.get(generation.id);
      current.push({
        ...generation,
        totalCostVnd: usage?.totalCostVnd ?? 0,
        usageEventCount: usage?.usageEventCount ?? 0,
      });
      generationsBySetId.set(generation.targetId, current);
    });
    return records.map((set) => ({
      ...serializeAdminFlashcardSet(set),
      pendingReviewCardCount: pendingBySetId.get(set.id) ?? 0,
      unpublishedApprovedCardCount: unpublishedBySetId.get(set.id) ?? 0,
      aiGenerations: generationsBySetId.get(set.id) ?? [],
    }));
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
    const action =
      input.action ??
      (input.reviewStatus === ReviewStatus.APPROVED
        ? "PUBLISH"
        : input.reviewStatus === ReviewStatus.HIDDEN
          ? "WITHDRAW"
          : "SAVE");
    const record = await this.prisma.$transaction(async (transaction) => {
      if (action === "PUBLISH") {
        const approvedCardCount = await transaction.flashcard.count({
          where: {
            flashcardSetId: setId,
            deletedAt: null,
            reviewStatus: ReviewStatus.APPROVED,
          },
        });
        if (approvedCardCount < 1) {
          throw badRequestException(
            "FLASHCARD_SET_HAS_NO_APPROVED_CARDS",
            "Cần có ít nhất 1 thẻ Flashcard được duyệt để phát hành",
            { approvedCardCount },
          );
        }
      }
      const latestPublication =
        action === "SAVE"
          ? await transaction.flashcard.findFirst({
              where: {
                flashcardSetId: setId,
                deletedAt: null,
                publishedAt: { not: null },
              },
              orderBy: { publishedAt: "desc" },
              select: { publishedAt: true },
            })
          : null;
      const publishedAt = latestPublication?.publishedAt ?? new Date();
      if (action === "SAVE" || action === "PUBLISH") {
        await transaction.flashcard.updateMany({
          where: {
            flashcardSetId: setId,
            deletedAt: null,
            reviewStatus: ReviewStatus.APPROVED,
          },
          data: { publishedAt },
        });
      }
      const nextReviewStatus =
        action === "PUBLISH"
          ? ReviewStatus.APPROVED
          : action === "WITHDRAW"
            ? ReviewStatus.HIDDEN
            : current.reviewStatus;
      const updated = await transaction.flashcardSet.update({
        where: { id: setId },
        data: {
          reviewStatus: nextReviewStatus,
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
          after: toFlashcardInputJson({
            ...serializeAdminFlashcardSet(updated),
            action,
          }),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });
      return updated;
    });
    return serializeAdminFlashcardSet(record);
  }

  async reviewAllPendingAiCards(
    setId: string,
    actorUserId: string,
    context: FlashcardRequestContext = {},
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const set = await transaction.flashcardSet.findFirst({
        where: { id: setId, deletedAt: null },
        select: { id: true, source: true },
      });
      if (!set) {
        throw notFoundException("NOT_FOUND", "Không tìm thấy bộ Flashcard");
      }
      const pendingCards = await transaction.flashcard.findMany({
        where: {
          flashcardSetId: setId,
          deletedAt: null,
          reviewStatus: ReviewStatus.NEEDS_REVIEW,
        },
        select: { id: true, sourceMetadataJson: true },
      });
      const aiCards = pendingCards.filter(
        (card) =>
          set.source === ContentSource.AI ||
          readFlashcardGenerationReference(card.sourceMetadataJson) !== null,
      );
      const cardIds = aiCards.map((card) => card.id);
      const approved =
        cardIds.length > 0
          ? await transaction.flashcard.updateMany({
              where: {
                id: { in: cardIds },
                deletedAt: null,
                reviewStatus: ReviewStatus.NEEDS_REVIEW,
              },
              data: { reviewStatus: ReviewStatus.APPROVED, publishedAt: null },
            })
          : { count: 0 };
      const pendingReviewCardCount = await transaction.flashcard.count({
        where: {
          flashcardSetId: setId,
          deletedAt: null,
          reviewStatus: ReviewStatus.NEEDS_REVIEW,
        },
      });
      if (approved.count > 0) {
        await transaction.auditLog.create({
          data: {
            actorUserId,
            action: "FLASHCARD_AI_CARDS_BULK_REVIEWED",
            entityType: "FlashcardSet",
            entityId: setId,
            before: toFlashcardInputJson({ pendingAiCardCount: aiCards.length }),
            after: toFlashcardInputJson({
              approvedCardCount: approved.count,
              pendingReviewCardCount,
            }),
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
          },
        });
      }
      return { approvedCardCount: approved.count, pendingReviewCardCount };
    });
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
    return Promise.all(
      records.map((record) => serializeAdminFlashcardAccessUrls(record, this.files)),
    );
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
          solutionJson:
            input.solutionJson && hasTiptapContent(input.solutionJson)
              ? toFlashcardInputJson(input.solutionJson)
              : Prisma.JsonNull,
          difficulty: normalizeCardDifficulty(input.difficulty),
          reviewStatus: ReviewStatus.APPROVED,
          sortOrder: input.sortOrder ?? (lastCard?.sortOrder ?? -1) + 1,
        },
        select: { id: true },
      });
      const flashcard = await transaction.flashcard.findUniqueOrThrow({
        where: { id: created.id },
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
      solutionJson:
        input.solutionJson === undefined
          ? current.solutionJson === null
            ? null
            : toFlashcardRecord(current.solutionJson, "solutionJson")
          : input.solutionJson,
      difficulty: input.difficulty ?? current.difficulty,
      sortOrder: input.sortOrder ?? current.sortOrder,
    };
    validateCardContent(merged);

    const record = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.flashcard.update({
        where: { id: flashcardId },
        data: {
          ...(input.frontJson !== undefined
            ? { frontJson: toFlashcardInputJson(input.frontJson) }
            : {}),
          ...(input.backJson !== undefined
            ? { backJson: toFlashcardInputJson(input.backJson) }
            : {}),
          ...(input.solutionJson !== undefined
            ? {
                solutionJson:
                  input.solutionJson && hasTiptapContent(input.solutionJson)
                    ? toFlashcardInputJson(input.solutionJson)
                    : Prisma.JsonNull,
              }
            : {}),
          ...(input.difficulty !== undefined
            ? { difficulty: normalizeCardDifficulty(input.difficulty) }
            : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          publishedAt: null,
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

  async reviewCard(
    flashcardId: string,
    actorUserId: string,
    input: ReviewFlashcardSetInput,
    context: FlashcardRequestContext = {},
  ) {
    const current = await this.findActiveCard(flashcardId);
    const record = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.flashcard.update({
        where: { id: flashcardId },
        data: { reviewStatus: input.reviewStatus, publishedAt: null },
        select: adminFlashcardSelect,
      });
      await transaction.flashcardSet.update({
        where: { id: current.flashcardSetId },
        data: { updatedById: actorUserId },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId,
          action: "FLASHCARD_REVIEWED",
          entityType: "Flashcard",
          entityId: flashcardId,
          before: toFlashcardInputJson({ reviewStatus: current.reviewStatus }),
          after: toFlashcardInputJson({ reviewStatus: updated.reviewStatus }),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });
      return updated;
    });
    return serializeAdminFlashcard(record);
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

    return Promise.all(
      records.map((record) =>
        serializeStudentFlashcardSet(
          record,
          progressByCardId,
          favoriteCardIds,
          this.files,
        ),
      ),
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
            publishedAt: { not: null },
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
        publishedAt: { not: null },
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
              publishedAt: { not: null },
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
          publishedAt: { not: null },
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
            publishedAt: { not: null },
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
