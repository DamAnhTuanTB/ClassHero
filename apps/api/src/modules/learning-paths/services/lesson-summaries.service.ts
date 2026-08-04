import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { AiGenerationType, Prisma, ProviderUsageMetric } from "@prisma/client";

import { throwBadRequest, throwNotFound } from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { AiGenerationJobService } from "#api/modules/ai/services/ai-generation-job.service";
import {
  LessonSummaryContextError,
  LessonSummaryContextService,
} from "#api/modules/ai/services/lesson-summary-context.service";
import {
  LESSON_SUMMARY_MAX_CONTEXT_TOKENS,
  LESSON_SUMMARY_MAX_OUTPUT_TOKENS,
  LESSON_SUMMARY_PROMPT_VERSION,
  LESSON_SUMMARY_SCHEMA_VERSION,
  lessonSummaryOutputSchema,
  type LessonSummaryJobInput,
} from "#api/modules/ai/types/lesson-summary.types";
import { buildAiUserPrompt } from "#api/modules/ai/utils/ai-prompt";
import { buildAiStructuredTextFormat } from "#api/modules/ai/utils/ai-structured-output-format";
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
      const contentJson = dto.contentJson as Prisma.InputJsonValue;
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
    const configuration = normalizeConfiguration(dto);
    const { route } = await this.resolveSummaryRoute(dto);

    const requestId = randomUUID();
    const inputMeta = {
      documentIds: sourceContext.documentIds,
      sourceHash: sourceContext.sourceHash,
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
          maxOutputTokens: route.maxOutputTokens,
        },
      },
      inputMeta,
      routeSnapshot: route,
      idempotencyKey: ["ai-summary", lessonId, sourceContext.sourceHash, requestId].join(
        ":",
      ),
      deduplicateActive: true,
      maxAttempts: 3,
    });

    return {
      mode: "QUEUED" as const,
      jobId: job.backgroundJobId,
      status: job.status,
    };
  }

  async previewPrompt(lessonId: string, dto: GenerateLessonSummaryDto) {
    const sourceContext = await this.loadSourceContext(lessonId, dto.documentIds);
    const configuration = normalizeConfiguration(dto);
    const { baseRoute, route } = await this.resolveSummaryRoute(dto);
    const request = buildLessonSummaryStructuredInput({
      lessonId,
      lessonTitle: sourceContext.lessonTitle,
      documentIds: sourceContext.documentIds,
      sourceHash: sourceContext.sourceHash,
      chunks: sourceContext.chunks,
      configuration,
      systemInstructions: configuration.systemInstructions,
      userPrompt: configuration.userPrompt,
    });
    const inputPrompt = buildAiUserPrompt(request);
    const estimatedInputTokens = Math.max(
      sourceContext.totalTokens,
      Math.ceil((request.systemPrompt.length + inputPrompt.length) / 4),
    );
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
              promptTokens: estimatedInputTokens,
              completionTokens: maxOutputTokens,
              requestCount: 1,
            },
            resolvedCandidate.rates,
            fxRate,
          )
        : null;

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
          format: buildAiStructuredTextFormat(
            lessonSummaryOutputSchema,
            request.outputName,
          ),
        },
        temperature: route.temperature ?? request.temperature ?? 0.2,
        max_output_tokens: maxOutputTokens,
      },
      context: {
        documentCount: sourceContext.documentIds.length,
        chunkCount: sourceContext.chunks.length,
        estimatedTokens: estimatedInputTokens,
        contextTokens: sourceContext.totalTokens,
        maxContextTokens: LESSON_SUMMARY_MAX_CONTEXT_TOKENS,
      },
      configuration: {
        selectedModel: dto.model ?? null,
        resolvedProvider: resolvedCandidate?.provider ?? null,
        resolvedModel: resolvedCandidate?.model ?? null,
        temperature: route.temperature ?? request.temperature ?? 0.2,
        maxOutputTokens,
        modelOptions: baseRoute.candidates.map((candidate) => ({
          provider: candidate.provider,
          model: candidate.model,
          available: candidate.available,
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
      const selectedCandidate = candidates.find(
        (candidate) => candidate.model === dto.model && candidate.available,
      );
      if (!selectedCandidate) {
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
      maxOutputTokens: dto.maxOutputTokens ?? baseRoute.maxOutputTokens,
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

  private rethrowContextError(error: unknown): never {
    if (!(error instanceof LessonSummaryContextError)) {
      throw error;
    }
    if (error.code === "LESSON_NOT_FOUND") {
      throwNotFound("NOT_FOUND", error.message, error.details);
    }
    throwBadRequest(error.code, error.message, error.details);
  }
}

function normalizeConfiguration(
  dto: GenerateLessonSummaryDto,
): Omit<LessonSummaryJobInput, "documentIds" | "sourceHash"> {
  return {
    style: dto.style,
    styleInstructions: dto.styleInstructions?.trim() ?? "",
    length: dto.length ?? "standard",
    targetWordCount: dto.targetWordCount ?? null,
    focus: dto.focus?.trim() ?? "",
    includeFormulas: dto.includeFormulas ?? true,
    includeExamples: dto.includeExamples ?? true,
    includeCommonMistakes: dto.includeCommonMistakes ?? true,
    contentSections: dto.contentSections ?? [],
    reviewQuestionCount: dto.reviewQuestionCount ?? 0,
    extraInstructions: dto.extraInstructions?.trim() ?? "",
    systemInstructions: dto.systemInstructions?.trim() ?? "",
    userPrompt: dto.userPrompt?.trim() ?? "",
  };
}
