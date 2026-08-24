import { Inject, Injectable } from "@nestjs/common";
import { DocumentStatus } from "@prisma/client";

import { PrismaService } from "#api/common/prisma/prisma.service";
import {
  QuizSourcePacketError,
  QuizSourcePacketService,
  type QuizSourcePacketErrorCode,
} from "#api/modules/quiz/services/quiz-source-packet.service";
import { resolveQuizSubject } from "#api/modules/quiz/utils/quiz-subject";

export type QuizGenerationContextErrorCode =
  | "LESSON_NOT_FOUND"
  | "AI_PDF_SOURCE_NOT_READY"
  | "AI_PDF_SOURCE_EMPTY"
  | "AI_PDF_PACKET_TOO_LARGE"
  | "AI_PDF_PACKET_TOO_MANY_PAGES"
  | "AI_SOURCE_CONTEXT_STALE";

export class QuizGenerationContextError extends Error {
  constructor(
    readonly code: QuizGenerationContextErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "QuizGenerationContextError";
  }
}

@Injectable()
export class QuizGenerationContextService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QuizSourcePacketService)
    private readonly packets: QuizSourcePacketService,
  ) {}

  async loadPacket(lessonId: string, requestedDocumentIds?: string[]) {
    const context = await this.loadLessonContext(lessonId, requestedDocumentIds);
    try {
      const packet = await this.packets.build(lessonId, context.documentIds);
      return { ...context, sourceHash: packet.sourceHash, packet };
    } catch (error) {
      this.rethrowPacketError(error);
    }
  }

  async computeCurrentSourceHash(lessonId: string, documentIds: string[]) {
    try {
      return await this.packets.computeCurrentSourceHash(lessonId, documentIds);
    } catch (error) {
      this.rethrowPacketError(error);
    }
  }

  cleanupPacket(objectKey: string) {
    return this.packets.cleanup(objectKey);
  }

  downloadPacket(objectKey: string) {
    return this.packets.download(objectKey);
  }

  private async loadLessonContext(
    lessonId: string,
    requestedDocumentIds?: string[],
  ) {
    const requestedIds = [...new Set(requestedDocumentIds ?? [])];
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
            ...(requestedIds.length > 0 ? { id: { in: requestedIds } } : {}),
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
          select: { id: true },
        },
      },
    });
    if (!lesson) {
      throw new QuizGenerationContextError(
        "LESSON_NOT_FOUND",
        "Không tìm thấy buổi học",
      );
    }
    if (requestedIds.length > 0 && lesson.documents.length !== requestedIds.length) {
      throw new QuizGenerationContextError(
        "AI_PDF_SOURCE_NOT_READY",
        "Mọi tài liệu Quiz phải thuộc đúng buổi học và ở trạng thái READY",
      );
    }
    if (lesson.documents.length === 0) {
      throw new QuizGenerationContextError(
        "AI_PDF_SOURCE_NOT_READY",
        "Buổi học chưa có PDF searchable sẵn sàng để sinh Quiz",
      );
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
      subject: resolveQuizSubject({
        domainName: lesson.learningPath.domain.name,
        domainSlug: lesson.learningPath.domain.slug,
      }),
      documentIds: lesson.documents.map((document) => document.id),
    };
  }

  private rethrowPacketError(error: unknown): never {
    if (error instanceof QuizSourcePacketError) {
      throw new QuizGenerationContextError(
        normalizePacketErrorCode(error.code),
        error.message,
        error.details,
      );
    }
    throw error;
  }
}

function normalizePacketErrorCode(
  code: QuizSourcePacketErrorCode,
): QuizGenerationContextErrorCode {
  return code;
}
