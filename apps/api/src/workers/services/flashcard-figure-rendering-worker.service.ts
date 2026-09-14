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

import type { EnvConfig } from "#api/config/env.validation";
import {
  type BackgroundJobBullmqData,
  type BackgroundJobBullmqResult,
  getBullmqQueueName,
} from "#api/jobs/background-job-queues";
import { parseRedisConnection } from "#api/jobs/redis-connection";
import { FlashcardFigureRenderingProcessor } from "#api/workers/processors/flashcard-figure-rendering.processor";
import { RealtimeJobSnapshotPublisherService } from "#api/modules/realtime/services/realtime-job-snapshot-publisher.service";

@Injectable()
export class FlashcardFigureRenderingWorkerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(FlashcardFigureRenderingWorkerService.name);
  private worker: Worker<BackgroundJobBullmqData, BackgroundJobBullmqResult> | null =
    null;

  constructor(
    @Inject(ConfigService)
    private readonly config: ConfigService<EnvConfig, true>,
    @Inject(FlashcardFigureRenderingProcessor)
    private readonly processor: FlashcardFigureRenderingProcessor,
    @Inject(RealtimeJobSnapshotPublisherService)
    private readonly realtimeJobs: RealtimeJobSnapshotPublisherService,
  ) {}

  onModuleInit() {
    const queueName = getBullmqQueueName(
      BackgroundJobQueue.FLASHCARD_FIGURE_RENDERING,
    );
    const concurrency = this.config.get("WORKER_CONCURRENCY_DIAGRAM", {
      infer: true,
    });
    this.worker = new Worker<BackgroundJobBullmqData, BackgroundJobBullmqResult>(
      queueName,
      (job) => this.processor.process(job),
      {
        connection: parseRedisConnection(this.config.get("REDIS_URL", { infer: true })),
        concurrency,
        name: "flashcard-figure-rendering-worker",
        removeOnComplete: { age: 7 * 24 * 60 * 60, count: 1_000 },
        removeOnFail: { age: 30 * 24 * 60 * 60, count: 5_000 },
      },
    );
    this.worker.on("completed", (job) => {
      void this.realtimeJobs.publishById(job.data.backgroundJobId);
    });
    this.worker.on("failed", (job, error) => {
      this.logger.error(
        `Flashcard figure job ${job?.id ?? "unknown"} failed: ${error.message}`,
      );
      if (job) void this.realtimeJobs.publishById(job.data.backgroundJobId);
    });
    this.logger.log(
      `Flashcard figure worker started on queue="${queueName}" concurrency=${concurrency}.`,
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
