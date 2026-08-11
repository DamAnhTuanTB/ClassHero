import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AiGenerationType, Prisma, ProviderUsageMetric } from "@prisma/client";
import type { ProviderRouteCandidate } from "#api/modules/provider-operations/types/provider-operations.types";

import { throwBadRequest, throwNotFound } from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import type { EnvConfig } from "#api/config/env.validation";
import { AiGenerationJobService } from "#api/modules/ai/services/ai-generation-job.service";
import {
  LessonSummaryContextError,
  LessonSummaryContextService,
} from "#api/modules/ai/services/lesson-summary-context.service";
import {
  LESSON_SUMMARY_MAX_CONTEXT_TOKENS,
  LESSON_SUMMARY_MAX_OUTPUT_TOKENS,
  LESSON_SUMMARY_MIN_OUTPUT_TOKENS,
  LESSON_SUMMARY_PROMPT_VERSION,
  LESSON_SUMMARY_SCHEMA_VERSION,
  lessonSummaryProviderTransportOutputSchema,
  type LessonSummaryJobInput,
} from "#api/modules/ai/types/lesson-summary.types";
import { buildAiUserPrompt } from "#api/modules/ai/utils/ai-prompt";
import {
  buildAiStructuredTextFormat,
  estimateAiStructuredInputTokens,
} from "#api/modules/ai/utils/ai-structured-output-format";
import { buildLessonSummaryStructuredInput } from "#api/modules/ai/utils/lesson-summary-prompt";
import { GenerateLessonSummaryDto } from "#api/modules/learning-paths/dto/generate-lesson-summary.dto";
import { UpsertLessonSummaryDto } from "#api/modules/learning-paths/dto/upsert-lesson-summary.dto";
import { lessonSummarySelect } from "#api/modules/learning-paths/selectors/lesson-summary.selects";
import { serializeLessonSummary } from "#api/modules/learning-paths/serializers/lesson-summary.serializers";
import type { RequestContext } from "#api/modules/learning-paths/types/lesson.types";
import {
  throwLessonNotFound,
  toInputJson,
} from "#api/modules/learning-paths/utils/lesson.helpers";
import {
  listUnresolvedLessonSummaryReviewIssues,
  reconcileLessonSummaryReviewIssues,
} from "#api/modules/learning-paths/utils/lesson-summary-review";
import { AiModelRoutingService } from "#api/modules/provider-operations/services/ai-model-routing.service";
import type { AiFeatureRoute } from "#api/modules/provider-operations/types/provider-operations.types";
import { calculateProviderCost } from "#api/modules/provider-operations/utils/provider-cost-calculator";

@Injectable()
export class LessonSummariesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AiGenerationJobService)
    private readonly aiGenerationJobs: AiGenerationJobService,
    @Inject(LessonSummaryContextService)
    private readonly summaryContext: LessonSummaryContextService,
    @Inject(AiModelRoutingService)
    private readonly modelRouting: AiModelRoutingService,
    @Inject(ConfigService)
    private readonly configService: ConfigService<EnvConfig, true>,
  ) {}

  async getForAdmin(lessonId: string) {
    await this.assertLessonExists(lessonId);
    const summary = await this.prisma.lessonSummary.findUnique({
      where: { lessonId },
      select: lessonSummarySelect,
    });

    return summary && !summary.deletedAt ? serializeLessonSummary(summary) : null;
  }

  async upsertForAdmin(
    lessonId: string,
    actorUserId: string,
    dto: UpsertLessonSummaryDto,
    context: RequestContext = {},
  ) {
    const summary = await this.prisma.$transaction(async (transaction) => {
      const lesson = await transaction.lesson.findFirst({
        where: {
          id: lessonId,
          deletedAt: null,
          learningPath: { deletedAt: null },
        },
        select: { id: true },
      });
      if (!lesson) {
        throwLessonNotFound();
      }

      const before = await transaction.lessonSummary.findUnique({
        where: { lessonId },
        select: lessonSummarySelect,
      });
      const reconciledContent = reconcileLessonSummaryReviewIssues(dto.contentJson);
      const unresolvedIssues = listUnresolvedLessonSummaryReviewIssues(reconciledContent);
      if (dto.reviewStatus === "APPROVED" && unresolvedIssues.length > 0) {
        throwBadRequest(
          "LESSON_SUMMARY_REVIEW_REQUIRED",
          `Còn ${unresolvedIssues.length} vấn đề cần sửa hoặc chấp nhận trước khi phát hành.`,
          {
            issues: unresolvedIssues.slice(0, 20).map((issue) => ({
              code: issue.code,
              path: issue.path,
              message: issue.message,
              suggestion: issue.suggestion,
            })),
          },
        );
      }
      const contentJson = reconciledContent as Prisma.InputJsonValue;
      const updated = await transaction.lessonSummary.upsert({
        where: { lessonId },
        create: {
          lessonId,
          contentJson,
          source: dto.source,
          reviewStatus: dto.reviewStatus,
          createdById: actorUserId,
          updatedById: actorUserId,
        },
        update: {
          contentJson,
          source: dto.source,
          reviewStatus: dto.reviewStatus,
          updatedById: actorUserId,
          deletedAt: null,
        },
        select: lessonSummarySelect,
      });

      await transaction.auditLog.create({
        data: {
          actorUserId,
          action: "LESSON_SUMMARY_UPSERTED",
          entityType: "LessonSummary",
          entityId: updated.id,
          before: before ? toInputJson(serializeLessonSummary(before)) : undefined,
          after: toInputJson(serializeLessonSummary(updated)),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });

      return updated;
    });

    return serializeLessonSummary(summary);
  }

  async generate(lessonId: string, actorUserId: string, dto: GenerateLessonSummaryDto) {
    const sourceContext = await this.loadSourceContext(lessonId, dto.documentIds);
    const configuration = normalizeConfiguration(
      dto,
      this.resolveSchemaReferenceStrategy(),
    );
    const { route } = await this.resolveSummaryRoute(dto);

    const requestId = randomUUID();
    const inputMeta = {
      documentIds: sourceContext.documentIds,
      sourceHash: sourceContext.sourceHash,
      targetGrade: sourceContext.targetGrade,
      ...configuration,
    } as const;
    const job = await this.aiGenerationJobs.createAndEnqueue({
      type: AiGenerationType.SUMMARY,
      createdByUserId: actorUserId,
      lessonId,
      targetType: "LESSON",
      targetId: lessonId,
      promptVersion: LESSON_SUMMARY_PROMPT_VERSION,
      schemaVersion: LESSON_SUMMARY_SCHEMA_VERSION,
      inputFingerprint: {
        lessonId,
        ...inputMeta,
        route: {
          candidates: route.candidates.map((candidate) => ({
            provider: candidate.provider,
            model: candidate.model,
          })),
          temperature: route.temperature,
          reasoningEffort: route.reasoningEffort,
          maxOutputTokens: route.maxOutputTokens,
        },
      },
      inputMeta,
      routeSnapshot: route,
      idempotencyKey: ["ai-summary", lessonId, sourceContext.sourceHash, requestId].join(
        ":",
      ),
      deduplicateActive: true,
      // An admin click authorizes exactly one provider request. Local recovery
      // handles block defects; the worker must not silently spend another call.
      maxAttempts: 1,
    });

    return {
      mode: "QUEUED" as const,
      jobId: job.backgroundJobId,
      status: job.status,
    };
  }

  async previewPrompt(lessonId: string, dto: GenerateLessonSummaryDto) {
    const sourceContext = await this.loadSourceContext(lessonId, dto.documentIds);
    const configuration = normalizeConfiguration(
      dto,
      this.resolveSchemaReferenceStrategy(),
    );
    const { baseRoute, route } = await this.resolveSummaryRoute(dto);
    const request = buildLessonSummaryStructuredInput({
      lessonId,
      lessonTitle: sourceContext.lessonTitle,
      targetGrade: sourceContext.targetGrade,
      documentIds: sourceContext.documentIds,
      sourceHash: sourceContext.sourceHash,
      chunks: sourceContext.chunks,
      configuration,
      systemInstructions: configuration.systemInstructions,
      userPrompt: configuration.userPrompt,
    });
    const inputPrompt = buildAiUserPrompt(request);
    const structuredTextFormat = buildAiStructuredTextFormat(
      lessonSummaryProviderTransportOutputSchema,
      request.outputName,
      request.schemaReferenceStrategy,
    );
    const inputTokenEstimate = estimateAiStructuredInputTokens({
      systemPrompt: request.systemPrompt,
      inputPrompt,
      structuredTextFormat,
      minimumPromptTokens: sourceContext.totalTokens,
    });
    const maxOutputTokens = route.maxOutputTokens ?? LESSON_SUMMARY_MAX_OUTPUT_TOKENS;
    const resolvedCandidate =
      route.candidates.find((candidate) => candidate.available) ??
      route.candidates[0] ??
      null;
    const fxRate = await this.getFxRateVndPerUsd();
    const requiredCostMetrics = new Set([
      ProviderUsageMetric.INPUT_TOKEN,
      ProviderUsageMetric.OUTPUT_TOKEN,
    ]);
    const pricedMetrics = new Set(
      resolvedCandidate?.rates.map((rate) => rate.metric) ?? [],
    );
    const canEstimateCost = [...requiredCostMetrics].every((metric) =>
      pricedMetrics.has(metric),
    );
    const estimatedCost =
      resolvedCandidate && canEstimateCost
        ? calculateProviderCost(
            {
              promptTokens: inputTokenEstimate.estimatedTokens,
              completionTokens: maxOutputTokens,
              requestCount: 1,
            },
            resolvedCandidate.rates,
            fxRate,
          )
        : null;

    const allActiveModels = await this.modelRouting.getAllActiveModels();

    return {
      promptVersion: LESSON_SUMMARY_PROMPT_VERSION,
      schemaVersion: LESSON_SUMMARY_SCHEMA_VERSION,
      systemPrompt: request.systemPrompt,
      userPrompt: request.userPrompt,
      inputPrompt,
      openAiRequest: {
        model: resolvedCandidate?.model ?? null,
        instructions: request.systemPrompt,
        input: inputPrompt,
        text: {
          format: structuredTextFormat,
        },
        temperature: route.temperature ?? request.temperature ?? 0.2,
        ...(route.reasoningEffort ? { reasoning_effort: route.reasoningEffort } : {}),
        max_output_tokens: maxOutputTokens,
      },
      context: {
        documentCount: sourceContext.documentIds.length,
        chunkCount: sourceContext.chunks.length,
        estimatedTokens: inputTokenEstimate.estimatedTokens,
        promptTokens: inputTokenEstimate.promptTokens,
        schemaTokens: inputTokenEstimate.schemaTokens,
        contextTokens: sourceContext.totalTokens,
        maxContextTokens: LESSON_SUMMARY_MAX_CONTEXT_TOKENS,
      },
      configuration: {
        selectedModel: dto.model ?? null,
        isDefaultConfigured: baseRoute.hasConfiguration,
        resolvedProvider: resolvedCandidate?.provider ?? null,
        resolvedModel: resolvedCandidate?.model ?? null,
        temperature: route.temperature ?? request.temperature ?? 0.2,
        reasoningEffort: route.reasoningEffort ?? null,
        maxOutputTokens,
        modelOptions: allActiveModels.map((candidate) => ({
          provider: candidate.provider,
          model: candidate.model,
          available: candidate.available,
          capabilities: candidate.capabilitiesJson,
        })),
      },
      estimatedCost: estimatedCost
        ? {
            available: true,
            upperBoundUsd: estimatedCost.costUsd,
            upperBoundVnd: estimatedCost.costVnd,
            fxRateVndPerUsd: fxRate,
          }
        : {
            available: false,
            upperBoundUsd: null,
            upperBoundVnd: null,
            fxRateVndPerUsd: fxRate,
          },
    };
  }

  private async assertLessonExists(lessonId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        id: lessonId,
        deletedAt: null,
        learningPath: { deletedAt: null },
      },
      select: { id: true },
    });
    if (!lesson) {
      throwLessonNotFound();
    }
  }

  private async loadSourceContext(lessonId: string, documentIds: string[]) {
    try {
      return await this.summaryContext.load(lessonId, documentIds);
    } catch (error) {
      this.rethrowContextError(error);
    }
  }

  private async resolveSummaryRoute(dto: GenerateLessonSummaryDto) {
    const baseRoute = await this.modelRouting.resolve(AiGenerationType.SUMMARY);
    let candidates = baseRoute.candidates;
    if (dto.model) {
      let selectedCandidate: ProviderRouteCandidate | null | undefined = candidates.find(
        (candidate) => candidate.model === dto.model && candidate.available,
      );
      if (!selectedCandidate) {
        selectedCandidate = await this.modelRouting.resolveCandidateByModel(dto.model);
      }
      if (!selectedCandidate || !selectedCandidate.available) {
        throwBadRequest(
          "AI_MODEL_NOT_AVAILABLE",
          "Model đã chọn không còn khả dụng cho chức năng tóm tắt.",
          { model: dto.model },
        );
      }
      candidates = [selectedCandidate];
    }

    const route: AiFeatureRoute = {
      ...baseRoute,
      candidates,
      temperature: dto.temperature ?? baseRoute.temperature,
      reasoningEffort: dto.reasoningEffort ?? baseRoute.reasoningEffort,
      maxOutputTokens: Math.max(
        dto.maxOutputTokens ?? baseRoute.maxOutputTokens ?? 0,
        LESSON_SUMMARY_MIN_OUTPUT_TOKENS,
      ),
    };
    if (dto.model && dto.reasoningEffort) {
      const allowedReasoningEffortLevels = readReasoningEffortLevels(
        candidates[0]?.capabilitiesJson,
      );
      if (!allowedReasoningEffortLevels.includes(dto.reasoningEffort)) {
        throwBadRequest(
          "AI_REASONING_EFFORT_NOT_SUPPORTED",
          "Mức Reasoning Effort đã chọn không được cấu hình cho model này.",
          {
            model: dto.model,
            reasoningEffort: dto.reasoningEffort,
            allowedReasoningEffortLevels,
          },
        );
      }
    }
    return { baseRoute, route };
  }

  private async getFxRateVndPerUsd() {
    const setting = await this.prisma.providerAccountingSetting.findUnique({
      where: { singletonKey: "default" },
      select: { fxRateVndPerUsd: true },
    });
    return setting?.fxRateVndPerUsd.toNumber() ?? 25_000;
  }

  private rethrowContextError(error: unknown): never {
    if (!(error instanceof LessonSummaryContextError)) {
      throw error;
    }
    if (error.code === "LESSON_NOT_FOUND") {
      throwNotFound("NOT_FOUND", error.message, error.details);
    }
    throwBadRequest(error.code, error.message, error.details);
  }

  private resolveSchemaReferenceStrategy(): LessonSummaryJobInput["schemaReferenceStrategy"] {
    return this.configService.get("AI_SUMMARY_SCHEMA_REFS_ENABLED", {
      infer: true,
    })
      ? "ref"
      : "inline";
  }
}

function readReasoningEffortLevels(capabilities: unknown): string[] {
  if (!capabilities || typeof capabilities !== "object" || Array.isArray(capabilities)) {
    return [];
  }
  const value = (capabilities as Record<string, unknown>).reasoningEffortLevels;
  return Array.isArray(value)
    ? value.filter((level): level is string => typeof level === "string")
    : [];
}

function normalizeConfiguration(
  dto: GenerateLessonSummaryDto,
  schemaReferenceStrategy: LessonSummaryJobInput["schemaReferenceStrategy"],
): Omit<LessonSummaryJobInput, "documentIds" | "sourceHash" | "targetGrade"> {
  return {
    style: dto.style,
    styleInstructions: dto.styleInstructions?.trim() ?? "",
    length: dto.length ?? "standard",
    targetWordCount: dto.targetWordCount ?? null,

    extraInstructions: dto.extraInstructions?.trim() ?? "",
    systemInstructions: dto.systemInstructions?.trim() ?? "",
    userPrompt: dto.userPrompt?.trim() ?? "",

    ...(dto.model ? { model: dto.model } : {}),
    ...(dto.temperature !== undefined ? { temperature: dto.temperature } : {}),
    ...(dto.reasoningEffort ? { reasoningEffort: dto.reasoningEffort } : {}),
    schemaReferenceStrategy,
    ...(dto.maxOutputTokens !== undefined
      ? { maxOutputTokens: dto.maxOutputTokens }
      : {}),
  };
}
