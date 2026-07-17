import { Inject, Injectable } from "@nestjs/common";
import {
  BackgroundJobQueue,
  BackgroundJobStatus,
  Prisma,
} from "@prisma/client";
import { Job, UnrecoverableError } from "bullmq";
import { PrismaService } from "#api/common/prisma/prisma.service";
import type {
  BackgroundJobBullmqData,
  BackgroundJobBullmqResult,
} from "#api/jobs/background-job-queues";
import { getJobErrorMessage } from "#api/jobs/job-error";
import { toJobJson } from "#api/jobs/job-json";

const workerJobSelect = {
  id: true,
  queue: true,
  status: true,
  resourceType: true,
  resourceId: true,
  inputMeta: true,
  result: true,
  attempts: true,
  maxAttempts: true,
} satisfies Prisma.BackgroundJobSelect;

type WorkerJobRecord = Prisma.BackgroundJobGetPayload<{
  select: typeof workerJobSelect;
}>;

@Injectable()
export class DocumentProcessingProcessor {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async process(
    job: Job<BackgroundJobBullmqData, BackgroundJobBullmqResult>,
  ): Promise<BackgroundJobBullmqResult> {
    const backgroundJob = await this.prisma.backgroundJob.findUnique({
      where: {
        id: job.data.backgroundJobId,
      },
      select: workerJobSelect,
    });

    if (!backgroundJob) {
      throw new UnrecoverableError(
        `Durable background job ${job.data.backgroundJobId} was not found`,
      );
    }

    if (backgroundJob.queue !== BackgroundJobQueue.DOCUMENT_PROCESSING) {
      throw new UnrecoverableError(
        `Job ${backgroundJob.id} belongs to ${backgroundJob.queue}, not DOCUMENT_PROCESSING`,
      );
    }

    if (backgroundJob.status === BackgroundJobStatus.CANCELLED) {
      throw new UnrecoverableError(`Job ${backgroundJob.id} was cancelled`);
    }

    if (backgroundJob.status === BackgroundJobStatus.SUCCEEDED) {
      return this.buildSkippedResult(backgroundJob);
    }

    const attempt = job.attemptsMade + 1;
    const maxAttempts = this.resolveMaxAttempts(job, backgroundJob);

    const runningJob = await this.prisma.backgroundJob.update({
      where: {
        id: backgroundJob.id,
      },
      data: {
        status: BackgroundJobStatus.RUNNING,
        bullmqJobId: String(job.id ?? backgroundJob.id),
        attempts: attempt,
        errorMessage: null,
        startedAt: new Date(),
      },
      select: workerJobSelect,
    });

    try {
      const result = this.buildFoundationResult(runningJob);

      await this.prisma.backgroundJob.update({
        where: {
          id: runningJob.id,
        },
        data: {
          status: BackgroundJobStatus.SUCCEEDED,
          result: toJobJson(result),
          errorMessage: null,
          finishedAt: new Date(),
        },
      });

      return result;
    } catch (error) {
      await this.markAttemptFailed(runningJob.id, error, attempt, maxAttempts);
      throw error;
    }
  }

  private buildFoundationResult(record: WorkerJobRecord): BackgroundJobBullmqResult {
    return {
      status: "SUCCEEDED",
      queue: record.queue,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      action: getJobAction(record.inputMeta),
      message:
        "Document processing worker foundation received the job. PDF extraction and chunking are implemented in M4.4.",
      handledAt: new Date().toISOString(),
    };
  }

  private buildSkippedResult(record: WorkerJobRecord): BackgroundJobBullmqResult {
    return {
      status: "SKIPPED",
      queue: record.queue,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      action: getJobAction(record.inputMeta),
      message: "Durable background job already succeeded.",
      handledAt: new Date().toISOString(),
    };
  }

  private async markAttemptFailed(
    jobId: string,
    error: unknown,
    attempt: number,
    maxAttempts: number,
  ) {
    const hasRetryLeft = attempt < maxAttempts;

    await this.prisma.backgroundJob.update({
      where: {
        id: jobId,
      },
      data: {
        status: hasRetryLeft
          ? BackgroundJobStatus.QUEUED
          : BackgroundJobStatus.FAILED,
        attempts: attempt,
        errorMessage: getJobErrorMessage(error),
        finishedAt: hasRetryLeft ? null : new Date(),
      },
    });
  }

  private resolveMaxAttempts(
    job: Job<BackgroundJobBullmqData, BackgroundJobBullmqResult>,
    record: WorkerJobRecord,
  ) {
    const bullmqAttempts =
      typeof job.opts.attempts === "number" && job.opts.attempts > 0
        ? job.opts.attempts
        : undefined;

    return Math.max(bullmqAttempts ?? record.maxAttempts, 1);
  }
}

function getJobAction(inputMeta: Prisma.JsonValue | null): string | null {
  if (!inputMeta || typeof inputMeta !== "object" || Array.isArray(inputMeta)) {
    return null;
  }

  const action = (inputMeta as Record<string, unknown>).action;
  return typeof action === "string" ? action : null;
}
