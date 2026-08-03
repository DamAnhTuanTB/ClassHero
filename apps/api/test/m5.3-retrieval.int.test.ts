import "dotenv/config";
import { randomUUID } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import {
  AiProviderName,
  DocumentStatus,
  FileProvider,
  FilePurpose,
  FileStatus,
  FileVisibility,
  PublishStatus,
  UserRole,
  UserStatus,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "#api/common/prisma/prisma.service";
import type { EnvConfig } from "#api/config/env.validation";
import type { AiService } from "#api/modules/ai/services/ai.service";
import { RetrievalService } from "#api/modules/ai/services/retrieval.service";
import { createTestCourseCatalogRelation } from "./helpers/course-catalog-fixture";

const embeddingModel = "text-embedding-3-small";
const embeddingDimensions = 1536;
const queryVector = createUnitVector(0);
const orthogonalVector = createUnitVector(1);
const testRunId = randomUUID();
const ids = {
  user: randomUUID(),
  learningPath: randomUUID(),
  chapter: randomUUID(),
  targetLesson: randomUUID(),
  otherLesson: randomUUID(),
  file: randomUUID(),
  targetDocument: randomUUID(),
  otherLessonDocument: randomUUID(),
  replacedDocument: randomUUID(),
  processingDocument: randomUUID(),
  wrongSpaceDocument: randomUUID(),
  targetChunk: randomUUID(),
  otherLessonChunk: randomUUID(),
  replacedChunk: randomUUID(),
  processingChunk: randomUUID(),
  wrongSpaceChunk: randomUUID(),
  orthogonalChunk: randomUUID(),
};

describe("M5.3 retrieval Postgres integration", () => {
  let prisma: PrismaService;
  let retrievalService: RetrievalService;

  beforeAll(async () => {
    prisma = new PrismaService(new ConfigService() as ConfigService<EnvConfig, true>);
    await prisma.$connect();
    await createFixture(prisma);

    const aiService = {
      getEmbeddingConfig: () => ({
        provider: AiProviderName.OPENAI,
        model: embeddingModel,
        dimensions: embeddingDimensions,
      }),
      createEmbedding: async () => ({
        vectors: [queryVector],
        model: embeddingModel,
        dimensions: embeddingDimensions,
        usage: { promptTokens: 4, totalTokens: 4 },
      }),
    } as unknown as AiService;
    retrievalService = new RetrievalService(prisma, aiService);
  });

  afterAll(async () => {
    await prisma.learningPath.deleteMany({
      where: { id: ids.learningPath },
    });
    await prisma.file.deleteMany({ where: { id: ids.file } });
    await prisma.user.deleteMany({ where: { id: ids.user } });
    await prisma.$disconnect();
  });

  it("does not leak vector results across lessons or inactive documents", async () => {
    const result = await retrievalService.retrieveContext({
      lessonId: ids.targetLesson,
      query: "M5 exact formula alpha",
      topK: 20,
      minScore: 0.25,
      includeKeywordSearch: false,
    });

    expect(result.chunks.map((chunk) => chunk.chunkId)).toEqual([ids.targetChunk]);
    expect(result.chunks.every((chunk) => chunk.lessonId === ids.targetLesson)).toBe(
      true,
    );
    expect(result.chunks.map((chunk) => chunk.chunkId)).not.toContain(
      ids.otherLessonChunk,
    );
    expect(result.chunks.map((chunk) => chunk.chunkId)).not.toContain(ids.replacedChunk);
    expect(result.chunks.map((chunk) => chunk.chunkId)).not.toContain(
      ids.processingChunk,
    );
    expect(result.chunks.map((chunk) => chunk.chunkId)).not.toContain(
      ids.wrongSpaceChunk,
    );
  });

  it("keeps hybrid keyword matches inside the same active lesson", async () => {
    const result = await retrievalService.retrieveContext({
      lessonId: ids.targetLesson,
      query: "M5 exact formula alpha",
      topK: 20,
      minScore: 0.25,
      includeKeywordSearch: true,
    });

    expect(result.chunks.map((chunk) => chunk.chunkId)).toEqual([ids.targetChunk]);
    expect(result.chunks[0]?.matchSource).toBe("both");
    expect(result.keywordMatchCount).toBe(1);
  });

  it("has the required cosine HNSW index", async () => {
    const rows = await prisma.$queryRaw<Array<{ indexdef: string }>>`
      SELECT indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'document_chunks'
        AND indexname = 'idx_document_chunks_embedding_hnsw'
    `;

    expect(rows).toHaveLength(1);
    expect(rows[0]?.indexdef).toContain("USING hnsw");
    expect(rows[0]?.indexdef).toContain("vector_cosine_ops");
  });
});

async function createFixture(prisma: PrismaService) {
  await prisma.user.create({
    data: {
      id: ids.user,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      email: `m5-retrieval-${testRunId}@example.com`,
      username: `m5_retrieval_${testRunId.slice(0, 8)}`,
      passwordHash: "test-only",
    },
  });
  const courseCatalog = await createTestCourseCatalogRelation(prisma, 7);
  await prisma.learningPath.create({
    data: {
      id: ids.learningPath,
      ...courseCatalog,
      title: "M5 retrieval fixture",
      slug: `m5-retrieval-${testRunId}`,
      originalPriceVnd: 100_000,
      status: PublishStatus.PUBLISHED,
      createdBy: { connect: { id: ids.user } },
      updatedBy: { connect: { id: ids.user } },
    },
  });
  await prisma.learningPathChapter.create({
    data: {
      id: ids.chapter,
      learningPathId: ids.learningPath,
      orderIndex: 1,
      title: "M5 retrieval chapter",
      status: PublishStatus.PUBLISHED,
      createdById: ids.user,
      updatedById: ids.user,
    },
  });
  await prisma.lesson.createMany({
    data: [
      {
        id: ids.targetLesson,
        learningPathId: ids.learningPath,
        chapterId: ids.chapter,
        orderIndex: 1,
        title: "Target lesson",
        status: PublishStatus.PUBLISHED,
        createdById: ids.user,
        updatedById: ids.user,
      },
      {
        id: ids.otherLesson,
        learningPathId: ids.learningPath,
        chapterId: ids.chapter,
        orderIndex: 2,
        title: "Other lesson",
        status: PublishStatus.PUBLISHED,
        createdById: ids.user,
        updatedById: ids.user,
      },
    ],
  });
  await prisma.file.create({
    data: {
      id: ids.file,
      provider: FileProvider.MINIO_LOCAL,
      purpose: FilePurpose.LESSON_DOCUMENT,
      bucket: "test",
      objectKey: `m5-retrieval/${testRunId}.pdf`,
      originalName: "fixture.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1n,
      visibility: FileVisibility.PRIVATE,
      status: FileStatus.READY,
      uploadedById: ids.user,
    },
  });
  await prisma.lessonDocument.createMany({
    data: [
      createDocument(ids.targetDocument, ids.targetLesson),
      createDocument(ids.otherLessonDocument, ids.otherLesson),
      {
        ...createDocument(ids.replacedDocument, ids.targetLesson),
        replacedAt: new Date(),
      },
      {
        ...createDocument(ids.processingDocument, ids.targetLesson),
        status: DocumentStatus.PROCESSING,
      },
      createDocument(ids.wrongSpaceDocument, ids.targetLesson),
    ],
  });
  await prisma.documentChunk.createMany({
    data: [
      createChunk(
        ids.targetChunk,
        ids.targetDocument,
        ids.targetLesson,
        0,
        "M5 exact formula alpha belongs to the target lesson.",
      ),
      createChunk(
        ids.orthogonalChunk,
        ids.targetDocument,
        ids.targetLesson,
        1,
        "Unrelated active target content.",
      ),
      createChunk(
        ids.otherLessonChunk,
        ids.otherLessonDocument,
        ids.otherLesson,
        0,
        "M5 exact formula alpha must never leak across lessons.",
      ),
      createChunk(
        ids.replacedChunk,
        ids.replacedDocument,
        ids.targetLesson,
        0,
        "M5 exact formula alpha from a replaced document.",
      ),
      createChunk(
        ids.processingChunk,
        ids.processingDocument,
        ids.targetLesson,
        0,
        "M5 exact formula alpha from a processing document.",
      ),
      {
        ...createChunk(
          ids.wrongSpaceChunk,
          ids.wrongSpaceDocument,
          ids.targetLesson,
          0,
          "Wrong embedding space.",
        ),
        embeddingModel: "different-model",
      },
    ],
  });

  await setVector(prisma, ids.targetChunk, queryVector);
  await setVector(prisma, ids.orthogonalChunk, orthogonalVector);
  await setVector(prisma, ids.otherLessonChunk, queryVector);
  await setVector(prisma, ids.replacedChunk, queryVector);
  await setVector(prisma, ids.processingChunk, queryVector);
  await setVector(prisma, ids.wrongSpaceChunk, queryVector);
}

function createDocument(id: string, lessonId: string) {
  return {
    id,
    lessonId,
    fileId: ids.file,
    status: DocumentStatus.READY,
    chunkCount: lessonId === ids.targetLesson ? 2 : 1,
    embeddingProvider: AiProviderName.OPENAI,
    embeddingModel,
    embeddingDimensions,
  };
}

function createChunk(
  id: string,
  documentId: string,
  lessonId: string,
  chunkIndex: number,
  content: string,
) {
  return {
    id,
    documentId,
    lessonId,
    chunkIndex,
    content,
    tokenCount: 20,
    embeddingProvider: AiProviderName.OPENAI,
    embeddingModel,
    embeddingDimensions,
  };
}

async function setVector(prisma: PrismaService, chunkId: string, vector: number[]) {
  const vectorString = `[${vector.join(",")}]`;
  await prisma.$executeRaw`
    UPDATE document_chunks
    SET embedding = ${vectorString}::vector
    WHERE id = ${chunkId}::uuid
  `;
}

function createUnitVector(index: number) {
  return Array.from({ length: embeddingDimensions }, (_, itemIndex) =>
    itemIndex === index ? 1 : 0,
  );
}
