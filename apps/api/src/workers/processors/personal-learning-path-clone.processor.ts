import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  AiProviderName,
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
import { AiService } from "#api/modules/ai/services/ai.service";
import { EmbeddingJobEnqueuer } from "#api/workers/services/embedding-job-enqueuer.service";
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
    @Inject(AiService) private readonly aiService: AiService,
    @Inject(EmbeddingJobEnqueuer)
    private readonly embeddingEnqueuer: EmbeddingJobEnqueuer,
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

    if (durableJob.queue !== BackgroundJobQueue.PERSONAL_LEARNING_PATH_CLONE) {
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
    if (durableJob.resourceType !== "ENROLLMENT" || !enrollmentId || !actorUserId) {
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
      const embeddingJobsQueued = await this.enqueueMissingEmbeddings({
        personalLearningPathId: clone.personalLearningPathId,
        actorUserId,
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
        details: {
          ...clone,
          embeddingJobsQueued,
        },
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
          status: hasRetryLeft ? BackgroundJobStatus.QUEUED : BackgroundJobStatus.FAILED,
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

  private async enqueueMissingEmbeddings({
    personalLearningPathId,
    actorUserId,
  }: {
    personalLearningPathId: string;
    actorUserId: string;
  }) {
    const embeddingConfig = this.aiService.getEmbeddingConfig();
    const pendingDocuments = await this.prisma.$queryRaw<
      Array<{ lessonDocumentId: string; lessonId: string }>
    >`
      SELECT DISTINCT
        ld.id AS "lessonDocumentId",
        ld.lesson_id AS "lessonId"
      FROM lesson_documents AS ld
      JOIN lessons AS lesson
        ON lesson.id = ld.lesson_id
      JOIN document_chunks AS chunk
        ON chunk.document_id = ld.id
      WHERE lesson.learning_path_id = ${personalLearningPathId}::uuid
        AND ld.replaced_at IS NULL
        AND (
          chunk.embedding IS NULL
          OR chunk.embedding_provider IS DISTINCT FROM ${AiProviderName.OPENAI}::"AiProviderName"
          OR chunk.embedding_model IS DISTINCT FROM ${embeddingConfig.model}
          OR chunk.embedding_dimensions IS DISTINCT FROM ${embeddingConfig.dimensions}
        )
      ORDER BY ld.id
    `;

    for (const document of pendingDocuments) {
      await this.embeddingEnqueuer.enqueueEmbeddingJob({
        lessonId: document.lessonId,
        lessonDocumentId: document.lessonDocumentId,
        ownerUserId: actorUserId,
      });
    }

    return pendingDocuments.length;
  }
}
