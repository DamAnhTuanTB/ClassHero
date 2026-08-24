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
import { QuizFigureRenderingProcessor } from "#api/workers/processors/quiz-figure-rendering.processor";

@Injectable()
export class QuizFigureRenderingWorkerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(QuizFigureRenderingWorkerService.name);
  private worker: Worker<BackgroundJobBullmqData, BackgroundJobBullmqResult> | null =
    null;

  constructor(
    @Inject(ConfigService)
    private readonly config: ConfigService<EnvConfig, true>,
    @Inject(QuizFigureRenderingProcessor)
    private readonly processor: QuizFigureRenderingProcessor,
  ) {}

  onModuleInit() {
    const queueName = getBullmqQueueName(BackgroundJobQueue.QUIZ_FIGURE_RENDERING);
    const concurrency = this.config.get("WORKER_CONCURRENCY_DIAGRAM", {
      infer: true,
    });
    this.worker = new Worker<BackgroundJobBullmqData, BackgroundJobBullmqResult>(
      queueName,
      (job) => this.processor.process(job),
      {
        connection: parseRedisConnection(this.config.get("REDIS_URL", { infer: true })),
        concurrency,
        name: "quiz-figure-rendering-worker",
        removeOnComplete: { age: 7 * 24 * 60 * 60, count: 1_000 },
        removeOnFail: { age: 30 * 24 * 60 * 60, count: 5_000 },
      },
    );
    this.worker.on("failed", (job, error) => {
      this.logger.error(
        `Quiz figure render job ${job?.id ?? "unknown"} failed: ${error.message}`,
      );
    });
    this.logger.log(
      `Quiz figure worker started on queue="${queueName}" concurrency=${concurrency}.`,
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
