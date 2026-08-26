import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isAiReasoningEffort, type AiReasoningEffort } from "@learning-path/shared";
import {
  AiGenerationType,
  AiModelPurpose,
  AiProviderName,
  Difficulty,
  Prisma,
  ProviderUsageMetric,
  QuestionType,
} from "@prisma/client";

import { badRequestException, notFoundException } from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import type { EnvConfig } from "#api/config/env.validation";
import { AiGenerationJobService } from "#api/modules/ai/services/ai-generation-job.service";
import { hashAiValue } from "#api/modules/ai/utils/ai-hash";
import { supportsOpenAiExplicitPromptCaching } from "#api/modules/ai/utils/ai-prompt-cache";
import { buildAiUserPrompt } from "#api/modules/ai/utils/ai-prompt";
import {
  estimateAiStructuredInputTokens,
  resolveAiStructuredTextFormat,
} from "#api/modules/ai/utils/ai-structured-output-format";
import {
  buildOpenAiResponseInput,
  buildOpenAiStructuredResponseRequest,
  OPENAI_PREVIEW_BINARY_DATA,
  OPENAI_PREVIEW_FILE_ID,
} from "#api/modules/ai/utils/openai-response-request";
import { AiModelRoutingService } from "#api/modules/provider-operations/services/ai-model-routing.service";
import type {
  AiFeatureRoute,
  ProviderRouteCandidate,
} from "#api/modules/provider-operations/types/provider-operations.types";
import { supportsHighDetailPdfInput } from "#api/modules/provider-operations/utils/ai-model-capabilities";
import { calculateProviderCost } from "#api/modules/provider-operations/utils/provider-cost-calculator";
import {
  QuizGenerationContextError,
  QuizGenerationContextService,
} from "#api/modules/quiz/services/quiz-generation-context.service";
import {
  getGeneratedQuizOutputSchema,
  QUIZ_MAX_CONFIGURED_OUTPUT_TOKENS,
  QUIZ_SCHEMA_VERSION,
  quizSubjectKeySchema,
  resolveQuizOutputTokenFloor,
  type QuizGenerationJobInput,
} from "#api/modules/quiz/types/quiz-generation.types";
import {
  buildQuizStructuredInput,
  resolveQuizPromptVersion,
} from "#api/modules/quiz/utils/quiz-generation-prompt";

const ALL_QUESTION_TYPES = Object.values(QuestionType);

export interface QueueQuizGenerationInput {
  requestDraftId?: string;
  requestHash?: string;
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
  figureModel?: string;
  figureTemperature?: number;
  figureReasoningEffort?: AiReasoningEffort;
  figureMaxOutputTokens?: number;
}

@Injectable()
export class QuizGenerationJobService {
  constructor(
    @Inject(AiGenerationJobService)
    private readonly jobs: AiGenerationJobService,
    @Inject(QuizGenerationContextService)
    private readonly context: QuizGenerationContextService,
    @Inject(AiModelRoutingService)
    private readonly modelRouting: AiModelRoutingService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(ConfigService)
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async queueQuiz(
    lessonId: string,
    actorUserId: string,
    input: QueueQuizGenerationInput,
  ) {
    if (!input.requestDraftId || !input.requestHash) {
      throw badRequestException(
        "AI_REQUEST_DRAFT_REQUIRED",
        "Hãy cập nhật dữ liệu gửi AI trước khi bắt đầu tạo Quiz.",
      );
    }
    const draft = await this.prisma.quizGenerationRequestDraft.findFirst({
      where: { id: input.requestDraftId, lessonId, createdById: actorUserId },
    });
    if (!draft || draft.expiresAt.getTime() <= Date.now() || draft.consumedAt) {
      throw badRequestException(
        "AI_INPUT_SNAPSHOT_STALE",
        "Bản xem trước đã hết hạn hoặc đã được sử dụng.",
      );
    }
    if (draft.requestHash !== input.requestHash) {
      throw badRequestException(
        "AI_INPUT_SNAPSHOT_STALE",
        "Prompt hiện tại không còn khớp bản xem trước.",
      );
    }

    const sourceSnapshot = readJsonRecord(draft.sourceSnapshotJson);
    const documentIds = readStringArray(sourceSnapshot.documentIds);
    const currentSourceHash = await this.loadCurrentSourceHash(lessonId, documentIds);
    if (
      currentSourceHash !== readRequiredString(sourceSnapshot.sourceHash, "sourceHash")
    ) {
      throw badRequestException(
        "AI_INPUT_SNAPSHOT_STALE",
        "Nguồn PDF hoặc khoảng trang đã thay đổi; hãy cập nhật dữ liệu gửi AI.",
      );
    }
    const snapshotTargetQuizSetId = readNullableString(sourceSnapshot.targetQuizSetId);
    const configuration = {
      ...normalizeConfiguration(input, snapshotTargetQuizSetId),
      ...this.resolveQuizTransportConfiguration(),
    };
    if (
      hashAiValue(configuration) !==
      hashAiValue(readJsonRecord(sourceSnapshot.generationConfiguration))
    ) {
      throw badRequestException(
        "AI_INPUT_SNAPSHOT_STALE",
        "Cấu hình sinh Quiz hiện tại không còn khớp bản xem trước.",
      );
    }
    const targetQuizSetId = await this.ensureQuizTargetSet(
      lessonId,
      actorUserId,
      snapshotTargetQuizSetId,
    );
    const route = readJsonRecord(
      readJsonRecord(draft.modelConfigJson).routeSnapshot,
    ) as unknown as AiFeatureRoute;
    const imageRouteRecord = readJsonRecord(
      readJsonRecord(draft.modelConfigJson).imageRouteSnapshot,
    );
    const imageRouteSnapshot =
      Object.keys(imageRouteRecord).length > 0
        ? (imageRouteRecord as unknown as AiFeatureRoute)
        : route;
    const subjectKey = quizSubjectKeySchema.parse(
      readRequiredString(sourceSnapshot.subjectKey, "subjectKey"),
    );
    const inputMeta = {
      requestDraftId: draft.id,
      requestHash: draft.requestHash,
      packetHash: draft.packetHash,
      manifestHash: draft.manifestHash,
      documentIds,
      sourceHash: currentSourceHash,
      targetGrade: readNullableNumber(sourceSnapshot.targetGrade),
      subjectKey,
      subjectName: readRequiredString(sourceSnapshot.subjectName, "subjectName"),
      subjectSlug: readRequiredString(sourceSnapshot.subjectSlug, "subjectSlug"),
      ...configuration,
      targetQuizSetId,
      imageRouteSnapshot,
    };
    const job = await this.jobs.createAndEnqueue({
      type: AiGenerationType.QUIZ,
      createdByUserId: actorUserId,
      lessonId,
      targetType: "QUIZ_SET",
      targetId: targetQuizSetId,
      promptVersion: resolveQuizPromptVersion(subjectKey),
      schemaVersion: QUIZ_SCHEMA_VERSION,
      inputFingerprint: { lessonId, ...inputMeta },
      inputMeta,
      routeSnapshot: route,
      idempotencyKey: ["quiz-generation", lessonId, currentSourceHash, randomUUID()].join(
        ":",
      ),
      deduplicateActive: true,
      maxAttempts: 1,
    });
    await this.prisma.quizGenerationRequestDraft.update({
      where: { id: draft.id },
      data: { consumedAt: new Date() },
    });
    return { mode: "QUEUED" as const, jobId: job.backgroundJobId, status: job.status };
  }

  async previewQuiz(
    lessonId: string,
    actorUserId: string,
    input: QueueQuizGenerationInput,
  ) {
    await this.cleanupRequestDraftPackets(lessonId, actorUserId);
    const targetQuizSet = await this.resolveQuizTargetSet(
      lessonId,
      input.targetQuizSetId,
    );
    const source = await this.loadPacket(lessonId, input.documentIds);
    if (!source.packet) throw new Error("Missing Quiz source packet.");
    const configuration = {
      ...normalizeConfiguration(input, targetQuizSet?.id ?? null),
      ...this.resolveQuizTransportConfiguration(),
    };
    const jobConfiguration: QuizGenerationJobInput = {
      requestDraftId: randomUUID(),
      requestHash: "0".repeat(64),
      packetHash: source.packet.packetHash,
      manifestHash: source.packet.manifestHash,
      documentIds: source.documentIds,
      sourceHash: source.sourceHash,
      targetGrade: source.targetGrade,
      subjectKey: source.subject.key,
      subjectName: source.subject.name,
      subjectSlug: source.subject.slug,
      ...configuration,
    };
    const { baseRoute, route } = await this.resolveQuizRoute(input);
    const imageRoute = await this.resolveQuizImageRoute(input);
    const request = buildQuizStructuredInput({
      lessonId,
      lessonTitle: source.lessonTitle,
      sourceHash: source.sourceHash,
      documentIds: source.documentIds,
      packet: {
        filename: source.packet.filename,
        bytes: source.packet.bytes,
      },
      configuration: jobConfiguration,
    });
    const inputPrompt = buildAiUserPrompt(request);
    const structuredTextFormatResolution = resolveAiStructuredTextFormat(
      getGeneratedQuizOutputSchema({
        subjectKey: source.subject.key,
        targetGrade: source.targetGrade,
        questionCount: jobConfiguration.questionCount,
        questionTypes: jobConfiguration.questionTypes,
        difficulty: jobConfiguration.difficulty,
      }),
      request.outputName,
      request.schemaReferenceStrategy,
    );
    const structuredTextFormat = structuredTextFormatResolution.format;
    const candidate =
      route.candidates.find((item) => item.available) ?? route.candidates[0] ?? null;
    const maxOutputTokens = route.maxOutputTokens ?? request.maxTokens ?? 0;
    const temperature = route.temperature ?? request.temperature ?? 0.1;
    const reasoningEffort = isAiReasoningEffort(route.reasoningEffort)
      ? route.reasoningEffort
      : undefined;
    const pdfInputTokens = Math.max(1, source.packet.manifest.pageCount * 1_000);
    const inputTokenEstimate = estimateAiStructuredInputTokens({
      systemPrompt: request.systemPrompt,
      inputPrompt,
      structuredTextFormat,
      additionalInputTokens: pdfInputTokens,
    });
    const fxRate = await this.getFxRateVndPerUsd();
    const costs = estimateCosts(
      candidate,
      fxRate,
      inputTokenEstimate.estimatedTokens,
      maxOutputTokens,
      Boolean(
        candidate?.provider === AiProviderName.OPENAI &&
        request.promptCache &&
        supportsOpenAiExplicitPromptCaching(candidate.model),
      ),
    );
    const schemaJson = structuredTextFormat.schema;
    const schemaHash = hashAiValue(schemaJson);
    const requestHash = hashAiValue({
      packetHash: source.packet.packetHash,
      manifestHash: source.packet.manifestHash,
      systemPrompt: request.systemPrompt,
      userPrompt: request.userPrompt,
      schemaVersion: QUIZ_SCHEMA_VERSION,
      schemaHash,
      model: candidate?.model ?? null,
      temperature,
      reasoningEffort,
      maxOutputTokens,
      schemaReferenceStrategy: request.schemaReferenceStrategy,
      resolvedSchemaReferenceStrategy:
        structuredTextFormatResolution.resolvedReferenceStrategy,
      detail: "high",
    });
    const expiresAt = new Date(
      Date.now() +
        this.config.get("AI_QUIZ_REQUEST_DRAFT_TTL_SECONDS", { infer: true }) * 1_000,
    );
    const draft = await this.prisma.quizGenerationRequestDraft.create({
      data: {
        lessonId,
        createdById: actorUserId,
        requestHash,
        packetHash: source.packet.packetHash,
        manifestHash: source.packet.manifestHash,
        packetObjectKey: source.packet.objectKey,
        packetFilename: source.packet.filename,
        packetSizeBytes: BigInt(source.packet.bytes.length),
        packetPageCount: source.packet.manifest.pageCount,
        systemInstructions: request.systemPrompt,
        userPrompt: request.userPrompt,
        schemaName: request.outputName,
        schemaVersion: QUIZ_SCHEMA_VERSION,
        schemaHash,
        schemaJson: schemaJson as unknown as Prisma.InputJsonValue,
        manifestJson: source.packet.manifest as unknown as Prisma.InputJsonValue,
        sourceSnapshotJson: {
          ...source.packet.sourceSnapshot,
          documentIds: source.documentIds,
          sourceHash: source.sourceHash,
          lessonTitle: source.lessonTitle,
          targetGrade: source.targetGrade,
          subjectKey: source.subject.key,
          subjectName: source.subject.name,
          subjectSlug: source.subject.slug,
          targetQuizSetId: targetQuizSet?.id ?? null,
          generationConfiguration: configuration,
        } as Prisma.InputJsonValue,
        modelConfigJson: {
          resolvedProvider: candidate?.provider ?? null,
          resolvedModel: candidate?.model ?? null,
          temperature,
          reasoningEffort,
          maxOutputTokens,
          schemaReferenceStrategy: request.schemaReferenceStrategy,
          resolvedSchemaReferenceStrategy:
            structuredTextFormatResolution.resolvedReferenceStrategy,
          schemaBytes: structuredTextFormatResolution.schemaBytes,
          pdfDetail: "high",
          routeSnapshot: route,
          imageRouteSnapshot: imageRoute,
        } as unknown as Prisma.InputJsonValue,
        costEstimateJson: costs.total
          ? ({
              inputUpperBoundUsd: costs.input?.costUsd ?? null,
              inputUpperBoundVnd: costs.input?.costVnd ?? null,
              outputUpperBoundUsd: costs.output?.costUsd ?? null,
              outputUpperBoundVnd: costs.output?.costVnd ?? null,
              upperBoundUsd: costs.total.costUsd,
              upperBoundVnd: costs.total.costVnd,
              fxRateVndPerUsd: fxRate,
            } as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        expiresAt,
      },
    });
    const modelOptions = (await this.modelRouting.getAllActiveModels()).filter(
      supportsHighDetailPdfInput,
    );
    return {
      requestDraftId: draft.id,
      requestHash,
      expiresAt,
      promptVersion: request.promptVersion,
      schemaVersion: QUIZ_SCHEMA_VERSION,
      systemPrompt: request.systemPrompt,
      userPrompt: request.userPrompt,
      inputPrompt,
      openAiFileUploadRequest: {
        purpose: "user_data" as const,
        file: `<File name="${source.packet.filename}" type="application/pdf" size=${source.packet.bytes.length}; ${OPENAI_PREVIEW_BINARY_DATA}>`,
      },
      openAiRequest: buildOpenAiStructuredResponseRequest({
        request: {
          ...request,
          model: candidate?.model,
          temperature,
          reasoningEffort,
          maxTokens: maxOutputTokens,
        },
        model: candidate?.model ?? null,
        structuredTextFormat,
        responseInput: buildOpenAiResponseInput(request, [
          { type: "input_file", file_id: OPENAI_PREVIEW_FILE_ID, detail: "high" },
        ]),
      }),
      context: {
        lessonTitle: source.lessonTitle,
        documentCount: source.documentIds.length,
        packet: {
          filename: source.packet.filename,
          sizeBytes: source.packet.bytes.length,
          pageCount: source.packet.manifest.pageCount,
          packetHash: source.packet.packetHash,
          manifestHash: source.packet.manifestHash,
          detail: "high" as const,
          manifest: source.packet.manifest,
        },
        chunkCount: 0,
        estimatedTokens: inputTokenEstimate.estimatedTokens,
        textInputTokens: inputTokenEstimate.textInputTokens,
        pdfInputTokens,
        promptTokens: inputTokenEstimate.promptTokens,
        schemaTokens: inputTokenEstimate.schemaTokens,
        contextTokens: 0,
        maxContextTokens: null,
        chunks: [],
      },
      configuration: {
        targetQuizSet,
        selectedModel: input.model ?? null,
        isDefaultConfigured: baseRoute.hasConfiguration,
        resolvedProvider: candidate?.provider ?? null,
        resolvedModel: candidate?.model ?? null,
        temperature,
        reasoningEffort: reasoningEffort ?? null,
        maxOutputTokens,
        schemaReferenceStrategy: request.schemaReferenceStrategy ?? "inline",
        resolvedSchemaReferenceStrategy:
          structuredTextFormatResolution.resolvedReferenceStrategy,
        schemaBytes: structuredTextFormatResolution.schemaBytes,
        modelOptions: modelOptions.map((item) => ({
          provider: item.provider,
          model: item.model,
          available: item.available,
          capabilities: item.capabilitiesJson,
        })),
      },
      estimatedCost: costs.total
        ? {
            available: true,
            inputUpperBoundUsd: costs.input?.costUsd ?? null,
            inputUpperBoundVnd: costs.input?.costVnd ?? null,
            outputUpperBoundUsd: costs.output?.costUsd ?? null,
            outputUpperBoundVnd: costs.output?.costVnd ?? null,
            upperBoundUsd: costs.total.costUsd,
            upperBoundVnd: costs.total.costVnd,
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

  private async cleanupRequestDraftPackets(lessonId: string, actorUserId: string) {
    const drafts = await this.prisma.quizGenerationRequestDraft.findMany({
      where: {
        consumedAt: null,
        OR: [{ expiresAt: { lte: new Date() } }, { lessonId, createdById: actorUserId }],
      },
      select: { id: true, packetObjectKey: true },
      take: 50,
    });
    if (drafts.length === 0) return;
    await Promise.all(
      drafts.map((draft) =>
        this.context.cleanupPacket(draft.packetObjectKey).catch(() => undefined),
      ),
    );
    await this.prisma.quizGenerationRequestDraft.deleteMany({
      where: { id: { in: drafts.map((draft) => draft.id) } },
    });
  }

  private async loadPacket(lessonId: string, documentIds?: string[]) {
    try {
      return await this.context.loadPacket(lessonId, documentIds);
    } catch (error) {
      this.rethrowContextError(error);
    }
  }

  private async loadCurrentSourceHash(lessonId: string, documentIds: string[]) {
    try {
      return await this.context.computeCurrentSourceHash(lessonId, documentIds);
    } catch (error) {
      this.rethrowContextError(error);
    }
  }

  private rethrowContextError(error: unknown): never {
    if (!(error instanceof QuizGenerationContextError)) throw error;
    if (error.code === "LESSON_NOT_FOUND") {
      throw notFoundException("LESSON_NOT_FOUND", error.message);
    }
    throw badRequestException(error.code, error.message, error.details);
  }

  private async resolveQuizRoute(input: QueueQuizGenerationInput) {
    const baseRoute = await this.modelRouting.resolve(
      AiGenerationType.QUIZ,
      AiModelPurpose.TEXT,
    );
    let candidates = baseRoute.candidates.filter(supportsHighDetailPdfInput);
    if (!input.model && candidates.length === 0) {
      throw badRequestException(
        "AI_PDF_MODEL_NOT_AVAILABLE",
        "Chưa có model OpenAI hỗ trợ PDF detail=high cho chức năng Quiz.",
      );
    }
    if (input.model) {
      let selected: ProviderRouteCandidate | null | undefined = candidates.find(
        (candidate) => candidate.model === input.model && candidate.available,
      );
      if (!selected)
        selected = await this.modelRouting.resolveCandidateByModel(input.model);
      if (!selected?.available || !supportsHighDetailPdfInput(selected)) {
        throw badRequestException(
          "AI_MODEL_NOT_AVAILABLE",
          "Model đã chọn không hỗ trợ PDF detail=high cho chức năng Quiz.",
        );
      }
      candidates = [selected];
    }
    const route: AiFeatureRoute = {
      ...baseRoute,
      model: candidates[0]?.model ?? baseRoute.model,
      candidates,
      temperature: input.temperature ?? baseRoute.temperature,
      reasoningEffort: input.reasoningEffort ?? baseRoute.reasoningEffort,
      maxOutputTokens: Math.min(
        QUIZ_MAX_CONFIGURED_OUTPUT_TOKENS,
        Math.max(
          input.maxOutputTokens ?? 0,
          baseRoute.maxOutputTokens ?? 0,
          resolveQuizOutputTokenFloor({
            questionCount: input.questionCount,
            questionTypes: input.questionTypes,
          }),
        ),
      ),
    };
    return { baseRoute, route };
  }

  private async resolveQuizImageRoute(input: QueueQuizGenerationInput) {
    const baseRoute = await this.modelRouting.resolve(
      AiGenerationType.QUIZ,
      AiModelPurpose.IMAGE,
    );
    let candidates = baseRoute.candidates;
    if (input.figureModel) {
      const selected =
        candidates.find(
          (candidate) => candidate.model === input.figureModel && candidate.available,
        ) ?? (await this.modelRouting.resolveCandidateByModel(input.figureModel));
      if (!selected?.available) {
        throw badRequestException(
          "AI_MODEL_NOT_AVAILABLE",
          "Model tạo hình đã chọn không còn khả dụng cho Quiz.",
        );
      }
      candidates = [selected];
    }
    return {
      ...baseRoute,
      model: candidates[0]?.model ?? baseRoute.model,
      candidates,
      temperature: input.figureTemperature ?? baseRoute.temperature,
      reasoningEffort: input.figureReasoningEffort ?? baseRoute.reasoningEffort,
      maxOutputTokens: input.figureMaxOutputTokens ?? baseRoute.maxOutputTokens,
    } satisfies AiFeatureRoute;
  }

  private resolveQuizTransportConfiguration(): Pick<
    QuizGenerationJobInput,
    "schemaReferenceStrategy" | "promptCacheKeyEnabled" | "promptCacheRetention"
  > {
    return {
      schemaReferenceStrategy: this.config.get("AI_QUIZ_SCHEMA_REFERENCE_STRATEGY", {
        infer: true,
      }),
      promptCacheKeyEnabled: this.config.get("AI_QUIZ_PROMPT_CACHE_KEY_ENABLED", {
        infer: true,
      }),
      promptCacheRetention: this.config.get("AI_QUIZ_PROMPT_CACHE_RETENTION", {
        infer: true,
      }),
    };
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

    const existing = await this.prisma.quizSet.findFirst({
      where: { lessonId, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true },
    });
    if (existing) {
      throw badRequestException(
        "QUIZ_TARGET_SET_REQUIRED",
        "Danh sách bộ Quiz đã thay đổi. Hãy tải lại và chọn đúng bộ Quiz trước khi tạo.",
      );
    }
    return null;
  }

  private async ensureQuizTargetSet(
    lessonId: string,
    actorUserId: string,
    targetQuizSetId: string | null,
  ) {
    const existing = await this.resolveQuizTargetSet(
      lessonId,
      targetQuizSetId ?? undefined,
    );
    if (existing) return existing.id;
    const created = await this.prisma.quizSet.create({
      data: {
        lessonId,
        title: "Bộ câu hỏi 1",
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

function normalizeConfiguration(
  input: QueueQuizGenerationInput,
  targetQuizSetId: string | null,
) {
  const questionTypes = [...new Set(input.questionTypes ?? ALL_QUESTION_TYPES)];
  return {
    targetQuizSetId,
    questionCount: input.questionCount,
    difficulty: input.difficulty,
    difficultyCounts: normalizeDifficultyCounts(input),
    questionTypes,
    style: input.style ?? ("student_friendly" as const),
    styleInstructions: input.styleInstructions?.trim() ?? "",
    extraInstructions: input.extraInstructions?.trim() ?? "",
    systemInstructions: input.systemInstructions ?? "",
    userPrompt: input.userPrompt ?? "",
    ...(input.model ? { model: input.model } : {}),
    ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
    ...(input.reasoningEffort ? { reasoningEffort: input.reasoningEffort } : {}),
    maxOutputTokens: Math.max(
      input.maxOutputTokens ?? 0,
      resolveQuizOutputTokenFloor({
        questionCount: input.questionCount,
        questionTypes,
      }),
    ),
  };
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
  if (counts.easy + counts.medium + counts.hard !== input.questionCount) {
    throw badRequestException(
      "AI_QUIZ_DIFFICULTY_COUNTS_INVALID",
      "Tổng số câu Dễ, Trung bình và Khó phải bằng chính xác số câu Quiz",
    );
  }
  return counts;
}

function estimateCosts(
  candidate: ProviderRouteCandidate | null,
  fxRate: number,
  inputTokens: number,
  outputTokens: number,
  useExplicitPromptCache: boolean,
) {
  const required = new Set([
    ProviderUsageMetric.INPUT_TOKEN,
    ProviderUsageMetric.OUTPUT_TOKEN,
  ]);
  const available = new Set(candidate?.rates.map((rate) => rate.metric) ?? []);
  const canEstimate = [...required].every((metric) => available.has(metric));
  if (!candidate || !canEstimate) return { input: null, output: null, total: null };
  const inputUsageUpperBound = {
    promptTokens: inputTokens,
    ...(useExplicitPromptCache ? { cacheWriteInputTokens: inputTokens } : {}),
  };
  return {
    input: calculateProviderCost(
      { ...inputUsageUpperBound, completionTokens: 0, requestCount: 1 },
      candidate.rates,
      fxRate,
    ),
    output: calculateProviderCost(
      { promptTokens: 0, completionTokens: outputTokens, requestCount: 0 },
      candidate.rates,
      fxRate,
    ),
    total: calculateProviderCost(
      { ...inputUsageUpperBound, completionTokens: outputTokens, requestCount: 1 },
      candidate.rates,
      fxRate,
    ),
  };
}

function readJsonRecord(value: Prisma.JsonValue | null | undefined) {
  return isRecord(value) ? value : {};
}

function readRequiredString(value: unknown, field: string) {
  if (typeof value !== "string" || value.length === 0) {
    throw badRequestException(
      "AI_INPUT_SNAPSHOT_INVALID",
      `Snapshot thiếu trường ${field}.`,
    );
  }
  return value;
}

function readNullableString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readNullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
