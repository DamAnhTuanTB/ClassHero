import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { Difficulty, ContentSource, ReviewStatus, QuestionType } from "@prisma/client";
import { RequestContext } from "#api/common/api/request-context";
import { QuizQuestionContentDto } from "../dto/quiz-question-content.dto";

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
    context: RequestContext,
  ) {
    // Verify lesson exists
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) {
      throw new NotFoundException("Lesson not found");
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
    context: RequestContext,
  ) {
    const set = await this.prisma.quizSet.findUnique({ where: { id: setId, deletedAt: null } });
    if (!set) throw new NotFoundException("Quiz Set not found");

    return this.prisma.quizSet.update({
      where: { id: setId },
      data: {
        ...dto,
        updatedById: userId,
      },
    });
  }

  async deleteQuizSet(setId: string, userId: string, context: RequestContext) {
    const set = await this.prisma.quizSet.findUnique({ where: { id: setId, deletedAt: null } });
    if (!set) throw new NotFoundException("Quiz Set not found");

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
    userId: string,
    dto: QuizQuestionContentDto,
    context: RequestContext,
  ) {
    const set = await this.prisma.quizSet.findUnique({ where: { id: setId, deletedAt: null } });
    if (!set) throw new NotFoundException("Quiz Set not found");

    const question = await this.prisma.quizQuestion.create({
      data: {
        quizSetId: setId,
        lessonId: set.lessonId,
        questionType: dto.questionType,
        difficulty: dto.difficulty,
        questionJson: dto.questionJson || {},
        optionsJson: (dto.optionsJson as any) || null,
        correctAnswerJson: (dto.correctAnswerJson as any) || null,
        hintJson: dto.hintJson || null,
        gradingConfigJson: (dto.gradingConfigJson as any) || null,
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
    userId: string,
    dto: Partial<QuizQuestionContentDto>,
    context: RequestContext,
  ) {
    const question = await this.prisma.quizQuestion.findUnique({ where: { id: questionId } });
    if (!question) throw new NotFoundException("Question not found");

    const updateData: any = {};
    if (dto.questionType) updateData.questionType = dto.questionType;
    if (dto.difficulty) updateData.difficulty = dto.difficulty;
    if (dto.questionJson) updateData.questionJson = dto.questionJson;
    if (dto.optionsJson !== undefined) updateData.optionsJson = dto.optionsJson;
    if (dto.correctAnswerJson !== undefined) updateData.correctAnswerJson = dto.correctAnswerJson;
    if (dto.hintJson !== undefined) updateData.hintJson = dto.hintJson;
    if (dto.gradingConfigJson !== undefined) updateData.gradingConfigJson = dto.gradingConfigJson;

    return this.prisma.quizQuestion.update({
      where: { id: questionId },
      data: updateData,
    });
  }

  async deleteQuestion(questionId: string, userId: string, context: RequestContext) {
    const question = await this.prisma.quizQuestion.findUnique({ where: { id: questionId } });
    if (!question) throw new NotFoundException("Question not found");

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
