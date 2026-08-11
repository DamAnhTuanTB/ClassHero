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
import { toJobJson } from "#api/jobs/job-json";
import type { BackgroundJobBullmqResult } from "#api/jobs/background-job-queues";

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
          outputHash: hashAiValue(prepared.output.data),
          outputJson: toJobJson(prepared.output.data),
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
    const message = getSafeAiErrorMessage(error);
    const finishedAt = isFinalAttempt ? new Date() : null;

    await this.prisma.$transaction([
      this.prisma.backgroundJob.update({
        where: { id: context.backgroundJobId },
        data: {
          status: isFinalAttempt
            ? BackgroundJobStatus.FAILED
            : BackgroundJobStatus.QUEUED,
          attempts: context.attempt,
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
          finishedAt,
        },
      }),
    ]);
  }
}

function getSafeAiErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown AI job error";
  return message.replace(/[\r\n]+/g, " ").slice(0, 2_000);
}
