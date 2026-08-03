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
import { AiGenerationProcessor } from "#api/workers/processors/ai-generation.processor";

@Injectable()
export class AiGenerationWorkerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AiGenerationWorkerService.name);
  private worker: Worker<
    BackgroundJobBullmqData,
    BackgroundJobBullmqResult
  > | null = null;

  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService<EnvConfig, true>,
    @Inject(AiGenerationProcessor)
    private readonly processor: AiGenerationProcessor,
  ) {}

  onModuleInit(): void {
    const queueName = getBullmqQueueName(BackgroundJobQueue.AI_GENERATION);
    const concurrency = this.configService.get("WORKER_CONCURRENCY_AI", {
      infer: true,
    });
    this.worker = new Worker<
      BackgroundJobBullmqData,
      BackgroundJobBullmqResult
    >(queueName, (job) => this.processor.process(job), {
      connection: parseRedisConnection(
        this.configService.get("REDIS_URL", { infer: true }),
      ),
      concurrency,
      name: "ai-generation-worker",
      removeOnComplete: { age: 7 * 24 * 60 * 60, count: 1_000 },
      removeOnFail: { age: 30 * 24 * 60 * 60, count: 5_000 },
    });

    this.worker.on("completed", (job) => {
      this.logger.log(`AI generation job ${job.id} completed.`);
    });
    this.worker.on("failed", (job, error) => {
      this.logger.error(
        `AI generation job ${job?.id ?? "unknown"} failed: ${error.message}`,
      );
    });
    this.worker.on("error", (error) => {
      this.logger.error(`AI generation worker error: ${error.message}`);
    });
    this.logger.log(
      `AI generation worker started on queue="${queueName}" concurrency=${concurrency}.`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
