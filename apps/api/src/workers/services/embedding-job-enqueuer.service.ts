/**
 * Utility để enqueue embedding job từ worker context.
 *
 * Worker context không import JobsModule (vì nó kéo AuthModule/JwtModule).
 * Utility này chỉ cần PrismaService và Redis connection để:
 * 1. Tạo durable background_jobs row
 * 2. Add BullMQ job vào EMBEDDING queue
 */

import { Inject, Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AiGenerationStatus,
  AiGenerationType,
  AiProviderName,
  BackgroundJobQueue,
  BackgroundJobStatus,
  DocumentStatus,
} from "@prisma/client";
import { Queue } from "bullmq";
import { PrismaService } from "#api/common/prisma/prisma.service";
import type { EnvConfig } from "#api/config/env.validation";
import {
  type BackgroundJobBullmqData,
  type BackgroundJobBullmqResult,
  getBullmqJobName,
  getBullmqQueueName,
} from "#api/jobs/background-job-queues";
import { parseRedisConnection } from "#api/jobs/redis-connection";
import { AiService } from "#api/modules/ai/services/ai.service";

const REMOVE_ON_COMPLETE_SECONDS = 7 * 24 * 60 * 60;
const REMOVE_ON_FAIL_SECONDS = 30 * 24 * 60 * 60;

@Injectable()
export class EmbeddingJobEnqueuer implements OnModuleDestroy {
  private readonly logger = new Logger(EmbeddingJobEnqueuer.name);
  private queue: Queue<BackgroundJobBullmqData, BackgroundJobBullmqResult> | null = null;
  private readonly redisConnection;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly configService: ConfigService<EnvConfig, true>,
    @Inject(AiService) private readonly aiService: AiService,
  ) {
    this.redisConnection = parseRedisConnection(
      this.configService.get("REDIS_URL", { infer: true }),
    );
  }

  /**
   * Tạo durable background_jobs row + enqueue BullMQ job cho EMBEDDING.
   *
   * @param lessonId - lesson ID
   * @param lessonDocumentId - lesson document cần embedding
   * @param ownerUserId - user tạo action ban đầu (optional)
   */
  async enqueueEmbeddingJob(params: {
    lessonId: string;
    lessonDocumentId: string;
    ownerUserId?: string;
  }): Promise<{ jobId: string }> {
    const lessonDocument = await this.prisma.lessonDocument.findFirst({
      where: {
        id: params.lessonDocumentId,
        lessonId: params.lessonId,
        replacedAt: null,
      },
      select: {
        id: true,
        chunkCount: true,
        processedAt: true,
        updatedAt: true,
      },
    });

    if (!lessonDocument) {
      throw new Error(
        `Cannot enqueue embedding for inactive lesson document ${params.lessonDocumentId}.`,
      );
    }

    if (lessonDocument.chunkCount <= 0) {
      throw new Error(
        `Cannot enqueue embedding for lesson document ${params.lessonDocumentId} without chunks.`,
      );
    }

    const activeJob = await this.prisma.backgroundJob.findFirst({
      where: {
        queue: BackgroundJobQueue.EMBEDDING,
        resourceType: "lesson_document",
        resourceId: params.lessonDocumentId,
        status: {
          in: [BackgroundJobStatus.QUEUED, BackgroundJobStatus.RUNNING],
        },
      },
      select: {
        id: true,
        bullmqJobId: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (activeJob?.bullmqJobId) {
      await this.prisma.lessonDocument.update({
        where: { id: params.lessonDocumentId },
        data: {
          status: DocumentStatus.PROCESSING,
          extractError: null,
        },
      });
      this.logger.debug(
        `Reusing active EMBEDDING job ${activeJob.id} for lessonDocument=${params.lessonDocumentId}`,
      );
      return { jobId: activeJob.id };
    }

    const documentVersion = lessonDocument.processedAt ?? lessonDocument.updatedAt;
    const idempotencyKey = [
      "embedding",
      params.lessonDocumentId,
      documentVersion.toISOString(),
    ].join(":");
    const embeddingConfig = this.aiService.getEmbeddingConfig();
    let durableJobId: string | null = activeJob?.id ?? null;
    let aiGenerationId: string | null = null;

    try {
      let durableJob = activeJob
        ? await this.prisma.backgroundJob.findUniqueOrThrow({
            where: { id: activeJob.id },
          })
        : await this.prisma.backgroundJob.findUnique({
            where: { idempotencyKey },
          });

      if (!durableJob) {
        durableJob = await this.prisma.backgroundJob.create({
          data: {
            queue: BackgroundJobQueue.EMBEDDING,
            status: BackgroundJobStatus.QUEUED,
            idempotencyKey,
            lessonId: params.lessonId,
            resourceType: "lesson_document",
            resourceId: params.lessonDocumentId,
            ownerUserId: params.ownerUserId ?? null,
            inputMeta: {
              action: "EMBEDDING",
              lessonId: params.lessonId,
              lessonDocumentId: params.lessonDocumentId,
              documentVersion: documentVersion.toISOString(),
            },
            maxAttempts: 3,
          },
        });
      } else if (durableJob.status === BackgroundJobStatus.SUCCEEDED) {
        return { jobId: durableJob.id };
      } else if (
        durableJob.status === BackgroundJobStatus.FAILED ||
        durableJob.status === BackgroundJobStatus.CANCELLED
      ) {
        durableJob = await this.prisma.backgroundJob.update({
          where: { id: durableJob.id },
          data: {
            status: BackgroundJobStatus.QUEUED,
            attempts: 0,
            bullmqJobId: null,
            result: undefined,
            errorMessage: null,
            startedAt: null,
            finishedAt: null,
          },
        });
      }

      durableJobId = durableJob.id;

      const existingAiGeneration = await this.prisma.aiGeneration.findFirst({
        where: {
          backgroundJobId: durableJob.id,
          type: AiGenerationType.EMBEDDING,
        },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });

      if (existingAiGeneration) {
        const aiGeneration = await this.prisma.aiGeneration.update({
          where: { id: existingAiGeneration.id },
          data: {
            status: AiGenerationStatus.QUEUED,
            provider: AiProviderName.OPENAI,
            model: embeddingConfig.model,
            retryCount: 0,
            errorMessage: null,
            startedAt: null,
            finishedAt: null,
          },
          select: { id: true },
        });
        aiGenerationId = aiGeneration.id;
      } else {
        const aiGeneration = await this.prisma.aiGeneration.create({
          data: {
            type: AiGenerationType.EMBEDDING,
            status: AiGenerationStatus.QUEUED,
            provider: AiProviderName.OPENAI,
            model: embeddingConfig.model,
            lessonId: params.lessonId,
            backgroundJobId: durableJob.id,
            createdByUserId: params.ownerUserId ?? null,
            targetType: "LESSON_DOCUMENT",
            targetId: params.lessonDocumentId,
            inputMetaJson: {
              lessonDocumentId: params.lessonDocumentId,
              dimensions: embeddingConfig.dimensions,
              documentVersion: documentVersion.toISOString(),
            },
          },
          select: { id: true },
        });
        aiGenerationId = aiGeneration.id;
      }

      await this.prisma.lessonDocument.update({
        where: { id: params.lessonDocumentId },
        data: {
          status: DocumentStatus.PROCESSING,
          extractError: null,
        },
      });

      // Enqueue BullMQ job
      const queue = this.getQueue();
      const existingBullmqJob = await queue.getJob(durableJob.id);
      if (existingBullmqJob) {
        const state = await existingBullmqJob.getState();
        if (state === "failed" || state === "completed") {
          await existingBullmqJob.remove();
        }
      }
      const bullmqJob = await queue.add(
        getBullmqJobName(BackgroundJobQueue.EMBEDDING),
        { backgroundJobId: durableJob.id },
        {
          jobId: durableJob.id,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 10_000,
          },
          removeOnComplete: {
            age: REMOVE_ON_COMPLETE_SECONDS,
            count: 1_000,
          },
          removeOnFail: {
            age: REMOVE_ON_FAIL_SECONDS,
            count: 5_000,
          },
        },
      );

      const bullmqJobId = String(bullmqJob.id ?? durableJob.id);

      await this.prisma.backgroundJob.update({
        where: { id: durableJob.id },
        data: { bullmqJobId },
      });

      this.logger.log(
        `Enqueued EMBEDDING job ${durableJob.id} for lessonDocument=${params.lessonDocumentId}, lesson=${params.lessonId}`,
      );

      return { jobId: durableJob.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failedAt = new Date();
      const updates: Array<Promise<unknown>> = [];

      if (durableJobId) {
        updates.push(
          this.prisma.backgroundJob.update({
            where: { id: durableJobId },
            data: {
              status: BackgroundJobStatus.FAILED,
              errorMessage: `Không enqueue được embedding job: ${message}`,
              finishedAt: failedAt,
            },
          }),
        );
      }
      if (aiGenerationId) {
        updates.push(
          this.prisma.aiGeneration.update({
            where: { id: aiGenerationId },
            data: {
              status: AiGenerationStatus.FAILED,
              errorMessage: message,
              finishedAt: failedAt,
            },
          }),
        );
      }
      updates.push(
        this.prisma.lessonDocument.update({
          where: { id: params.lessonDocumentId },
          data: {
            status: DocumentStatus.FAILED,
            extractError: `Không enqueue được embedding job: ${message}`,
          },
        }),
      );
      await Promise.all(updates);

      this.logger.error(
        `Failed to enqueue EMBEDDING job for lessonDocument=${params.lessonDocumentId}: ${message}`,
      );
      throw error;
    }
  }

  private getQueue(): Queue<BackgroundJobBullmqData, BackgroundJobBullmqResult> {
    if (!this.queue) {
      this.queue = new Queue(getBullmqQueueName(BackgroundJobQueue.EMBEDDING), {
        connection: this.redisConnection,
        skipWaitingForReady: true,
      });
    }

    return this.queue;
  }

  async close(): Promise<void> {
    if (this.queue) {
      await this.queue.close();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }
}
