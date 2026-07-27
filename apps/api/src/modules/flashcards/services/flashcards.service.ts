import { Injectable } from "@nestjs/common";
import {
  AiExplanationTargetType,
  ContentSource,
  Difficulty,
  EnrollmentStatus,
  Prisma,
  PublishStatus,
  ReviewStatus,
} from "@prisma/client";
import {
  badRequestException,
  forbiddenException,
  notFoundException,
} from "#api/common/errors/api-exception";
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

@Injectable()
export class FlashcardsService {
  constructor(private readonly prisma: PrismaService) {}

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
    await this.assertStudentLessonAccess(lessonId, studentUserId);
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
    return records.map(serializeStudentFlashcardSet);
  }

  private async assertStudentLessonAccess(lessonId: string, studentUserId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        id: lessonId,
        deletedAt: null,
        status: PublishStatus.PUBLISHED,
      },
      select: {
        learningPathId: true,
        trialEnabled: true,
      },
    });
    if (!lesson) {
      throw notFoundException("NOT_FOUND", "Không tìm thấy buổi học");
    }
    if (lesson.trialEnabled) {
      return;
    }

    const now = new Date();
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        studentUserId,
        status: EnrollmentStatus.ACTIVE,
        startsAt: { lte: now },
        expiresAt: { gt: now },
        OR: [
          { learningPathId: lesson.learningPathId },
          { deliveryLearningPathId: lesson.learningPathId },
        ],
      },
      select: { id: true },
    });
    if (!enrollment) {
      throw forbiddenException(
        "ENROLLMENT_REQUIRED",
        "Bạn cần quyền học buổi này để xem flashcard",
      );
    }
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
