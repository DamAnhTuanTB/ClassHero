import { Injectable } from "@nestjs/common";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { badRequestException, notFoundException } from "#api/common/errors/api-exception";
import type { getRequestContext } from "#api/common/api/request-context";
import {
  AiGenerationStatus,
  AiExplanationTargetType,
  ContentSource,
  Difficulty,
  Prisma,
  QuestionType,
  ReviewStatus,
} from "@prisma/client";
import {
  QuizQuestionContentDto,
  UpdateQuizQuestionContentDto,
} from "#api/modules/quiz/dto/quiz-question-content.dto";
import {
  correctAnswerSchema,
  multiStatementCorrectAnswerSchema,
  multiStatementOptionsSchema,
  multipleChoiceOptionsSchema,
  textInputGradingSchema,
} from "#api/modules/quiz/types/quiz.types";
import { getTiptapText } from "#api/common/validation/rich-text-content";
import {
  lessonSummaryMvpBlockSchema,
  type LessonSummaryMvpBlock,
} from "#api/modules/ai/types/lesson-summary.types";

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
    const sets = await this.prisma.quizSet.findMany({
      where: { lessonId, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        aiGeneration: {
          select: { id: true, inputMetaJson: true },
        },
        _count: {
          select: {
            questions: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });
    if (sets.length === 0) return [];
    const setIds = sets.map((set) => set.id);
    const [pendingGroups, aiGenerations] = await Promise.all([
      this.prisma.quizQuestion.groupBy({
        by: ["quizSetId"],
        where: {
          quizSetId: { in: setIds },
          deletedAt: null,
          reviewStatus: ReviewStatus.NEEDS_REVIEW,
        },
        _count: { _all: true },
      }),
      this.prisma.aiGeneration.findMany({
        where: {
          type: "QUIZ",
          status: AiGenerationStatus.SUCCEEDED,
          targetType: "QUIZ_SET",
          targetId: { in: setIds },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, targetId: true, inputMetaJson: true, createdAt: true },
      }),
    ]);
    const pendingBySetId = new Map(
      pendingGroups.map((group) => [group.quizSetId, group._count._all]),
    );
    const generationsBySetId = new Map<string, typeof aiGenerations>();
    aiGenerations.forEach((generation) => {
      if (!generation.targetId) return;
      const current = generationsBySetId.get(generation.targetId) ?? [];
      current.push(generation);
      generationsBySetId.set(generation.targetId, current);
    });
    return sets.map((set) => ({
      ...set,
      pendingReviewQuestionCount: pendingBySetId.get(set.id) ?? 0,
      aiGenerations: generationsBySetId.get(set.id) ?? [],
    }));
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

    return this.prisma.$transaction(async (transaction) => {
      const lastSet = await transaction.quizSet.findFirst({
        where: { lessonId, deletedAt: null },
        orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }],
        select: { sortOrder: true },
      });

      return transaction.quizSet.create({
        data: {
          lessonId,
          title: dto.title,
          difficulty: dto.difficulty || Difficulty.MIXED,
          source: ContentSource.ADMIN,
          sortOrder: (lastSet?.sortOrder ?? -1) + 1,
          createdById: userId,
          updatedById: userId,
        },
      });
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

  async reviewQuizSet(
    setId: string,
    userId: string,
    input: { reviewStatus: ReviewStatus },
    context: RequestContext,
  ) {
    const current = await this.prisma.quizSet.findUnique({
      where: { id: setId, deletedAt: null },
      select: { id: true, reviewStatus: true },
    });
    if (!current) {
      throw notFoundException("NOT_FOUND", "Không tìm thấy bộ câu hỏi");
    }
    return this.prisma.$transaction(async (transaction) => {
      const questions = await transaction.quizQuestion.findMany({
        where: { quizSetId: setId, deletedAt: null },
        select: { explanationId: true },
      });
      await transaction.quizQuestion.updateMany({
        where: { quizSetId: setId, deletedAt: null },
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
      const updated = await transaction.quizSet.update({
        where: { id: setId },
        data: { reviewStatus: input.reviewStatus, updatedById: userId },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: userId,
          action: "QUIZ_SET_REVIEWED",
          entityType: "QuizSet",
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
      where: { quizSetId: setId, deletedAt: null },
      orderBy: { sortOrder: "asc" },
      include: {
        explanation: {
          select: {
            id: true,
            contentJson: true,
            reviewStatus: true,
            staleAt: true,
          },
        },
      },
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

    validateQuestionContent(dto);

    return this.prisma.$transaction(async (transaction) => {
      const lastQuestion = await transaction.quizQuestion.findFirst({
        where: { quizSetId: setId, deletedAt: null },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      const question = await transaction.quizQuestion.create({
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
        await transaction.quizQuestion.update({
          where: { id: question.id },
          data: { explanationId },
        });
      }

      await transaction.quizSet.update({
        where: { id: setId },
        data: { questionCount: { increment: 1 } },
      });

      return transaction.quizQuestion.findUniqueOrThrow({
        where: { id: question.id },
        include: {
          explanation: {
            select: {
              id: true,
              contentJson: true,
              reviewStatus: true,
              staleAt: true,
            },
          },
        },
      });
    });
  }

  async updateQuestion(
    questionId: string,
    _userId: string,
    dto: UpdateQuizQuestionContentDto,
    _context: RequestContext,
  ) {
    const question = await this.prisma.quizQuestion.findUnique({
      where: { id: questionId, deletedAt: null },
      include: {
        explanation: {
          select: {
            id: true,
            contentJson: true,
            reviewStatus: true,
            staleAt: true,
          },
        },
      },
    });
    if (!question) {
      throw notFoundException("NOT_FOUND", "Không tìm thấy câu hỏi");
    }

    const mergedContent: QuizQuestionContentDto = {
      questionType: dto.questionType ?? question.questionType,
      difficulty: dto.difficulty ?? question.difficulty,
      questionJson: dto.questionJson ?? toRecord(question.questionJson, "questionJson"),
      optionsJson: dto.optionsJson ?? toOptionalJsonValue(question.optionsJson),
      correctAnswerJson:
        dto.correctAnswerJson ??
        (question.correctAnswerJson as QuizQuestionContentDto["correctAnswerJson"]),
      hintJson: dto.hintJson ?? toOptionalJsonRecord(question.hintJson),
      gradingConfigJson:
        dto.gradingConfigJson ?? toOptionalJsonValue(question.gradingConfigJson),
      explanationJson:
        dto.explanationJson ?? toOptionalJsonRecord(question.explanation?.contentJson),
    };
    validateQuestionContent(mergedContent);
    let exampleBlock: Extract<LessonSummaryMvpBlock, { type: "example" }> | null = null;
    if (dto.exampleBlock) {
      const parsedExampleBlock = lessonSummaryMvpBlockSchema.safeParse(dto.exampleBlock);
      if (!parsedExampleBlock.success || parsedExampleBlock.data.type !== "example") {
        throw badRequestException(
          "QUIZ_EXAMPLE_BLOCK_INVALID",
          "Khối Ví dụ của câu Quiz không đúng cấu trúc dùng chung với Sinh kiến thức",
          parsedExampleBlock.success ? undefined : parsedExampleBlock.error.flatten(),
        );
      }
      exampleBlock = parsedExampleBlock.data;
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
    if (
      mergedContent.questionType !== QuestionType.MULTIPLE_CHOICE &&
      mergedContent.questionType !== QuestionType.MULTI_STATEMENT_TRUE_FALSE
    ) {
      updateData.optionsJson = Prisma.DbNull;
    }
    if (mergedContent.questionType !== QuestionType.TEXT_INPUT) {
      updateData.gradingConfigJson = Prisma.DbNull;
    }
    if (exampleBlock) {
      updateData.sourceMetadataJson = toInputJson(
        replaceStructuredExample(question.sourceMetadataJson, exampleBlock),
      );
    } else if (changesExplanationContext(dto) || dto.explanationJson !== undefined) {
      updateData.sourceMetadataJson = toInputJson(
        removeStructuredExample(question.sourceMetadataJson),
      );
    }

    return this.prisma.$transaction(async (transaction) => {
      if (exampleBlock && question.explanationId) {
        await transaction.aiExplanation.update({
          where: { id: question.explanationId },
          data: { staleAt: null },
        });
      }
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

      return transaction.quizQuestion.update({
        where: { id: questionId },
        data: updateData,
        include: {
          explanation: {
            select: {
              id: true,
              contentJson: true,
              reviewStatus: true,
              staleAt: true,
            },
          },
        },
      });
    });
  }

  async deleteQuestion(questionId: string, userId: string, context: RequestContext) {
    const question = await this.prisma.quizQuestion.findUnique({
      where: { id: questionId, deletedAt: null },
      include: {
        quizSet: {
          select: { id: true, aiGenerationId: true, questionCount: true },
        },
        explanation: { select: { aiGenerationId: true } },
      },
    });
    if (!question) {
      throw notFoundException("NOT_FOUND", "Không tìm thấy câu hỏi");
    }

    const result = await this.prisma.$transaction(async (transaction) => {
      await transaction.quizQuestion.update({
        where: { id: questionId },
        data: { deletedAt: new Date() },
      });
      const currentActiveCount = await transaction.quizQuestion.count({
        where: { quizSetId: question.quizSetId, deletedAt: null },
      });
      await transaction.quizSet.update({
        where: { id: question.quizSetId },
        data: { questionCount: currentActiveCount, updatedById: userId },
      });
      const aiGenerationId =
        question.explanation?.aiGenerationId ?? question.quizSet.aiGenerationId;
      const generationActiveCount = aiGenerationId
        ? await transaction.quizQuestion.count({
            where: {
              quizSetId: question.quizSetId,
              deletedAt: null,
              explanation: { aiGenerationId },
            },
          })
        : currentActiveCount;
      const generationAudit = await updateGenerationCurationMetadata(
        transaction,
        aiGenerationId,
        {
          currentActiveCount: generationActiveCount,
          deletedCountIncrement: 1,
          removedQuestionIndex: readGenerationQuestionIndex(
            question.sourceMetadataJson,
            question.sortOrder,
          ),
        },
      );
      await transaction.auditLog.create({
        data: {
          actorUserId: userId,
          action: "QUIZ_QUESTION_DELETED",
          entityType: "QuizQuestion",
          entityId: questionId,
          before: toInputJson({
            quizSetId: question.quizSetId,
            sortOrder: question.sortOrder,
          }),
          after: toInputJson({ deletedAt: true, currentActiveCount }),
          metadata: toInputJson({
            aiGenerationId,
            generationAudit,
          }),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });
      return { currentActiveCount, generationAudit };
    });

    return { success: true, ...result };
  }
}

async function updateGenerationCurationMetadata(
  transaction: Prisma.TransactionClient,
  aiGenerationId: string | null,
  update: {
    currentActiveCount: number;
    deletedCountIncrement?: number;
    removedQuestionIndex?: number;
  },
) {
  if (!aiGenerationId) return null;
  const generation = await transaction.aiGeneration.findUnique({
    where: { id: aiGenerationId },
    select: { inputMetaJson: true },
  });
  if (!generation) return null;
  const inputMeta = toRecordOrEmpty(generation.inputMetaJson);
  const currentAudit = toRecordOrEmpty(inputMeta.generationAudit);
  const initialGeneratedCount = readNumber(
    currentAudit.initialGeneratedCount,
    readNumber(inputMeta.questionCount, update.currentActiveCount),
  );
  const generationAudit = {
    requestedCount: readNumber(
      currentAudit.requestedCount,
      readNumber(inputMeta.questionCount, initialGeneratedCount),
    ),
    initialGeneratedCount,
    currentActiveCount: update.currentActiveCount,
    deletedCount:
      readNumber(currentAudit.deletedCount, 0) + (update.deletedCountIncrement ?? 0),
  };
  const generationIssues = Array.isArray(inputMeta.generationIssues)
    ? inputMeta.generationIssues.filter((issue) => {
        if (
          update.removedQuestionIndex === undefined ||
          !issue ||
          typeof issue !== "object" ||
          Array.isArray(issue)
        ) {
          return true;
        }
        return (
          (issue as Record<string, unknown>).questionIndex !== update.removedQuestionIndex
        );
      })
    : [];
  await transaction.aiGeneration.update({
    where: { id: aiGenerationId },
    data: {
      inputMetaJson: toInputJson({
        ...inputMeta,
        generationAudit,
        generationIssues,
      }),
    },
  });
  return generationAudit;
}

function toRecordOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readGenerationQuestionIndex(value: unknown, fallback: number) {
  return readNumber(toRecordOrEmpty(value).generationQuestionIndex, fallback);
}

function removeStructuredExample(value: unknown) {
  const metadata = toRecordOrEmpty(value);
  const { exampleBlock: _exampleBlock, ...rest } = metadata;
  return rest;
}

function replaceStructuredExample(
  value: unknown,
  exampleBlock: Extract<LessonSummaryMvpBlock, { type: "example" }>,
) {
  const metadata = toRecordOrEmpty(value);
  const {
    exampleBlock: _oldExampleBlock,
    sourceChunkIds: _sourceChunkIds,
    sourceHash: _sourceHash,
    sources: _sources,
    ...rest
  } = metadata;
  return { ...rest, exampleBlock };
}

function validateQuestionContent(dto: QuizQuestionContentDto) {
  if (getTiptapText(dto.questionJson).trim().length === 0) {
    throw badRequestException(
      "QUIZ_QUESTION_EMPTY_CONTENT",
      "Nội dung câu hỏi không được để trống",
    );
  }

  const correctAnswer = correctAnswerSchema.safeParse(dto.correctAnswerJson);
  if (!correctAnswer.success) {
    throw badRequestException(
      "QUIZ_QUESTION_INVALID_CORRECT_ANSWER",
      "Đáp án đúng chưa hợp lệ",
      correctAnswer.error.flatten(),
    );
  }

  if (dto.questionType === QuestionType.MULTIPLE_CHOICE) {
    const options = multipleChoiceOptionsSchema.safeParse(dto.optionsJson);
    if (!options.success) {
      throw badRequestException(
        "QUIZ_QUESTION_INVALID_OPTIONS",
        "Câu hỏi trắc nghiệm cần ít nhất 2 phương án hợp lệ",
        options.error.flatten(),
      );
    }

    const optionIds = options.data.map((option) => option.id);
    if (new Set(optionIds).size !== optionIds.length) {
      throw badRequestException(
        "QUIZ_QUESTION_DUPLICATE_OPTIONS",
        "Mã phương án trả lời không được trùng nhau",
      );
    }
    const optionTexts = options.data.map((option) =>
      getTiptapText(option.richText).trim().toLocaleLowerCase("vi"),
    );
    if (optionTexts.some((text) => text.length === 0)) {
      throw badRequestException(
        "QUIZ_QUESTION_EMPTY_OPTION",
        "Nội dung phương án trả lời không được để trống",
      );
    }
    if (new Set(optionTexts).size !== optionTexts.length) {
      throw badRequestException(
        "QUIZ_QUESTION_DUPLICATE_OPTION_CONTENT",
        "Nội dung các phương án trả lời không được trùng nhau",
      );
    }
    if (
      !Array.isArray(correctAnswer.data) ||
      correctAnswer.data.some(
        (answerId) => typeof answerId !== "string" || !optionIds.includes(answerId),
      )
    ) {
      throw badRequestException(
        "QUIZ_QUESTION_CORRECT_OPTION_NOT_FOUND",
        "Đáp án đúng phải thuộc danh sách phương án trả lời",
      );
    }
  }

  if (
    dto.questionType === QuestionType.TRUE_FALSE &&
    typeof correctAnswer.data !== "boolean"
  ) {
    throw badRequestException(
      "QUIZ_QUESTION_INVALID_TRUE_FALSE_ANSWER",
      "Câu hỏi đúng/sai phải chọn một đáp án đúng",
    );
  }

  if (dto.questionType === QuestionType.MULTI_STATEMENT_TRUE_FALSE) {
    const statements = multiStatementOptionsSchema.safeParse(dto.optionsJson);
    if (!statements.success) {
      throw badRequestException(
        "QUIZ_QUESTION_INVALID_STATEMENTS",
        "Câu hỏi đúng/sai nhiều mệnh đề cần ít nhất 2 mệnh đề hợp lệ",
        statements.error.flatten(),
      );
    }

    const statementIds = statements.data.map((statement) => statement.id);
    if (new Set(statementIds).size !== statementIds.length) {
      throw badRequestException(
        "QUIZ_QUESTION_DUPLICATE_STATEMENT_IDS",
        "Mã mệnh đề không được trùng nhau",
      );
    }
    if (
      statements.data.some(
        (statement) => getTiptapText(statement.richText).trim().length === 0,
      )
    ) {
      throw badRequestException(
        "QUIZ_QUESTION_EMPTY_STATEMENT",
        "Nội dung mệnh đề không được để trống",
      );
    }

    const answers = multiStatementCorrectAnswerSchema.safeParse(dto.correctAnswerJson);
    if (!answers.success) {
      throw badRequestException(
        "QUIZ_QUESTION_INVALID_STATEMENT_ANSWERS",
        "Mỗi mệnh đề phải có một đáp án Đúng hoặc Sai",
        answers.error.flatten(),
      );
    }
    const answerIds = answers.data.map((answer) => answer.statementId);
    if (
      new Set(answerIds).size !== answerIds.length ||
      answerIds.length !== statementIds.length ||
      answerIds.some((statementId) => !statementIds.includes(statementId))
    ) {
      throw badRequestException(
        "QUIZ_QUESTION_STATEMENT_ANSWER_MISMATCH",
        "Đáp án phải ánh xạ đúng một lần cho mọi mệnh đề",
      );
    }
  }

  if (dto.questionType === QuestionType.TEXT_INPUT) {
    if (
      !Array.isArray(correctAnswer.data) ||
      correctAnswer.data.some(
        (answer) => typeof answer !== "string" || answer.trim().length === 0,
      )
    ) {
      throw badRequestException(
        "QUIZ_QUESTION_INVALID_TEXT_ANSWERS",
        "Câu hỏi nhập đáp án cần ít nhất một câu trả lời hợp lệ",
      );
    }
    const gradingConfig = textInputGradingSchema.safeParse(dto.gradingConfigJson ?? {});
    if (!gradingConfig.success) {
      throw badRequestException(
        "QUIZ_QUESTION_INVALID_GRADING_CONFIG",
        "Cấu hình chấm câu trả lời chưa hợp lệ",
        gradingConfig.error.flatten(),
      );
    }
  }
}

function changesExplanationContext(dto: UpdateQuizQuestionContentDto) {
  return [
    dto.questionType,
    dto.questionJson,
    dto.optionsJson,
    dto.correctAnswerJson,
    dto.hintJson,
  ].some((value) => value !== undefined);
}

async function syncExplanation(
  transaction: Prisma.TransactionClient,
  input: {
    currentExplanationId: string | null;
    explanationJson: Record<string, unknown> | null | undefined;
    lessonId: string;
    questionId: string;
  },
) {
  if (input.explanationJson === undefined) {
    return input.currentExplanationId;
  }

  if (input.explanationJson === null || isEmptyTiptapDocument(input.explanationJson)) {
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
        contentJson: toInputJson(input.explanationJson),
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
      targetType: AiExplanationTargetType.QUIZ_QUESTION,
      targetId: input.questionId,
      lessonId: input.lessonId,
      contentJson: toInputJson(input.explanationJson),
      source: ContentSource.ADMIN,
      reviewStatus: ReviewStatus.APPROVED,
    },
    select: { id: true },
  });
  return explanation.id;
}

function isEmptyTiptapDocument(value: Record<string, unknown>) {
  return getTiptapText(value).trim().length === 0;
}

function toRecord(value: Prisma.JsonValue, fieldName: string) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw badRequestException(
      "QUIZ_QUESTION_INVALID_STORED_DATA",
      `Dữ liệu ${fieldName} đang lưu không hợp lệ`,
    );
  }
  return value as Record<string, unknown>;
}

function toOptionalJsonRecord(value: Prisma.JsonValue | null | undefined) {
  return value === null || value === undefined ? undefined : toRecord(value, "richText");
}

function toOptionalJsonValue<T>(value: Prisma.JsonValue | null | undefined) {
  return value === null || value === undefined ? undefined : (value as T);
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toNullableInputJson(
  value: unknown | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return value === undefined || value === null ? Prisma.DbNull : toInputJson(value);
}
