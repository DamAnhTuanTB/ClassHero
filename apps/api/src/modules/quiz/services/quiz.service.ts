import { Injectable } from "@nestjs/common";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { notFoundException } from "#api/common/errors/api-exception";
import type { getRequestContext } from "#api/common/api/request-context";
import { ContentSource, Difficulty, Prisma, ReviewStatus } from "@prisma/client";
import { QuizQuestionContentDto } from "#api/modules/quiz/dto/quiz-question-content.dto";

type RequestContext = ReturnType<typeof getRequestContext>;

export interface CreateQuizSetDto {
  title: string;
  difficulty?: Difficulty;
}

export interface UpdateQuizSetDto {
  title?: string;
  difficulty?: Difficulty;
  reviewStatus?: ReviewStatus;
}

@Injectable()
export class QuizService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Quiz Set ---

  async listQuizSetsByLesson(lessonId: string) {
    return this.prisma.quizSet.findMany({
      where: { lessonId, deletedAt: null },
      orderBy: { sortOrder: "asc" },
      include: {
        _count: {
          select: { questions: true },
        },
      },
    });
  }

  async createQuizSet(
    lessonId: string,
    userId: string,
    dto: CreateQuizSetDto,
    _context: RequestContext,
  ) {
    // Verify lesson exists
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) {
      throw notFoundException("NOT_FOUND", "Không tìm thấy buổi học");
    }

    return this.prisma.quizSet.create({
      data: {
        lessonId,
        title: dto.title,
        difficulty: dto.difficulty || Difficulty.MIXED,
        source: ContentSource.ADMIN,
        createdById: userId,
        updatedById: userId,
      },
    });
  }

  async updateQuizSet(
    setId: string,
    userId: string,
    dto: UpdateQuizSetDto,
    _context: RequestContext,
  ) {
    const set = await this.prisma.quizSet.findUnique({
      where: { id: setId, deletedAt: null },
    });
    if (!set) {
      throw notFoundException("NOT_FOUND", "Không tìm thấy bộ câu hỏi");
    }

    return this.prisma.quizSet.update({
      where: { id: setId },
      data: {
        ...dto,
        updatedById: userId,
      },
    });
  }

  async deleteQuizSet(setId: string, userId: string, _context: RequestContext) {
    const set = await this.prisma.quizSet.findUnique({
      where: { id: setId, deletedAt: null },
    });
    if (!set) {
      throw notFoundException("NOT_FOUND", "Không tìm thấy bộ câu hỏi");
    }

    return this.prisma.quizSet.update({
      where: { id: setId },
      data: {
        deletedAt: new Date(),
        updatedById: userId,
      },
    });
  }

  // --- Quiz Question ---

  async listQuestionsBySet(setId: string) {
    return this.prisma.quizQuestion.findMany({
      where: { quizSetId: setId },
    });
  }

  async createQuestion(
    setId: string,
    _userId: string,
    dto: QuizQuestionContentDto,
    _context: RequestContext,
  ) {
    const set = await this.prisma.quizSet.findUnique({
      where: { id: setId, deletedAt: null },
    });
    if (!set) {
      throw notFoundException("NOT_FOUND", "Không tìm thấy bộ câu hỏi");
    }

    const question = await this.prisma.quizQuestion.create({
      data: {
        quizSetId: setId,
        lessonId: set.lessonId,
        questionType: dto.questionType,
        difficulty: dto.difficulty,
        questionJson: toInputJson(dto.questionJson),
        optionsJson: toNullableInputJson(dto.optionsJson),
        correctAnswerJson: toInputJson(dto.correctAnswerJson),
        hintJson: toNullableInputJson(dto.hintJson),
        gradingConfigJson: toNullableInputJson(dto.gradingConfigJson),
        reviewStatus: ReviewStatus.APPROVED,
      },
    });

    // Update count
    await this.prisma.quizSet.update({
      where: { id: setId },
      data: { questionCount: { increment: 1 } },
    });

    return question;
  }

  async updateQuestion(
    questionId: string,
    _userId: string,
    dto: Partial<QuizQuestionContentDto>,
    _context: RequestContext,
  ) {
    const question = await this.prisma.quizQuestion.findUnique({
      where: { id: questionId },
    });
    if (!question) {
      throw notFoundException("NOT_FOUND", "Không tìm thấy câu hỏi");
    }

    const updateData: Prisma.QuizQuestionUpdateInput = {};
    if (dto.questionType) updateData.questionType = dto.questionType;
    if (dto.difficulty) updateData.difficulty = dto.difficulty;
    if (dto.questionJson) updateData.questionJson = toInputJson(dto.questionJson);
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

    return this.prisma.quizQuestion.update({
      where: { id: questionId },
      data: updateData,
    });
  }

  async deleteQuestion(questionId: string, _userId: string, _context: RequestContext) {
    const question = await this.prisma.quizQuestion.findUnique({
      where: { id: questionId },
    });
    if (!question) {
      throw notFoundException("NOT_FOUND", "Không tìm thấy câu hỏi");
    }

    await this.prisma.quizQuestion.delete({
      where: { id: questionId },
    });

    // Update count
    await this.prisma.quizSet.update({
      where: { id: question.quizSetId },
      data: { questionCount: { decrement: 1 } },
    });

    return { success: true };
  }
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toNullableInputJson(
  value: unknown | undefined,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return value === undefined ? Prisma.DbNull : toInputJson(value);
}
