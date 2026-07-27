import "reflect-metadata";
import { Test, type TestingModule } from "@nestjs/testing";
import {
  AiGenerationStatus,
  AiProviderName,
  BackgroundJobQueue,
  BackgroundJobStatus,
  DocumentStatus,
} from "@prisma/client";
import { type Job, UnrecoverableError } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "#api/common/prisma/prisma.service";
import type {
  BackgroundJobBullmqData,
  BackgroundJobBullmqResult,
} from "#api/jobs/background-job-queues";
import { AiService } from "#api/modules/ai/services/ai.service";
import { EmbeddingProcessor } from "#api/workers/processors/embedding.processor";

function makeBackgroundJob(
  overrides: Partial<ReturnType<typeof makeBackgroundJobRecord>> = {},
) {
  return {
    ...makeBackgroundJobRecord(),
    ...overrides,
  };
}

function makeBackgroundJobRecord() {
  return {
    id: "job-1",
    queue: BackgroundJobQueue.EMBEDDING,
    status: BackgroundJobStatus.QUEUED,
    lessonId: "lesson-1",
    resourceType: "lesson_document",
    resourceId: "lesson-doc-1",
    inputMeta: {
      action: "EMBEDDING",
      lessonId: "lesson-1",
      lessonDocumentId: "lesson-doc-1",
    },
    result: null,
    attempts: 0,
    maxAttempts: 3,
  };
}

function makeChunks(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `chunk-${index}`,
    content: `Content for chunk ${index}`,
    chunkIndex: index,
  }));
}

function makeBullmqJob(params?: {
  backgroundJobId?: string;
  attemptsMade?: number;
  attempts?: number;
}) {
  const backgroundJobId = params?.backgroundJobId ?? "job-1";
  return {
    data: { backgroundJobId },
    id: `bullmq-${backgroundJobId}`,
    attemptsMade: params?.attemptsMade ?? 0,
    opts: { attempts: params?.attempts ?? 3 },
  } as unknown as Job<BackgroundJobBullmqData, BackgroundJobBullmqResult>;
}

function createPrismaMock() {
  return {
    backgroundJob: {
      findUnique: vi.fn(),
      update: vi.fn(async (input: unknown) => input),
    },
    lessonDocument: {
      findFirst: vi.fn(async () => ({
        id: "lesson-doc-1",
        chunkCount: 3,
      })),
      update: vi.fn(async (input: unknown) => input),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    aiGeneration: {
      findFirst: vi.fn(async () => ({
        id: "ai-generation-1",
        startedAt: null,
      })),
      create: vi.fn(async () => ({ id: "ai-generation-1" })),
      update: vi.fn(async () => ({ id: "ai-generation-1" })),
    },
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(async () => 1),
  };
}

function createAiServiceMock() {
  return {
    isProviderAvailable: vi.fn(() => true),
    createEmbedding: vi.fn(async () => ({
      vectors: [] as number[][],
      model: "text-embedding-3-small",
      dimensions: 1536,
      usage: { promptTokens: 10, totalTokens: 10 },
    })),
    getEmbeddingConfig: vi.fn(() => ({
      provider: AiProviderName.OPENAI,
      model: "text-embedding-3-small",
      dimensions: 1536,
    })),
  };
}

describe("EmbeddingProcessor", () => {
  let processor: EmbeddingProcessor;
  let prisma: ReturnType<typeof createPrismaMock>;
  let aiService: ReturnType<typeof createAiServiceMock>;

  beforeEach(async () => {
    prisma = createPrismaMock();
    aiService = createAiServiceMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingProcessor,
        { provide: PrismaService, useValue: prisma },
        { provide: AiService, useValue: aiService },
      ],
    }).compile();

    processor = module.get(EmbeddingProcessor);
  });

  it("skips a durable job that already succeeded", async () => {
    prisma.backgroundJob.findUnique.mockResolvedValueOnce(
      makeBackgroundJob({ status: BackgroundJobStatus.SUCCEEDED }),
    );

    await expect(processor.process(makeBullmqJob())).resolves.toMatchObject({
      status: "SKIPPED",
      action: "EMBEDDING",
    });
    expect(prisma.aiGeneration.findFirst).not.toHaveBeenCalled();
  });

  it("marks the document ready when every chunk already has an embedding", async () => {
    prisma.backgroundJob.findUnique.mockResolvedValueOnce(makeBackgroundJob());
    prisma.$queryRaw.mockResolvedValueOnce([]);

    await expect(processor.process(makeBullmqJob())).resolves.toMatchObject({
      status: "SKIPPED",
      message: "All chunks already have embeddings",
    });

    expect(prisma.lessonDocument.update).toHaveBeenLastCalledWith({
      where: { id: "lesson-doc-1" },
      data: expect.objectContaining({
        status: DocumentStatus.READY,
        embeddingProvider: AiProviderName.OPENAI,
        embeddingModel: "text-embedding-3-small",
        embeddingDimensions: 1536,
      }),
    });
    expect(prisma.aiGeneration.update).toHaveBeenCalledWith({
      where: { id: "ai-generation-1" },
      data: expect.objectContaining({
        status: AiGenerationStatus.SUCCEEDED,
        totalTokens: 0,
      }),
    });
  });

  it("embeds chunks, persists vectors and records usage", async () => {
    const chunks = makeChunks(3);
    prisma.backgroundJob.findUnique.mockResolvedValueOnce(makeBackgroundJob());
    prisma.$queryRaw.mockResolvedValueOnce(chunks);
    aiService.createEmbedding.mockResolvedValueOnce({
      vectors: chunks.map(() => new Array(1536).fill(0.1)),
      model: "text-embedding-3-small",
      dimensions: 1536,
      usage: { promptTokens: 30, totalTokens: 30 },
    });

    await expect(processor.process(makeBullmqJob())).resolves.toMatchObject({
      status: "SUCCEEDED",
      details: {
        embeddedCount: 3,
        totalTokens: 30,
      },
    });

    expect(aiService.createEmbedding).toHaveBeenCalledWith({
      texts: chunks.map((chunk) => chunk.content),
    });
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(3);
    expect(prisma.lessonDocument.update).toHaveBeenLastCalledWith({
      where: { id: "lesson-doc-1" },
      data: expect.objectContaining({
        status: DocumentStatus.READY,
        embeddingProvider: AiProviderName.OPENAI,
        embeddingModel: "text-embedding-3-small",
        embeddingDimensions: 1536,
      }),
    });
    expect(prisma.aiGeneration.update).toHaveBeenCalledWith({
      where: { id: "ai-generation-1" },
      data: expect.objectContaining({
        status: AiGenerationStatus.SUCCEEDED,
        promptTokens: 30,
        totalTokens: 30,
      }),
    });
  });

  it("batches large chunk sets", async () => {
    const chunks = makeChunks(120);
    prisma.backgroundJob.findUnique.mockResolvedValueOnce(makeBackgroundJob());
    prisma.$queryRaw.mockResolvedValueOnce(chunks);

    for (const batchSize of [50, 50, 20]) {
      aiService.createEmbedding.mockResolvedValueOnce({
        vectors: Array.from({ length: batchSize }, () =>
          new Array(1536).fill(0.1),
        ),
        model: "text-embedding-3-small",
        dimensions: 1536,
        usage: {
          promptTokens: batchSize * 10,
          totalTokens: batchSize * 10,
        },
      });
    }

    await expect(processor.process(makeBullmqJob())).resolves.toMatchObject({
      status: "SUCCEEDED",
    });
    expect(aiService.createEmbedding).toHaveBeenCalledTimes(3);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(120);
  });

  it("returns a transient failure to QUEUED for BullMQ retry", async () => {
    prisma.backgroundJob.findUnique.mockResolvedValueOnce(makeBackgroundJob());
    prisma.$queryRaw.mockResolvedValueOnce(makeChunks(1));
    aiService.createEmbedding.mockRejectedValueOnce(
      new Error("OpenAI temporarily unavailable"),
    );

    await expect(processor.process(makeBullmqJob())).rejects.toThrow(
      "OpenAI temporarily unavailable",
    );

    expect(prisma.backgroundJob.update).toHaveBeenLastCalledWith({
      where: { id: "job-1" },
      data: expect.objectContaining({
        status: BackgroundJobStatus.QUEUED,
        finishedAt: null,
      }),
    });
    expect(prisma.aiGeneration.update).toHaveBeenLastCalledWith({
      where: { id: "ai-generation-1" },
      data: expect.objectContaining({
        status: AiGenerationStatus.QUEUED,
      }),
    });
    expect(prisma.lessonDocument.updateMany).toHaveBeenCalledWith({
      where: {
        id: "lesson-doc-1",
        lessonId: "lesson-1",
        replacedAt: null,
      },
      data: expect.objectContaining({
        status: DocumentStatus.PROCESSING,
      }),
    });
  });

  it("marks the job, generation and document failed on the final attempt", async () => {
    prisma.backgroundJob.findUnique.mockResolvedValueOnce(makeBackgroundJob());
    prisma.$queryRaw.mockResolvedValueOnce(makeChunks(1));
    aiService.createEmbedding.mockRejectedValueOnce(
      new Error("OpenAI unavailable"),
    );

    await expect(
      processor.process(makeBullmqJob({ attemptsMade: 2, attempts: 3 })),
    ).rejects.toThrow("OpenAI unavailable");

    expect(prisma.backgroundJob.update).toHaveBeenLastCalledWith({
      where: { id: "job-1" },
      data: expect.objectContaining({
        status: BackgroundJobStatus.FAILED,
        finishedAt: expect.any(Date),
      }),
    });
    expect(prisma.aiGeneration.update).toHaveBeenLastCalledWith({
      where: { id: "ai-generation-1" },
      data: expect.objectContaining({
        status: AiGenerationStatus.FAILED,
        finishedAt: expect.any(Date),
      }),
    });
    expect(prisma.lessonDocument.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: "lesson-doc-1" }),
      data: expect.objectContaining({
        status: DocumentStatus.FAILED,
      }),
    });
  });

  it("treats a missing provider as unrecoverable", async () => {
    prisma.backgroundJob.findUnique.mockResolvedValueOnce(makeBackgroundJob());
    aiService.isProviderAvailable.mockReturnValueOnce(false);

    await expect(processor.process(makeBullmqJob())).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(prisma.backgroundJob.update).toHaveBeenLastCalledWith({
      where: { id: "job-1" },
      data: expect.objectContaining({
        status: BackgroundJobStatus.FAILED,
      }),
    });
  });

  it("rejects a job assigned to another queue", async () => {
    prisma.backgroundJob.findUnique.mockResolvedValueOnce(
      makeBackgroundJob({ queue: BackgroundJobQueue.DOCUMENT_PROCESSING }),
    );

    await expect(processor.process(makeBullmqJob())).rejects.toThrow(
      "not EMBEDDING",
    );
  });

  it("rejects missing lesson document metadata without retrying", async () => {
    prisma.backgroundJob.findUnique.mockResolvedValueOnce(
      makeBackgroundJob({ inputMeta: { action: "EMBEDDING" } }),
    );

    await expect(processor.process(makeBullmqJob())).rejects.toThrow(
      "missing lessonDocumentId",
    );
    expect(prisma.backgroundJob.update).toHaveBeenLastCalledWith({
      where: { id: "job-1" },
      data: expect.objectContaining({
        status: BackgroundJobStatus.FAILED,
      }),
    });
  });

  it("rejects a lesson document from another lesson", async () => {
    prisma.backgroundJob.findUnique.mockResolvedValueOnce(makeBackgroundJob());
    prisma.lessonDocument.findFirst.mockResolvedValueOnce(null);

    await expect(processor.process(makeBullmqJob())).rejects.toThrow(
      "was not found in lesson lesson-1",
    );
  });

  it("rejects a provider response with a missing vector", async () => {
    prisma.backgroundJob.findUnique.mockResolvedValueOnce(makeBackgroundJob());
    prisma.$queryRaw.mockResolvedValueOnce(makeChunks(2));
    aiService.createEmbedding.mockResolvedValueOnce({
      vectors: [new Array(1536).fill(0.1)],
      model: "text-embedding-3-small",
      dimensions: 1536,
      usage: { promptTokens: 10, totalTokens: 10 },
    });

    await expect(processor.process(makeBullmqJob())).rejects.toThrow(
      "returned 1 vectors for 2 inputs",
    );
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });
});
