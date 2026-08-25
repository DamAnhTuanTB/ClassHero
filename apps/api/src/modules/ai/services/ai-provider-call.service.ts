import { Inject, Injectable } from "@nestjs/common";
import {
  AI_REASONING_EFFORT_LEVELS,
  isAiReasoningEffort,
  type AiReasoningEffort,
} from "@learning-path/shared";
import {
  ProviderUsageMetric,
  type AiGenerationType,
  type AiProviderName,
} from "@prisma/client";
import { createHash } from "node:crypto";

import { PrismaService } from "#api/common/prisma/prisma.service";
import { AiService } from "#api/modules/ai/services/ai.service";
import type {
  AiOutputSchema,
  AiStructuredInput,
  AiStructuredOutput,
} from "#api/modules/ai/types/ai-text.types";
import { isAiProviderOutputError } from "#api/modules/ai/utils/ai-output-validation";
import { buildAiUserPrompt } from "#api/modules/ai/utils/ai-prompt";
import { AiModelRoutingService } from "#api/modules/provider-operations/services/ai-model-routing.service";
import { ProviderUsageService } from "#api/modules/provider-operations/services/provider-usage.service";
import type { AiFeatureRoute } from "#api/modules/provider-operations/types/provider-operations.types";
import {
  estimateAiStructuredInputTokens,
  resolveAiStructuredTextFormat,
} from "#api/modules/ai/utils/ai-structured-output-format";
import { calculateProviderCost } from "#api/modules/provider-operations/utils/provider-cost-calculator";

export type ResolvedAiStructuredRequestTrace = {
  provider: AiProviderName;
  model: string;
  catalogItemId: string | null;
  category: string;
  temperature: number | null;
  reasoningEffort: AiReasoningEffort | null;
  maxOutputTokens: number | null;
  outputName: string;
  promptVersion: string;
  schemaVersion: string;
  schemaReferenceStrategy: AiStructuredInput["schemaReferenceStrategy"];
  resolvedSchemaReferenceStrategy: "inline" | "ref" | "ref_v2";
  schemaBytes: number;
  systemPrompt: string;
  userPrompt: string;
  inputTextItems: AiStructuredInput["inputTextItems"];
  inputFiles: Array<{
    order: number;
    filename: string;
    mimeType: string;
    detail: string | null;
    fileId: string | null;
    fileUrl: string | null;
    fileDataSha256: string | null;
    fileDataCharacters: number | null;
  }>;
  inputImages: Array<{
    order: number;
    detail: string | null;
    mimeType: string | null;
    byteLength: number | null;
    sha256: string;
  }>;
  textFormat: Record<string, unknown>;
  promptCache: AiStructuredInput["promptCache"];
  inputTokenEstimate: {
    textInputTokens: number;
    imageInputTokens: number;
    estimatedTokens: number;
  };
};

export type ResolvedAiStructuredRequestPreview = ResolvedAiStructuredRequestTrace & {
  estimatedCost: {
    available: boolean;
    inputUpperBoundUsd: number | null;
    inputUpperBoundVnd: number | null;
    outputUpperBoundUsd: number | null;
    outputUpperBoundVnd: number | null;
    upperBoundUsd: number | null;
    upperBoundVnd: number | null;
    fxRateVndPerUsd: number;
  };
};

type RoutedAiCallContext = {
  feature: AiGenerationType;
  aiGenerationId?: string | null;
  backgroundJobId?: string | null;
  attempt?: number;
  callSequence?: number;
  routeSnapshot?: AiFeatureRoute;
  idempotencyKey?: string;
  /** Disable provider failover for flows whose retry contract permits compiler repair only. */
  allowProviderFallback?: boolean;
  onResolvedRequest?: (trace: ResolvedAiStructuredRequestTrace) => Promise<void>;
};

@Injectable()
export class AiProviderCallService {
  constructor(
    @Inject(AiService) private readonly aiService: AiService,
    @Inject(AiModelRoutingService)
    private readonly routing: AiModelRoutingService,
    @Inject(ProviderUsageService)
    private readonly usage: ProviderUsageService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async previewStructuredRequest<TOutput>(
    context: Pick<RoutedAiCallContext, "feature" | "routeSnapshot"> & {
      maxOutputTokensOverride?: number;
      reasoningEffortCap?: AiReasoningEffort;
    },
    input: AiStructuredInput,
    schema: AiOutputSchema<TOutput>,
  ): Promise<ResolvedAiStructuredRequestPreview> {
    const route = context.routeSnapshot ?? (await this.routing.resolve(context.feature));
    const candidate = route.candidates.find((item) => item.available);
    if (!candidate) {
      throw new Error(
        `No configured credential is available for AI feature ${context.feature}.`,
      );
    }
    const configuredReasoningEffort =
      toAiReasoningEffort(route.reasoningEffort) ?? input.reasoningEffort;
    const resolvedInput = {
      ...input,
      model: candidate.model,
      temperature: route.temperature ?? input.temperature,
      reasoningEffort: capReasoningEffort(
        configuredReasoningEffort,
        context.reasoningEffortCap,
      ),
      maxTokens:
        context.maxOutputTokensOverride ?? route.maxOutputTokens ?? input.maxTokens,
    } satisfies AiStructuredInput;
    const trace = buildResolvedRequestTrace({ candidate, input: resolvedInput, schema });
    const inputTokenEstimate = trace.inputTokenEstimate;
    const fxRateVndPerUsd = await this.getFxRateVndPerUsd();
    const requiredMetrics = new Set([
      ProviderUsageMetric.INPUT_TOKEN,
      ProviderUsageMetric.OUTPUT_TOKEN,
    ]);
    const pricedMetrics = new Set(candidate.rates.map((rate) => rate.metric));
    const canEstimateCost = [...requiredMetrics].every((metric) =>
      pricedMetrics.has(metric),
    );
    const maxOutputTokens = trace.maxOutputTokens ?? 0;
    const inputCost = canEstimateCost
      ? calculateProviderCost(
          {
            promptTokens: inputTokenEstimate.estimatedTokens,
            completionTokens: 0,
            requestCount: 1,
          },
          candidate.rates,
          fxRateVndPerUsd,
        )
      : null;
    const outputCost = canEstimateCost
      ? calculateProviderCost(
          { promptTokens: 0, completionTokens: maxOutputTokens, requestCount: 0 },
          candidate.rates,
          fxRateVndPerUsd,
        )
      : null;
    const totalCost = canEstimateCost
      ? calculateProviderCost(
          {
            promptTokens: inputTokenEstimate.estimatedTokens,
            completionTokens: maxOutputTokens,
            requestCount: 1,
          },
          candidate.rates,
          fxRateVndPerUsd,
        )
      : null;
    return {
      ...trace,
      estimatedCost: totalCost
        ? {
            available: true,
            inputUpperBoundUsd: inputCost?.costUsd ?? null,
            inputUpperBoundVnd: inputCost?.costVnd ?? null,
            outputUpperBoundUsd: outputCost?.costUsd ?? null,
            outputUpperBoundVnd: outputCost?.costVnd ?? null,
            upperBoundUsd: totalCost.costUsd,
            upperBoundVnd: totalCost.costVnd,
            fxRateVndPerUsd,
          }
        : {
            available: false,
            inputUpperBoundUsd: null,
            inputUpperBoundVnd: null,
            outputUpperBoundUsd: null,
            outputUpperBoundVnd: null,
            upperBoundUsd: null,
            upperBoundVnd: null,
            fxRateVndPerUsd,
          },
    };
  }

  async generateStructured<TOutput>(
    context: RoutedAiCallContext,
    input: AiStructuredInput,
    schema: AiOutputSchema<TOutput>,
  ): Promise<AiStructuredOutput<TOutput>> {
    const route = context.routeSnapshot ?? (await this.routing.resolve(context.feature));
    const availableCandidates = route.candidates.filter(
      (candidate) => candidate.available,
    );
    const candidates =
      context.allowProviderFallback === false
        ? availableCandidates.slice(0, 1)
        : availableCandidates;
    if (candidates.length === 0) {
      throw new Error(
        `No configured credential is available for AI feature ${context.feature}.`,
      );
    }

    let lastError: unknown;
    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index]!;
      const maxInputTokens = route.maxInputTokens ?? candidate.maxInputTokens;
      const maxOutputTokens = route.maxOutputTokens ?? input.maxTokens;
      const reasoningEffort = toAiReasoningEffort(route.reasoningEffort);
      const requestFingerprint = fingerprintRequest(input);
      const resolvedInput = {
        ...input,
        model: candidate.model,
        temperature: route.temperature ?? input.temperature,
        reasoningEffort: reasoningEffort ?? input.reasoningEffort,
        maxTokens: maxOutputTokens,
      } satisfies AiStructuredInput;
      await context.onResolvedRequest?.(
        buildResolvedRequestTrace({
          candidate,
          input: resolvedInput,
          schema,
        }),
      );
      const usageEvent = await this.usage.reserveAndStart(
        {
          category: candidate.category,
          provider: candidate.provider,
          catalogItemId: candidate.catalogItemId,
          priceVersionId: candidate.priceVersionId,
          aiGenerationId: context.aiGenerationId,
          backgroundJobId: context.backgroundJobId,
          feature: context.feature,
          purpose: route.purpose ?? null,
          attempt: context.attempt,
        },
        {
          idempotencyKey: [
            context.idempotencyKey ??
              [
                "ai",
                context.backgroundJobId ?? context.aiGenerationId ?? requestFingerprint,
                context.attempt ?? 1,
                context.callSequence ?? 1,
              ].join(":"),
            index,
            candidate.catalogItemId ?? candidate.model,
          ].join(":"),
          usageUpperBound: {
            promptTokens: maxInputTokens ?? 0,
            completionTokens: maxOutputTokens ?? 0,
          },
          rates: candidate.rates,
          requiredMetrics: [
            ProviderUsageMetric.INPUT_TOKEN,
            ProviderUsageMetric.OUTPUT_TOKEN,
          ],
          estimateUnavailableReason:
            maxInputTokens == null || maxInputTokens <= 0
              ? "Chưa có giới hạn token đầu vào trong Thiết lập mặc định nên yêu cầu AI đã được dừng để bảo vệ ngân sách."
              : maxOutputTokens == null || maxOutputTokens <= 0
                ? "Chưa có giới hạn token đầu ra trong Thiết lập mặc định nên yêu cầu AI đã được dừng để bảo vệ ngân sách."
                : undefined,
        },
      );
      try {
        const output = await this.aiService.generateStructured(
          resolvedInput,
          schema,
          candidate.provider,
        );
        const usage = output.usage;
        const recorded = await this.usage.succeed(usageEvent.id, {
          promptTokens: usage?.promptTokens,
          cachedInputTokens: usage?.cachedInputTokens,
          completionTokens: usage?.completionTokens,
          totalTokens: usage?.totalTokens,
          providerRequestId: output.providerRequestId,
          latencyMs: output.latencyMs,
          rawUsage: {
            providerUsage: output.providerUsageRaw ?? null,
            fileOperations: output.inputFileOperations ?? [],
          },
          rates: candidate.rates,
        });
        if (context.aiGenerationId) {
          await this.updateAiGenerationCost(context.aiGenerationId, recorded.costVnd);
        }
        return output;
      } catch (error) {
        const recorded = await this.usage.fail(usageEvent.id, error, {
          rates: candidate.rates,
        });
        if (
          context.aiGenerationId &&
          isAiProviderOutputError(error) &&
          recorded.costMeasured
        ) {
          await this.updateAiGenerationCost(context.aiGenerationId, recorded.costVnd);
        }
        lastError = error;
        const hasFallback = index < candidates.length - 1;
        if (!hasFallback || !isTransientProviderError(error)) {
          throw error;
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error("AI provider call failed.");
  }

  private async updateAiGenerationCost(aiGenerationId: string, fallbackCostVnd: number) {
    const aggregate = this.prisma.providerUsageEvent?.aggregate
      ? await this.prisma.providerUsageEvent.aggregate({
          where: { aiGenerationId },
          _sum: { costVnd: true },
        })
      : null;
    await this.prisma.aiGeneration.update({
      where: { id: aiGenerationId },
      data: {
        estimatedCostVnd: aggregate?._sum.costVnd ?? fallbackCostVnd,
      },
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

function estimateImageInputTokens(detail: string | null) {
  return detail === "low" ? 250 : 1_000;
}

function buildResolvedRequestTrace<TOutput>(input: {
  candidate: AiFeatureRoute["candidates"][number];
  input: AiStructuredInput;
  schema: AiOutputSchema<TOutput>;
}): ResolvedAiStructuredRequestTrace {
  const textFormatResolution = resolveAiStructuredTextFormat(
    input.schema,
    input.input.outputName,
    input.input.schemaReferenceStrategy,
  );
  const textFormat = textFormatResolution.format;
  const inputImages = (input.input.inputImages ?? []).map((image, order) => {
    const decoded = readDataUrl(image.imageUrl);
    return {
      order,
      detail: image.detail ?? null,
      mimeType: decoded.mimeType,
      byteLength: decoded.byteLength,
      sha256: hashValue(image.imageUrl),
    };
  });
  const imageInputTokens = inputImages.reduce(
    (total, image) => total + estimateImageInputTokens(image.detail),
    0,
  );
  const inputTokenEstimate = estimateAiStructuredInputTokens({
    systemPrompt: input.input.systemPrompt,
    inputPrompt: buildAiUserPrompt(input.input),
    structuredTextFormat: textFormat,
    additionalInputTokens: imageInputTokens,
  });
  return {
    provider: input.candidate.provider,
    model: input.candidate.model,
    catalogItemId: input.candidate.catalogItemId ?? null,
    category: input.candidate.category,
    temperature: input.input.temperature ?? null,
    reasoningEffort: input.input.reasoningEffort ?? null,
    maxOutputTokens: input.input.maxTokens ?? null,
    outputName: input.input.outputName,
    promptVersion: input.input.promptVersion,
    schemaVersion: input.input.schemaVersion,
    schemaReferenceStrategy: input.input.schemaReferenceStrategy,
    resolvedSchemaReferenceStrategy: textFormatResolution.resolvedReferenceStrategy,
    schemaBytes: textFormatResolution.schemaBytes,
    systemPrompt: input.input.systemPrompt,
    userPrompt: input.input.userPrompt,
    inputTextItems: input.input.inputTextItems,
    inputFiles: (input.input.inputFiles ?? []).map((file, order) => ({
      order,
      filename: file.filename,
      mimeType: file.mimeType,
      detail: file.detail ?? null,
      fileId: file.fileId ?? null,
      fileUrl: file.fileUrl ?? null,
      fileDataSha256: file.fileData ? hashValue(file.fileData) : null,
      fileDataCharacters: file.fileData?.length ?? null,
    })),
    inputImages,
    textFormat: JSON.parse(JSON.stringify(textFormat)) as Record<string, unknown>,
    promptCache: input.input.promptCache,
    inputTokenEstimate: {
      textInputTokens: inputTokenEstimate.textInputTokens,
      imageInputTokens,
      estimatedTokens: inputTokenEstimate.estimatedTokens,
    },
  };
}

function readDataUrl(value: string) {
  const match = value.match(/^data:([^;,]+);base64,(.+)$/su);
  if (!match) return { mimeType: null, byteLength: null };
  return {
    mimeType: match[1] ?? null,
    byteLength: Buffer.byteLength(match[2] ?? "", "base64"),
  };
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function fingerprintRequest(input: AiStructuredInput) {
  const digestValue = (value: string | undefined) =>
    value ? createHash("sha256").update(value).digest("hex") : null;
  return createHash("sha256")
    .update(
      JSON.stringify({
        systemPrompt: input.systemPrompt,
        userPrompt: input.userPrompt,
        inputTextItems: input.inputTextItems,
        inputFiles: input.inputFiles?.map((file) => ({
          filename: file.filename,
          mimeType: file.mimeType,
          detail: file.detail,
          fileId: file.fileId,
          fileUrl: file.fileUrl,
          fileDataHash: digestValue(file.fileData),
        })),
        inputImages: input.inputImages?.map((image) => ({
          detail: image.detail,
          imageHash: digestValue(image.imageUrl),
        })),
      }),
    )
    .digest("hex")
    .slice(0, 20);
}

function toAiReasoningEffort(value: string | null): AiReasoningEffort | undefined {
  return isAiReasoningEffort(value) ? value : undefined;
}

function capReasoningEffort(
  value: AiReasoningEffort | undefined,
  cap: AiReasoningEffort | undefined,
) {
  if (!value || !cap) return value;
  const valueIndex = AI_REASONING_EFFORT_LEVELS.indexOf(value);
  const capIndex = AI_REASONING_EFFORT_LEVELS.indexOf(cap);
  return valueIndex <= capIndex ? value : cap;
}

export function isTransientProviderError(error: unknown) {
  const status = readStatus(error);
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    status === 408 ||
    status === 409 ||
    status === 429 ||
    (status !== null && status >= 500) ||
    error instanceof DOMException ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("connection reset")
  );
}

function readStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const value = (error as { status?: unknown }).status;
  return typeof value === "number" ? value : null;
}
