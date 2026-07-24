import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { AiProviderName } from "@prisma/client";

import { RetrievalService } from "#api/modules/ai/services/retrieval.service";
import { AiService } from "#api/modules/ai/services/ai.service";
import { PrismaService } from "#api/common/prisma/prisma.service";

// Helpers
function makeChunkRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "chunk-1",
    document_id: "doc-1",
    lesson_id: "lesson-1",
    content: "Số hữu tỉ là số viết được dưới dạng phân số a/b",
    chunk_index: 0,
    token_count: 100,
    metadata_json: null,
    score: 0.85,
    ...overrides,
  };
}

const mockQueryVector = new Array(1536).fill(0.1);

describe("RetrievalService", () => {
  let service: RetrievalService;
  let mockPrisma: any;
  let mockAiService: any;

  beforeEach(async () => {
    mockPrisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
    };

    mockAiService = {
      createEmbedding: vi.fn().mockResolvedValue({
        vectors: [mockQueryVector],
        model: "text-embedding-3-small",
        dimensions: 1536,
        usage: { promptTokens: 10, totalTokens: 10 },
      }),
      getEmbeddingConfig: vi.fn().mockReturnValue({
        provider: AiProviderName.OPENAI,
        model: "text-embedding-3-small",
        dimensions: 1536,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetrievalService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AiService, useValue: mockAiService },
      ],
    }).compile();

    service = module.get<RetrievalService>(RetrievalService);
  });

  it("should embed query and return matching chunks", async () => {
    const chunks = [
      makeChunkRow({ id: "c1", score: 0.92, chunk_index: 0 }),
      makeChunkRow({ id: "c2", score: 0.78, chunk_index: 1 }),
    ];
    mockPrisma.$queryRaw.mockResolvedValueOnce(chunks);

    const result = await service.retrieveContext({
      lessonId: "lesson-1",
      query: "Số hữu tỉ là gì?",
    });

    // Verify embedding was called with the query
    expect(mockAiService.createEmbedding).toHaveBeenCalledWith({
      texts: ["Số hữu tỉ là gì?"],
    });

    // Verify results
    expect(result.chunks).toHaveLength(2);
    expect(result.chunks[0].chunkId).toBe("c1");
    expect(result.chunks[0].score).toBe(0.92);
    expect(result.chunks[1].chunkId).toBe("c2");
    expect(result.query).toBe("Số hữu tỉ là gì?");
    expect(result.totalTokens).toBe(200); // 100 * 2
    expect(result.searchLatencyMs).toBeGreaterThanOrEqual(0);
  });

  it("should filter chunks below minScore", async () => {
    const chunks = [
      makeChunkRow({ id: "c1", score: 0.85 }),
      makeChunkRow({ id: "c2", score: 0.15 }), // below threshold
      makeChunkRow({ id: "c3", score: 0.10 }), // below threshold
    ];
    mockPrisma.$queryRaw.mockResolvedValueOnce(chunks);

    const result = await service.retrieveContext({
      lessonId: "lesson-1",
      query: "test",
      minScore: 0.25,
    });

    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0].chunkId).toBe("c1");
  });

  it("should use default minScore 0.25", async () => {
    const chunks = [
      makeChunkRow({ id: "c1", score: 0.30 }),
      makeChunkRow({ id: "c2", score: 0.20 }), // below default 0.25
    ];
    mockPrisma.$queryRaw.mockResolvedValueOnce(chunks);

    const result = await service.retrieveContext({
      lessonId: "lesson-1",
      query: "test",
    });

    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0].score).toBe(0.30);
  });

  it("should return empty array if no chunks found", async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([]);

    const result = await service.retrieveContext({
      lessonId: "lesson-no-chunks",
      query: "anything",
    });

    expect(result.chunks).toHaveLength(0);
    expect(result.totalTokens).toBe(0);
  });

  it("should cap topK at maxTopK (20)", async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([]);

    await service.retrieveContext({
      lessonId: "lesson-1",
      query: "test",
      topK: 100, // over max
      includeKeywordSearch: false,
    });

    // Verify SQL was called — the LIMIT in the query should be 20 (maxTopK)
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("should use default topK=6 when not specified", async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([]);

    await service.retrieveContext({
      lessonId: "lesson-1",
      query: "test",
      includeKeywordSearch: false,
    });

    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("should compute totalTokens correctly", async () => {
    const chunks = [
      makeChunkRow({ id: "c1", score: 0.9, token_count: 150 }),
      makeChunkRow({ id: "c2", score: 0.8, token_count: 200 }),
      makeChunkRow({ id: "c3", score: 0.7, token_count: 300 }),
    ];
    mockPrisma.$queryRaw.mockResolvedValueOnce(chunks);

    const result = await service.retrieveContext({
      lessonId: "lesson-1",
      query: "test",
    });

    expect(result.totalTokens).toBe(650); // 150+200+300
  });

  it("should handle null token_count gracefully", async () => {
    const chunks = [
      makeChunkRow({ id: "c1", score: 0.9, token_count: null }),
      makeChunkRow({ id: "c2", score: 0.8, token_count: 200 }),
    ];
    mockPrisma.$queryRaw.mockResolvedValueOnce(chunks);

    const result = await service.retrieveContext({
      lessonId: "lesson-1",
      query: "test",
    });

    expect(result.totalTokens).toBe(200); // 0 + 200
    expect(result.chunks[0].tokenCount).toBe(0);
  });

  it("should preserve original content (LaTeX) in results", async () => {
    const latexContent = "\\frac{a}{b} \\neq 0 \\in \\mathbb{Z}";
    const chunks = [
      makeChunkRow({ id: "c1", score: 0.9, content: latexContent }),
    ];
    mockPrisma.$queryRaw.mockResolvedValueOnce(chunks);

    const result = await service.retrieveContext({
      lessonId: "lesson-1",
      query: "phân số",
    });

    // Content should be the original LaTeX, not stripped
    expect(result.chunks[0].content).toBe(latexContent);
  });

  it("should perform hybrid search and merge results", async () => {
    // Vector search results
    const vectorChunks = [
      makeChunkRow({ id: "c1", score: 0.9 }),
      makeChunkRow({ id: "c2", score: 0.8 }),
    ];
    // Keyword search results
    const keywordChunks = [
      makeChunkRow({ id: "c2", score: 0.5 }), // overlapping, should be boosted
      makeChunkRow({ id: "c3", score: 0.5 }), // keyword only
    ];

    mockPrisma.$queryRaw
      .mockResolvedValueOnce(vectorChunks)
      .mockResolvedValueOnce(keywordChunks);

    const result = await service.retrieveContext({
      lessonId: "lesson-1",
      query: "diện tích là 25 cm²", // has unit, will trigger keyword search
    });

    expect(result.chunks).toHaveLength(3);
    
    // c2 should be boosted from 0.8 -> 0.95 and sorted to top
    expect(result.chunks[0].chunkId).toBe("c2");
    expect(result.chunks[0].score).toBeCloseTo(0.95);
    expect(result.chunks[0].matchSource).toBe("both");

    expect(result.chunks[1].chunkId).toBe("c1");
    expect(result.chunks[1].score).toBe(0.9);
    expect(result.chunks[1].matchSource).toBe("vector");

    expect(result.chunks[2].chunkId).toBe("c3");
    expect(result.chunks[2].score).toBe(0.5);
    expect(result.chunks[2].matchSource).toBe("keyword");

    expect(result.keywordMatchCount).toBe(2);
  });

  it("should cap results based on token budget", async () => {
    const vectorChunks = [
      makeChunkRow({ id: "c1", score: 0.9, token_count: 1500 }),
      makeChunkRow({ id: "c2", score: 0.8, token_count: 1000 }),
      makeChunkRow({ id: "c3", score: 0.7, token_count: 800 }), // this one exceeds 3000 total (1500+1000+800=3300)
    ];

    mockPrisma.$queryRaw
      .mockResolvedValueOnce(vectorChunks)
      .mockResolvedValueOnce([]); // no keywords

    const result = await service.retrieveContext({
      lessonId: "lesson-1",
      query: "test query with some keywords",
      maxContextTokens: 3000,
    });

    expect(result.chunks).toHaveLength(2); // only c1 and c2
    expect(result.totalTokens).toBe(2500);
  });

  it("should bypass keyword search if includeKeywordSearch is false", async () => {
    const vectorChunks = [makeChunkRow({ id: "c1", score: 0.9 })];
    mockPrisma.$queryRaw.mockResolvedValueOnce(vectorChunks);

    const result = await service.retrieveContext({
      lessonId: "lesson-1",
      query: "diện tích là 25 cm²", // normally triggers keyword
      includeKeywordSearch: false,
    });

    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1); // only vector search called
    expect(result.chunks).toHaveLength(1);
    expect(result.keywordMatchCount).toBe(0);
  });
});
