import { Inject, Injectable } from "@nestjs/common";
import {
  AI_REASONING_EFFORT_LEVELS,
  isAiReasoningEffort,
  type AiReasoningEffort,
  type ProviderUsageTargetContext,
} from "@learning-path/shared";
import {
  AiProviderName,
  ProviderUsageMetric,
  type AiGenerationType,
} from "@prisma/client";
import { createHash } from "node:crypto";

import { PrismaService } from "#api/common/prisma/prisma.service";
import { AiService } from "#api/modules/ai/services/ai.service";
import type {
  AiEmbeddingInput,
  AiEmbeddingOutput,
} from "#api/modules/ai/types/ai-embedding.types";
import type {
  AiOutputSchema,
  AiStructuredInput,
  AiStructuredOutput,
  AiTextInput,
  AiTextStreamEvent,
} from "#api/modules/ai/types/ai-text.types";
import { isAiProviderOutputError } from "#api/modules/ai/utils/ai-output-validation";
import { buildAiUserPrompt } from "#api/modules/ai/utils/ai-prompt";
import { AiModelRoutingService } from "#api/modules/provider-operations/services/ai-model-routing.service";
import { ProviderUsageService } from "#api/modules/provider-operations/services/provider-usage.service";
import type {
  AiFeatureRoute,
  ProviderUsageOperation,
} from "#api/modules/provider-operations/types/provider-operations.types";
import {
  estimateAiStructuredInputTokens,
  resolveAiStructuredTextFormat,
} from "#api/modules/ai/utils/ai-structured-output-format";
import { calculateProviderCost } from "#api/modules/provider-operations/utils/provider-cost-calculator";
import { supportsOpenAiExplicitPromptCaching } from "#api/modules/ai/utils/ai-prompt-cache";

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
    tokenBreakdown?: {
      systemInstructionsTokens: number;
      userPromptTokens: number;
      contextTokens: number;
      schemaTokens: number;
      textInputTokens: number;
      pdfInputTokens: number;
      estimatedTokens: number;
    };
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

export type RoutedAiCallContext = {
  feature: AiGenerationType;
  aiGenerationId?: string | null;
  backgroundJobId?: string | null;
  attempt?: number;
  callSequence?: number;
  operation?: ProviderUsageOperation;
  targetContext: ProviderUsageTargetContext;
  routeSnapshot?: AiFeatureRoute;
  idempotencyKey?: string;
  /** Disable provider failover for flows whose retry contract permits compiler repair only. */
  allowProviderFallback?: boolean;
  /** Per-call output cap for an auxiliary call whose output limit differs from its route. */
  maxOutputTokensOverride?: number;
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

  getEmbeddingConfig() {
    return this.aiService.getEmbeddingConfig();
  }

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
    const inputUsageUpperBound = buildInputUsageUpperBound({
      candidate,
      input: resolvedInput,
      promptTokens: inputTokenEstimate.estimatedTokens,
    });
    const inputCost = canEstimateCost
      ? calculateProviderCost(
          {
            ...inputUsageUpperBound,
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
            ...inputUsageUpperBound,
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
    validationSchema: AiOutputSchema<TOutput> = schema,
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
      const isFallback = route.candidates.indexOf(candidate) > 0;
      const maxInputTokens = resolveCandidateMaxInputTokens(
        route,
        candidate,
        isFallback,
      );
      const controls = resolveCandidateControls(route, candidate, isFallback, input);
      const requestFingerprint = fingerprintRequest(input);
      const resolvedInput = {
        ...input,
        model: candidate.model,
        temperature: controls.temperature,
        reasoningEffort: controls.reasoningEffort,
        maxTokens: controls.maxOutputTokens,
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
          operation:
            context.operation ??
            (route.purpose === "IMAGE"
              ? "DIAGRAM_GENERATION"
              : defaultContentOperation(context.feature)),
          targetContext: context.targetContext,
          reasoningEffort: resolvedInput.reasoningEffort ?? null,
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
            ...buildInputUsageUpperBound({
              candidate,
              input: resolvedInput,
              promptTokens: maxInputTokens ?? 0,
            }),
            completionTokens: controls.maxOutputTokens ?? 0,
          },
          rates: candidate.rates,
          requiredMetrics: [
            ProviderUsageMetric.INPUT_TOKEN,
            ProviderUsageMetric.OUTPUT_TOKEN,
          ],
          estimateUnavailableReason:
            maxInputTokens == null || maxInputTokens <= 0
              ? "Chưa có giới hạn token đầu vào trong Thiết lập mặc định nên yêu cầu AI đã được dừng để bảo vệ ngân sách."
              : controls.maxOutputTokens == null || controls.maxOutputTokens <= 0
                ? "Chưa có giới hạn token đầu ra trong Thiết lập mặc định nên yêu cầu AI đã được dừng để bảo vệ ngân sách."
                : undefined,
        },
      );
      try {
        const output =
          validationSchema === schema
            ? await this.aiService.generateStructured(
                resolvedInput,
                schema,
                candidate.provider,
              )
            : await this.aiService.generateStructured(
                resolvedInput,
                schema,
                candidate.provider,
                validationSchema,
              );
        const usage = output.usage;
        const recorded = await this.usage.succeed(usageEvent.id, {
          promptTokens: usage?.promptTokens,
          cachedInputTokens: usage?.cachedInputTokens,
          cacheWriteInputTokens: usage?.cacheWriteInputTokens,
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

  async *streamText(
    context: RoutedAiCallContext,
    input: AiTextInput,
  ): AsyncGenerator<AiTextStreamEvent> {
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
      const isFallback = route.candidates.indexOf(candidate) > 0;
      const maxInputTokens = resolveCandidateMaxInputTokens(
        route,
        candidate,
        isFallback,
      );
      const controls = resolveCandidateControls(
        route,
        candidate,
        isFallback,
        input,
        context.maxOutputTokensOverride,
      );
      const resolvedInput = {
        ...input,
        model: candidate.model,
        temperature: controls.temperature,
        reasoningEffort: controls.reasoningEffort,
        maxTokens: controls.maxOutputTokens,
      } satisfies AiTextInput;
      const estimatedPromptTokens = estimateTextInputTokens(resolvedInput);
      if (maxInputTokens && estimatedPromptTokens > maxInputTokens) {
        throw new Error(
          `AI text input estimate ${estimatedPromptTokens} exceeds route limit ${maxInputTokens}.`,
        );
      }

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
          operation: context.operation ?? defaultContentOperation(context.feature),
          targetContext: context.targetContext,
          reasoningEffort: resolvedInput.reasoningEffort ?? null,
          attempt: context.attempt,
        },
        {
          idempotencyKey: [
            context.idempotencyKey ??
              [
                "ai-stream",
                context.backgroundJobId ??
                  context.aiGenerationId ??
                  fingerprintRequest(input),
                context.attempt ?? 1,
                context.callSequence ?? 1,
              ].join(":"),
            index,
            candidate.catalogItemId ?? candidate.model,
          ].join(":"),
          usageUpperBound: {
            promptTokens: maxInputTokens ?? estimatedPromptTokens,
            completionTokens: controls.maxOutputTokens ?? 0,
          },
          rates: candidate.rates,
          requiredMetrics: [
            ProviderUsageMetric.INPUT_TOKEN,
            ProviderUsageMetric.OUTPUT_TOKEN,
          ],
          estimateUnavailableReason:
            !maxInputTokens || maxInputTokens <= 0
              ? "Chưa có giới hạn token đầu vào cho Chat AI."
              : !controls.maxOutputTokens || controls.maxOutputTokens <= 0
                ? "Chưa có giới hạn token đầu ra cho Chat AI."
                : undefined,
        },
      );
      let usageSettled = false;
      let emittedDelta = false;

      try {
        for await (const event of this.aiService.streamText(
          resolvedInput,
          candidate.provider,
        )) {
          if (event.type === "delta") emittedDelta = true;
          if (event.type === "completed") {
            const usage = event.output.usage;
            const recorded = await this.usage.succeed(usageEvent.id, {
              promptTokens: usage?.promptTokens,
              cachedInputTokens: usage?.cachedInputTokens,
              cacheWriteInputTokens: usage?.cacheWriteInputTokens,
              completionTokens: usage?.completionTokens,
              totalTokens: usage?.totalTokens,
              providerRequestId: event.output.providerRequestId,
              latencyMs: event.output.latencyMs,
              rawUsage: {
                providerUsage: event.output.providerUsageRaw ?? null,
                fileOperations: event.output.inputFileOperations ?? [],
                ...(event.output.timeToFirstTokenMs === undefined
                  ? {}
                  : { timeToFirstTokenMs: event.output.timeToFirstTokenMs }),
              },
              rates: candidate.rates,
            });
            usageSettled = true;
            if (context.aiGenerationId) {
              await this.updateAiGenerationCost(context.aiGenerationId, recorded.costVnd);
            }
          }
          yield event;
        }
        if (!usageSettled) {
          throw new Error("AI text stream was interrupted before completion.");
        }
        return;
      } catch (error) {
        if (!usageSettled) {
          await this.usage.fail(usageEvent.id, error, { rates: candidate.rates });
          usageSettled = true;
        }
        lastError = error;
        const hasFallback = index < candidates.length - 1;
        if (emittedDelta || !hasFallback || !isTransientProviderError(error)) {
          throw error;
        }
      } finally {
        if (!usageSettled) {
          await this.usage.fail(
            usageEvent.id,
            new Error("AI text stream was interrupted before completion."),
            { rates: candidate.rates },
          );
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error("AI provider call failed.");
  }

  async createEmbedding(
    context: RoutedAiCallContext,
    input: AiEmbeddingInput,
    configuredSpace = this.aiService.getEmbeddingConfig(),
  ): Promise<AiEmbeddingOutput> {
    const candidate = await this.routing.resolveCandidateByModel(configuredSpace.model);
    if (
      !candidate?.available ||
      candidate.provider !== configuredSpace.provider ||
      configuredSpace.provider !== AiProviderName.OPENAI
    ) {
      throw new Error(
        `No configured OpenAI credential or active catalog price is available for embedding model ${configuredSpace.model}.`,
      );
    }

    const estimatedPromptTokens = Math.max(
      1,
      Math.ceil(input.texts.reduce((total, value) => total + value.length, 0) / 4),
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
        operation: context.operation ?? "EMBEDDING_GENERATION",
        targetContext: context.targetContext,
        attempt: context.attempt,
      },
      {
        idempotencyKey:
          context.idempotencyKey ??
          `ai-embedding:${context.aiGenerationId ?? fingerprintEmbeddingRequest(input)}`,
        usageUpperBound: { promptTokens: estimatedPromptTokens },
        rates: candidate.rates,
        requiredMetrics: [ProviderUsageMetric.INPUT_TOKEN],
      },
    );

    try {
      const output = await this.aiService.createEmbedding(input, configuredSpace);
      const recorded = await this.usage.succeed(usageEvent.id, {
        promptTokens: output.usage?.promptTokens,
        totalTokens: output.usage?.totalTokens,
        rates: candidate.rates,
      });
      if (context.aiGenerationId) {
        await this.updateAiGenerationCost(context.aiGenerationId, recorded.costVnd);
      }
      return output;
    } catch (error) {
      await this.usage.fail(usageEvent.id, error, { rates: candidate.rates });
      throw error;
    }
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

function resolveCandidateControls(
  route: AiFeatureRoute,
  candidate: AiFeatureRoute["candidates"][number],
  isFallback: boolean,
  input: AiTextInput,
  maxOutputTokensOverride?: number,
) {
  const configuredTemperature = isFallback
    ? route.fallbackTemperature
    : route.temperature;
  const configuredReasoningEffort = isFallback
    ? route.fallbackReasoningEffort
    : route.reasoningEffort;
  const aiConfiguration = readAiConfiguration(candidate.capabilitiesJson);
  return {
    temperature:
      aiConfiguration === "REASONING_EFFORT"
        ? undefined
        : (configuredTemperature ?? input.temperature),
    reasoningEffort:
      aiConfiguration === "TEMPERATURE"
        ? undefined
        : (toAiReasoningEffort(configuredReasoningEffort ?? null) ??
          input.reasoningEffort),
    maxOutputTokens:
      maxOutputTokensOverride ??
      (isFallback ? route.fallbackMaxOutputTokens : route.maxOutputTokens) ??
      route.maxOutputTokens ??
      input.maxTokens,
  };
}

function resolveCandidateMaxInputTokens(
  route: AiFeatureRoute,
  candidate: AiFeatureRoute["candidates"][number],
  isFallback: boolean,
) {
  return isFallback
    ? (route.fallbackMaxInputTokens ?? route.maxInputTokens ?? candidate.maxInputTokens)
    : (route.maxInputTokens ?? candidate.maxInputTokens);
}

function readAiConfiguration(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const configuration = (value as Record<string, unknown>).aiConfiguration;
  return configuration === "TEMPERATURE" || configuration === "REASONING_EFFORT"
    ? configuration
    : null;
}

function buildInputUsageUpperBound(input: {
  candidate: AiFeatureRoute["candidates"][number];
  input: AiStructuredInput;
  promptTokens: number;
}) {
  return {
    promptTokens: input.promptTokens,
    ...(input.candidate.provider === AiProviderName.OPENAI &&
    input.input.promptCache &&
    supportsOpenAiExplicitPromptCaching(input.candidate.model)
      ? { cacheWriteInputTokens: input.promptTokens }
      : {}),
  };
}

function estimateImageInputTokens(detail: string | null) {
  return detail === "low" ? 250 : 1_000;
}

function estimateTextInputTokens(input: AiTextInput) {
  const text = [
    input.systemPrompt,
    input.userPrompt,
    ...(input.inputTextItems ?? []).map((item) => item.text),
    ...(input.contextChunks ?? []).map((chunk) => chunk.content),
  ].join("\n");
  const imageTokens = (input.inputImages ?? []).reduce(
    (total, image) => total + estimateImageInputTokens(image.detail ?? null),
    0,
  );
  return Math.max(1, Math.ceil(text.length / 4)) + imageTokens;
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
  const userPrompt = buildAiUserPrompt(input.input);
  const inputPrompt = [
    ...(input.input.inputTextItems ?? []).map((item) => item.text),
    userPrompt,
  ].join("\n");
  const inputTokenEstimate = estimateAiStructuredInputTokens({
    systemPrompt: input.input.systemPrompt,
    inputPrompt,
    structuredTextFormat: textFormat,
    additionalInputTokens: imageInputTokens,
  });
  const systemInstructionsTokens = Math.max(
    1,
    Math.ceil(input.input.systemPrompt.length / 4),
  );
  const userPromptTokens = Math.max(1, Math.ceil(input.input.userPrompt.length / 4));
  const contextTokens = Math.max(
    0,
    inputTokenEstimate.textInputTokens -
      systemInstructionsTokens -
      userPromptTokens -
      inputTokenEstimate.schemaTokens,
  );
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
      tokenBreakdown: {
        systemInstructionsTokens,
        userPromptTokens,
        contextTokens,
        schemaTokens: inputTokenEstimate.schemaTokens,
        textInputTokens: inputTokenEstimate.textInputTokens,
        pdfInputTokens: 0,
        estimatedTokens: inputTokenEstimate.estimatedTokens + imageInputTokens,
      },
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

function fingerprintRequest(input: AiTextInput) {
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

function fingerprintEmbeddingRequest(input: AiEmbeddingInput) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 20);
}

function toAiReasoningEffort(value: string | null): AiReasoningEffort | undefined {
  return isAiReasoningEffort(value) ? value : undefined;
}

function defaultContentOperation(feature: AiGenerationType): ProviderUsageOperation {
  const operations: Record<string, ProviderUsageOperation> = {
    SUMMARY: "SUMMARY_GENERATION",
    QUIZ: "QUIZ_GENERATION",
    FLASHCARD: "FLASHCARD_GENERATION",
    TEST: "TEST_GENERATION",
    EXPLANATION: "EXPLANATION_GENERATION",
    CHAT: "CHAT_RESPONSE_GENERATION",
    EMBEDDING: "EMBEDDING_GENERATION",
    DOCUMENT_EXTRACT: "DOCUMENT_EXTRACTION",
    DIAGRAM_RENDER: "DIAGRAM_GENERATION",
  };
  return operations[feature] ?? "DIAGRAM_GENERATION";
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
    message.includes("connection error") ||
    message.includes("connection reset") ||
    message.includes("fetch failed") ||
    message.includes("econnrefused") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("eai_again")
  );
}

function readStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const value = (error as { status?: unknown }).status;
  return typeof value === "number" ? value : null;
}
