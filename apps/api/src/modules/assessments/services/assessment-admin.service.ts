import { Injectable } from "@nestjs/common";
import {
  AiGenerationType,
  ContentSource,
  Prisma,
  QuestionType,
  ReviewStatus,
} from "@prisma/client";
import type { getRequestContext } from "#api/common/api/request-context";
import { badRequestException, notFoundException } from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { FilesService } from "#api/modules/files/services/files.service";
import { hashAiValue } from "#api/modules/ai/utils/ai-hash";
import {
  quizFigureSelect,
  serializeQuizFigureAccessUrl,
} from "#api/modules/quiz-figures/services/quiz-figures.service";
import {
  readQuizGenerationQuestion,
  readQuizGenerationQuestionReference,
  replaceQuizGenerationQuestionOutput,
  stripQuizGeometryStatementFromMetadata,
} from "#api/modules/quiz/utils/quiz-generation-output";
import {
  getGeneratedQuizOutputSchema,
  quizSubjectKeySchema,
} from "#api/modules/quiz/types/quiz-generation.types";
import { normalizeGeneratedQuizQuestionContent } from "#api/modules/quiz/utils/quiz-generation-content-normalizer";
import { mapGeneratedQuizQuestion } from "#api/modules/quiz/utils/quiz-generation-mapper";
import {
  changesAssessmentExplanationContext,
  syncAssessmentExplanation,
  toInputJson,
  toNullableInputJson,
  toOptionalJsonRecord,
  toOptionalJsonValue,
  toRecord,
  validateAssessmentDurationSeconds,
  validateAssessmentQuestionContent,
} from "#api/modules/assessments/utils/assessment-question-content";
import {
  type CreateTestSetDto,
  type TestQuestionContentDto,
  type UpdateTestQuestionContentDto,
  type UpdateTestSetDto,
} from "#api/modules/tests/dto/test-content.dto";
import { calculateEffectivePoints } from "#api/modules/tests/utils/test-question-content";
import { QuizSetReviewActionDto } from "#api/modules/quiz/dto/review-quiz-set.dto";
import { enrichAssessmentQuestionFigures } from "#api/modules/assessments/services/assessment-question-figure-enrichment";
import {
  reviewAllPendingAssessmentAiQuestions,
  reviewAssessmentQuestion,
  reviewAssessmentSet,
} from "#api/modules/assessments/services/assessment-admin-publication";
import {
  QuizService,
  type CreateQuizSetDto,
  type UpdateQuizSetDto,
} from "#api/modules/quiz/services/quiz.service";
import type {
  QuizQuestionContentDto,
  UpdateQuizGenerationQuestionJsonDto,
  UpdateQuizQuestionContentDto,
} from "#api/modules/quiz/dto/quiz-question-content.dto";
import type { ReviewQuizSetDto } from "#api/modules/quiz/dto/review-quiz-set.dto";

type RequestContext = ReturnType<typeof getRequestContext>;

@Injectable()
/**
 * Shared Admin assessment application service.
 *
 * Test persistence remains isolated here because its attempts, soft-delete and
 * publication model intentionally differ from Quiz. Controllers must not add
 * Test-specific CRUD/review rules outside this service.
 */
export class AssessmentAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
    private readonly quizService: QuizService,
  ) {}

  async listSetsByLesson(kind: "QUIZ" | "TEST", lessonId: string) {
    return kind === "QUIZ"
      ? this.quizService.listQuizSetsByLesson(lessonId)
      : this.listTestSetsByLesson(lessonId);
  }

  async createSet(
    input:
      | {
          kind: "QUIZ";
          lessonId: string;
          userId: string;
          dto: CreateQuizSetDto;
          context: RequestContext;
        }
      | {
          kind: "TEST";
          lessonId: string;
          userId: string;
          dto: CreateTestSetDto;
          context: RequestContext;
        },
  ) {
    return input.kind === "QUIZ"
      ? this.quizService.createQuizSet(
          input.lessonId,
          input.userId,
          input.dto,
          input.context,
        )
      : this.createTestSet(input.lessonId, input.userId, input.dto, input.context);
  }

  async updateSet(
    input:
      | {
          kind: "QUIZ";
          setId: string;
          userId: string;
          dto: UpdateQuizSetDto;
          context: RequestContext;
        }
      | {
          kind: "TEST";
          setId: string;
          userId: string;
          dto: UpdateTestSetDto;
          context: RequestContext;
        },
  ) {
    return input.kind === "QUIZ"
      ? this.quizService.updateQuizSet(
          input.setId,
          input.userId,
          input.dto,
          input.context,
        )
      : this.updateTestSet(input.setId, input.userId, input.dto, input.context);
  }

  async reviewSet(
    input:
      | {
          kind: "QUIZ";
          setId: string;
          userId: string;
          dto: ReviewQuizSetDto;
          context: RequestContext;
        }
      | {
          kind: "TEST";
          setId: string;
          userId: string;
          dto: ReviewQuizSetDto;
          context: RequestContext;
        },
  ) {
    return input.kind === "QUIZ"
      ? this.quizService.reviewQuizSet(
          input.setId,
          input.userId,
          input.dto,
          input.context,
        )
      : this.reviewTestSet(input.setId, input.userId, input.dto, input.context);
  }

  async deleteSet(
    kind: "QUIZ" | "TEST",
    setId: string,
    userId: string,
    context: RequestContext,
  ) {
    return kind === "QUIZ"
      ? this.quizService.deleteQuizSet(setId, userId, context)
      : this.deleteTestSet(setId, userId, context);
  }

  async listQuestionsBySet(kind: "QUIZ" | "TEST", setId: string) {
    return kind === "QUIZ"
      ? this.quizService.listQuestionsBySet(setId)
      : this.listTestQuestionsBySet(setId);
  }

  async createQuestion(
    input:
      | {
          kind: "QUIZ";
          setId: string;
          userId: string;
          dto: QuizQuestionContentDto;
          context: RequestContext;
        }
      | {
          kind: "TEST";
          setId: string;
          userId: string;
          dto: TestQuestionContentDto;
          context: RequestContext;
        },
  ) {
    return input.kind === "QUIZ"
      ? this.quizService.createQuestion(
          input.setId,
          input.userId,
          input.dto,
          input.context,
        )
      : this.createTestQuestion(input.setId, input.userId, input.dto, input.context);
  }

  async updateQuestion(
    input:
      | {
          kind: "QUIZ";
          questionId: string;
          userId: string;
          dto: UpdateQuizQuestionContentDto;
          context: RequestContext;
        }
      | {
          kind: "TEST";
          questionId: string;
          userId: string;
          dto: UpdateTestQuestionContentDto;
          context: RequestContext;
        },
  ) {
    return input.kind === "QUIZ"
      ? this.quizService.updateQuestion(
          input.questionId,
          input.userId,
          input.dto,
          input.context,
        )
      : this.updateTestQuestion(input.questionId, input.userId, input.dto, input.context);
  }

  async updateGenerationQuestionJson(
    input:
      | {
          kind: "QUIZ";
          questionId: string;
          userId: string;
          dto: UpdateQuizGenerationQuestionJsonDto;
          context: RequestContext;
        }
      | {
          kind: "TEST";
          questionId: string;
          userId: string;
          dto: UpdateQuizGenerationQuestionJsonDto;
          context: RequestContext;
        },
  ) {
    return input.kind === "QUIZ"
      ? this.quizService.updateGenerationQuestionJson(
          input.questionId,
          input.userId,
          input.dto,
          input.context,
        )
      : this.updateTestGenerationQuestionJson(
          input.questionId,
          input.userId,
          input.dto,
          input.context,
        );
  }

  async reviewQuestion(input: {
    kind: "QUIZ" | "TEST";
    questionId: string;
    userId: string;
    dto: { reviewStatus: ReviewStatus };
    context: RequestContext;
  }) {
    return input.kind === "QUIZ"
      ? this.quizService.reviewQuestion(
          input.questionId,
          input.userId,
          input.dto,
          input.context,
        )
      : this.reviewTestQuestion(input.questionId, input.userId, input.dto, input.context);
  }

  async reviewAllPendingAiQuestions(
    kind: "QUIZ" | "TEST",
    setId: string,
    userId: string,
    context: RequestContext,
  ) {
    return kind === "QUIZ"
      ? this.quizService.reviewAllPendingAiQuestions(setId, userId, context)
      : this.reviewAllPendingTestAiQuestions(setId, userId, context);
  }

  async deleteQuestion(
    kind: "QUIZ" | "TEST",
    questionId: string,
    userId: string,
    context: RequestContext,
  ) {
    return kind === "QUIZ"
      ? this.quizService.deleteQuestion(questionId, userId, context)
      : this.deleteTestQuestion(questionId, userId, context);
  }

  private async listTestSetsByLesson(lessonId: string) {
    const sets = await this.prisma.testSet.findMany({
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
    const [pendingGroups, unpublishedGroups, aiGenerations, usageGroups] =
      await Promise.all([
        this.prisma.testQuestion.groupBy({
          by: ["testSetId"],
          where: {
            testSetId: { in: setIds },
            deletedAt: null,
            reviewStatus: ReviewStatus.NEEDS_REVIEW,
          },
          _count: { _all: true },
        }),
        this.prisma.testQuestion.groupBy({
          by: ["testSetId"],
          where: {
            testSetId: { in: setIds },
            deletedAt: null,
            reviewStatus: ReviewStatus.APPROVED,
            publishedAt: null,
          },
          _count: { _all: true },
        }),
        this.prisma.aiGeneration.findMany({
          where: {
            type: AiGenerationType.TEST,
            targetType: "TEST_SET",
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
              type: AiGenerationType.TEST,
              targetType: "TEST_SET",
              targetId: { in: setIds },
            },
          },
          _count: { _all: true },
          _sum: { costVnd: true },
        }),
      ]);
    const pendingBySetId = new Map(
      pendingGroups.map((group) => [group.testSetId, group._count._all]),
    );
    const unpublishedBySetId = new Map(
      unpublishedGroups.map((group) => [group.testSetId, group._count._all]),
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
    const generationsBySetId = new Map<
      string,
      Array<
        (typeof aiGenerations)[number] & {
          totalCostVnd: number;
          usageEventCount: number;
        }
      >
    >();
    for (const generation of aiGenerations) {
      if (!generation.targetId) continue;
      const usage = usageByGenerationId.get(generation.id);
      const current = generationsBySetId.get(generation.targetId) ?? [];
      current.push({
        ...generation,
        totalCostVnd: usage?.totalCostVnd ?? 0,
        usageEventCount: usage?.usageEventCount ?? 0,
      });
      generationsBySetId.set(generation.targetId, current);
    }
    return sets.map((set) => ({
      ...set,
      pendingReviewQuestionCount: pendingBySetId.get(set.id) ?? 0,
      unpublishedApprovedQuestionCount: unpublishedBySetId.get(set.id) ?? 0,
      aiGenerations: generationsBySetId.get(set.id) ?? [],
    }));
  }

  private async createTestSet(
    lessonId: string,
    userId: string,
    dto: CreateTestSetDto,
    _context: RequestContext,
  ) {
    validateAssessmentDurationSeconds(dto.durationSeconds);
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
          totalScore: new Prisma.Decimal(10),
          source: ContentSource.ADMIN,
          reviewStatus: ReviewStatus.DRAFT,
          sortOrder: (lastSet?.sortOrder ?? -1) + 1,
          createdById: userId,
          updatedById: userId,
        },
      });
    });
  }

  private async updateTestSet(
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

    if (dto.durationSeconds !== undefined) {
      validateAssessmentDurationSeconds(dto.durationSeconds);
    }

    return this.prisma.testSet.update({
      where: { id: setId },
      data: {
        title: dto.title?.trim(),
        durationSeconds: dto.durationSeconds,
        updatedById: userId,
      },
    });
  }

  private async reviewTestSet(
    setId: string,
    userId: string,
    input: { reviewStatus: ReviewStatus; action?: QuizSetReviewActionDto },
    context: RequestContext,
  ) {
    return reviewAssessmentSet(this.prisma, "TEST", setId, userId, input, context);
  }

  private async deleteTestSet(setId: string, userId: string, _context: RequestContext) {
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

  private async listTestQuestionsBySet(setId: string) {
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
            reviewStatus: true,
            staleAt: true,
          },
        },
        figures: {
          where: { deletedAt: null },
          orderBy: { role: "asc" },
          select: quizFigureSelect,
        },
      },
    });

    const generationIds = [
      ...new Set(
        questions.flatMap((question) => {
          const reference = readQuizGenerationQuestionReference(
            question.sourceMetadataJson,
          );
          return reference ? [reference.aiGenerationId] : [];
        }),
      ),
    ];
    const [generations, enrichedFigures] = await Promise.all([
      generationIds.length > 0
        ? this.prisma.aiGeneration.findMany({
            where: { id: { in: generationIds }, type: AiGenerationType.TEST },
            select: { id: true, outputJson: true },
          })
        : Promise.resolve([]),
      enrichAssessmentQuestionFigures(this.prisma, this.files, questions),
    ]);
    const outputByGenerationId = new Map(
      generations.map((generation) => [generation.id, generation.outputJson]),
    );

    const effectivePoints = calculateEffectivePoints(
      questions.map((question) =>
        question.points === null ? null : question.points.toNumber(),
      ),
      set.totalScore.toNumber(),
    );

    return Promise.all(
      questions.map(async (question, index) => {
        const reference = readQuizGenerationQuestionReference(
          question.sourceMetadataJson,
        );
        return {
          ...question,
          points: question.points?.toNumber() ?? null,
          effectivePoints: effectivePoints[index] ?? 0,
          generationQuestionJson: reference
            ? readQuizGenerationQuestion(
                outputByGenerationId.get(reference.aiGenerationId),
                reference.generationQuestionIndex,
              )
            : null,
          sourceMetadataJson: stripQuizGeometryStatementFromMetadata(
            question.sourceMetadataJson,
          ),
          figures: question.figures.map(
            (figure) => enrichedFigures.get(figure.id) ?? figure,
          ),
        };
      }),
    );
  }

  private async createTestQuestion(
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

    validateAssessmentQuestionContent(dto, "TEST");

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
          gradingConfigJson: Prisma.DbNull,
          reviewStatus: ReviewStatus.NEEDS_REVIEW,
          sortOrder: (lastQuestion?.sortOrder ?? -1) + 1,
        },
      });

      const explanationId = await syncAssessmentExplanation(transaction, {
        currentExplanationId: null,
        explanationJson: dto.explanationJson,
        lessonId: set.lessonId,
        questionId: question.id,
        targetType: "TEST_QUESTION",
        reviewStatus: ReviewStatus.NEEDS_REVIEW,
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

  private async updateTestQuestion(
    questionId: string,
    _userId: string,
    dto: UpdateTestQuestionContentDto,
    _context: RequestContext,
  ) {
    const question = await this.prisma.testQuestion.findFirst({
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

    const mergedContent: TestQuestionContentDto = {
      questionType: dto.questionType ?? question.questionType,
      difficulty: dto.difficulty ?? question.difficulty,
      questionJson:
        dto.questionJson ?? toRecord(question.questionJson, "questionJson", "TEST"),
      optionsJson: dto.optionsJson ?? toOptionalJsonValue(question.optionsJson),
      correctAnswerJson:
        dto.correctAnswerJson ??
        (question.correctAnswerJson as TestQuestionContentDto["correctAnswerJson"]),
      hintJson: dto.hintJson ?? toOptionalJsonRecord(question.hintJson, "TEST"),
      gradingConfigJson:
        dto.gradingConfigJson ?? toOptionalJsonValue(question.gradingConfigJson),
      explanationJson:
        dto.explanationJson ??
        toOptionalJsonRecord(question.explanation?.contentJson, "TEST"),
    };
    validateAssessmentQuestionContent(mergedContent, "TEST");

    const updateData: Prisma.TestQuestionUpdateInput = { publishedAt: null };
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
    if (
      mergedContent.questionType !== QuestionType.MULTIPLE_CHOICE &&
      mergedContent.questionType !== QuestionType.MULTI_STATEMENT_TRUE_FALSE
    ) {
      updateData.optionsJson = Prisma.DbNull;
    }
    updateData.gradingConfigJson = Prisma.DbNull;

    return this.prisma.$transaction(async (transaction) => {
      if (
        dto.explanationJson === undefined &&
        question.explanationId &&
        changesAssessmentExplanationContext(dto)
      ) {
        await transaction.aiExplanation.update({
          where: { id: question.explanationId },
          data: { staleAt: new Date() },
        });
      }
      const explanationId = await syncAssessmentExplanation(transaction, {
        currentExplanationId: question.explanationId,
        explanationJson: dto.explanationJson,
        lessonId: question.lessonId,
        questionId,
        targetType: "TEST_QUESTION",
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

  /**
   * Test v2 uses the exact same mutable structured-output contract as Quiz.
   * Legacy Test generations intentionally have no reference metadata and stay
   * read-only instead of being guessed into the new schema.
   */
  private async updateTestGenerationQuestionJson(
    questionId: string,
    userId: string,
    input: { generationQuestionJson: Record<string, unknown> },
    context: RequestContext,
  ) {
    const question = await this.prisma.testQuestion.findFirst({
      where: { id: questionId, deletedAt: null },
      include: {
        explanation: {
          select: { id: true, contentJson: true, reviewStatus: true, staleAt: true },
        },
      },
    });
    if (!question) throw notFoundException("NOT_FOUND", "Không tìm thấy câu hỏi");

    const reference = readQuizGenerationQuestionReference(question.sourceMetadataJson);
    if (!reference) {
      throw badRequestException(
        "TEST_GENERATION_JSON_READ_ONLY_LEGACY",
        "Câu Test cũ không có JSON sinh v2 để chỉnh sửa. Hãy tạo lại bằng luồng AI hiện tại.",
      );
    }
    const generation = await this.prisma.aiGeneration.findFirst({
      where: {
        id: reference.aiGenerationId,
        type: AiGenerationType.TEST,
        targetType: "TEST_SET",
      },
      select: { inputMetaJson: true, outputJson: true },
    });
    if (!generation) {
      throw badRequestException(
        "TEST_GENERATION_JSON_NOT_AVAILABLE",
        "Không tìm thấy JSON làm việc của lượt sinh Test v2.",
      );
    }
    const inputMeta = jsonRecord(generation.inputMetaJson);
    if (inputMeta.pipelineVersion !== "ASSESSMENT_QUIZ_V1") {
      throw badRequestException(
        "TEST_GENERATION_JSON_READ_ONLY_LEGACY",
        "JSON của lượt sinh Test cũ chỉ có thể xem, không thể chỉnh sửa bằng contract v2.",
      );
    }
    const subjectKey = quizSubjectKeySchema.safeParse(inputMeta.subjectKey);
    if (!subjectKey.success) {
      throw badRequestException(
        "TEST_GENERATION_SUBJECT_INVALID",
        "Snapshot môn học của lượt sinh Test không hợp lệ.",
      );
    }
    const targetGrade =
      typeof inputMeta.targetGrade === "number" ? inputMeta.targetGrade : null;
    const parsed = getGeneratedQuizOutputSchema({
      subjectKey: subjectKey.data,
      targetGrade,
      questionCount: 1,
    }).safeParse({ questions: [input.generationQuestionJson] });
    if (!parsed.success) {
      throw badRequestException(
        "TEST_GENERATION_JSON_INVALID",
        "JSON câu Test chưa đúng cấu trúc Quiz dùng chung.",
        parsed.error.flatten(),
      );
    }
    const current = readQuizGenerationQuestion(
      generation.outputJson,
      reference.generationQuestionIndex,
    );
    if (!current) {
      throw badRequestException(
        "TEST_GENERATION_JSON_NOT_AVAILABLE",
        "Không tìm thấy câu Test trong JSON làm việc.",
      );
    }
    if (
      hashAiValue(current.figure ?? null) !==
      hashAiValue(input.generationQuestionJson.figure ?? null)
    ) {
      throw badRequestException(
        "TEST_GENERATION_FIGURE_EDIT_UNSUPPORTED",
        "Không sửa trực tiếp quyết định hình trong JSON; hãy dùng công cụ quản lý hình của câu Test.",
      );
    }
    const normalized = normalizeGeneratedQuizQuestionContent(parsed.data.questions[0]!);
    const mapped = mapGeneratedQuizQuestion(normalized);
    const output = replaceQuizGenerationQuestionOutput(
      generation.outputJson,
      reference.generationQuestionIndex,
      normalized as unknown as Record<string, unknown>,
    );
    if (!output) {
      throw badRequestException(
        "TEST_GENERATION_JSON_NOT_AVAILABLE",
        "Không thể cập nhật JSON làm việc của câu Test.",
      );
    }

    return this.prisma.$transaction(async (transaction) => {
      const explanationId = await syncAssessmentExplanation(transaction, {
        currentExplanationId: question.explanationId,
        explanationJson: mapped.explanationJson,
        lessonId: question.lessonId,
        questionId,
        targetType: "TEST_QUESTION",
      });
      const updated = await transaction.testQuestion.update({
        where: { id: questionId },
        data: {
          questionType: mapped.questionType,
          difficulty: mapped.difficulty,
          questionJson: toInputJson(mapped.questionJson),
          optionsJson: toNullableInputJson(mapped.optionsJson),
          correctAnswerJson: toInputJson(mapped.correctAnswerJson),
          hintJson: toNullableInputJson(mapped.hintJson),
          gradingConfigJson: toNullableInputJson(mapped.gradingConfigJson),
          reviewStatus: ReviewStatus.NEEDS_REVIEW,
          publishedAt: null,
          ...(explanationId
            ? { explanation: { connect: { id: explanationId } } }
            : { explanation: { disconnect: true } }),
        },
        include: {
          explanation: {
            select: { id: true, contentJson: true, reviewStatus: true, staleAt: true },
          },
          figures: {
            where: { deletedAt: null },
            orderBy: { role: "asc" },
            select: quizFigureSelect,
          },
        },
      });
      await transaction.aiGeneration.update({
        where: { id: reference.aiGenerationId },
        data: { outputJson: toInputJson(output), outputHash: hashAiValue(output) },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: userId,
          action: "TEST_QUESTION_GENERATION_JSON_UPDATED",
          entityType: "TestQuestion",
          entityId: questionId,
          before: toInputJson(current),
          after: toInputJson(normalized),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });
      return {
        ...updated,
        points: updated.points?.toNumber() ?? null,
        generationQuestionJson: normalized,
        figures: await Promise.all(
          updated.figures.map((figure) =>
            serializeQuizFigureAccessUrl(figure, this.files),
          ),
        ),
      };
    });
  }

  private async reviewTestQuestion(
    questionId: string,
    userId: string,
    input: { reviewStatus: ReviewStatus },
    context: RequestContext,
  ) {
    return reviewAssessmentQuestion(
      this.prisma,
      "TEST",
      questionId,
      userId,
      input,
      context,
    );
  }

  private async reviewAllPendingTestAiQuestions(
    setId: string,
    userId: string,
    context: RequestContext,
  ) {
    return reviewAllPendingAssessmentAiQuestions(
      this.prisma,
      "TEST",
      setId,
      userId,
      context,
    );
  }

  private async deleteTestQuestion(
    questionId: string,
    _userId: string,
    _context: RequestContext,
  ) {
    await this.prisma.$transaction(async (transaction) => {
      const question = await transaction.testQuestion.findFirst({
        where: { id: questionId, deletedAt: null },
        select: { testSetId: true },
      });
      if (!question) {
        throw notFoundException("NOT_FOUND", "Không tìm thấy câu hỏi");
      }

      const deleted = await transaction.testQuestion.updateMany({
        where: { id: questionId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      if (deleted.count === 0) {
        throw notFoundException("NOT_FOUND", "Không tìm thấy câu hỏi");
      }

      const currentActiveCount = await transaction.testQuestion.count({
        where: { testSetId: question.testSetId, deletedAt: null },
      });
      await transaction.testSet.update({
        where: { id: question.testSetId },
        data: { questionCount: currentActiveCount },
      });
    });

    return { success: true };
  }
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
