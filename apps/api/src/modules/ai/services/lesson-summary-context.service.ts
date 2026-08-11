import { Inject, Injectable } from "@nestjs/common";
import { DocumentStatus } from "@prisma/client";

import { PrismaService } from "#api/common/prisma/prisma.service";
import type { AiTextInput } from "#api/modules/ai/types/ai-text.types";
import { LESSON_SUMMARY_MAX_CONTEXT_TOKENS } from "#api/modules/ai/types/lesson-summary.types";
import { hashAiValue } from "#api/modules/ai/utils/ai-hash";

export type LessonSummaryContextErrorCode =
  "LESSON_NOT_FOUND" | "AI_CONTEXT_NOT_FOUND" | "AI_CONTEXT_TOO_LARGE";

export class LessonSummaryContextError extends Error {
  constructor(
    readonly code: LessonSummaryContextErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "LessonSummaryContextError";
  }
}

export interface LessonSummaryContext {
  lessonId: string;
  lessonTitle: string;
  targetGrade: number | null;
  documentIds: string[];
  sourceHash: string;
  totalTokens: number;
  chunks: NonNullable<AiTextInput["contextChunks"]>;
}

@Injectable()
export class LessonSummaryContextService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async load(lessonId: string, documentIds: string[]): Promise<LessonSummaryContext> {
    const uniqueDocumentIds = [...new Set(documentIds)];
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        id: lessonId,
        deletedAt: null,
        learningPath: { deletedAt: null },
      },
      select: {
        id: true,
        title: true,
        learningPath: {
          select: {
            targetAudiences: {
              select: { targetAudience: { select: { grade: true } } },
            },
          },
        },
      },
    });
    if (!lesson) {
      throw new LessonSummaryContextError("LESSON_NOT_FOUND", "Không tìm thấy buổi học");
    }

    const documents = await this.prisma.lessonDocument.findMany({
      where: {
        id: { in: uniqueDocumentIds },
        lessonId,
        status: DocumentStatus.READY,
        replacedAt: null,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        contentHash: true,
        chunks: {
          orderBy: [{ chunkIndex: "asc" }, { id: "asc" }],
          select: {
            id: true,
            content: true,
            contentHash: true,
            tokenCount: true,
            chunkIndex: true,
          },
        },
      },
    });

    if (
      uniqueDocumentIds.length === 0 ||
      documents.length !== uniqueDocumentIds.length ||
      documents.some((document) => document.chunks.length === 0)
    ) {
      throw new LessonSummaryContextError(
        "AI_CONTEXT_NOT_FOUND",
        "Tài liệu phải thuộc đúng buổi học, ở trạng thái sẵn sàng và có chunks",
        { lessonId, documentIds: uniqueDocumentIds },
      );
    }

    const chunks = documents.flatMap((document) =>
      document.chunks.map((chunk) => ({
        id: chunk.id,
        content: chunk.content,
        metadata: {
          documentId: document.id,
          chunkIndex: chunk.chunkIndex,
        },
      })),
    );
    const totalTokens = documents.reduce(
      (documentTotal, document) =>
        documentTotal +
        document.chunks.reduce(
          (chunkTotal, chunk) =>
            chunkTotal +
            (chunk.tokenCount ?? Math.max(1, Math.ceil(chunk.content.length / 4))),
          0,
        ),
      0,
    );

    if (totalTokens > LESSON_SUMMARY_MAX_CONTEXT_TOKENS) {
      throw new LessonSummaryContextError(
        "AI_CONTEXT_TOO_LARGE",
        "Nội dung buổi học vượt giới hạn context cho một lần tạo tóm tắt",
        {
          totalTokens,
          maxTokens: LESSON_SUMMARY_MAX_CONTEXT_TOKENS,
        },
      );
    }

    const targetGrade =
      lesson.learningPath.targetAudiences
        .map(({ targetAudience }) => targetAudience.grade)
        .filter((grade): grade is number => grade !== null)
        .sort((left, right) => left - right)[0] ?? null;
    const sourceHash = hashAiValue({
      targetGrade,
      documents: documents.map((document) => ({
        id: document.id,
        contentHash: document.contentHash,
        chunks: document.chunks.map((chunk) => ({
          id: chunk.id,
          contentHash: chunk.contentHash ?? hashAiValue(chunk.content),
          tokenCount: chunk.tokenCount,
        })),
      })),
    });

    return {
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      targetGrade,
      documentIds: documents.map((document) => document.id),
      sourceHash,
      totalTokens,
      chunks,
    };
  }
}
