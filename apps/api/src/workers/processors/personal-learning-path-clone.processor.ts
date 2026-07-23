import { Inject, Injectable, Logger } from "@nestjs/common";
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
import { PersonalLearningPathClonerService } from "#api/workers/services/personal-learning-path-cloner.service";

const workerJobSelect = {
  id: true,
  queue: true,
  status: true,
  ownerUserId: true,
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
export class PersonalLearningPathCloneProcessor {
  private readonly logger = new Logger(PersonalLearningPathCloneProcessor.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PersonalLearningPathClonerService)
    private readonly cloner: PersonalLearningPathClonerService,
  ) {}

  async process(
    job: Job<BackgroundJobBullmqData, BackgroundJobBullmqResult>,
  ): Promise<BackgroundJobBullmqResult> {
    const durableJob = await this.prisma.backgroundJob.findUnique({
      where: { id: job.data.backgroundJobId },
      select: workerJobSelect,
    });

    if (!durableJob) {
      throw new UnrecoverableError(
        `Durable background job ${job.data.backgroundJobId} was not found`,
      );
    }

    if (
      durableJob.queue !== BackgroundJobQueue.PERSONAL_LEARNING_PATH_CLONE
    ) {
      throw new UnrecoverableError(
        `Job ${durableJob.id} belongs to ${durableJob.queue}, not PERSONAL_LEARNING_PATH_CLONE`,
      );
    }

    if (durableJob.status === BackgroundJobStatus.CANCELLED) {
      throw new UnrecoverableError(`Job ${durableJob.id} was cancelled`);
    }

    if (durableJob.status === BackgroundJobStatus.SUCCEEDED) {
      return this.buildSkippedResult(durableJob);
    }

    const enrollmentId = durableJob.resourceId;
    const actorUserId = durableJob.ownerUserId;
    if (
      durableJob.resourceType !== "ENROLLMENT" ||
      !enrollmentId ||
      !actorUserId
    ) {
      throw new UnrecoverableError(
        `Job ${durableJob.id} is missing enrollment or actor metadata`,
      );
    }

    const attempt = job.attemptsMade + 1;
    const maxAttempts = this.resolveMaxAttempts(job, durableJob);
    const runningJob = await this.prisma.backgroundJob.update({
      where: { id: durableJob.id },
      data: {
        status: BackgroundJobStatus.RUNNING,
        bullmqJobId: String(job.id ?? durableJob.id),
        attempts: attempt,
        errorMessage: null,
        startedAt: new Date(),
        finishedAt: null,
      },
      select: workerJobSelect,
    });

    try {
      const clone = await this.cloner.cloneForEnrollment({
        enrollmentId,
        actorUserId,
        backgroundJobId: runningJob.id,
      });
      const result: BackgroundJobBullmqResult = {
        status: clone.alreadyActivated ? "SKIPPED" : "SUCCEEDED",
        queue: runningJob.queue,
        resourceType: runningJob.resourceType,
        resourceId: runningJob.resourceId,
        action: "PERSONAL_LEARNING_PATH_CLONE",
        message: clone.alreadyActivated
          ? "Enrollment already uses a personal learning path."
          : "Personal learning path cloned and activated.",
        handledAt: new Date().toISOString(),
        details: clone,
      };

      await this.prisma.backgroundJob.update({
        where: { id: runningJob.id },
        data: {
          status: BackgroundJobStatus.SUCCEEDED,
          result: toJobJson(result),
          errorMessage: null,
          finishedAt: new Date(),
        },
      });

      return result;
    } catch (error) {
      const hasRetryLeft = attempt < maxAttempts;
      const message = getJobErrorMessage(error);

      await this.prisma.backgroundJob.update({
        where: { id: runningJob.id },
        data: {
          status: hasRetryLeft
            ? BackgroundJobStatus.QUEUED
            : BackgroundJobStatus.FAILED,
          attempts: attempt,
          errorMessage: message,
          finishedAt: hasRetryLeft ? null : new Date(),
        },
      });
      this.logger.warn(
        `Personal clone job ${runningJob.id} attempt ${attempt}/${maxAttempts} failed: ${message}`,
      );
      throw error;
    }
  }

  private buildSkippedResult(record: WorkerJobRecord): BackgroundJobBullmqResult {
    return {
      status: "SKIPPED",
      queue: record.queue,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      action: "PERSONAL_LEARNING_PATH_CLONE",
      message: "Durable background job already succeeded.",
      handledAt: new Date().toISOString(),
    };
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
