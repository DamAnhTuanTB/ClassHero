import { Inject, Injectable } from "@nestjs/common";
import { DocumentStatus } from "@prisma/client";

import { PrismaService } from "#api/common/prisma/prisma.service";
import {
  FlashcardSourcePacketError,
  FlashcardSourcePacketService,
  type FlashcardSourcePacketErrorCode,
} from "#api/modules/flashcards/services/flashcard-source-packet.service";
import { resolveFlashcardSubject } from "#api/modules/flashcards/utils/flashcard-subject";

export type FlashcardGenerationContextErrorCode =
  | "LESSON_NOT_FOUND"
  | "AI_PDF_SOURCE_NOT_READY"
  | "AI_PDF_SOURCE_EMPTY"
  | "AI_PDF_PACKET_TOO_LARGE"
  | "AI_PDF_PACKET_TOO_MANY_PAGES"
  | "AI_SOURCE_CONTEXT_STALE";

export class FlashcardGenerationContextError extends Error {
  constructor(
    readonly code: FlashcardGenerationContextErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "FlashcardGenerationContextError";
  }
}

@Injectable()
export class FlashcardGenerationContextService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FlashcardSourcePacketService)
    private readonly packets: FlashcardSourcePacketService,
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
      throw new FlashcardGenerationContextError(
        "LESSON_NOT_FOUND",
        "Không tìm thấy buổi học",
      );
    }
    if (requestedIds.length > 0 && lesson.documents.length !== requestedIds.length) {
      throw new FlashcardGenerationContextError(
        "AI_PDF_SOURCE_NOT_READY",
        "Mọi tài liệu Flashcard phải thuộc đúng buổi học và ở trạng thái READY",
      );
    }
    if (lesson.documents.length === 0) {
      throw new FlashcardGenerationContextError(
        "AI_PDF_SOURCE_NOT_READY",
        "Buổi học chưa có PDF searchable sẵn sàng để sinh Flashcard",
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
      subject: resolveFlashcardSubject({
        domainName: lesson.learningPath.domain.name,
        domainSlug: lesson.learningPath.domain.slug,
      }),
      documentIds: lesson.documents.map((document) => document.id),
    };
  }

  private rethrowPacketError(error: unknown): never {
    if (error instanceof FlashcardSourcePacketError) {
      throw new FlashcardGenerationContextError(
        normalizePacketErrorCode(error.code),
        error.message,
        error.details,
      );
    }
    throw error;
  }
}

function normalizePacketErrorCode(
  code: FlashcardSourcePacketErrorCode,
): FlashcardGenerationContextErrorCode {
  return code;
}
