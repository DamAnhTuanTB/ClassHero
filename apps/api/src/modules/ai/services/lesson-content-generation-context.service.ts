import { Inject, Injectable } from "@nestjs/common";
import { DocumentStatus } from "@prisma/client";

import { PrismaService } from "#api/common/prisma/prisma.service";
import { RetrievalService } from "#api/modules/ai/services/retrieval.service";
import { LESSON_CONTENT_MAX_CONTEXT_TOKENS } from "#api/modules/ai/types/lesson-content-generation.types";
import { hashAiValue } from "#api/modules/ai/utils/ai-hash";
import { resolveCourseSubject } from "#api/modules/ai/utils/lesson-summary-subject";

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

  async snapshot(lessonId: string, requestedDocumentIds?: string[]) {
    const documentIds = [...new Set(requestedDocumentIds ?? [])];
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, deletedAt: null, learningPath: { deletedAt: null } },
      select: {
        id: true,
        title: true,
        learningPath: {
          select: {
            domain: { select: { name: true, slug: true } },
            targetAudiences: {
              select: { targetAudience: { select: { grade: true } } },
            },
          },
        },
        documents: {
          where: {
            status: DocumentStatus.READY,
            replacedAt: null,
            ...(documentIds.length > 0 ? { id: { in: documentIds } } : {}),
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            contentHash: true,
            chunks: {
              orderBy: [{ chunkIndex: "asc" }, { id: "asc" }],
              select: {
                id: true,
                contentHash: true,
                content: true,
                tokenCount: true,
                chunkIndex: true,
                metadataJson: true,
              },
            },
          },
        },
      },
    });
    if (!lesson) {
      throw new LessonContentContextError("LESSON_NOT_FOUND", "Không tìm thấy buổi học");
    }
    const documents = lesson.documents.filter((document) => document.chunks.length > 0);
    if (documentIds.length > 0 && documents.length !== documentIds.length) {
      throw new LessonContentContextError(
        "AI_CONTEXT_NOT_FOUND",
        "Tài liệu phải thuộc đúng buổi học, ở trạng thái READY và có chunks",
      );
    }
    if (documents.length === 0) {
      throw new LessonContentContextError(
        "AI_CONTEXT_NOT_FOUND",
        "Buổi học chưa có tài liệu READY với chunks để sinh nội dung AI",
      );
    }
    const targetGrade =
      lesson.learningPath.targetAudiences
        .map(({ targetAudience }) => targetAudience.grade)
        .filter((grade): grade is number => grade !== null)
        .sort((left, right) => left - right)[0] ?? null;
    const subject = resolveCourseSubject({
      domainName: lesson.learningPath.domain.name,
      domainSlug: lesson.learningPath.domain.slug,
    });
    const chunks = documents
      .flatMap((document) =>
        document.chunks.map((chunk) => ({
          id: chunk.id,
          content: chunk.content,
          score: 1,
          metadata: {
            documentId: document.id,
            chunkIndex: chunk.chunkIndex,
            metadataJson: chunk.metadataJson,
          },
          tokenCount:
            chunk.tokenCount ?? Math.max(1, Math.ceil(chunk.content.length / 4)),
        })),
      )
      .reduce<{
        values: Array<{
          id: string;
          content: string;
          score: number;
          metadata: Record<string, unknown>;
        }>;
        tokens: number;
      }>(
        (accumulator, chunk) => {
          if (accumulator.tokens + chunk.tokenCount > LESSON_CONTENT_MAX_CONTEXT_TOKENS) {
            return accumulator;
          }
          accumulator.values.push({
            id: chunk.id,
            content: chunk.content,
            score: chunk.score,
            metadata: chunk.metadata,
          });
          accumulator.tokens += chunk.tokenCount;
          return accumulator;
        },
        { values: [], tokens: 0 },
      );
    return {
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      targetGrade,
      subject,
      documentIds: documents.map((document) => document.id),
      sourceHash: hashAiValue({
        targetGrade,
        subject,
        documents: documents.map((document) => ({
          id: document.id,
          contentHash: document.contentHash,
          chunks: document.chunks.map((chunk) => ({
            id: chunk.id,
            contentHash: chunk.contentHash ?? hashAiValue(chunk.content),
          })),
        })),
      }),
      chunks: chunks.values,
      totalTokens: chunks.tokens,
    };
  }

  async retrieve(input: {
    lessonId: string;
    documentIds: string[];
    sourceHash: string;
    query: string;
  }) {
    const snapshot = await this.snapshot(input.lessonId, input.documentIds);
    if (snapshot.sourceHash !== input.sourceHash) {
      throw new LessonContentContextError(
        "AI_SOURCE_CONTEXT_STALE",
        "Tài liệu buổi học đã thay đổi sau khi job được tạo",
      );
    }
    const retrieved = await this.retrieval.retrieveContext({
      lessonId: input.lessonId,
      documentIds: snapshot.documentIds,
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
