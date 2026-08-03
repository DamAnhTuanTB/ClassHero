import { Injectable } from "@nestjs/common";
import {
  ContentSource,
  Difficulty,
  Prisma,
  QuestionType,
  ReviewStatus,
} from "@prisma/client";
import type { getRequestContext } from "#api/common/api/request-context";
import { notFoundException } from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import {
  type CreateTestSetDto,
  type TestQuestionContentDto,
  type UpdateTestQuestionContentDto,
  type UpdateTestSetDto,
} from "#api/modules/tests/dto/test-content.dto";
import {
  calculateEffectivePoints,
  changesExplanationContext,
  syncExplanation,
  toInputJson,
  toNullableInputJson,
  toOptionalJsonRecord,
  toOptionalJsonValue,
  toRecord,
  validateQuestionContent,
} from "#api/modules/tests/utils/test-question-content";

type RequestContext = ReturnType<typeof getRequestContext>;

@Injectable()
export class TestsService {
  constructor(private readonly prisma: PrismaService) {}

  async listSetsByLesson(lessonId: string) {
    return this.prisma.testSet.findMany({
      where: { lessonId, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        _count: {
          select: {
            questions: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });
  }

  async createSet(
    lessonId: string,
    userId: string,
    dto: CreateTestSetDto,
    _context: RequestContext,
  ) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true },
    });
    if (!lesson) {
      throw notFoundException("NOT_FOUND", "Không tìm thấy buổi học");
    }

    return this.prisma.$transaction(async (transaction) => {
      const lastSet = await transaction.testSet.findFirst({
        where: { lessonId, deletedAt: null },
        orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }],
        select: { sortOrder: true },
      });

      return transaction.testSet.create({
        data: {
          lessonId,
          title: dto.title.trim(),
          durationSeconds: dto.durationSeconds,
          difficulty: dto.difficulty ?? Difficulty.MIXED,
          difficultyRatioJson: toNullableInputJson(dto.difficultyRatioJson),
          totalScore: new Prisma.Decimal(10),
          source: ContentSource.ADMIN,
          sortOrder: (lastSet?.sortOrder ?? -1) + 1,
          createdById: userId,
          updatedById: userId,
        },
      });
    });
  }

  async updateSet(
    setId: string,
    userId: string,
    dto: UpdateTestSetDto,
    _context: RequestContext,
  ) {
    const set = await this.prisma.testSet.findFirst({
      where: { id: setId, deletedAt: null },
      select: { id: true },
    });
    if (!set) {
      throw notFoundException("NOT_FOUND", "Không tìm thấy bộ đề");
    }

    return this.prisma.testSet.update({
      where: { id: setId },
      data: {
        title: dto.title?.trim(),
        durationSeconds: dto.durationSeconds,
        difficulty: dto.difficulty,
        difficultyRatioJson:
          dto.difficultyRatioJson === undefined
            ? undefined
            : toNullableInputJson(dto.difficultyRatioJson),
        updatedById: userId,
      },
    });
  }

  async reviewSet(
    setId: string,
    userId: string,
    input: { reviewStatus: ReviewStatus },
    context: RequestContext,
  ) {
    const current = await this.prisma.testSet.findFirst({
      where: { id: setId, deletedAt: null },
      select: { id: true, reviewStatus: true },
    });
    if (!current) {
      throw notFoundException("NOT_FOUND", "Không tìm thấy bộ đề");
    }
    return this.prisma.$transaction(async (transaction) => {
      const questions = await transaction.testQuestion.findMany({
        where: { testSetId: setId, deletedAt: null },
        select: { explanationId: true },
      });
      await transaction.testQuestion.updateMany({
        where: { testSetId: setId, deletedAt: null },
        data: { reviewStatus: input.reviewStatus },
      });
      const explanationIds = questions.flatMap((question) =>
        question.explanationId ? [question.explanationId] : [],
      );
      if (explanationIds.length > 0) {
        await transaction.aiExplanation.updateMany({
          where: { id: { in: explanationIds } },
          data: { reviewStatus: input.reviewStatus },
        });
      }
      const updated = await transaction.testSet.update({
        where: { id: setId },
        data: { reviewStatus: input.reviewStatus, updatedById: userId },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: userId,
          action: "TEST_SET_REVIEWED",
          entityType: "TestSet",
          entityId: setId,
          before: toInputJson(current),
          after: toInputJson({ id: updated.id, reviewStatus: updated.reviewStatus }),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });
      return updated;
    });
  }

  async deleteSet(setId: string, userId: string, _context: RequestContext) {
    const set = await this.prisma.testSet.findFirst({
      where: { id: setId, deletedAt: null },
      select: { id: true },
    });
    if (!set) {
      throw notFoundException("NOT_FOUND", "Không tìm thấy bộ đề");
    }

    return this.prisma.testSet.update({
      where: { id: setId },
      data: {
        deletedAt: new Date(),
        updatedById: userId,
      },
    });
  }

  async listQuestionsBySet(setId: string) {
    const set = await this.prisma.testSet.findFirst({
      where: { id: setId, deletedAt: null },
      select: { id: true, totalScore: true },
    });
    if (!set) {
      throw notFoundException("NOT_FOUND", "Không tìm thấy bộ đề");
    }

    const questions = await this.prisma.testQuestion.findMany({
      where: { testSetId: setId, deletedAt: null },
      orderBy: { sortOrder: "asc" },
      include: {
        explanation: {
          select: {
            id: true,
            contentJson: true,
          },
        },
      },
    });

    const effectivePoints = calculateEffectivePoints(
      questions.map((question) =>
        question.points === null ? null : question.points.toNumber(),
      ),
      set.totalScore.toNumber(),
    );

    return questions.map((question, index) => ({
      ...question,
      points: question.points?.toNumber() ?? null,
      effectivePoints: effectivePoints[index] ?? 0,
    }));
  }

  async createQuestion(
    setId: string,
    _userId: string,
    dto: TestQuestionContentDto,
    _context: RequestContext,
  ) {
    const set = await this.prisma.testSet.findFirst({
      where: { id: setId, deletedAt: null },
      select: { id: true, lessonId: true },
    });
    if (!set) {
      throw notFoundException("NOT_FOUND", "Không tìm thấy bộ đề");
    }

    validateQuestionContent(dto);

    return this.prisma.$transaction(async (transaction) => {
      const lastQuestion = await transaction.testQuestion.findFirst({
        where: { testSetId: setId, deletedAt: null },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      const question = await transaction.testQuestion.create({
        data: {
          testSetId: setId,
          lessonId: set.lessonId,
          questionType: dto.questionType,
          difficulty: dto.difficulty,
          questionJson: toInputJson(dto.questionJson),
          optionsJson: toNullableInputJson(dto.optionsJson),
          correctAnswerJson: toInputJson(dto.correctAnswerJson),
          hintJson: toNullableInputJson(dto.hintJson),
          gradingConfigJson: toNullableInputJson(dto.gradingConfigJson),
          points:
            dto.points === undefined || dto.points === null
              ? null
              : new Prisma.Decimal(dto.points),
          reviewStatus: ReviewStatus.APPROVED,
          sortOrder: (lastQuestion?.sortOrder ?? -1) + 1,
        },
      });

      const explanationId = await syncExplanation(transaction, {
        currentExplanationId: null,
        explanationJson: dto.explanationJson,
        lessonId: set.lessonId,
        questionId: question.id,
      });

      if (explanationId) {
        await transaction.testQuestion.update({
          where: { id: question.id },
          data: { explanationId },
        });
      }

      await transaction.testSet.update({
        where: { id: setId },
        data: { questionCount: { increment: 1 } },
      });

      return transaction.testQuestion.findUniqueOrThrow({
        where: { id: question.id },
        include: {
          explanation: {
            select: { id: true, contentJson: true },
          },
        },
      });
    });
  }

  async updateQuestion(
    questionId: string,
    _userId: string,
    dto: UpdateTestQuestionContentDto,
    _context: RequestContext,
  ) {
    const question = await this.prisma.testQuestion.findFirst({
      where: { id: questionId, deletedAt: null },
      include: {
        explanation: {
          select: { id: true, contentJson: true },
        },
      },
    });
    if (!question) {
      throw notFoundException("NOT_FOUND", "Không tìm thấy câu hỏi");
    }

    const mergedContent: TestQuestionContentDto = {
      questionType: dto.questionType ?? question.questionType,
      difficulty: dto.difficulty ?? question.difficulty,
      questionJson: dto.questionJson ?? toRecord(question.questionJson, "questionJson"),
      optionsJson: dto.optionsJson ?? toOptionalJsonValue(question.optionsJson),
      correctAnswerJson:
        dto.correctAnswerJson ??
        (question.correctAnswerJson as TestQuestionContentDto["correctAnswerJson"]),
      hintJson: dto.hintJson ?? toOptionalJsonRecord(question.hintJson),
      gradingConfigJson:
        dto.gradingConfigJson ?? toOptionalJsonValue(question.gradingConfigJson),
      explanationJson:
        dto.explanationJson ?? toOptionalJsonRecord(question.explanation?.contentJson),
      points:
        dto.points === undefined ? (question.points?.toNumber() ?? null) : dto.points,
    };
    validateQuestionContent(mergedContent);

    const updateData: Prisma.TestQuestionUpdateInput = {};
    if (dto.questionType) updateData.questionType = dto.questionType;
    if (dto.difficulty) updateData.difficulty = dto.difficulty;
    if (dto.questionJson) {
      updateData.questionJson = toInputJson(dto.questionJson);
    }
    if (dto.optionsJson !== undefined) {
      updateData.optionsJson = toNullableInputJson(dto.optionsJson);
    }
    if (dto.correctAnswerJson !== undefined) {
      updateData.correctAnswerJson = toInputJson(dto.correctAnswerJson);
    }
    if (dto.hintJson !== undefined) {
      updateData.hintJson = toNullableInputJson(dto.hintJson);
    }
    if (dto.gradingConfigJson !== undefined) {
      updateData.gradingConfigJson = toNullableInputJson(dto.gradingConfigJson);
    }
    if (dto.points !== undefined) {
      updateData.points = dto.points === null ? null : new Prisma.Decimal(dto.points);
    }
    if (
      mergedContent.questionType !== QuestionType.MULTIPLE_CHOICE &&
      mergedContent.questionType !== QuestionType.MULTI_STATEMENT_TRUE_FALSE
    ) {
      updateData.optionsJson = Prisma.DbNull;
    }
    if (mergedContent.questionType !== QuestionType.TEXT_INPUT) {
      updateData.gradingConfigJson = Prisma.DbNull;
    }

    return this.prisma.$transaction(async (transaction) => {
      if (
        dto.explanationJson === undefined &&
        question.explanationId &&
        changesExplanationContext(dto)
      ) {
        await transaction.aiExplanation.update({
          where: { id: question.explanationId },
          data: { staleAt: new Date() },
        });
      }
      const explanationId = await syncExplanation(transaction, {
        currentExplanationId: question.explanationId,
        explanationJson: dto.explanationJson,
        lessonId: question.lessonId,
        questionId,
      });
      if (dto.explanationJson !== undefined) {
        updateData.explanation =
          explanationId === null
            ? { disconnect: true }
            : { connect: { id: explanationId } };
      }

      return transaction.testQuestion.update({
        where: { id: questionId },
        data: updateData,
        include: {
          explanation: {
            select: { id: true, contentJson: true },
          },
        },
      });
    });
  }

  async deleteQuestion(questionId: string, _userId: string, _context: RequestContext) {
    const question = await this.prisma.testQuestion.findFirst({
      where: { id: questionId, deletedAt: null },
      select: { id: true, testSetId: true },
    });
    if (!question) {
      throw notFoundException("NOT_FOUND", "Không tìm thấy câu hỏi");
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.testQuestion.update({
        where: { id: questionId },
        data: { deletedAt: new Date() },
      });
      await transaction.testSet.update({
        where: { id: question.testSetId },
        data: { questionCount: { decrement: 1 } },
      });
    });

    return { success: true };
  }
}
