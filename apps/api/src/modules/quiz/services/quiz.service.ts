import { Injectable, Optional } from "@nestjs/common";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { badRequestException, notFoundException } from "#api/common/errors/api-exception";
import type { getRequestContext } from "#api/common/api/request-context";
import {
  AiExplanationTargetType,
  AiGenerationType,
  BackgroundJobStatus,
  ContentSource,
  Prisma,
  ProviderUsageStatus,
  QuestionType,
  ReviewStatus,
} from "@prisma/client";
import {
  QuizQuestionContentDto,
  UpdateQuizGenerationQuestionJsonDto,
  UpdateQuizQuestionContentDto,
} from "#api/modules/quiz/dto/quiz-question-content.dto";
import {
  QuizSetReviewActionDto,
  type ReviewQuizSetDto,
} from "#api/modules/quiz/dto/review-quiz-set.dto";
import {
  correctAnswerSchema,
  multiStatementCorrectAnswerSchema,
  multiStatementOptionsSchema,
  multipleChoiceOptionsSchema,
  textInputCorrectAnswerSchema,
} from "#api/modules/quiz/types/quiz.types";
import { getTiptapText } from "#api/common/validation/rich-text-content";
import {
  getGeneratedQuizOutputSchema,
  quizExplanationBlockSchema,
  quizSubjectKeySchema,
  type QuizExplanationBlock,
} from "#api/modules/quiz/types/quiz-generation.types";
import {
  quizFigureSelect,
  readQuizFigurePendingAiTargetMode,
  serializeQuizFigureAccessUrl,
} from "#api/modules/quiz-figures/services/quiz-figures.service";
import { hashAiValue } from "#api/modules/ai/utils/ai-hash";
import {
  readQuizGenerationQuestion,
  readQuizGenerationQuestionReference,
  replaceQuizGenerationQuestionOutput,
  stripQuizGeometryStatementFromMetadata,
  updateQuizGenerationQuestionOutput,
} from "#api/modules/quiz/utils/quiz-generation-output";
import {
  normalizeGeneratedQuizQuestionContent,
  normalizeQuizExplanationBlock,
} from "#api/modules/quiz/utils/quiz-generation-content-normalizer";
import { mapGeneratedQuizQuestion } from "#api/modules/quiz/utils/quiz-generation-mapper";
import { validateQuizOutput } from "#api/modules/quiz/utils/quiz-generation-validation";
import { StoredFileCleanupService } from "#api/modules/files/services/stored-file-cleanup.service";
import { FilesService } from "#api/modules/files/services/files.service";

type RequestContext = ReturnType<typeof getRequestContext>;

export interface CreateQuizSetDto {
  title: string;
}

export interface UpdateQuizSetDto {
  title?: string;
  reviewStatus?: ReviewStatus;
}

@Injectable()
export class QuizService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly fileCleanup?: StoredFileCleanupService,
    @Optional() private readonly files?: FilesService,
  ) {}

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
    const [pendingGroups, unpublishedGroups, aiGenerations, usageGroups] =
      await Promise.all([
        this.prisma.quizQuestion.groupBy({
          by: ["quizSetId"],
          where: {
            quizSetId: { in: setIds },
            deletedAt: null,
            reviewStatus: ReviewStatus.NEEDS_REVIEW,
          },
          _count: { _all: true },
        }),
        this.prisma.quizQuestion.groupBy({
          by: ["quizSetId"],
          where: {
            quizSetId: { in: setIds },
            deletedAt: null,
            reviewStatus: ReviewStatus.APPROVED,
            publishedAt: null,
          },
          _count: { _all: true },
        }),
        this.prisma.aiGeneration.findMany({
          where: {
            type: AiGenerationType.QUIZ,
            targetType: "QUIZ_SET",
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
              type: AiGenerationType.QUIZ,
              targetType: "QUIZ_SET",
              targetId: { in: setIds },
            },
          },
          _count: { _all: true },
          _sum: { costVnd: true },
        }),
      ]);
    const pendingBySetId = new Map(
      pendingGroups.map((group) => [group.quizSetId, group._count._all]),
    );
    const unpublishedBySetId = new Map(
      unpublishedGroups.map((group) => [group.quizSetId, group._count._all]),
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
    type QuizGenerationListItem = (typeof aiGenerations)[number] & {
      totalCostVnd: number;
      usageEventCount: number;
    };
    const generationsBySetId = new Map<string, QuizGenerationListItem[]>();
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
    return sets.map((set) => ({
      ...set,
      pendingReviewQuestionCount: pendingBySetId.get(set.id) ?? 0,
      unpublishedApprovedQuestionCount: unpublishedBySetId.get(set.id) ?? 0,
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
    input: ReviewQuizSetDto,
    context: RequestContext,
  ) {
    const current = await this.prisma.quizSet.findUnique({
      where: { id: setId, deletedAt: null },
      select: { id: true, reviewStatus: true },
    });
    if (!current) {
      throw notFoundException("NOT_FOUND", "Không tìm thấy bộ câu hỏi");
    }
    const action =
      input.action ??
      (input.reviewStatus === ReviewStatus.APPROVED
        ? QuizSetReviewActionDto.PUBLISH
        : input.reviewStatus === ReviewStatus.HIDDEN
          ? QuizSetReviewActionDto.WITHDRAW
          : QuizSetReviewActionDto.SAVE);
    return this.prisma.$transaction(async (transaction) => {
      if (action === QuizSetReviewActionDto.PUBLISH) {
        const approvedQuestionCount = await transaction.quizQuestion.count({
          where: {
            quizSetId: setId,
            deletedAt: null,
            reviewStatus: ReviewStatus.APPROVED,
          },
        });
        if (approvedQuestionCount < 1) {
          throw badRequestException(
            "QUIZ_SET_HAS_NO_APPROVED_QUESTIONS",
            "Cần có ít nhất 1 câu Quiz được duyệt để phát hành",
            { approvedQuestionCount },
          );
        }
      }
      const latestPublication =
        action === QuizSetReviewActionDto.SAVE
          ? await transaction.quizQuestion.findFirst({
              where: {
                quizSetId: setId,
                deletedAt: null,
                publishedAt: { not: null },
              },
              orderBy: { publishedAt: "desc" },
              select: { publishedAt: true },
            })
          : null;
      const publishedAt = latestPublication?.publishedAt ?? new Date();
      if (
        action === QuizSetReviewActionDto.SAVE ||
        action === QuizSetReviewActionDto.PUBLISH
      ) {
        await transaction.quizQuestion.updateMany({
          where: {
            quizSetId: setId,
            deletedAt: null,
            reviewStatus: ReviewStatus.APPROVED,
          },
          data: { publishedAt },
        });
      }
      const nextReviewStatus =
        action === QuizSetReviewActionDto.PUBLISH
          ? ReviewStatus.APPROVED
          : action === QuizSetReviewActionDto.WITHDRAW
            ? ReviewStatus.HIDDEN
            : current.reviewStatus;
      const updated = await transaction.quizSet.update({
        where: { id: setId },
        data: { reviewStatus: nextReviewStatus, updatedById: userId },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: userId,
          action: "QUIZ_SET_REVIEWED",
          entityType: "QuizSet",
          entityId: setId,
          before: toInputJson(current),
          after: toInputJson({
            id: updated.id,
            action,
            reviewStatus: updated.reviewStatus,
          }),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });
      return updated;
    });
  }

  async deleteQuizSet(setId: string, userId: string, context: RequestContext) {
    const deletion = await this.prisma.$transaction(async (transaction) => {
      const set = await transaction.quizSet.findFirst({
        where: { id: setId, deletedAt: null },
        select: {
          id: true,
          lessonId: true,
          title: true,
          source: true,
          reviewStatus: true,
          questionCount: true,
          questions: {
            select: {
              id: true,
              figures: {
                select: {
                  revisions: { select: { deliveryFileId: true } },
                },
              },
            },
          },
        },
      });
      if (!set) {
        throw notFoundException("NOT_FOUND", "Không tìm thấy bộ câu hỏi");
      }

      const questionIds = set.questions.map((question) => question.id);
      const deliveryFileIds = set.questions.flatMap((question) =>
        question.figures.flatMap((figure) =>
          figure.revisions.flatMap((revision) =>
            revision.deliveryFileId ? [revision.deliveryFileId] : [],
          ),
        ),
      );
      if (deliveryFileIds.length > 0 && !this.fileCleanup) {
        throw new Error("Stored file cleanup service is unavailable");
      }
      const deletedAttemptCount = (
        await transaction.quizAttempt.deleteMany({ where: { quizSetId: setId } })
      ).count;

      await transaction.quizSet.delete({ where: { id: setId } });

      const deletedExplanationCount =
        questionIds.length > 0
          ? (
              await transaction.aiExplanation.deleteMany({
                where: {
                  targetType: AiExplanationTargetType.QUIZ_QUESTION,
                  targetId: { in: questionIds },
                },
              })
            ).count
          : 0;
      const stagedFileIds = this.fileCleanup
        ? await this.fileCleanup.stageDetachedFigureFiles(transaction, deliveryFileIds)
        : [];

      await transaction.auditLog.create({
        data: {
          actorUserId: userId,
          action: "QUIZ_SET_PERMANENT_DELETED",
          entityType: "QuizSet",
          entityId: setId,
          before: toInputJson({
            lessonId: set.lessonId,
            title: set.title,
            source: set.source,
            reviewStatus: set.reviewStatus,
            questionCount: set.questionCount,
          }),
          after: toInputJson({
            hardDeleted: true,
            deletedQuestionCount: questionIds.length,
            deletedAttemptCount,
            deletedExplanationCount,
            stagedFileCleanupCount: stagedFileIds.length,
          }),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });

      return {
        response: {
          success: true,
          deletedQuestionCount: questionIds.length,
          deletedAttemptCount,
          deletedExplanationCount,
        },
        stagedFileIds,
      };
    });

    const fileCleanup = this.fileCleanup
      ? await this.fileCleanup.deleteStagedFiles(deletion.stagedFileIds)
      : { deletedFileCount: 0, pendingFileCleanupCount: 0 };

    return { ...deletion.response, ...fileCleanup };
  }

  // --- Quiz Question ---

  async listQuestionsBySet(setId: string) {
    const questions = await this.prisma.quizQuestion.findMany({
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
    const currentFigureAssets = questions.flatMap((question) =>
      question.figures.flatMap((figure) => {
        const deliveryFileId = figure.currentRevision?.deliveryFile?.id;
        return deliveryFileId ? [{ figureId: figure.id, deliveryFileId }] : [];
      }),
    );
    const figureIds = [...new Set(currentFigureAssets.map((asset) => asset.figureId))];
    const deliveryFileIds = [
      ...new Set(currentFigureAssets.map((asset) => asset.deliveryFileId)),
    ];
    const activeFigureIds = [
      ...new Set(
        questions.flatMap((question) =>
          question.figures
            .filter((figure) =>
              ["QUEUED", "RENDERING", "REPAIRING"].includes(figure.status),
            )
            .map((figure) => figure.id),
        ),
      ),
    ];
    const [generations, figureCostAttempts, activeFigureJobs] = await Promise.all([
      generationIds.length > 0
        ? this.prisma.aiGeneration.findMany({
            where: { id: { in: generationIds } },
            select: { id: true, outputJson: true },
          })
        : Promise.resolve([]),
      figureIds.length > 0
        ? this.prisma.quizFigureRenderAttempt.findMany({
            where: {
              quizFigureId: { in: figureIds },
              revision: { deliveryFileId: { in: deliveryFileIds } },
            },
            select: {
              quizFigureId: true,
              revision: { select: { deliveryFileId: true } },
              backgroundJob: {
                select: {
                  providerUsageEvents: {
                    where: {
                      provider: "OPENAI",
                      status: ProviderUsageStatus.SUCCEEDED,
                    },
                    select: { id: true, cachedInputTokens: true, costVnd: true },
                  },
                },
              },
            },
          })
        : Promise.resolve([]),
      activeFigureIds.length > 0
        ? this.prisma.backgroundJob.findMany({
            where: {
              resourceType: "QUIZ_FIGURE",
              resourceId: { in: activeFigureIds },
              status: {
                in: [BackgroundJobStatus.QUEUED, BackgroundJobStatus.RUNNING],
              },
            },
            orderBy: { createdAt: "desc" },
            select: { resourceId: true, inputMeta: true },
          })
        : Promise.resolve([]),
    ]);
    const outputByGenerationId = new Map(
      generations.map((generation) => [generation.id, generation.outputJson]),
    );
    const openAiUsageByFigureAsset = collectOpenAiFigureUsage(figureCostAttempts);
    const pendingAiTargetModeByFigureId = new Map<string, "QUESTION" | "SOLUTION">();
    for (const job of activeFigureJobs) {
      if (!job.resourceId || pendingAiTargetModeByFigureId.has(job.resourceId)) continue;
      const pendingTargetMode = readQuizFigurePendingAiTargetMode(job.inputMeta);
      if (pendingTargetMode) {
        pendingAiTargetModeByFigureId.set(job.resourceId, pendingTargetMode);
      }
    }

    return Promise.all(
      questions.map(async (question) => {
        const reference = readQuizGenerationQuestionReference(
          question.sourceMetadataJson,
        );
        const generationQuestionJson = reference
          ? readQuizGenerationQuestion(
              outputByGenerationId.get(reference.aiGenerationId),
              reference.generationQuestionIndex,
            )
          : null;
        return {
          ...question,
          figures: await Promise.all(
            question.figures.map(async (figure) => {
              const deliveryFileId = figure.currentRevision?.deliveryFile?.id;
              const serializedFigure = await serializeQuizFigureAccessUrl(
                figure,
                this.files,
              );
              return {
                ...serializedFigure,
                pendingAiTargetMode: pendingAiTargetModeByFigureId.get(figure.id) ?? null,
                openAiGenerationCostVnd: deliveryFileId
                  ? (openAiUsageByFigureAsset.get(
                      quizFigureAssetKey(figure.id, deliveryFileId),
                    )?.costVnd ?? null)
                  : null,
                openAiCachedInputTokens: deliveryFileId
                  ? (openAiUsageByFigureAsset.get(
                      quizFigureAssetKey(figure.id, deliveryFileId),
                    )?.cachedInputTokens ?? null)
                  : null,
              };
            }),
          ),
          sourceMetadataJson: stripQuizGeometryStatementFromMetadata(
            question.sourceMetadataJson,
          ),
          generationQuestionJson,
        };
      }),
    );
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
          gradingConfigJson: Prisma.DbNull,
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
    let quizExplanationBlock: QuizExplanationBlock | null = null;
    if (dto.quizExplanationBlock) {
      const parsedExplanationBlock = quizExplanationBlockSchema.safeParse(
        dto.quizExplanationBlock,
      );
      if (!parsedExplanationBlock.success) {
        throw badRequestException(
          "QUIZ_EXPLANATION_BLOCK_INVALID",
          "Khối lời giải của câu Quiz không đúng cấu trúc Quiz",
          parsedExplanationBlock.error.flatten(),
        );
      }
      quizExplanationBlock = normalizeQuizExplanationBlock(parsedExplanationBlock.data);
    }

    const updateData: Prisma.QuizQuestionUpdateInput = { publishedAt: null };
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
    if (
      mergedContent.questionType !== QuestionType.MULTIPLE_CHOICE &&
      mergedContent.questionType !== QuestionType.MULTI_STATEMENT_TRUE_FALSE
    ) {
      updateData.optionsJson = Prisma.DbNull;
    }
    updateData.gradingConfigJson = Prisma.DbNull;
    if (quizExplanationBlock) {
      updateData.sourceMetadataJson = toInputJson(
        replaceQuizExplanationBlock(question.sourceMetadataJson, quizExplanationBlock),
      );
    } else if (changesExplanationContext(dto) || dto.explanationJson !== undefined) {
      updateData.sourceMetadataJson = toInputJson(
        removeQuizExplanationBlock(question.sourceMetadataJson),
      );
    }

    return this.prisma.$transaction(async (transaction) => {
      if (quizExplanationBlock && question.explanationId) {
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

      const updatedQuestion = await transaction.quizQuestion.update({
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

      await syncQuizGenerationOutput(transaction, updatedQuestion);
      return updatedQuestion;
    });
  }

  async updateGenerationQuestionJson(
    questionId: string,
    userId: string,
    dto: UpdateQuizGenerationQuestionJsonDto,
    context: RequestContext,
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

    const reference = readQuizGenerationQuestionReference(question.sourceMetadataJson);
    if (!reference) {
      throw badRequestException(
        "QUIZ_GENERATION_JSON_NOT_AVAILABLE",
        "Câu hỏi này không thuộc một lượt sinh Quiz có JSON làm việc.",
      );
    }
    const generation = await this.prisma.aiGeneration.findUnique({
      where: { id: reference.aiGenerationId },
      select: { inputMetaJson: true, outputJson: true },
    });
    if (!generation) {
      throw badRequestException(
        "QUIZ_GENERATION_JSON_NOT_AVAILABLE",
        "Không tìm thấy JSON làm việc của lượt sinh Quiz.",
      );
    }

    const inputMeta = toRecordOrEmpty(generation.inputMetaJson);
    const subjectKey = quizSubjectKeySchema.safeParse(inputMeta.subjectKey);
    if (!subjectKey.success) {
      throw badRequestException(
        "QUIZ_GENERATION_SUBJECT_INVALID",
        "Snapshot môn học của lượt sinh Quiz không hợp lệ.",
      );
    }
    const targetGrade = readNullableGrade(inputMeta.targetGrade);
    const parsed = getGeneratedQuizOutputSchema({
      subjectKey: subjectKey.data,
      targetGrade,
      questionCount: 1,
    }).safeParse({ questions: [dto.generationQuestionJson] });
    if (!parsed.success) {
      throw badRequestException(
        "QUIZ_GENERATION_JSON_INVALID",
        "JSON câu Quiz chưa đúng cấu trúc cần thiết để lưu.",
        parsed.error.flatten(),
      );
    }

    const currentGenerationQuestion = readQuizGenerationQuestion(
      generation.outputJson,
      reference.generationQuestionIndex,
    );
    if (!currentGenerationQuestion) {
      throw badRequestException(
        "QUIZ_GENERATION_JSON_NOT_AVAILABLE",
        "Không tìm thấy câu tương ứng trong JSON làm việc của lượt sinh Quiz.",
      );
    }
    if (
      hashAiValue(currentGenerationQuestion.figure ?? null) !==
      hashAiValue(dto.generationQuestionJson.figure ?? null)
    ) {
      throw badRequestException(
        "QUIZ_GENERATION_FIGURE_EDIT_UNSUPPORTED",
        "Không sửa trực tiếp quyết định hình trong JSON; hãy dùng công cụ quản lý hình của câu Quiz.",
      );
    }

    const normalizedQuestion = normalizeGeneratedQuizQuestionContent(
      parsed.data.questions[0]!,
    );
    const mapped = mapGeneratedQuizQuestion(normalizedQuestion);
    const currentOutput = replaceQuizGenerationQuestionOutput(
      generation.outputJson,
      reference.generationQuestionIndex,
      normalizedQuestion as unknown as Record<string, unknown>,
    );
    if (!currentOutput) {
      throw badRequestException(
        "QUIZ_GENERATION_JSON_NOT_AVAILABLE",
        "Không thể cập nhật câu tương ứng trong JSON làm việc của lượt sinh Quiz.",
      );
    }
    const semanticReview = validateQuizOutput({
      questions: [normalizedQuestion],
      requestedCount: 1,
      requestedTypes: [normalizedQuestion.questionType],
      requestedDifficulty: normalizedQuestion.difficulty,
      difficultyCounts: null,
    });
    const generationIssues = [
      ...readGenerationIssuesForOtherQuestions(
        inputMeta.generationIssues,
        reference.generationQuestionIndex,
      ),
      ...semanticReview.metadata.issues.map((issue) => ({
        ...issue,
        questionIndex: reference.generationQuestionIndex,
      })),
      ...mapped.recoveryIssues.map((issue) => ({
        ...issue,
        questionIndex: reference.generationQuestionIndex,
        blocking: false,
      })),
    ];

    return this.prisma.$transaction(async (transaction) => {
      const explanationId = await syncExplanation(transaction, {
        currentExplanationId: question.explanationId,
        explanationJson: mapped.explanationJson,
        lessonId: question.lessonId,
        questionId,
      });
      const updated = await transaction.quizQuestion.update({
        where: { id: questionId },
        data: {
          questionType: mapped.questionType,
          difficulty: mapped.difficulty,
          questionJson: toInputJson(mapped.questionJson),
          optionsJson: toNullableInputJson(mapped.optionsJson),
          correctAnswerJson: toInputJson(mapped.correctAnswerJson),
          hintJson: toNullableInputJson(mapped.hintJson),
          gradingConfigJson: toNullableInputJson(mapped.gradingConfigJson),
          sourceMetadataJson: toInputJson(
            replaceQuizExplanationBlock(
              question.sourceMetadataJson,
              mapped.explanationBlock,
            ),
          ),
          reviewStatus: ReviewStatus.NEEDS_REVIEW,
          publishedAt: null,
          ...(explanationId
            ? { explanation: { connect: { id: explanationId } } }
            : { explanation: { disconnect: true } }),
        },
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
      await transaction.aiGeneration.update({
        where: { id: reference.aiGenerationId },
        data: {
          outputJson: toInputJson(currentOutput),
          outputHash: hashAiValue(currentOutput),
          inputMetaJson: toInputJson({
            ...inputMeta,
            generationIssues,
          }),
        },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: userId,
          action: "QUIZ_QUESTION_GENERATION_JSON_UPDATED",
          entityType: "QuizQuestion",
          entityId: questionId,
          before: toInputJson(currentGenerationQuestion),
          after: toInputJson(normalizedQuestion),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });
      return {
        ...updated,
        generationQuestionJson: normalizedQuestion,
      };
    });
  }

  async reviewQuestion(
    questionId: string,
    userId: string,
    input: { reviewStatus: ReviewStatus },
    context: RequestContext,
  ) {
    const current = await this.prisma.quizQuestion.findUnique({
      where: { id: questionId, deletedAt: null },
      select: {
        id: true,
        quizSetId: true,
        explanationId: true,
        reviewStatus: true,
      },
    });
    if (!current) {
      throw notFoundException("NOT_FOUND", "Không tìm thấy câu hỏi");
    }

    return this.prisma.$transaction(async (transaction) => {
      if (current.explanationId) {
        await transaction.aiExplanation.update({
          where: { id: current.explanationId },
          data: { reviewStatus: input.reviewStatus },
        });
      }
      const updated = await transaction.quizQuestion.update({
        where: { id: questionId },
        data: { reviewStatus: input.reviewStatus, publishedAt: null },
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

      const pendingReviewQuestionCount = await transaction.quizQuestion.count({
        where: {
          quizSetId: current.quizSetId,
          deletedAt: null,
          reviewStatus: ReviewStatus.NEEDS_REVIEW,
        },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: userId,
          action: "QUIZ_QUESTION_REVIEWED",
          entityType: "QuizQuestion",
          entityId: questionId,
          before: toInputJson({ reviewStatus: current.reviewStatus }),
          after: toInputJson({
            reviewStatus: updated.reviewStatus,
            pendingReviewQuestionCount,
          }),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });
      return updated;
    });
  }

  async reviewAllPendingAiQuestions(
    setId: string,
    userId: string,
    context: RequestContext,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const quizSet = await transaction.quizSet.findUnique({
        where: { id: setId, deletedAt: null },
        select: { id: true, source: true },
      });
      if (!quizSet) {
        throw notFoundException("NOT_FOUND", "Không tìm thấy bộ Quiz");
      }

      const pendingQuestions = await transaction.quizQuestion.findMany({
        where: {
          quizSetId: setId,
          deletedAt: null,
          reviewStatus: ReviewStatus.NEEDS_REVIEW,
        },
        select: {
          id: true,
          explanationId: true,
          sourceMetadataJson: true,
        },
      });
      const aiQuestions = pendingQuestions.filter(
        (question) =>
          quizSet.source === ContentSource.AI ||
          readQuizGenerationQuestionReference(question.sourceMetadataJson) !== null,
      );
      const questionIds = aiQuestions.map((question) => question.id);
      const explanationIds = aiQuestions.flatMap((question) =>
        question.explanationId ? [question.explanationId] : [],
      );

      if (explanationIds.length > 0) {
        await transaction.aiExplanation.updateMany({
          where: { id: { in: explanationIds } },
          data: { reviewStatus: ReviewStatus.APPROVED },
        });
      }
      const approved =
        questionIds.length > 0
          ? await transaction.quizQuestion.updateMany({
              where: {
                id: { in: questionIds },
                deletedAt: null,
                reviewStatus: ReviewStatus.NEEDS_REVIEW,
              },
              data: {
                reviewStatus: ReviewStatus.APPROVED,
                publishedAt: null,
              },
            })
          : { count: 0 };
      const pendingReviewQuestionCount = await transaction.quizQuestion.count({
        where: {
          quizSetId: setId,
          deletedAt: null,
          reviewStatus: ReviewStatus.NEEDS_REVIEW,
        },
      });

      if (approved.count > 0) {
        await transaction.auditLog.create({
          data: {
            actorUserId: userId,
            action: "QUIZ_AI_QUESTIONS_BULK_REVIEWED",
            entityType: "QuizSet",
            entityId: setId,
            before: toInputJson({ pendingAiQuestionCount: aiQuestions.length }),
            after: toInputJson({
              approvedQuestionCount: approved.count,
              pendingReviewQuestionCount,
            }),
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
          },
        });
      }

      return {
        approvedQuestionCount: approved.count,
        pendingReviewQuestionCount,
      };
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

function collectOpenAiFigureUsage(
  attempts: Array<{
    quizFigureId: string;
    revision: { deliveryFileId: string | null };
    backgroundJob: {
      providerUsageEvents: Array<{
        id: string;
        cachedInputTokens: number;
        costVnd: number;
      }>;
    } | null;
  }>,
) {
  const usage = new Map<string, { cachedInputTokens: number; costVnd: number }>();
  const eventIdsByAsset = new Map<string, Set<string>>();

  for (const attempt of attempts) {
    const deliveryFileId = attempt.revision.deliveryFileId;
    if (!deliveryFileId) continue;
    const key = quizFigureAssetKey(attempt.quizFigureId, deliveryFileId);
    const seenEventIds = eventIdsByAsset.get(key) ?? new Set<string>();

    for (const event of attempt.backgroundJob?.providerUsageEvents ?? []) {
      if (seenEventIds.has(event.id)) continue;
      seenEventIds.add(event.id);
      const current = usage.get(key) ?? { cachedInputTokens: 0, costVnd: 0 };
      usage.set(key, {
        cachedInputTokens: current.cachedInputTokens + event.cachedInputTokens,
        costVnd: current.costVnd + event.costVnd,
      });
    }
    eventIdsByAsset.set(key, seenEventIds);
  }

  return usage;
}

function quizFigureAssetKey(figureId: string, deliveryFileId: string) {
  return `${figureId}:${deliveryFileId}`;
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

function readNullableGrade(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 12
    ? value
    : null;
}

function readGenerationIssuesForOtherQuestions(
  value: unknown,
  editedQuestionIndex: number,
) {
  if (!Array.isArray(value)) return [];
  return value.filter((issue) => {
    if (!issue || typeof issue !== "object" || Array.isArray(issue)) return true;
    return (issue as Record<string, unknown>).questionIndex !== editedQuestionIndex;
  });
}

function readNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readGenerationQuestionIndex(value: unknown, fallback: number) {
  return readNumber(toRecordOrEmpty(value).generationQuestionIndex, fallback);
}

function removeQuizExplanationBlock(value: unknown) {
  const metadata = toRecordOrEmpty(value);
  const { quizExplanationBlock: _quizExplanationBlock, ...rest } = metadata;
  return rest;
}

function replaceQuizExplanationBlock(
  value: unknown,
  quizExplanationBlock: QuizExplanationBlock,
) {
  const metadata = toRecordOrEmpty(value);
  const {
    quizExplanationBlock: _oldQuizExplanationBlock,
    sourceChunkIds: _sourceChunkIds,
    sourceHash: _sourceHash,
    sources: _sources,
    ...rest
  } = metadata;
  return { ...rest, quizExplanationBlock };
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
      correctAnswer.data.length !== 1 ||
      correctAnswer.data.some(
        (answerId) => typeof answerId !== "string" || !optionIds.includes(answerId),
      )
    ) {
      throw badRequestException(
        "QUIZ_QUESTION_CORRECT_OPTION_NOT_FOUND",
        "Câu trắc nghiệm phải có đúng một đáp án và đáp án đó phải thuộc danh sách phương án",
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
    const textAnswer = textInputCorrectAnswerSchema.safeParse(dto.correctAnswerJson);
    if (!textAnswer.success) {
      throw badRequestException(
        "QUIZ_QUESTION_INVALID_TEXT_ANSWERS",
        "Câu hỏi nhập đáp án cần đúng một đáp án chuẩn hợp lệ",
        textAnswer.error.flatten(),
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

async function syncQuizGenerationOutput(
  transaction: Prisma.TransactionClient,
  question: Parameters<typeof updateQuizGenerationQuestionOutput>[2],
) {
  const reference = readQuizGenerationQuestionReference(question.sourceMetadataJson);
  if (!reference) return;

  const generation = await transaction.aiGeneration.findUnique({
    where: { id: reference.aiGenerationId },
    select: { outputJson: true },
  });
  if (!generation) return;

  const currentOutput = updateQuizGenerationQuestionOutput(
    generation.outputJson,
    reference.generationQuestionIndex,
    question,
  );
  if (!currentOutput) return;

  await transaction.aiGeneration.update({
    where: { id: reference.aiGenerationId },
    data: {
      outputJson: toInputJson(currentOutput),
      outputHash: hashAiValue(currentOutput),
    },
  });
}

function toNullableInputJson(
  value: unknown | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return value === undefined || value === null ? Prisma.DbNull : toInputJson(value);
}
