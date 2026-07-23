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
import { PersonalLearningPathCloneProcessor } from "#api/workers/processors/personal-learning-path-clone.processor";

const REMOVE_ON_COMPLETE_SECONDS = 7 * 24 * 60 * 60;
const REMOVE_ON_FAIL_SECONDS = 30 * 24 * 60 * 60;
const PERSONAL_CLONE_CONCURRENCY = 1;

@Injectable()
export class PersonalLearningPathCloneWorkerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(
    PersonalLearningPathCloneWorkerService.name,
  );
  private worker: Worker<BackgroundJobBullmqData, BackgroundJobBullmqResult> | null =
    null;

  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService<EnvConfig, true>,
    @Inject(PersonalLearningPathCloneProcessor)
    private readonly processor: PersonalLearningPathCloneProcessor,
  ) {}

  onModuleInit() {
    const queueName = getBullmqQueueName(
      BackgroundJobQueue.PERSONAL_LEARNING_PATH_CLONE,
    );

    this.worker = new Worker<BackgroundJobBullmqData, BackgroundJobBullmqResult>(
      queueName,
      (job) => this.processor.process(job),
      {
        connection: parseRedisConnection(
          this.configService.get("REDIS_URL", { infer: true }),
        ),
        concurrency: PERSONAL_CLONE_CONCURRENCY,
        name: "personal-learning-path-clone-worker",
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

    this.worker.on("ready", () => {
      this.logger.log(
        `Worker ready for ${queueName} with concurrency ${PERSONAL_CLONE_CONCURRENCY}`,
      );
    });
    this.worker.on("completed", (job) => {
      this.logger.debug(`Completed BullMQ job ${job.id ?? "unknown"}`);
    });
    this.worker.on("failed", (job, error) => {
      this.logger.warn(
        `BullMQ job ${job?.id ?? "unknown"} failed: ${error.message}`,
      );
    });
    this.worker.on("error", (error) => {
      this.logger.error(`Worker error: ${error.message}`);
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
