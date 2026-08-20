import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { AiReasoningEffort } from "@learning-path/shared";
import {
  AiGenerationType,
  Difficulty,
  ProviderUsageMetric,
  QuestionType,
} from "@prisma/client";

import { badRequestException, notFoundException } from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { AiGenerationJobService } from "#api/modules/ai/services/ai-generation-job.service";
import {
  LessonContentContextError,
  LessonContentGenerationContextService,
} from "#api/modules/ai/services/lesson-content-generation-context.service";
import {
  LESSON_CONTENT_PROMPT_VERSION,
  LESSON_CONTENT_SCHEMA_VERSION,
  getGeneratedQuizOutputSchema,
} from "#api/modules/ai/types/lesson-content-generation.types";
import { buildAiUserPrompt } from "#api/modules/ai/utils/ai-prompt";
import {
  buildAiStructuredTextFormat,
  estimateAiStructuredInputTokens,
} from "#api/modules/ai/utils/ai-structured-output-format";
import { buildQuizStructuredInput } from "#api/modules/ai/utils/lesson-content-generation-prompt";
import { AiModelRoutingService } from "#api/modules/provider-operations/services/ai-model-routing.service";
import type { AiFeatureRoute } from "#api/modules/provider-operations/types/provider-operations.types";
import { calculateProviderCost } from "#api/modules/provider-operations/utils/provider-cost-calculator";

const ALL_QUESTION_TYPES = Object.values(QuestionType);

@Injectable()
export class LessonContentGenerationJobService {
  constructor(
    @Inject(AiGenerationJobService)
    private readonly jobs: AiGenerationJobService,
    @Inject(LessonContentGenerationContextService)
    private readonly context: LessonContentGenerationContextService,
    @Inject(AiModelRoutingService)
    private readonly modelRouting: AiModelRoutingService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async queueQuiz(
    lessonId: string,
    actorUserId: string,
    input: {
      targetQuizSetId?: string;
      documentIds?: string[];
      questionCount: number;
      difficulty: Difficulty;
      difficultyCounts?: { easy: number; medium: number; hard: number };
      questionTypes?: QuestionType[];
      style?: "student_friendly" | "concise" | "academic";
      styleInstructions?: string;
      extraInstructions?: string;
      systemInstructions?: string;
      userPrompt?: string;
      model?: string;
      temperature?: number;
      reasoningEffort?: AiReasoningEffort;
      maxOutputTokens?: number;
    },
  ) {
    const questionTypes = unique(input.questionTypes ?? ALL_QUESTION_TYPES);
    const snapshot = await this.loadSnapshot(lessonId, input.documentIds);
    const targetQuizSetId = await this.ensureQuizTargetSet(
      lessonId,
      actorUserId,
      input.targetQuizSetId,
    );
    const difficultyCounts = normalizeDifficultyCounts(input);
    const { route } = await this.resolveQuizRoute(input);
    return this.queue(
      AiGenerationType.QUIZ,
      lessonId,
      actorUserId,
      {
        targetQuizSetId,
        questionCount: input.questionCount,
        difficulty: input.difficulty,
        difficultyCounts,
        questionTypes,
        targetGrade: snapshot.targetGrade,
        subjectKey: snapshot.subject.key,
        subjectName: snapshot.subject.name,
        subjectSlug: snapshot.subject.slug,
        style: input.style ?? "student_friendly",
        styleInstructions: input.styleInstructions?.trim() ?? "",
        extraInstructions: input.extraInstructions?.trim() ?? "",
        systemInstructions: input.systemInstructions?.trim() ?? "",
        userPrompt: input.userPrompt?.trim() ?? "",
        ...(input.model ? { model: input.model } : {}),
        ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
        ...(input.reasoningEffort ? { reasoningEffort: input.reasoningEffort } : {}),
        ...(input.maxOutputTokens ? { maxOutputTokens: input.maxOutputTokens } : {}),
      },
      snapshot,
      route,
    );
  }

  async previewQuiz(
    lessonId: string,
    input: Parameters<LessonContentGenerationJobService["queueQuiz"]>[2],
  ) {
    const questionTypes = unique(input.questionTypes ?? ALL_QUESTION_TYPES);
    const snapshot = await this.loadSnapshot(lessonId, input.documentIds);
    const targetQuizSet = await this.resolveQuizTargetSet(
      lessonId,
      input.targetQuizSetId,
    );
    const difficultyCounts = normalizeDifficultyCounts(input);
    const configuration = {
      targetQuizSetId: targetQuizSet?.id ?? null,
      documentIds: snapshot.documentIds,
      sourceHash: snapshot.sourceHash,
      targetGrade: snapshot.targetGrade,
      subjectKey: snapshot.subject.key,
      subjectName: snapshot.subject.name,
      subjectSlug: snapshot.subject.slug,
      questionCount: input.questionCount,
      difficulty: input.difficulty,
      difficultyCounts,
      questionTypes,
      style: input.style ?? ("student_friendly" as const),
      styleInstructions: input.styleInstructions?.trim() ?? "",
      extraInstructions: input.extraInstructions?.trim() ?? "",
      systemInstructions: input.systemInstructions?.trim() ?? "",
      userPrompt: input.userPrompt?.trim() ?? "",
      ...(input.model ? { model: input.model } : {}),
      ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
      ...(input.reasoningEffort ? { reasoningEffort: input.reasoningEffort } : {}),
      ...(input.maxOutputTokens ? { maxOutputTokens: input.maxOutputTokens } : {}),
    };
    const { baseRoute, route } = await this.resolveQuizRoute(input);
    const request = buildQuizStructuredInput({
      lessonId,
      lessonTitle: snapshot.lessonTitle,
      documentIds: snapshot.documentIds,
      sourceHash: snapshot.sourceHash,
      chunks: snapshot.chunks,
      configuration,
    });
    const inputPrompt = buildAiUserPrompt(request);
    const structuredTextFormat = buildAiStructuredTextFormat(
      getGeneratedQuizOutputSchema(snapshot.subject.key),
      request.outputName,
    );
    const candidate =
      route.candidates.find((item) => item.available) ?? route.candidates[0] ?? null;
    const maxOutputTokens = route.maxOutputTokens ?? request.maxTokens ?? 0;
    const inputTokenEstimate = estimateAiStructuredInputTokens({
      systemPrompt: request.systemPrompt,
      inputPrompt,
      structuredTextFormat,
      minimumPromptTokens: snapshot.totalTokens,
    });
    const requiredMetrics = new Set([
      ProviderUsageMetric.INPUT_TOKEN,
      ProviderUsageMetric.OUTPUT_TOKEN,
    ]);
    const availableMetrics = new Set(candidate?.rates.map((rate) => rate.metric) ?? []);
    const canEstimate = [...requiredMetrics].every((metric) =>
      availableMetrics.has(metric),
    );
    const fxRate = await this.getFxRateVndPerUsd();
    const estimatedInputCost =
      candidate && canEstimate
        ? calculateProviderCost(
            {
              promptTokens: inputTokenEstimate.estimatedTokens,
              completionTokens: 0,
              requestCount: 1,
            },
            candidate.rates,
            fxRate,
          )
        : null;
    const estimatedOutputCost =
      candidate && canEstimate
        ? calculateProviderCost(
            {
              promptTokens: 0,
              completionTokens: maxOutputTokens,
              requestCount: 0,
            },
            candidate.rates,
            fxRate,
          )
        : null;
    const estimatedCost =
      candidate && canEstimate
        ? calculateProviderCost(
            {
              promptTokens: inputTokenEstimate.estimatedTokens,
              completionTokens: maxOutputTokens,
              requestCount: 1,
            },
            candidate.rates,
            fxRate,
          )
        : null;
    const modelOptions = await this.modelRouting.getAllActiveModels();
    return {
      promptVersion: LESSON_CONTENT_PROMPT_VERSION,
      schemaVersion: LESSON_CONTENT_SCHEMA_VERSION,
      systemPrompt: request.systemPrompt,
      userPrompt: request.userPrompt,
      inputPrompt,
      openAiRequest: {
        model: candidate?.model ?? null,
        instructions: request.systemPrompt,
        input: inputPrompt,
        text: {
          format: structuredTextFormat,
        },
        temperature: route.temperature ?? request.temperature ?? 0.1,
        ...(route.reasoningEffort ? { reasoning_effort: route.reasoningEffort } : {}),
        max_output_tokens: maxOutputTokens,
      },
      context: {
        documentCount: snapshot.documentIds.length,
        chunkCount: snapshot.chunks.length,
        estimatedTokens: inputTokenEstimate.estimatedTokens,
        textInputTokens: inputTokenEstimate.textInputTokens,
        pdfInputTokens: 0,
        promptTokens: inputTokenEstimate.promptTokens,
        schemaTokens: inputTokenEstimate.schemaTokens,
        contextTokens: snapshot.totalTokens,
        maxContextTokens: 8_000,
      },
      configuration: {
        targetQuizSet,
        selectedModel: input.model ?? null,
        isDefaultConfigured: baseRoute.hasConfiguration,
        resolvedProvider: candidate?.provider ?? null,
        resolvedModel: candidate?.model ?? null,
        temperature: route.temperature ?? request.temperature ?? 0.1,
        reasoningEffort: route.reasoningEffort ?? null,
        maxOutputTokens,
        modelOptions: modelOptions.map((item) => ({
          provider: item.provider,
          model: item.model,
          available: item.available,
          capabilities: item.capabilitiesJson,
        })),
      },
      estimatedCost: estimatedCost
        ? {
            available: true,
            inputUpperBoundUsd: estimatedInputCost?.costUsd ?? null,
            inputUpperBoundVnd: estimatedInputCost?.costVnd ?? null,
            outputUpperBoundUsd: estimatedOutputCost?.costUsd ?? null,
            outputUpperBoundVnd: estimatedOutputCost?.costVnd ?? null,
            upperBoundUsd: estimatedCost.costUsd,
            upperBoundVnd: estimatedCost.costVnd,
            fxRateVndPerUsd: fxRate,
          }
        : {
            available: false,
            inputUpperBoundUsd: null,
            inputUpperBoundVnd: null,
            outputUpperBoundUsd: null,
            outputUpperBoundVnd: null,
            upperBoundUsd: null,
            upperBoundVnd: null,
            fxRateVndPerUsd: fxRate,
          },
    };
  }

  queueFlashcards(
    lessonId: string,
    actorUserId: string,
    input: {
      cardCount: number;
      difficulty: Difficulty;
    },
  ) {
    return this.queue(AiGenerationType.FLASHCARD, lessonId, actorUserId, input);
  }

  queueTest(
    lessonId: string,
    actorUserId: string,
    input: {
      questionCount: number;
      durationSeconds: number;
      difficultyRatio: { easy: number; medium: number; hard: number };
      questionTypes?: QuestionType[];
    },
  ) {
    const ratioTotal =
      input.difficultyRatio.easy +
      input.difficultyRatio.medium +
      input.difficultyRatio.hard;
    if (Math.abs(ratioTotal - 1) > 0.001) {
      throw badRequestException(
        "AI_TEST_DIFFICULTY_RATIO_INVALID",
        "Tổng tỷ lệ độ khó phải bằng 1",
      );
    }
    const questionTypes = unique(input.questionTypes ?? ALL_QUESTION_TYPES);
    return this.queue(AiGenerationType.TEST, lessonId, actorUserId, {
      ...input,
      questionTypes,
    });
  }

  private async queue(
    type: AiGenerationType,
    lessonId: string,
    actorUserId: string,
    request: Record<string, unknown>,
    providedSnapshot?: Awaited<
      ReturnType<LessonContentGenerationContextService["snapshot"]>
    >,
    routeSnapshot?: AiFeatureRoute,
  ) {
    const snapshot = providedSnapshot ?? (await this.loadSnapshot(lessonId));
    const inputMeta = {
      ...request,
      documentIds: snapshot.documentIds,
      sourceHash: snapshot.sourceHash,
      targetGrade: snapshot.targetGrade,
      subjectKey: snapshot.subject.key,
      subjectName: snapshot.subject.name,
      subjectSlug: snapshot.subject.slug,
    };
    const job = await this.jobs.createAndEnqueue({
      type,
      createdByUserId: actorUserId,
      lessonId,
      targetType: `${type}_SET`,
      promptVersion: LESSON_CONTENT_PROMPT_VERSION,
      schemaVersion: LESSON_CONTENT_SCHEMA_VERSION,
      inputFingerprint: { lessonId, ...inputMeta },
      inputMeta,
      ...(routeSnapshot ? { routeSnapshot } : {}),
      idempotencyKey: [
        "ai-content",
        type,
        lessonId,
        snapshot.sourceHash,
        randomUUID(),
      ].join(":"),
      deduplicateActive: true,
      maxAttempts: type === AiGenerationType.QUIZ ? 1 : 3,
    });
    return { mode: "QUEUED" as const, jobId: job.backgroundJobId, status: job.status };
  }

  private async loadSnapshot(lessonId: string, documentIds?: string[]) {
    try {
      return await this.context.snapshot(lessonId, documentIds);
    } catch (error) {
      if (!(error instanceof LessonContentContextError)) throw error;
      if (error.code === "LESSON_NOT_FOUND") {
        throw notFoundException("LESSON_NOT_FOUND", error.message);
      }
      throw badRequestException(error.code, error.message);
    }
  }

  private async resolveQuizRoute(input: {
    model?: string;
    temperature?: number;
    reasoningEffort?: AiReasoningEffort;
    maxOutputTokens?: number;
  }) {
    const baseRoute = await this.modelRouting.resolve(AiGenerationType.QUIZ);
    let candidates = baseRoute.candidates;
    if (input.model) {
      const selected =
        candidates.find(
          (candidate) => candidate.model === input.model && candidate.available,
        ) ?? (await this.modelRouting.resolveCandidateByModel(input.model));
      if (!selected?.available) {
        throw badRequestException(
          "AI_MODEL_NOT_AVAILABLE",
          "Model đã chọn không còn khả dụng cho chức năng Quiz.",
        );
      }
      candidates = [selected];
    }
    const route: AiFeatureRoute = {
      ...baseRoute,
      candidates,
      temperature: input.temperature ?? baseRoute.temperature,
      reasoningEffort: input.reasoningEffort ?? baseRoute.reasoningEffort,
      maxOutputTokens: input.maxOutputTokens ?? baseRoute.maxOutputTokens,
    };
    return { baseRoute, route };
  }

  private async getFxRateVndPerUsd() {
    const setting = await this.prisma.providerAccountingSetting.findUnique({
      where: { singletonKey: "default" },
      select: { fxRateVndPerUsd: true },
    });
    return setting?.fxRateVndPerUsd.toNumber() ?? 25_000;
  }

  private async resolveQuizTargetSet(lessonId: string, targetQuizSetId?: string) {
    if (targetQuizSetId) {
      const selected = await this.prisma.quizSet.findFirst({
        where: { id: targetQuizSetId, lessonId, deletedAt: null },
        select: { id: true, title: true },
      });
      if (!selected) {
        throw badRequestException(
          "QUIZ_TARGET_SET_NOT_FOUND",
          "Bộ Quiz đang chọn không còn tồn tại trong buổi học này.",
        );
      }
      return selected;
    }
    return this.prisma.quizSet.findFirst({
      where: { lessonId, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true },
    });
  }

  private async ensureQuizTargetSet(
    lessonId: string,
    actorUserId: string,
    targetQuizSetId?: string,
  ) {
    const existing = await this.resolveQuizTargetSet(lessonId, targetQuizSetId);
    if (existing) return existing.id;
    const created = await this.prisma.quizSet.create({
      data: {
        lessonId,
        title: "Bộ câu hỏi 1",
        difficulty: Difficulty.MIXED,
        source: "ADMIN",
        reviewStatus: "APPROVED",
        sortOrder: 0,
        createdById: actorUserId,
        updatedById: actorUserId,
      },
      select: { id: true },
    });
    return created.id;
  }
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function normalizeDifficultyCounts(input: {
  questionCount: number;
  difficulty: Difficulty;
  difficultyCounts?: { easy: number; medium: number; hard: number };
}) {
  if (input.difficulty !== Difficulty.MIXED) return null;
  const counts = input.difficultyCounts;
  if (!counts) {
    throw badRequestException(
      "AI_QUIZ_DIFFICULTY_COUNTS_REQUIRED",
      "Quiz Hỗn hợp cần nhập số câu Dễ, Trung bình và Khó",
    );
  }
  const total = counts.easy + counts.medium + counts.hard;
  if (total !== input.questionCount) {
    throw badRequestException(
      "AI_QUIZ_DIFFICULTY_COUNTS_INVALID",
      "Tổng số câu Dễ, Trung bình và Khó phải bằng chính xác số câu Quiz",
    );
  }
  return counts;
}
