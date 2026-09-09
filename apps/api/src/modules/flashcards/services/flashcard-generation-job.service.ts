import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isAiReasoningEffort } from "@learning-path/shared";
import {
  AiGenerationType,
  AiModelPurpose,
  AiProviderName,
  ContentSource,
  Difficulty,
  Prisma,
  ProviderUsageMetric,
  ReviewStatus,
} from "@prisma/client";
import { badRequestException, notFoundException } from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import type { EnvConfig } from "#api/config/env.validation";
import { AiGenerationJobService } from "#api/modules/ai/services/ai-generation-job.service";
import { hashAiValue } from "#api/modules/ai/utils/ai-hash";
import { buildAiUserPrompt } from "#api/modules/ai/utils/ai-prompt";
import { supportsOpenAiExplicitPromptCaching } from "#api/modules/ai/utils/ai-prompt-cache";
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
import {
  FlashcardGenerationContextError,
  FlashcardGenerationContextService,
} from "#api/modules/flashcards/services/flashcard-generation-context.service";
import {
  FLASHCARD_MAX_OUTPUT_TOKENS,
  FLASHCARD_MIN_OUTPUT_TOKENS,
  FLASHCARD_SCHEMA_VERSION,
  flashcardSubjectKeySchema,
  generatedFlashcardOutputSchema,
  type QueueFlashcardGenerationInput,
} from "#api/modules/flashcards/types/flashcard-generation.types";
import {
  buildFlashcardStructuredInput,
  resolveFlashcardPromptVersion,
} from "#api/modules/flashcards/utils/flashcard-generation-prompt";
import { AiModelRoutingService } from "#api/modules/provider-operations/services/ai-model-routing.service";
import type {
  AiFeatureRoute,
  ProviderRouteCandidate,
} from "#api/modules/provider-operations/types/provider-operations.types";
import { supportsHighDetailPdfInput } from "#api/modules/provider-operations/utils/ai-model-capabilities";
import { calculateProviderCost } from "#api/modules/provider-operations/utils/provider-cost-calculator";

@Injectable()
export class FlashcardGenerationJobService {
  constructor(
    @Inject(AiGenerationJobService) private readonly jobs: AiGenerationJobService,
    @Inject(FlashcardGenerationContextService)
    private readonly context: FlashcardGenerationContextService,
    @Inject(AiModelRoutingService)
    private readonly modelRouting: AiModelRoutingService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async preview(lessonId: string, actorUserId: string, input: QueueFlashcardGenerationInput) {
    await this.cleanupDrafts(lessonId, actorUserId);
    const [targetSet, source, existingCards] = await Promise.all([
      this.resolveTargetSet(lessonId, input.targetFlashcardSetId),
      this.loadPacket(lessonId, input.documentIds),
      this.prisma.flashcard.findMany({
        where: { lessonId, deletedAt: null, flashcardSet: { deletedAt: null } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { frontJson: true },
      }),
    ]);
    const configuration = normalizeConfiguration(input, targetSet?.id ?? null);
    const route = await this.resolveRoute(
      { ...input, maxOutputTokens: configuration.maxOutputTokens },
      AiModelPurpose.TEXT,
    );
    const imageRoute = await this.resolveRoute(input, AiModelPurpose.IMAGE);
    const candidate =
      route.candidates.find((item) => item.available) ?? route.candidates[0] ?? null;
    const jobConfiguration = {
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
      targetFlashcardSetId: targetSet?.id ?? randomUUID(),
      temperature: route.temperature ?? 0.2,
      reasoningEffort: isAiReasoningEffort(route.reasoningEffort)
        ? route.reasoningEffort
        : undefined,
      model: candidate?.model,
    };
    const request = buildFlashcardStructuredInput({
      lessonId,
      lessonTitle: source.lessonTitle,
      sourceHash: source.sourceHash,
      documentIds: source.documentIds,
      packet: {
        filename: source.packet.filename,
        bytes: source.packet.bytes,
        modelManifest: source.packet.modelManifest,
      },
      configuration: jobConfiguration,
      existingFronts: existingCards
        .map((card) => tiptapText(card.frontJson))
        .filter(Boolean),
    });
    const manifestPrompt = request.inputTextItems?.[0]?.text ?? "";
    const inputPrompt = [manifestPrompt, buildAiUserPrompt(request)]
      .filter(Boolean)
      .join("\n\n");
    const format = resolveAiStructuredTextFormat(
      generatedFlashcardOutputSchema,
      request.outputName,
      request.schemaReferenceStrategy,
    );
    const tokenEstimate = estimateAiStructuredInputTokens({
      systemPrompt: request.systemPrompt,
      inputPrompt,
      structuredTextFormat: format.format,
      additionalInputTokens: Math.max(
        1,
        source.packet.manifest.pageCount * 1_000,
      ),
    });
    const fxRate = await this.getFxRateVndPerUsd();
    const costs = estimateCosts(
      candidate,
      fxRate,
      tokenEstimate.estimatedTokens,
      configuration.maxOutputTokens,
      Boolean(
        candidate?.provider === AiProviderName.OPENAI &&
          request.promptCache &&
          supportsOpenAiExplicitPromptCaching(candidate.model),
      ),
    );
    const schemaJson = format.format.schema;
    const schemaHash = hashAiValue(schemaJson);
    const requestHash = hashAiValue({
      packetHash: source.packet.packetHash,
      manifestHash: source.packet.manifestHash,
      systemPrompt: request.systemPrompt,
      userPrompt: request.userPrompt,
      schemaHash,
      model: candidate?.model ?? null,
      temperature: request.temperature,
      reasoningEffort: request.reasoningEffort,
      maxOutputTokens: request.maxTokens,
    });
    const expiresAt = new Date(
      Date.now() +
        this.config.get("AI_FLASHCARD_REQUEST_DRAFT_TTL_SECONDS", { infer: true }) *
          1_000,
    );
    const estimatedCost = costs.total
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
      : unavailableCost(fxRate);
    const draft = await this.prisma.flashcardGenerationRequestDraft.create({
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
        schemaVersion: FLASHCARD_SCHEMA_VERSION,
        schemaHash,
        schemaJson: json(schemaJson),
        manifestJson: json(source.packet.manifest),
        sourceSnapshotJson: json({
          ...source.packet.sourceSnapshot,
          lessonTitle: source.lessonTitle,
          targetGrade: source.targetGrade,
          subjectKey: source.subject.key,
          subjectName: source.subject.name,
          subjectSlug: source.subject.slug,
          documentIds: source.documentIds,
          sourceHash: source.sourceHash,
          targetFlashcardSetId: targetSet?.id ?? null,
          generationConfiguration: configuration,
        }),
        modelConfigJson: json({ routeSnapshot: route, imageRouteSnapshot: imageRoute }),
        costEstimateJson: json(estimatedCost),
        expiresAt,
      },
    });
    return {
      requestDraftId: draft.id,
      requestHash,
      expiresAt: expiresAt.toISOString(),
      promptVersion: request.promptVersion,
      schemaVersion: FLASHCARD_SCHEMA_VERSION,
      systemPrompt: request.systemPrompt,
      userPrompt: request.userPrompt,
      inputPrompt,
      openAiFileUploadRequest: {
        purpose: "user_data" as const,
        file: `<File name="${source.packet.filename}" type="application/pdf" size=${source.packet.bytes.length}; ${OPENAI_PREVIEW_BINARY_DATA}>`,
      },
      openAiRequest: buildOpenAiStructuredResponseRequest({
        request,
        model: candidate?.model ?? null,
        structuredTextFormat: format.format,
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
        estimatedTokens: tokenEstimate.estimatedTokens,
        textInputTokens: tokenEstimate.textInputTokens,
        pdfInputTokens: Math.max(1, source.packet.manifest.pageCount * 1_000),
        promptTokens: tokenEstimate.promptTokens,
        schemaTokens: tokenEstimate.schemaTokens,
        contextTokens: 0,
        maxContextTokens: null,
        chunks: [],
      },
      configuration: {
        targetFlashcardSet: targetSet,
        selectedModel: input.model ?? null,
        isDefaultConfigured: route.hasConfiguration,
        resolvedProvider: candidate?.provider ?? null,
        resolvedModel: candidate?.model ?? null,
        temperature: request.temperature,
        reasoningEffort: request.reasoningEffort ?? null,
        maxOutputTokens: configuration.maxOutputTokens,
        schemaReferenceStrategy: "ref_v2",
        resolvedSchemaReferenceStrategy: format.resolvedReferenceStrategy,
        schemaBytes: format.schemaBytes,
        modelOptions: route.candidates.map((item) => ({
          provider: item.provider,
          model: item.model,
          available: item.available,
          capabilities: item.capabilitiesJson,
        })),
      },
      estimatedCost,
    };
  }

  async queue(lessonId: string, actorUserId: string, input: QueueFlashcardGenerationInput) {
    if (!input.requestDraftId || !input.requestHash) {
      throw badRequestException(
        "AI_REQUEST_DRAFT_REQUIRED",
        "Hãy cập nhật dữ liệu gửi AI trước khi bắt đầu tạo Flashcard.",
      );
    }
    const draft = await this.prisma.flashcardGenerationRequestDraft.findFirst({
      where: { id: input.requestDraftId, lessonId, createdById: actorUserId },
    });
    if (!draft || draft.expiresAt.getTime() <= Date.now() || draft.consumedAt) {
      throw badRequestException("AI_INPUT_SNAPSHOT_STALE", "Bản xem trước đã hết hạn hoặc đã được sử dụng.");
    }
    if (draft.requestHash !== input.requestHash) {
      throw badRequestException("AI_INPUT_SNAPSHOT_STALE", "Prompt hiện tại không còn khớp bản xem trước.");
    }
    const sourceSnapshot = readRecord(draft.sourceSnapshotJson);
    const documentIds = readStringArray(sourceSnapshot.documentIds);
    const currentSourceHash = await this.loadCurrentSourceHash(lessonId, documentIds);
    if (currentSourceHash !== readRequiredString(sourceSnapshot.sourceHash, "sourceHash")) {
      throw badRequestException("AI_INPUT_SNAPSHOT_STALE", "Nguồn PDF hoặc khoảng trang Flashcard đã thay đổi; hãy cập nhật dữ liệu gửi AI.");
    }
    if (!draft.packetHash || !draft.manifestHash) {
      throw badRequestException("AI_INPUT_SNAPSHOT_STALE", "Bản xem trước Flashcard cũ không có packet PDF; hãy cập nhật lại.");
    }
    const targetSnapshot = readNullableString(sourceSnapshot.targetFlashcardSetId);
    const configuration = normalizeConfiguration(input, targetSnapshot);
    if (hashAiValue(configuration) !== hashAiValue(readRecord(sourceSnapshot.generationConfiguration))) {
      throw badRequestException("AI_INPUT_SNAPSHOT_STALE", "Cấu hình Flashcard không còn khớp bản xem trước.");
    }
    const targetFlashcardSetId = await this.ensureTargetSet(lessonId, actorUserId, targetSnapshot);
    const modelConfig = readRecord(draft.modelConfigJson);
    const route = readRecord(modelConfig.routeSnapshot) as unknown as AiFeatureRoute;
    const imageRouteSnapshot = readRecord(modelConfig.imageRouteSnapshot) as unknown as AiFeatureRoute;
    const subjectKey = flashcardSubjectKeySchema.parse(readRequiredString(sourceSnapshot.subjectKey, "subjectKey"));
    const subjectName = readRequiredString(sourceSnapshot.subjectName, "subjectName");
    const subjectSlug = readRequiredString(sourceSnapshot.subjectSlug, "subjectSlug");
    const inputMeta = {
      requestDraftId: draft.id,
      requestHash: draft.requestHash,
      packetHash: draft.packetHash,
      manifestHash: draft.manifestHash,
      documentIds,
      sourceHash: currentSourceHash,
      targetGrade: readNullableNumber(sourceSnapshot.targetGrade),
      subjectKey,
      subjectName,
      subjectSlug,
      ...configuration,
      targetFlashcardSetId,
      imageRouteSnapshot,
    };
    const job = await this.jobs.createAndEnqueue({
      type: AiGenerationType.FLASHCARD,
      createdByUserId: actorUserId,
      lessonId,
      targetType: "FLASHCARD_SET",
      targetId: targetFlashcardSetId,
      promptVersion: resolveFlashcardPromptVersion({ key: subjectKey, name: subjectName, slug: subjectSlug }),
      schemaVersion: FLASHCARD_SCHEMA_VERSION,
      inputFingerprint: { lessonId, ...inputMeta },
      inputMeta,
      routeSnapshot: route,
      idempotencyKey: ["flashcard-generation", lessonId, currentSourceHash, randomUUID()].join(":"),
      deduplicateActive: true,
      maxAttempts: 1,
    });
    await this.prisma.flashcardGenerationRequestDraft.update({
      where: { id: draft.id },
      data: { consumedAt: new Date() },
    });
    return { mode: "QUEUED" as const, jobId: job.backgroundJobId, status: job.status };
  }

  private async resolveRoute(input: QueueFlashcardGenerationInput, purpose: AiModelPurpose) {
    const base = await this.modelRouting.resolve(AiGenerationType.FLASHCARD, purpose);
    const selectedModel = purpose === AiModelPurpose.IMAGE ? input.figureModel : input.model;
    let candidates =
      purpose === AiModelPurpose.TEXT
        ? base.candidates.filter(supportsHighDetailPdfInput)
        : base.candidates;
    if (!selectedModel && candidates.length === 0) {
      throw badRequestException(
        "AI_PDF_MODEL_NOT_AVAILABLE",
        "Chưa có model hỗ trợ PDF detail=high cho chức năng Flashcard.",
      );
    }
    if (selectedModel) {
      const selected =
        candidates.find((item) => item.model === selectedModel && item.available) ??
        (await this.modelRouting.resolveCandidateByModel(selectedModel));
      if (
        !selected?.available ||
        (purpose === AiModelPurpose.TEXT && !supportsHighDetailPdfInput(selected))
      ) {
        throw badRequestException("AI_MODEL_NOT_AVAILABLE", "Model đã chọn không hỗ trợ PDF detail=high cho Flashcard.");
      }
      candidates = [selected];
    }
    const figure = purpose === AiModelPurpose.IMAGE;
    return {
      ...base,
      model: candidates[0]?.model ?? base.model,
      candidates,
      temperature: (figure ? input.figureTemperature : input.temperature) ?? base.temperature,
      reasoningEffort: (figure ? input.figureReasoningEffort : input.reasoningEffort) ?? base.reasoningEffort,
      maxOutputTokens: (figure ? input.figureMaxOutputTokens : input.maxOutputTokens) ?? base.maxOutputTokens,
    } satisfies AiFeatureRoute;
  }

  private async resolveTargetSet(lessonId: string, setId?: string) {
    if (setId) {
      const selected = await this.prisma.flashcardSet.findFirst({
        where: { id: setId, lessonId, deletedAt: null },
        select: { id: true, title: true },
      });
      if (!selected) throw badRequestException("FLASHCARD_TARGET_SET_NOT_FOUND", "Bộ Flashcard đang chọn không còn tồn tại.");
      return selected;
    }
    const existing = await this.prisma.flashcardSet.findFirst({ where: { lessonId, deletedAt: null }, select: { id: true } });
    if (existing) throw badRequestException("FLASHCARD_TARGET_SET_REQUIRED", "Hãy chọn đúng bộ Flashcard trước khi tạo.");
    return null;
  }

  private async ensureTargetSet(lessonId: string, actorUserId: string, setId: string | null) {
    const existing = await this.resolveTargetSet(lessonId, setId ?? undefined);
    if (existing) return existing.id;
    const created = await this.prisma.flashcardSet.create({
      data: {
        lessonId,
        title: "Bộ flashcard 1",
        source: ContentSource.ADMIN,
        reviewStatus: ReviewStatus.APPROVED,
        difficulty: Difficulty.MIXED,
        sortOrder: 0,
        createdById: actorUserId,
        updatedById: actorUserId,
      },
      select: { id: true },
    });
    return created.id;
  }

  private async loadPacket(lessonId: string, documentIds?: string[]) {
    try { return await this.context.loadPacket(lessonId, documentIds); }
    catch (error) { this.rethrowContextError(error); }
  }

  private async loadCurrentSourceHash(lessonId: string, documentIds: string[]) {
    try { return await this.context.computeCurrentSourceHash(lessonId, documentIds); }
    catch (error) { this.rethrowContextError(error); }
  }

  private rethrowContextError(error: unknown): never {
    if (!(error instanceof FlashcardGenerationContextError)) throw error;
    if (error.code === "LESSON_NOT_FOUND") throw notFoundException("LESSON_NOT_FOUND", error.message);
    throw badRequestException(error.code, error.message, error.details);
  }

  private async cleanupDrafts(lessonId: string, actorUserId: string) {
    const drafts = await this.prisma.flashcardGenerationRequestDraft.findMany({
      where: { consumedAt: null, OR: [{ expiresAt: { lte: new Date() } }, { lessonId, createdById: actorUserId }] },
      select: { id: true, packetObjectKey: true },
      take: 50,
    });
    await Promise.all(
      drafts.map((draft) =>
        draft.packetObjectKey
          ? this.context.cleanupPacket(draft.packetObjectKey).catch(() => undefined)
          : Promise.resolve(),
      ),
    );
    await this.prisma.flashcardGenerationRequestDraft.deleteMany({
      where: { id: { in: drafts.map((draft) => draft.id) } },
    });
  }

  private async getFxRateVndPerUsd() {
    const setting = await this.prisma.providerAccountingSetting.findUnique({
      where: { singletonKey: "default" },
      select: { fxRateVndPerUsd: true },
    });
    return setting?.fxRateVndPerUsd.toNumber() ?? 25_000;
  }
}

function normalizeConfiguration(input: QueueFlashcardGenerationInput, targetFlashcardSetId: string | null) {
  return {
    targetFlashcardSetId,
    cardCount: input.cardCount,
    ...(input.realWorldCardCount === undefined ? {} : { realWorldCardCount: input.realWorldCardCount }),
    difficulty: input.difficulty,
    difficultyCounts: normalizeDifficultyCounts(input),
    style: input.style ?? ("student_friendly" as const),
    styleInstructions: input.styleInstructions?.trim() || "Dễ hiểu, gần gũi, sử dụng cách diễn đạt và mức độ chi tiết phù hợp lứa tuổi.",
    extraInstructions: input.extraInstructions?.trim() ?? "",
    systemInstructions: input.systemInstructions ?? "",
    userPrompt: input.userPrompt ?? "",
    ...(input.model ? { model: input.model } : {}),
    ...(input.temperature === undefined ? {} : { temperature: input.temperature }),
    ...(input.reasoningEffort ? { reasoningEffort: input.reasoningEffort } : {}),
    maxOutputTokens: Math.min(FLASHCARD_MAX_OUTPUT_TOKENS, Math.max(input.maxOutputTokens ?? 0, FLASHCARD_MIN_OUTPUT_TOKENS, input.cardCount * 450)),
    schemaReferenceStrategy: "ref_v2" as const,
    promptCacheKeyEnabled: true,
    promptCacheRetention: "in_memory" as const,
  };
}

function normalizeDifficultyCounts(input: QueueFlashcardGenerationInput) {
  if (input.difficulty !== Difficulty.MIXED) return null;
  if (!input.difficultyCounts) throw badRequestException("AI_FLASHCARD_DIFFICULTY_COUNTS_REQUIRED", "Flashcard Hỗn hợp cần nhập số thẻ Dễ, Trung bình và Khó.");
  const { easy, medium, hard } = input.difficultyCounts;
  if (easy + medium + hard !== input.cardCount) throw badRequestException("AI_FLASHCARD_DIFFICULTY_COUNTS_INVALID", "Tổng số thẻ Dễ, Trung bình và Khó phải bằng số thẻ ghi nhớ.");
  return { easy, medium, hard };
}

function tiptapText(value: Prisma.JsonValue) {
  const visit = (node: unknown): string => {
    if (!node || typeof node !== "object" || Array.isArray(node)) return "";
    const record = node as Record<string, unknown>;
    const own = typeof record.text === "string" ? record.text : "";
    const children = Array.isArray(record.content) ? record.content.map(visit).join(" ") : "";
    return `${own} ${children}`.replace(/\s+/gu, " ").trim();
  };
  return visit(value);
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
  if (!candidate || [...required].some((metric) => !available.has(metric))) {
    return { input: null, output: null, total: null };
  }
  const inputUsage = {
    promptTokens: inputTokens,
    ...(useExplicitPromptCache ? { cacheWriteInputTokens: inputTokens } : {}),
  };
  return {
    input: calculateProviderCost(
      { ...inputUsage, completionTokens: 0, requestCount: 1 },
      candidate.rates,
      fxRate,
    ),
    output: calculateProviderCost(
      { promptTokens: 0, completionTokens: outputTokens, requestCount: 1 },
      candidate.rates,
      fxRate,
    ),
    total: calculateProviderCost(
      { ...inputUsage, completionTokens: outputTokens, requestCount: 1 },
      candidate.rates,
      fxRate,
    ),
  };
}

function unavailableCost(fxRateVndPerUsd = 25_000) {
  return {
    available: false,
    inputUpperBoundUsd: null,
    inputUpperBoundVnd: null,
    outputUpperBoundUsd: null,
    outputUpperBoundVnd: null,
    upperBoundUsd: null,
    upperBoundVnd: null,
    fxRateVndPerUsd,
  };
}

function readRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
function readRequiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value) throw badRequestException("AI_INPUT_SNAPSHOT_INVALID", `Snapshot thiếu ${field}.`);
  return value;
}
function readNullableString(value: unknown) { return typeof value === "string" && value ? value : null; }
function readNullableNumber(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function readStringArray(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function json(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue; }
