import { Inject, Injectable } from "@nestjs/common";
import { DocumentStatus } from "@prisma/client";

import { PrismaService } from "#api/common/prisma/prisma.service";
import { RetrievalService } from "#api/modules/ai/services/retrieval.service";
import { LESSON_CONTENT_MAX_CONTEXT_TOKENS } from "#api/modules/ai/types/lesson-content-generation.types";
import { hashAiValue } from "#api/modules/ai/utils/ai-hash";

export type LessonContentContextErrorCode =
  "LESSON_NOT_FOUND" | "AI_CONTEXT_NOT_FOUND" | "AI_SOURCE_CONTEXT_STALE";

export class LessonContentContextError extends Error {
  constructor(
    readonly code: LessonContentContextErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "LessonContentContextError";
  }
}

@Injectable()
export class LessonContentGenerationContextService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RetrievalService) private readonly retrieval: RetrievalService,
  ) {}

  async snapshot(lessonId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, deletedAt: null, learningPath: { deletedAt: null } },
      select: {
        id: true,
        title: true,
        documents: {
          where: { status: DocumentStatus.READY, replacedAt: null },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            contentHash: true,
            chunks: {
              orderBy: [{ chunkIndex: "asc" }, { id: "asc" }],
              select: { id: true, contentHash: true, content: true },
            },
          },
        },
      },
    });
    if (!lesson) {
      throw new LessonContentContextError("LESSON_NOT_FOUND", "Không tìm thấy buổi học");
    }
    const documents = lesson.documents.filter((document) => document.chunks.length > 0);
    if (documents.length === 0) {
      throw new LessonContentContextError(
        "AI_CONTEXT_NOT_FOUND",
        "Buổi học chưa có tài liệu READY với chunks để sinh nội dung AI",
      );
    }
    return {
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      documentIds: documents.map((document) => document.id),
      sourceHash: hashAiValue(
        documents.map((document) => ({
          id: document.id,
          contentHash: document.contentHash,
          chunks: document.chunks.map((chunk) => ({
            id: chunk.id,
            contentHash: chunk.contentHash ?? hashAiValue(chunk.content),
          })),
        })),
      ),
    };
  }

  async retrieve(input: { lessonId: string; sourceHash: string; query: string }) {
    const snapshot = await this.snapshot(input.lessonId);
    if (snapshot.sourceHash !== input.sourceHash) {
      throw new LessonContentContextError(
        "AI_SOURCE_CONTEXT_STALE",
        "Tài liệu buổi học đã thay đổi sau khi job được tạo",
      );
    }
    const retrieved = await this.retrieval.retrieveContext({
      lessonId: input.lessonId,
      query: input.query,
      topK: 20,
      minScore: 0.2,
      includeKeywordSearch: true,
      maxContextTokens: LESSON_CONTENT_MAX_CONTEXT_TOKENS,
    });
    if (retrieved.chunks.length === 0) {
      throw new LessonContentContextError(
        "AI_CONTEXT_NOT_FOUND",
        "Không tìm thấy chunk phù hợp trong buổi học",
      );
    }
    return { ...snapshot, ...retrieved };
  }
}
