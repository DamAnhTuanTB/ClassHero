import { Inject, Injectable, Logger } from "@nestjs/common";
import { BackgroundJobStatus } from "@prisma/client";
import { Job, UnrecoverableError } from "bullmq";

import type {
  BackgroundJobBullmqData,
  BackgroundJobBullmqResult,
} from "#api/jobs/background-job-queues";
import { AiGenerationLifecycleService } from "#api/modules/ai/services/ai-generation-lifecycle.service";
import type { AiGenerationExecutionContext } from "#api/modules/ai/types/ai-generation.types";
import { AiOutputValidationError } from "#api/modules/ai/utils/ai-output-validation";
import { AiGenerationExecutionService } from "#api/workers/services/ai-generation-execution.service";
import type { AiFeatureRoute } from "#api/modules/provider-operations/types/provider-operations.types";

@Injectable()
export class AiGenerationProcessor {
  private readonly logger = new Logger(AiGenerationProcessor.name);

  constructor(
    @Inject(AiGenerationLifecycleService)
    private readonly lifecycle: AiGenerationLifecycleService,
    @Inject(AiGenerationExecutionService)
    private readonly execution: AiGenerationExecutionService,
  ) {}

  async process(
    job: Job<BackgroundJobBullmqData, BackgroundJobBullmqResult>,
  ): Promise<BackgroundJobBullmqResult> {
    const record = await this.lifecycle.load(job.data.backgroundJobId);

    if (record.status === BackgroundJobStatus.CANCELLED) {
      throw new UnrecoverableError(`AI generation job ${record.id} was cancelled.`);
    }
    if (record.status === BackgroundJobStatus.SUCCEEDED) {
      return {
        status: "SKIPPED",
        queue: record.queue,
        resourceType: record.resourceType,
        resourceId: record.resourceId,
        action: record.aiGeneration.type,
        message: "AI generation job already succeeded.",
        handledAt: new Date().toISOString(),
      };
    }

    const attempt = job.attemptsMade + 1;
    const maxAttempts = Math.max(
      record.maxAttempts,
      typeof job.opts.attempts === "number" ? job.opts.attempts : 1,
      1,
    );
    const context: AiGenerationExecutionContext = {
      backgroundJobId: record.id,
      aiGenerationId: record.aiGeneration.id,
      type: record.aiGeneration.type,
      ownerUserId: record.ownerUserId,
      lessonId: record.lessonId,
      targetType: record.aiGeneration.targetType,
      targetId: record.aiGeneration.targetId,
      inputMeta: record.inputMeta,
      attempt,
      maxAttempts,
      providerRouteSnapshot: readRouteSnapshot(record.inputMeta),
    };

    await this.lifecycle.markRunning(
      context,
      String(job.id ?? record.id),
    );

    try {
      // persist() is intentionally unreachable until generate() returns a
      // provider result that has already passed strict JSON Schema + Zod.
      const prepared = await this.execution.generate(context);
      const persisted = await this.execution.persist(context, prepared);
      return await this.lifecycle.markSucceeded(context, prepared, persisted);
    } catch (error) {
      const isInvalidOutput = error instanceof AiOutputValidationError;
      const isFinalAttempt =
        isInvalidOutput ||
        error instanceof UnrecoverableError ||
        attempt >= maxAttempts;
      await this.lifecycle.markFailed(context, error, isFinalAttempt);

      if (isInvalidOutput) {
        this.logger.warn(
          `AI generation ${context.aiGenerationId} rejected invalid output without persistence.`,
        );
        throw new UnrecoverableError(error.message);
      }
      throw error;
    }
  }
}

function readRouteSnapshot(value: unknown): AiFeatureRoute | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const snapshot = (value as Record<string, unknown>).providerRouteSnapshot;
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return undefined;
  }
  return snapshot as AiFeatureRoute;
}
