import { Inject, Injectable } from "@nestjs/common";
import {
  AiGenerationStatus,
  BackgroundJobQueue,
  BackgroundJobStatus,
  Prisma,
} from "@prisma/client";
import { UnrecoverableError } from "bullmq";

import { PrismaService } from "#api/common/prisma/prisma.service";
import type {
  AiGenerationExecutionContext,
  AiGenerationLifecycleRecord,
  AiGenerationPersistenceResult,
  AiGenerationPreparedOutput,
} from "#api/modules/ai/types/ai-generation.types";
import { hashAiValue } from "#api/modules/ai/utils/ai-hash";
import { isAiProviderOutputError } from "#api/modules/ai/utils/ai-output-validation";
import { toJobJson } from "#api/jobs/job-json";
import type { BackgroundJobBullmqResult } from "#api/jobs/background-job-queues";
import {
  normalizeJobError,
  type JobProvider,
} from "#api/jobs/job-error";

const lifecycleJobSelect = {
  id: true,
  queue: true,
  status: true,
  ownerUserId: true,
  lessonId: true,
  inputMeta: true,
  resourceType: true,
  resourceId: true,
  maxAttempts: true,
  aiGenerations: {
    orderBy: { createdAt: "asc" },
    take: 1,
    select: {
      id: true,
      type: true,
      status: true,
      targetType: true,
      targetId: true,
    },
  },
} satisfies Prisma.BackgroundJobSelect;

@Injectable()
export class AiGenerationLifecycleService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async load(backgroundJobId: string): Promise<AiGenerationLifecycleRecord> {
    const record = await this.prisma.backgroundJob.findUnique({
      where: { id: backgroundJobId },
      select: lifecycleJobSelect,
    });

    if (!record) {
      throw new UnrecoverableError(
        `Durable AI background job ${backgroundJobId} was not found.`,
      );
    }
    if (record.queue !== BackgroundJobQueue.AI_GENERATION) {
      throw new UnrecoverableError(
        `Job ${record.id} belongs to ${record.queue}, not AI_GENERATION.`,
      );
    }

    const aiGeneration = record.aiGenerations[0];
    if (!aiGeneration) {
      throw new UnrecoverableError(
        `AI generation record for background job ${record.id} was not found.`,
      );
    }

    return {
      ...record,
      queue: "AI_GENERATION",
      aiGeneration,
    };
  }

  async markRunning(
    context: AiGenerationExecutionContext,
    bullmqJobId: string,
  ): Promise<void> {
    const startedAt = new Date();
    await this.prisma.$transaction([
      this.prisma.backgroundJob.update({
        where: { id: context.backgroundJobId },
        data: {
          status: BackgroundJobStatus.RUNNING,
          bullmqJobId,
          attempts: context.attempt,
          errorMessage: null,
          startedAt,
          finishedAt: null,
        },
      }),
      this.prisma.aiGeneration.update({
        where: { id: context.aiGenerationId },
        data: {
          status: AiGenerationStatus.RUNNING,
          retryCount: Math.max(context.attempt - 1, 0),
          errorMessage: null,
          startedAt,
          finishedAt: null,
        },
      }),
    ]);
  }

  async markSucceeded(
    context: AiGenerationExecutionContext,
    prepared: AiGenerationPreparedOutput,
    persisted: AiGenerationPersistenceResult,
  ): Promise<BackgroundJobBullmqResult> {
    const finishedAt = new Date();
    const result: BackgroundJobBullmqResult = {
      status: "SUCCEEDED",
      queue: BackgroundJobQueue.AI_GENERATION,
      resourceType: persisted.resourceType,
      resourceId: persisted.resourceId,
      action: prepared.action,
      message: persisted.message,
      handledAt: finishedAt.toISOString(),
      ...(persisted.result === undefined ? {} : { details: persisted.result }),
    };
    const usage = prepared.output.usage;
    const recordedOutput = prepared.recordedOutput ?? prepared.output.data;

    await this.prisma.$transaction([
      this.prisma.backgroundJob.update({
        where: { id: context.backgroundJobId },
        data: {
          status: BackgroundJobStatus.SUCCEEDED,
          resourceType: persisted.resourceType,
          resourceId: persisted.resourceId,
          result: toJobJson(result),
          errorMessage: null,
          finishedAt,
        },
      }),
      this.prisma.aiGeneration.update({
        where: { id: context.aiGenerationId },
        data: {
          status: AiGenerationStatus.SUCCEEDED,
          provider: prepared.output.provider,
          model: prepared.output.model,
          providerRequestId: prepared.output.providerRequestId,
          promptTokens: usage?.promptTokens,
          completionTokens: usage?.completionTokens,
          totalTokens: usage?.totalTokens,
          latencyMs: prepared.output.latencyMs,
          retryCount: Math.max(context.attempt - 1, 0),
          outputHash: hashAiValue(recordedOutput),
          outputJson: toJobJson(recordedOutput),
          targetType: persisted.resourceType,
          targetId: persisted.resourceId,
          errorMessage: null,
          finishedAt,
        },
      }),
    ]);

    return result;
  }

  async markFailed(
    context: AiGenerationExecutionContext,
    error: unknown,
    isFinalAttempt: boolean,
  ): Promise<void> {
    const failure = normalizeJobError(error, resolveProviderHint(context));
    const message = failure.message;
    const finishedAt = isFinalAttempt ? new Date() : null;
    const providerFailure = isAiProviderOutputError(error) ? error.details : null;
    const usage = providerFailure?.usage;

    await this.prisma.$transaction([
      this.prisma.backgroundJob.update({
        where: { id: context.backgroundJobId },
        data: {
          status: isFinalAttempt
            ? BackgroundJobStatus.FAILED
            : BackgroundJobStatus.QUEUED,
          attempts: context.attempt,
          result: toJobJson({ errorDetails: failure }),
          errorMessage: message,
          finishedAt,
        },
      }),
      this.prisma.aiGeneration.update({
        where: { id: context.aiGenerationId },
        data: {
          status: isFinalAttempt ? AiGenerationStatus.FAILED : AiGenerationStatus.QUEUED,
          retryCount: Math.max(context.attempt - 1, 0),
          errorMessage: message,
          ...(providerFailure
            ? {
                provider: providerFailure.provider,
                model: providerFailure.model,
                providerRequestId: providerFailure.providerRequestId,
                promptTokens: usage?.promptTokens,
                completionTokens: usage?.completionTokens,
                totalTokens: usage?.totalTokens,
                latencyMs: providerFailure.latencyMs,
              }
            : {}),
          finishedAt,
        },
      }),
    ]);
  }
}

function resolveProviderHint(context: AiGenerationExecutionContext): JobProvider | null {
  const provider = context.providerRouteSnapshot?.candidates[0]?.provider;
  if (provider === "OPENAI" || provider === "GEMINI") return provider;
  return null;
}
