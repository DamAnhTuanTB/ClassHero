import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "#api/common/prisma/prisma.service";
import {
  LessonSummaryContextError,
  LessonSummaryContextService,
} from "#api/modules/ai/services/lesson-summary-context.service";

const lessonId = "00000000-0000-4000-8000-000000000001";
const documentId = "00000000-0000-4000-8000-000000000002";

function createPrismaMock(tokenCount = 20) {
  return {
    lesson: {
      findFirst: vi.fn(async () => ({
        id: lessonId,
        title: "Lesson",
        learningPath: {
          targetAudiences: [
            { targetAudience: { grade: 8 } },
            { targetAudience: { grade: 7 } },
          ],
        },
      })),
    },
    lessonDocument: {
      findMany: vi.fn(async () => [
        {
          id: documentId,
          contentHash: "document-hash",
          chunks: [
            {
              id: "00000000-0000-4000-8000-000000000003",
              content: "Nội dung chunk",
              contentHash: "chunk-hash",
              tokenCount,
              chunkIndex: 0,
            },
          ],
        },
      ]),
    },
  };
}

describe("M9.2 lesson summary context", () => {
  it("returns ordered lesson-only chunks and a stable source hash", async () => {
    const prisma = createPrismaMock();
    const service = new LessonSummaryContextService(prisma as unknown as PrismaService);

    const first = await service.load(lessonId, [documentId]);
    const second = await service.load(lessonId, [documentId]);

    expect(first.documentIds).toEqual([documentId]);
    expect(first.chunks).toEqual([
      expect.objectContaining({ content: "Nội dung chunk" }),
    ]);
    expect(first.sourceHash).toBe(second.sourceHash);
    expect(first.sourceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.targetGrade).toBe(7);
  });

  it("rejects a selected document that is not ready in the lesson", async () => {
    const prisma = createPrismaMock();
    prisma.lessonDocument.findMany.mockResolvedValueOnce([]);
    const service = new LessonSummaryContextService(prisma as unknown as PrismaService);

    await expect(service.load(lessonId, [documentId])).rejects.toMatchObject({
      code: "AI_CONTEXT_NOT_FOUND",
    } satisfies Partial<LessonSummaryContextError>);
  });

  it("changes the source hash when the target grade changes", async () => {
    const prisma = createPrismaMock();
    const service = new LessonSummaryContextService(prisma as unknown as PrismaService);
    const gradeSeven = await service.load(lessonId, [documentId]);
    prisma.lesson.findFirst.mockResolvedValueOnce({
      id: lessonId,
      title: "Lesson",
      learningPath: {
        targetAudiences: [{ targetAudience: { grade: 8 } }],
      },
    });

    const gradeEight = await service.load(lessonId, [documentId]);

    expect(gradeSeven.targetGrade).toBe(7);
    expect(gradeEight.targetGrade).toBe(8);
    expect(gradeEight.sourceHash).not.toBe(gradeSeven.sourceHash);
  });

  it("fails clearly instead of silently truncating oversized context", async () => {
    const service = new LessonSummaryContextService(
      createPrismaMock(12_001) as unknown as PrismaService,
    );

    await expect(service.load(lessonId, [documentId])).rejects.toMatchObject({
      code: "AI_CONTEXT_TOO_LARGE",
    } satisfies Partial<LessonSummaryContextError>);
  });
});
