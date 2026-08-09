import { Inject, Injectable } from "@nestjs/common";
import { ProviderUsageMetric, type AiGenerationType } from "@prisma/client";
import { createHash } from "node:crypto";

import { PrismaService } from "#api/common/prisma/prisma.service";
import { AiService } from "#api/modules/ai/services/ai.service";
import type {
  AiOutputSchema,
  AiStructuredInput,
  AiStructuredOutput,
} from "#api/modules/ai/types/ai-text.types";
import { AiModelRoutingService } from "#api/modules/provider-operations/services/ai-model-routing.service";
import { ProviderUsageService } from "#api/modules/provider-operations/services/provider-usage.service";
import type { AiFeatureRoute } from "#api/modules/provider-operations/types/provider-operations.types";

type RoutedAiCallContext = {
  feature: AiGenerationType;
  aiGenerationId?: string | null;
  backgroundJobId?: string | null;
  attempt?: number;
  callSequence?: number;
  routeSnapshot?: AiFeatureRoute;
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

  async generateStructured<TOutput>(
    context: RoutedAiCallContext,
    input: AiStructuredInput,
    schema: AiOutputSchema<TOutput>,
  ): Promise<AiStructuredOutput<TOutput>> {
    const route = context.routeSnapshot ?? (await this.routing.resolve(context.feature));
    const candidates = route.candidates.filter((candidate) => candidate.available);
    if (candidates.length === 0) {
      throw new Error(
        `No configured credential is available for AI feature ${context.feature}.`,
      );
    }

    let lastError: unknown;
    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index]!;
      const maxOutputTokens = route.maxOutputTokens ?? input.maxTokens;
      const requestFingerprint = createHash("sha256")
        .update(`${input.systemPrompt}\n${input.userPrompt}`)
        .digest("hex")
        .slice(0, 20);
      const usageEvent = await this.usage.reserveAndStart(
        {
          category: candidate.category,
          provider: candidate.provider,
          catalogItemId: candidate.catalogItemId,
          priceVersionId: candidate.priceVersionId,
          aiGenerationId: context.aiGenerationId,
          backgroundJobId: context.backgroundJobId,
          feature: context.feature,
          attempt: context.attempt,
        },
        {
          idempotencyKey: [
            "ai",
            context.backgroundJobId ?? context.aiGenerationId ?? requestFingerprint,
            context.attempt ?? 1,
            context.callSequence ?? 1,
            index,
            candidate.catalogItemId ?? candidate.model,
          ].join(":"),
          usageUpperBound: {
            promptTokens: candidate.maxInputTokens ?? 0,
            completionTokens: maxOutputTokens ?? 0,
          },
          rates: candidate.rates,
          requiredMetrics: [
            ProviderUsageMetric.INPUT_TOKEN,
            ProviderUsageMetric.OUTPUT_TOKEN,
          ],
          estimateUnavailableReason:
            candidate.maxInputTokens == null || candidate.maxInputTokens <= 0
              ? "Chưa có giới hạn đầu vào của mô hình nên yêu cầu AI đã được dừng để bảo vệ ngân sách."
              : maxOutputTokens == null || maxOutputTokens <= 0
                ? "Chưa có giới hạn độ dài đầu ra nên yêu cầu AI đã được dừng để bảo vệ ngân sách."
                : undefined,
        },
      );
      try {
        const output = await this.aiService.generateStructured(
          {
            ...input,
            model: candidate.model,
            temperature: route.temperature ?? input.temperature,
            maxTokens: maxOutputTokens,
          },
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
          rawUsage: usage,
          rates: candidate.rates,
        });
        if (context.aiGenerationId) {
          await this.prisma.aiGeneration.update({
            where: { id: context.aiGenerationId },
            data: { estimatedCostVnd: recorded.costVnd },
          });
        }
        return output;
      } catch (error) {
        await this.usage.fail(usageEvent.id, error);
        lastError = error;
        const hasFallback = index < candidates.length - 1;
        if (!hasFallback || !isTransientProviderError(error)) {
          throw error;
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error("AI provider call failed.");
  }
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
