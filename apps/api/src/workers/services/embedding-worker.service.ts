/**
 * EmbeddingWorkerService — BullMQ worker cho EMBEDDING queue.
 *
 * Pattern giống DocumentProcessingWorkerService.
 * Concurrency dùng chung WORKER_CONCURRENCY_AI với AI generation (default 4).
 */

import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BackgroundJobQueue } from "@prisma/client";
import { Worker } from "bullmq";
import { EnvConfig } from "#api/config/env.validation";
import {
  type BackgroundJobBullmqData,
  type BackgroundJobBullmqResult,
  getBullmqQueueName,
} from "#api/jobs/background-job-queues";
import { parseRedisConnection } from "#api/jobs/redis-connection";
import { EmbeddingProcessor } from "#api/workers/processors/embedding.processor";
import { RealtimeJobSnapshotPublisherService } from "#api/modules/realtime/services/realtime-job-snapshot-publisher.service";

const REMOVE_ON_COMPLETE_SECONDS = 7 * 24 * 60 * 60;
const REMOVE_ON_FAIL_SECONDS = 30 * 24 * 60 * 60;

@Injectable()
export class EmbeddingWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmbeddingWorkerService.name);
  private worker: Worker<BackgroundJobBullmqData, BackgroundJobBullmqResult> | null =
    null;

  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService<EnvConfig, true>,
    @Inject(EmbeddingProcessor)
    private readonly processor: EmbeddingProcessor,
    @Inject(RealtimeJobSnapshotPublisherService)
    private readonly realtimeJobs: RealtimeJobSnapshotPublisherService,
  ) {}

  onModuleInit() {
    const queueName = getBullmqQueueName(BackgroundJobQueue.EMBEDDING);
    const concurrency = this.configService.get("WORKER_CONCURRENCY_AI", {
      infer: true,
    });

    this.worker = new Worker<BackgroundJobBullmqData, BackgroundJobBullmqResult>(
      queueName,
      (job) => this.processor.process(job),
      {
        connection: parseRedisConnection(
          this.configService.get("REDIS_URL", { infer: true }),
        ),
        concurrency,
        name: "embedding-worker",
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

    this.worker.on("failed", (job, err) => {
      this.logger.error(`Embedding job ${job?.id ?? "unknown"} failed: ${err.message}`);
      if (job) void this.realtimeJobs.publishById(job.data.backgroundJobId);
    });

    this.worker.on("completed", (job) => {
      this.logger.log(`Embedding job ${job.id} completed`);
      void this.realtimeJobs.publishById(job.data.backgroundJobId);
    });

    this.logger.log(
      `Embedding worker started on queue="${queueName}" concurrency=${concurrency}`,
    );
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
      this.logger.log("Embedding worker closed");
    }
  }
}
