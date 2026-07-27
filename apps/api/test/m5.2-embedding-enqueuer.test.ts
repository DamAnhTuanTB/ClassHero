import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import {
  AiGenerationStatus,
  BackgroundJobQueue,
  BackgroundJobStatus,
  DocumentStatus,
} from "@prisma/client";
import type { Job, Queue } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "#api/common/prisma/prisma.service";
import type { EnvConfig } from "#api/config/env.validation";
import type {
  BackgroundJobBullmqData,
  BackgroundJobBullmqResult,
} from "#api/jobs/background-job-queues";
import type { AiService } from "#api/modules/ai/services/ai.service";
import { EmbeddingJobEnqueuer } from "#api/workers/services/embedding-job-enqueuer.service";

function createPrismaMock() {
  const durableJob = {
    id: "embedding-job-1",
    status: BackgroundJobStatus.QUEUED,
  };

  return {
    lessonDocument: {
      findFirst: vi.fn(async () => ({
        id: "lesson-document-1",
        chunkCount: 2,
        processedAt: new Date("2026-07-27T00:00:00.000Z"),
        updatedAt: new Date("2026-07-27T00:00:00.000Z"),
      })),
      update: vi.fn(async () => ({ id: "lesson-document-1" })),
    },
    backgroundJob: {
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => null),
      findUniqueOrThrow: vi.fn(async () => durableJob),
      create: vi.fn(async () => durableJob),
      update: vi.fn(async () => durableJob),
    },
    aiGeneration: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: "ai-generation-1" })),
      update: vi.fn(async () => ({ id: "ai-generation-1" })),
    },
  };
}

function createQueueMock() {
  return {
    getJob: vi.fn(async () => undefined),
    add: vi.fn(async () => ({ id: "embedding-job-1" })),
    close: vi.fn(async () => undefined),
  };
}

function createService(params?: {
  prisma?: ReturnType<typeof createPrismaMock>;
  queue?: ReturnType<typeof createQueueMock>;
}) {
  const prisma = params?.prisma ?? createPrismaMock();
  const queue = params?.queue ?? createQueueMock();
  const configService = {
    get: vi.fn((key: keyof EnvConfig) =>
      key === "REDIS_URL" ? "redis://localhost:6379" : undefined,
    ),
  } as unknown as ConfigService<EnvConfig, true>;
  const aiService = {
    getEmbeddingConfig: vi.fn(() => ({
      provider: "OPENAI",
      model: "text-embedding-3-small",
      dimensions: 1536,
    })),
  } as unknown as AiService;
  const service = new EmbeddingJobEnqueuer(
    prisma as unknown as PrismaService,
    configService,
    aiService,
  );
  Reflect.set(
    service,
    "queue",
    queue as unknown as Queue<BackgroundJobBullmqData, BackgroundJobBullmqResult>,
  );

  return { service, prisma, queue };
}

describe("EmbeddingJobEnqueuer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates durable and AI generation rows before enqueueing BullMQ", async () => {
    const { service, prisma, queue } = createService();

    await expect(
      service.enqueueEmbeddingJob({
        lessonId: "lesson-1",
        lessonDocumentId: "lesson-document-1",
        ownerUserId: "admin-1",
      }),
    ).resolves.toEqual({ jobId: "embedding-job-1" });

    expect(prisma.backgroundJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        queue: BackgroundJobQueue.EMBEDDING,
        status: BackgroundJobStatus.QUEUED,
        idempotencyKey: "embedding:lesson-document-1:2026-07-27T00:00:00.000Z",
      }),
    });
    expect(prisma.aiGeneration.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: AiGenerationStatus.QUEUED,
        backgroundJobId: "embedding-job-1",
        targetId: "lesson-document-1",
      }),
      select: { id: true },
    });
    expect(queue.add).toHaveBeenCalledWith(
      "embedding",
      { backgroundJobId: "embedding-job-1" },
      expect.objectContaining({
        jobId: "embedding-job-1",
        attempts: 3,
      }),
    );
    expect(prisma.lessonDocument.update).toHaveBeenCalledWith({
      where: { id: "lesson-document-1" },
      data: {
        status: DocumentStatus.PROCESSING,
        extractError: null,
      },
    });
  });

  it("reuses an active durable job that is already in BullMQ", async () => {
    const prisma = createPrismaMock();
    prisma.backgroundJob.findFirst.mockResolvedValueOnce({
      id: "active-job-1",
      bullmqJobId: "active-bullmq-1",
    });
    const { service, queue } = createService({ prisma });

    await expect(
      service.enqueueEmbeddingJob({
        lessonId: "lesson-1",
        lessonDocumentId: "lesson-document-1",
      }),
    ).resolves.toEqual({ jobId: "active-job-1" });
    expect(queue.add).not.toHaveBeenCalled();
    expect(prisma.backgroundJob.create).not.toHaveBeenCalled();
    expect(prisma.lessonDocument.update).toHaveBeenCalledWith({
      where: { id: "lesson-document-1" },
      data: {
        status: DocumentStatus.PROCESSING,
        extractError: null,
      },
    });
  });

  it("marks durable and AI generation rows failed when BullMQ enqueue fails", async () => {
    const queue = createQueueMock();
    queue.add.mockRejectedValueOnce(new Error("Redis unavailable"));
    const { service, prisma } = createService({ queue });

    await expect(
      service.enqueueEmbeddingJob({
        lessonId: "lesson-1",
        lessonDocumentId: "lesson-document-1",
      }),
    ).rejects.toThrow("Redis unavailable");

    expect(prisma.backgroundJob.update).toHaveBeenCalledWith({
      where: { id: "embedding-job-1" },
      data: expect.objectContaining({
        status: BackgroundJobStatus.FAILED,
        errorMessage: expect.stringContaining("Redis unavailable"),
      }),
    });
    expect(prisma.aiGeneration.update).toHaveBeenCalledWith({
      where: { id: "ai-generation-1" },
      data: expect.objectContaining({
        status: AiGenerationStatus.FAILED,
        errorMessage: "Redis unavailable",
      }),
    });
    expect(prisma.lessonDocument.update).toHaveBeenLastCalledWith({
      where: { id: "lesson-document-1" },
      data: {
        status: DocumentStatus.FAILED,
        extractError: "Không enqueue được embedding job: Redis unavailable",
      },
    });
  });

  it("rejects documents without chunks before creating a job", async () => {
    const prisma = createPrismaMock();
    prisma.lessonDocument.findFirst.mockResolvedValueOnce({
      id: "lesson-document-1",
      chunkCount: 0,
      processedAt: new Date("2026-07-27T00:00:00.000Z"),
      updatedAt: new Date("2026-07-27T00:00:00.000Z"),
    });
    const { service } = createService({ prisma });

    await expect(
      service.enqueueEmbeddingJob({
        lessonId: "lesson-1",
        lessonDocumentId: "lesson-document-1",
      }),
    ).rejects.toThrow("without chunks");
    expect(prisma.backgroundJob.create).not.toHaveBeenCalled();
  });

  it("removes a retained failed BullMQ job before requeueing", async () => {
    const prisma = createPrismaMock();
    prisma.backgroundJob.findUnique.mockResolvedValueOnce({
      id: "embedding-job-1",
      status: BackgroundJobStatus.FAILED,
    });
    const remove = vi.fn(async () => undefined);
    const retainedJob = {
      getState: vi.fn(async () => "failed"),
      remove,
    } as unknown as Job<BackgroundJobBullmqData, BackgroundJobBullmqResult>;
    const queue = createQueueMock();
    queue.getJob.mockResolvedValueOnce(retainedJob);
    const { service } = createService({ prisma, queue });

    await service.enqueueEmbeddingJob({
      lessonId: "lesson-1",
      lessonDocumentId: "lesson-document-1",
    });

    expect(remove).toHaveBeenCalledTimes(1);
    expect(prisma.backgroundJob.update).toHaveBeenCalledWith({
      where: { id: "embedding-job-1" },
      data: expect.objectContaining({
        status: BackgroundJobStatus.QUEUED,
        attempts: 0,
      }),
    });
  });
});
