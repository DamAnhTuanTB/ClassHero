import { Inject, Injectable } from "@nestjs/common";
import { DocumentStatus } from "@prisma/client";

import { PrismaService } from "#api/common/prisma/prisma.service";
import { LessonSourcePacketService } from "#api/modules/ai/services/lesson-source-packet.service";
import type { AiTextInput } from "#api/modules/ai/types/ai-text.types";
import type { LessonSummarySubjectSnapshot } from "#api/modules/ai/types/lesson-summary-subject.types";
import { LESSON_SUMMARY_MAX_CONTEXT_TOKENS } from "#api/modules/ai/types/lesson-summary.types";
import { hashAiValue } from "#api/modules/ai/utils/ai-hash";
import {
  extractChunkPdfPageRange,
  readStoredChunkPageRange,
} from "#api/modules/ai/utils/chunk-page-range";
import { resolveLessonSummarySubject } from "#api/modules/ai/utils/lesson-summary-subject";

export type LessonSummaryContextErrorCode =
  | "LESSON_NOT_FOUND"
  | "AI_CONTEXT_NOT_FOUND"
  | "AI_CONTEXT_TOO_LARGE"
  | "AI_PDF_SOURCE_NOT_READY"
  | "AI_PDF_SOURCE_EMPTY"
  | "AI_PDF_PACKET_TOO_LARGE"
  | "AI_PDF_PACKET_TOO_MANY_PAGES";

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
  subject: LessonSummarySubjectSnapshot;
  documentIds: string[];
  sourceHash: string;
  totalTokens: number;
  chunks: NonNullable<AiTextInput["contextChunks"]>;
  packet?: Awaited<ReturnType<LessonSourcePacketService["build"]>>;
}

@Injectable()
export class LessonSummaryContextService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LessonSourcePacketService)
    private readonly packets: LessonSourcePacketService,
  ) {}

  async loadPacket(lessonId: string, documentIds: string[]) {
    const base = await this.loadLessonIdentity(lessonId);
    const packet = await this.packets.build(lessonId, documentIds);
    return {
      ...base,
      documentIds: [...new Set(documentIds)],
      sourceHash: packet.sourceHash,
      totalTokens: 0,
      chunks: [],
      packet,
    } satisfies LessonSummaryContext;
  }

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
            domain: { select: { name: true, slug: true } },
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
        title: true,
        contentHash: true,
        file: { select: { originalName: true } },
        chunks: {
          orderBy: [{ chunkIndex: "asc" }, { id: "asc" }],
          select: {
            id: true,
            content: true,
            contentHash: true,
            tokenCount: true,
            chunkIndex: true,
            metadataJson: true,
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
          documentTitle: document.title?.trim() || document.file.originalName,
          pageRange:
            readStoredChunkPageRange(chunk.metadataJson) ??
            extractChunkPdfPageRange(chunk.content),
          chunkIndex: chunk.chunkIndex,
          tokenCount: chunk.tokenCount ?? Math.max(1, Math.ceil(chunk.content.length / 4)),
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
    const subject = resolveLessonSummarySubject({
      domainName: lesson.learningPath.domain.name,
      domainSlug: lesson.learningPath.domain.slug,
    });
    const sourceHash = hashAiValue({
      targetGrade,
      subject,
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
      subject,
      documentIds: documents.map((document) => document.id),
      sourceHash,
      totalTokens,
      chunks,
    };
  }

  async loadLessonIdentity(lessonId: string) {
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
            domain: { select: { name: true, slug: true } },
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
    const targetGrade =
      lesson.learningPath.targetAudiences
        .map(({ targetAudience }) => targetAudience.grade)
        .filter((grade): grade is number => grade !== null)
        .sort((left, right) => left - right)[0] ?? null;
    return {
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      targetGrade,
      subject: resolveLessonSummarySubject({
        domainName: lesson.learningPath.domain.name,
        domainSlug: lesson.learningPath.domain.slug,
      }),
    };
  }
}
