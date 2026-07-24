import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import {
  AiProviderName,
  BackgroundJobQueue,
  BackgroundJobStatus,
} from "@prisma/client";

import { EmbeddingProcessor } from "#api/workers/processors/embedding.processor";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { AiService } from "#api/modules/ai/services/ai.service";

// Helpers
function makeBackgroundJob(overrides = {}) {
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
    ...overrides,
  };
}

function makeChunks(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `chunk-${i}`,
    content: `Content for chunk ${i}`,
    chunkIndex: i,
  }));
}

function makeBullmqJob(backgroundJobId = "job-1") {
  return {
    data: { backgroundJobId },
    id: `bullmq-${backgroundJobId}`,
    attemptsMade: 0,
    opts: { attempts: 3 },
  } as any;
}

describe("EmbeddingProcessor", () => {
  let processor: EmbeddingProcessor;
  let mockPrisma: any;
  let mockAiService: any;

  beforeEach(async () => {
    mockPrisma = {
      backgroundJob: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      lessonDocument: {
        update: vi.fn(),
      },
      aiGeneration: {
        create: vi.fn(),
      },
      $queryRaw: vi.fn(),
      $executeRaw: vi.fn(),
    };

    mockAiService = {
      isProviderAvailable: vi.fn().mockReturnValue(true),
      createEmbedding: vi.fn().mockResolvedValue({
        vectors: [],
        model: "text-embedding-3-small",
        dimensions: 1536,
        usage: { promptTokens: 10, totalTokens: 10 },
      }),
      getEmbeddingConfig: vi.fn().mockReturnValue({
        model: "text-embedding-3-small",
        dimensions: 1536,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AiService, useValue: mockAiService },
      ],
    }).compile();

    processor = module.get<EmbeddingProcessor>(EmbeddingProcessor);
  });

  describe("process", () => {
    it("should skip if job already succeeded", async () => {
      mockPrisma.backgroundJob.findUnique.mockResolvedValueOnce(
        makeBackgroundJob({ status: BackgroundJobStatus.SUCCEEDED }),
      );

      const result = await processor.process(makeBullmqJob());
      expect(result.status).toBe("SKIPPED");
    });

    it("should skip if no chunks need embedding", async () => {
      const job = makeBackgroundJob();
      mockPrisma.backgroundJob.findUnique.mockResolvedValueOnce(job);
      mockPrisma.backgroundJob.update.mockResolvedValue(job);
      mockPrisma.$queryRaw.mockResolvedValueOnce([]); // no chunks

      const result = await processor.process(makeBullmqJob());
      expect(result.status).toBe("SKIPPED");
      expect(result.message).toContain("already have embeddings");
    });

    it("should embed chunks and save vectors", async () => {
      const job = makeBackgroundJob();
      const chunks = makeChunks(3);

      mockPrisma.backgroundJob.findUnique.mockResolvedValueOnce(job);
      mockPrisma.backgroundJob.update.mockResolvedValue(job);
      mockPrisma.$queryRaw.mockResolvedValueOnce(chunks);
      mockPrisma.$executeRaw.mockResolvedValue(1);
      mockPrisma.lessonDocument.update.mockResolvedValue({});
      mockPrisma.aiGeneration.create.mockResolvedValue({});

      // Mock embedding response
      mockAiService.createEmbedding.mockResolvedValueOnce({
        vectors: chunks.map(() => new Array(1536).fill(0.1)),
        model: "text-embedding-3-small",
        dimensions: 1536,
        usage: { promptTokens: 30, totalTokens: 30 },
      });

      const result = await processor.process(makeBullmqJob());

      expect(result.status).toBe("SUCCEEDED");
      expect(mockAiService.createEmbedding).toHaveBeenCalledTimes(1);
      expect(mockAiService.createEmbedding).toHaveBeenCalledWith({
        texts: chunks.map((c) => c.content),
      });
      // 3 chunks = 3 raw SQL updates
      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(3);
      // lesson_documents updated with embedding metadata
      expect(mockPrisma.lessonDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "lesson-doc-1" },
          data: expect.objectContaining({
            embeddingProvider: AiProviderName.OPENAI,
            embeddingModel: "text-embedding-3-small",
            embeddingDimensions: 1536,
          }),
        }),
      );
      // ai_generations log created
      expect(mockPrisma.aiGeneration.create).toHaveBeenCalledTimes(1);
    });

    it("should batch large chunk sets", async () => {
      const job = makeBackgroundJob();
      const chunks = makeChunks(120); // > 50 batch size → 3 batches

      mockPrisma.backgroundJob.findUnique.mockResolvedValueOnce(job);
      mockPrisma.backgroundJob.update.mockResolvedValue(job);
      mockPrisma.$queryRaw.mockResolvedValueOnce(chunks);
      mockPrisma.$executeRaw.mockResolvedValue(1);
      mockPrisma.lessonDocument.update.mockResolvedValue({});
      mockPrisma.aiGeneration.create.mockResolvedValue({});

      // Mock 3 batch responses
      for (let i = 0; i < 3; i++) {
        const batchSize = i < 2 ? 50 : 20;
        mockAiService.createEmbedding.mockResolvedValueOnce({
          vectors: new Array(batchSize)
            .fill(null)
            .map(() => new Array(1536).fill(0.1)),
          model: "text-embedding-3-small",
          dimensions: 1536,
          usage: { promptTokens: batchSize * 10, totalTokens: batchSize * 10 },
        });
      }

      const result = await processor.process(makeBullmqJob());

      expect(result.status).toBe("SUCCEEDED");
      expect(mockAiService.createEmbedding).toHaveBeenCalledTimes(3);
      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(120);
    });

    it("should throw UnrecoverableError if provider not available", async () => {
      const job = makeBackgroundJob();
      mockPrisma.backgroundJob.findUnique.mockResolvedValueOnce(job);
      mockPrisma.backgroundJob.update.mockResolvedValue(job);
      mockAiService.isProviderAvailable.mockReturnValue(false);

      await expect(processor.process(makeBullmqJob())).rejects.toThrow(
        "OpenAI provider is not available",
      );
    });

    it("should throw UnrecoverableError if wrong queue", async () => {
      mockPrisma.backgroundJob.findUnique.mockResolvedValueOnce(
        makeBackgroundJob({ queue: BackgroundJobQueue.DOCUMENT_PROCESSING }),
      );

      await expect(processor.process(makeBullmqJob())).rejects.toThrow(
        "not EMBEDDING",
      );
    });

    it("should throw UnrecoverableError if missing lessonDocumentId", async () => {
      mockPrisma.backgroundJob.findUnique.mockResolvedValueOnce(
        makeBackgroundJob({ inputMeta: { action: "EMBEDDING" } }),
      );
      mockPrisma.backgroundJob.update.mockResolvedValue({});

      await expect(processor.process(makeBullmqJob())).rejects.toThrow(
        "missing lessonDocumentId",
      );
    });
  });
});
