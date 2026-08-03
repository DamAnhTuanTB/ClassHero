import "reflect-metadata";
import {
  AiGenerationStatus,
  AiGenerationType,
  BackgroundJobQueue,
  BackgroundJobStatus,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "#api/common/prisma/prisma.service";
import { AiGenerationJobService } from "#api/modules/ai/services/ai-generation-job.service";
import type { BackgroundJobQueueService } from "#api/modules/jobs/services/background-job-queue.service";

function createPrismaMock() {
  const transaction = {
    backgroundJob: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: "background-ai-1" })),
    },
    aiGeneration: {
      create: vi.fn(async () => ({ id: "ai-generation-1" })),
    },
  };
  return {
    transaction,
    client: {
      $transaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
      ),
      aiGeneration: {
        update: vi.fn(async (input: unknown) => input),
      },
    },
  };
}

function makeInput() {
  return {
    type: AiGenerationType.SUMMARY,
    createdByUserId: "00000000-0000-4000-8000-000000000001",
    lessonId: "00000000-0000-4000-8000-000000000002",
    targetType: "LESSON",
    targetId: "00000000-0000-4000-8000-000000000002",
    promptVersion: "summary-v1",
    schemaVersion: "summary-v1",
    inputFingerprint: { lessonId: "lesson-1", chunkIds: ["chunk-1"] },
    inputMeta: { action: "SUMMARY", chunkCount: 1 },
    idempotencyKey: "summary:lesson-1:v1",
  };
}

describe("M9.1 AI generation job service", () => {
  it("creates the durable background job and AI log before enqueue", async () => {
    const prisma = createPrismaMock();
    const queue = { enqueue: vi.fn(async () => undefined) };
    const service = new AiGenerationJobService(
      prisma.client as unknown as PrismaService,
      queue as unknown as BackgroundJobQueueService,
    );

    await expect(service.createAndEnqueue(makeInput())).resolves.toEqual({
      backgroundJobId: "background-ai-1",
      aiGenerationId: "ai-generation-1",
      status: BackgroundJobStatus.QUEUED,
      created: true,
    });
    expect(prisma.transaction.backgroundJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        queue: BackgroundJobQueue.AI_GENERATION,
        status: BackgroundJobStatus.QUEUED,
        idempotencyKey: "summary:lesson-1:v1",
      }),
      select: { id: true },
    });
    expect(prisma.transaction.aiGeneration.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: AiGenerationStatus.QUEUED,
        backgroundJobId: "background-ai-1",
        inputHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
      select: { id: true },
    });
    expect(queue.enqueue).toHaveBeenCalledWith("background-ai-1");
  });

  it("reuses an existing idempotent pair without enqueueing twice", async () => {
    const prisma = createPrismaMock();
    prisma.transaction.backgroundJob.findUnique.mockResolvedValueOnce({
      id: "background-existing",
      status: BackgroundJobStatus.RUNNING,
      aiGenerations: [{ id: "ai-existing" }],
    } as never);
    const queue = { enqueue: vi.fn(async () => undefined) };
    const service = new AiGenerationJobService(
      prisma.client as unknown as PrismaService,
      queue as unknown as BackgroundJobQueueService,
    );

    await expect(service.createAndEnqueue(makeInput())).resolves.toEqual({
      backgroundJobId: "background-existing",
      aiGenerationId: "ai-existing",
      status: BackgroundJobStatus.RUNNING,
      created: false,
    });
    expect(prisma.transaction.backgroundJob.create).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("marks the AI log failed when BullMQ enqueue fails", async () => {
    const prisma = createPrismaMock();
    const queue = {
      enqueue: vi.fn(async () => {
        throw new Error("Redis unavailable");
      }),
    };
    const service = new AiGenerationJobService(
      prisma.client as unknown as PrismaService,
      queue as unknown as BackgroundJobQueueService,
    );

    await expect(service.createAndEnqueue(makeInput())).rejects.toThrow(
      "Redis unavailable",
    );
    expect(prisma.client.aiGeneration.update).toHaveBeenCalledWith({
      where: { id: "ai-generation-1" },
      data: expect.objectContaining({
        status: AiGenerationStatus.FAILED,
        finishedAt: expect.any(Date),
      }),
    });
  });
});
