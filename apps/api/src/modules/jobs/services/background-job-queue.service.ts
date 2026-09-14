import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BackgroundJobQueue, BackgroundJobStatus } from "@prisma/client";
import { Queue, type JobsOptions } from "bullmq";
import { throwInternalServerError } from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { EnvConfig } from "#api/config/env.validation";
import {
  type BackgroundJobBullmqData,
  type BackgroundJobBullmqResult,
  getBullmqJobName,
  getBullmqQueueName,
} from "#api/jobs/background-job-queues";
import { getJobErrorMessage } from "#api/jobs/job-error";
import { parseRedisConnection } from "#api/jobs/redis-connection";
import { RealtimeEventPublisherService } from "#api/modules/realtime/services/realtime-event-publisher.service";

type BullmqQueueClient = {
  add(
    name: string,
    data: BackgroundJobBullmqData,
    opts: JobsOptions,
  ): Promise<{ id?: string | number }>;
  close(): Promise<void>;
};

const REMOVE_ON_COMPLETE_SECONDS = 7 * 24 * 60 * 60;
const REMOVE_ON_FAIL_SECONDS = 30 * 24 * 60 * 60;

@Injectable()
export class BackgroundJobQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(BackgroundJobQueueService.name);
  private readonly queues = new Map<BackgroundJobQueue, BullmqQueueClient>();
  private readonly redisConnection;

  constructor(
    @Inject(ConfigService)
    configService: ConfigService<EnvConfig, true>,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(RealtimeEventPublisherService)
    private readonly realtimePublisher?: RealtimeEventPublisherService,
  ) {
    this.redisConnection = parseRedisConnection(
      configService.get("REDIS_URL", { infer: true }),
    );
  }

  async enqueue(jobId: string) {
    const job = await this.prisma.backgroundJob.findUnique({
      where: {
        id: jobId,
      },
      select: {
        id: true,
        queue: true,
        status: true,
        maxAttempts: true,
        availableAt: true,
      },
    });

    if (!job) {
      throwInternalServerError("BACKGROUND_JOB_NOT_FOUND", "Không tìm thấy job nền");
    }

    if (job.status === BackgroundJobStatus.CANCELLED) {
      throwInternalServerError(
        "BACKGROUND_JOB_CANCELLED",
        "Không thể enqueue job đã bị hủy",
      );
    }

    const attempts = Math.max(job.maxAttempts, 1);
    const queue = this.getQueue(job.queue);

    try {
      const bullmqJob = await queue.add(
        getBullmqJobName(job.queue),
        { backgroundJobId: job.id },
        {
          jobId: job.id,
          attempts,
          backoff: {
            type: "exponential",
            delay: 5_000,
          },
          delay: this.resolveDelay(job.availableAt),
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
      const bullmqJobId = String(bullmqJob.id ?? job.id);

      const updatedJob = await this.prisma.backgroundJob.update({
        where: {
          id: job.id,
        },
        data: {
          bullmqJobId,
          status: BackgroundJobStatus.QUEUED,
          errorMessage: null,
          maxAttempts: attempts,
        },
        select: realtimeJobSelect,
      });
      await this.realtimePublisher?.publishBackgroundJobStatus(updatedJob);

      return {
        jobId: job.id,
        bullmqJobId,
        queueName: getBullmqQueueName(job.queue),
      };
    } catch (error) {
      const message = getJobErrorMessage(error);

      const updatedJob = await this.prisma.backgroundJob.update({
        where: {
          id: job.id,
        },
        data: {
          status: BackgroundJobStatus.FAILED,
          errorMessage: `Không enqueue được BullMQ job: ${message}`,
          finishedAt: new Date(),
        },
        select: realtimeJobSelect,
      });
      await this.realtimePublisher?.publishBackgroundJobStatus(updatedJob);

      this.logger.error(
        `Failed to enqueue background job ${job.id} on ${job.queue}: ${message}`,
      );
      throwInternalServerError(
        "BACKGROUND_JOB_ENQUEUE_FAILED",
        "Không thể đưa job vào hàng đợi xử lý",
        {
          jobId: job.id,
          queue: job.queue,
        },
      );
    }
  }

  async enqueueMany(jobIds: string[]) {
    const results = [];

    for (const jobId of jobIds) {
      results.push(await this.enqueue(jobId));
    }

    return results;
  }

  async onModuleDestroy() {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
  }

  protected createQueue(queue: BackgroundJobQueue): BullmqQueueClient {
    return new Queue<BackgroundJobBullmqData, BackgroundJobBullmqResult>(
      getBullmqQueueName(queue),
      {
        connection: this.redisConnection,
        skipWaitingForReady: true,
      },
    );
  }

  private getQueue(queue: BackgroundJobQueue) {
    const existingQueue = this.queues.get(queue);

    if (existingQueue) {
      return existingQueue;
    }

    const bullmqQueue = this.createQueue(queue);
    this.queues.set(queue, bullmqQueue);
    return bullmqQueue;
  }

  private resolveDelay(availableAt: Date | null) {
    if (!availableAt) {
      return 0;
    }

    return Math.max(availableAt.getTime() - Date.now(), 0);
  }
}

const realtimeJobSelect = {
  id: true,
  lessonId: true,
  ownerUserId: true,
  queue: true,
  status: true,
  attempts: true,
  resourceType: true,
  resourceId: true,
  updatedAt: true,
} as const;
