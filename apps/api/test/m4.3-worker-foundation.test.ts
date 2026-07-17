import "reflect-metadata";
import { InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  BackgroundJobQueue,
  BackgroundJobStatus,
  Prisma,
} from "@prisma/client";
import { Job, UnrecoverableError, type JobsOptions } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "#api/common/prisma/prisma.service";
import type { EnvConfig } from "#api/config/env.validation";
import {
  type BackgroundJobBullmqData,
  type BackgroundJobBullmqResult,
  getBullmqQueueName,
} from "#api/jobs/background-job-queues";
import { parseRedisConnection } from "#api/jobs/redis-connection";
import { BackgroundJobQueueService } from "#api/modules/jobs/services/background-job-queue.service";
import { DocumentProcessingProcessor } from "#api/workers/processors/document-processing.processor";

describe("M4.3 BullMQ worker foundation", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("maps durable job queues to BullMQ queue names", () => {
    expect(getBullmqQueueName(BackgroundJobQueue.DOCUMENT_PROCESSING)).toBe(
      "document-processing",
    );
    expect(getBullmqQueueName(BackgroundJobQueue.AI_GENERATION)).toBe(
      "ai-generation",
    );
  });

  it("parses Redis URLs for BullMQ connection options", () => {
    expect(parseRedisConnection("redis://:secret@localhost:6379/2")).toMatchObject({
      host: "localhost",
      port: 6379,
      password: "secret",
      db: 2,
    });
    expect(parseRedisConnection("rediss://redis.example.com")).toMatchObject({
      host: "redis.example.com",
      port: 6379,
      tls: {},
    });
  });

  it("enqueues a durable background job and stores the BullMQ id", async () => {
    const prisma = createQueuePrismaMock({
      id: "durable-job-1",
      queue: BackgroundJobQueue.DOCUMENT_PROCESSING,
      status: BackgroundJobStatus.QUEUED,
      maxAttempts: 3,
      availableAt: null,
    });
    const config = createConfigServiceMock();
    const queueAdd = vi.fn(
      async (
        _name: string,
        _data: BackgroundJobBullmqData,
        _opts: JobsOptions,
      ) => ({ id: "bullmq-job-1" }),
    );
    const service = new TestBackgroundJobQueueService(config, prisma, queueAdd);

    await expect(service.enqueue("durable-job-1")).resolves.toEqual({
      jobId: "durable-job-1",
      bullmqJobId: "bullmq-job-1",
      queueName: "document-processing",
    });

    expect(queueAdd).toHaveBeenCalledWith(
      "document-processing",
      { backgroundJobId: "durable-job-1" },
      expect.objectContaining({
        jobId: "durable-job-1",
        attempts: 3,
      }),
    );
    expect(prisma.backgroundJob.update).toHaveBeenCalledWith({
      where: { id: "durable-job-1" },
      data: expect.objectContaining({
        bullmqJobId: "bullmq-job-1",
        status: BackgroundJobStatus.QUEUED,
        errorMessage: null,
      }),
    });
  });

  it("marks the durable job failed when BullMQ enqueue fails", async () => {
    const prisma = createQueuePrismaMock({
      id: "durable-job-2",
      queue: BackgroundJobQueue.DOCUMENT_PROCESSING,
      status: BackgroundJobStatus.QUEUED,
      maxAttempts: 3,
      availableAt: null,
    });
    const config = createConfigServiceMock();
    const queueAdd = vi.fn(async () => {
      throw new Error("Redis unavailable");
    });
    const service = new TestBackgroundJobQueueService(config, prisma, queueAdd);

    await expect(service.enqueue("durable-job-2")).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );

    expect(prisma.backgroundJob.update).toHaveBeenCalledWith({
      where: { id: "durable-job-2" },
      data: expect.objectContaining({
        status: BackgroundJobStatus.FAILED,
        errorMessage: "Không enqueue được BullMQ job: Redis unavailable",
      }),
    });
  });

  it("processes a document job and updates durable status lifecycle", async () => {
    const prisma = createProcessorPrismaMock();
    const processor = new DocumentProcessingProcessor(prisma);
    const job = createBullmqJob({
      id: "bullmq-job-3",
      data: { backgroundJobId: "durable-job-3" },
      attemptsMade: 0,
      opts: { attempts: 3 },
    });

    const result = await processor.process(job);

    expect(result).toMatchObject({
      status: "SUCCEEDED",
      queue: BackgroundJobQueue.DOCUMENT_PROCESSING,
      resourceType: "SOURCE_DOCUMENT",
      resourceId: "source-document-1",
      action: "SOURCE_PAGE_EXTRACTION",
    });
    expect(prisma.backgroundJob.update).toHaveBeenNthCalledWith(1, {
      where: { id: "durable-job-3" },
      data: expect.objectContaining({
        status: BackgroundJobStatus.RUNNING,
        bullmqJobId: "bullmq-job-3",
        attempts: 1,
        errorMessage: null,
      }),
      select: expect.any(Object),
    });
    expect(prisma.backgroundJob.update).toHaveBeenNthCalledWith(2, {
      where: { id: "durable-job-3" },
      data: expect.objectContaining({
        status: BackgroundJobStatus.SUCCEEDED,
        errorMessage: null,
        result: expect.objectContaining({
          status: "SUCCEEDED",
          action: "SOURCE_PAGE_EXTRACTION",
        }),
      }),
    });
  });

  it("does not retry BullMQ jobs without a durable background job row", async () => {
    const prisma = {
      backgroundJob: {
        findUnique: vi.fn(async () => null),
        update: vi.fn(),
      },
    } as unknown as PrismaService;
    const processor = new DocumentProcessingProcessor(prisma);

    await expect(
      processor.process(
        createBullmqJob({
          id: "missing-bullmq-job",
          data: { backgroundJobId: "missing-durable-job" },
          attemptsMade: 0,
          opts: { attempts: 3 },
        }),
      ),
    ).rejects.toBeInstanceOf(UnrecoverableError);
  });
});

class TestBackgroundJobQueueService extends BackgroundJobQueueService {
  constructor(
    configService: ConfigService<EnvConfig, true>,
    prisma: PrismaService,
    private readonly queueAdd: (
      name: string,
      data: BackgroundJobBullmqData,
      opts: JobsOptions,
    ) => Promise<{ id?: string | number }>,
  ) {
    super(configService, prisma);
  }

  protected override createQueue(_queue: BackgroundJobQueue) {
    return {
      add: this.queueAdd,
      close: vi.fn(async () => undefined),
    };
  }
}

function createConfigServiceMock() {
  return {
    get: vi.fn((key: keyof EnvConfig) => {
      if (key === "REDIS_URL") {
        return "redis://localhost:6379";
      }

      return undefined;
    }),
  } as unknown as ConfigService<EnvConfig, true>;
}

function createQueuePrismaMock(job: {
  id: string;
  queue: BackgroundJobQueue;
  status: BackgroundJobStatus;
  maxAttempts: number;
  availableAt: Date | null;
}) {
  return {
    backgroundJob: {
      findUnique: vi.fn(async () => job),
      update: vi.fn(async (input: unknown) => input),
    },
  } as unknown as PrismaService & {
    backgroundJob: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
}

function createProcessorPrismaMock() {
  const record = {
    id: "durable-job-3",
    queue: BackgroundJobQueue.DOCUMENT_PROCESSING,
    status: BackgroundJobStatus.QUEUED,
    resourceType: "SOURCE_DOCUMENT",
    resourceId: "source-document-1",
    inputMeta: {
      action: "SOURCE_PAGE_EXTRACTION",
    } satisfies Prisma.InputJsonObject,
    result: null,
    attempts: 0,
    maxAttempts: 3,
  };

  return {
    backgroundJob: {
      findUnique: vi.fn(async () => record),
      update: vi.fn(async (input: { data: Record<string, unknown> }) => ({
        ...record,
        ...input.data,
      })),
    },
  } as unknown as PrismaService & {
    backgroundJob: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
}

function createBullmqJob({
  id,
  data,
  attemptsMade,
  opts,
}: {
  id: string;
  data: BackgroundJobBullmqData;
  attemptsMade: number;
  opts: { attempts: number };
}) {
  return {
    id,
    data,
    attemptsMade,
    opts,
  } as unknown as Job<BackgroundJobBullmqData, BackgroundJobBullmqResult>;
}
