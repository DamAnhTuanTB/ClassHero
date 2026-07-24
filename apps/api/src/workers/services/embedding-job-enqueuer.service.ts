/**
 * Utility để enqueue embedding job từ worker context.
 *
 * Worker context không import JobsModule (vì nó kéo AuthModule/JwtModule).
 * Utility này chỉ cần PrismaService và Redis connection để:
 * 1. Tạo durable background_jobs row
 * 2. Add BullMQ job vào EMBEDDING queue
 */

import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BackgroundJobQueue, BackgroundJobStatus } from "@prisma/client";
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

const REMOVE_ON_COMPLETE_SECONDS = 7 * 24 * 60 * 60;
const REMOVE_ON_FAIL_SECONDS = 30 * 24 * 60 * 60;

@Injectable()
export class EmbeddingJobEnqueuer {
  private readonly logger = new Logger(EmbeddingJobEnqueuer.name);
  private queue: Queue<BackgroundJobBullmqData, BackgroundJobBullmqResult> | null = null;
  private readonly redisConnection;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly configService: ConfigService<EnvConfig, true>,
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
  }): Promise<{ jobId: string } | null> {
    try {
      // Tạo durable background_jobs row
      const durableJob = await this.prisma.backgroundJob.create({
        data: {
          queue: BackgroundJobQueue.EMBEDDING,
          status: BackgroundJobStatus.QUEUED,
          lessonId: params.lessonId,
          resourceType: "lesson_document",
          resourceId: params.lessonDocumentId,
          ownerUserId: params.ownerUserId ?? null,
          inputMeta: {
            action: "EMBEDDING",
            lessonId: params.lessonId,
            lessonDocumentId: params.lessonDocumentId,
          },
          maxAttempts: 3,
        },
      });

      // Enqueue BullMQ job
      const queue = this.getQueue();
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
      // Embedding enqueue failure should not fail the parent document processing job
      this.logger.error(
        `Failed to enqueue EMBEDDING job for lessonDocument=${params.lessonDocumentId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private getQueue(): Queue<BackgroundJobBullmqData, BackgroundJobBullmqResult> {
    if (!this.queue) {
      this.queue = new Queue(
        getBullmqQueueName(BackgroundJobQueue.EMBEDDING),
        {
          connection: this.redisConnection,
          skipWaitingForReady: true,
        },
      );
    }

    return this.queue;
  }

  async close(): Promise<void> {
    if (this.queue) {
      await this.queue.close();
    }
  }
}
