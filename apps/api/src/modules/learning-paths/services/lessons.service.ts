import { Inject, Injectable } from "@nestjs/common";
import { Prisma, PublishStatus } from "@prisma/client";
import { throwBadRequest } from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { CreateLessonDto } from "#api/modules/learning-paths/dto/create-lesson.dto";
import { UpdateLessonDto } from "#api/modules/learning-paths/dto/update-lesson.dto";
import {
  assertVideoUrlAllowed,
  getStatusAuditAction,
  handleKnownPrismaError,
  normalizeOptionalText,
  normalizeText,
  throwChapterNotFound,
  throwDuplicatedLessonTitle,
  throwLessonNotFound,
  toInputJson,
} from "#api/modules/learning-paths/utils/lesson.helpers";
import { lessonSelect } from "#api/modules/learning-paths/selectors/lesson.selects";
import { serializeLesson } from "#api/modules/learning-paths/serializers/lesson.serializers";
import { SourceDocumentsService } from "#api/modules/learning-paths/services/source-documents.service";
import type { LessonDocumentRecord } from "#api/modules/learning-paths/types/document.types";
import type { RequestContext } from "#api/modules/learning-paths/types/lesson.types";

@Injectable()
export class LessonsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SourceDocumentsService)
    private readonly sourceDocumentsService: SourceDocumentsService,
  ) {}

  async listForAdmin(chapterId: string) {
    await this.assertChapterExists(chapterId);

    const lessons = await this.prisma.lesson.findMany({
      where: {
        chapterId,
        deletedAt: null,
      },
      select: lessonSelect,
      orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
    });

    return lessons.map(serializeLesson);
  }

  async getForAdmin(lessonId: string) {
    const lesson = await this.findActiveById(lessonId);
    return serializeLesson(lesson);
  }

  async create(
    chapterId: string,
    actorUserId: string,
    dto: CreateLessonDto,
    context: RequestContext = {},
  ) {
    assertVideoUrlAllowed(dto.videoUrl);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const chapter = await tx.learningPathChapter.findFirst({
          where: {
            id: chapterId,
            deletedAt: null,
            learningPath: {
              deletedAt: null,
            },
          },
          select: {
            id: true,
            learningPathId: true,
          },
        });

        if (!chapter) {
          throwChapterNotFound();
        }

        const normalizedTitle = normalizeText(dto.title);
        await this.assertLessonTitleAvailable(tx, chapter.id, normalizedTitle);

        const status = dto.status ?? PublishStatus.DRAFT;
        const created = await tx.lesson.create({
          data: {
            learningPathId: chapter.learningPathId,
            chapterId: chapter.id,
            orderIndex: dto.orderIndex,
            title: normalizedTitle,
            shortDescription: normalizeOptionalText(dto.shortDescription),
            scheduledAt: dto.scheduledAt ?? null,
            examOpenAt: dto.examOpenAt ?? null,
            videoUrl: normalizeOptionalText(dto.videoUrl),
            completionMinScore: dto.completionMinScore ?? 7,
            trialEnabled: dto.trialEnabled ?? false,
            status,
            createdById: actorUserId,
            updatedById: actorUserId,
          },
          select: lessonSelect,
        });

        await tx.learningPath.update({
          where: { id: chapter.learningPathId },
          data: {
            totalLessonCount: {
              increment: 1,
            },
            updatedById: actorUserId,
          },
        });

        await tx.auditLog.create({
          data: {
            actorUserId,
            action: getStatusAuditAction("LESSON_CREATED", status),
            entityType: "Lesson",
            entityId: created.id,
            after: toInputJson(serializeLesson(created)),
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
          },
        });

        const sourceDocumentExtractions =
          dto.sourceDocumentExtractions ??
          (dto.sourceDocumentPageRange ? [dto.sourceDocumentPageRange] : []);
        const lessonDocuments =
          sourceDocumentExtractions.length > 0
            ? await this.sourceDocumentsService.syncLessonSourceExtractionsInTransaction(
                tx,
                {
                  actorUserId,
                  context,
                  extractions: sourceDocumentExtractions,
                  lessonId: created.id,
                },
              )
            : [];

        return { lesson: created, lessonDocuments };
      });

      await this.enqueueLessonDocuments(result.lessonDocuments);

      return serializeLesson(result.lesson);
    } catch (error) {
      handleKnownPrismaError(error);
    }
  }

  async update(
    lessonId: string,
    actorUserId: string,
    dto: UpdateLessonDto,
    context: RequestContext = {},
  ) {
    if (Object.keys(dto).length === 0) {
      throwBadRequest("VALIDATION_ERROR", "Cần cung cấp ít nhất một trường để cập nhật");
    }

    assertVideoUrlAllowed(dto.videoUrl);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const before = await tx.lesson.findFirst({
          where: {
            id: lessonId,
            deletedAt: null,
            chapter: {
              deletedAt: null,
            },
            learningPath: {
              deletedAt: null,
            },
          },
          select: lessonSelect,
        });

        if (!before) {
          throwLessonNotFound();
        }

        const normalizedTitle =
          dto.title !== undefined ? normalizeText(dto.title) : undefined;
        if (normalizedTitle !== undefined) {
          await this.assertLessonTitleAvailable(
            tx,
            before.chapterId,
            normalizedTitle,
            before.id,
          );
        }

        if (dto.orderIndex !== undefined && dto.orderIndex !== before.orderIndex) {
          await this.moveLessonOrder(tx, before, dto.orderIndex);
        }

        const status = dto.status ?? before.status;
        const updated = await tx.lesson.update({
          where: { id: lessonId },
          data: {
            ...(normalizedTitle !== undefined ? { title: normalizedTitle } : {}),
            ...(dto.shortDescription !== undefined
              ? { shortDescription: normalizeOptionalText(dto.shortDescription) }
              : {}),
            ...(dto.scheduledAt !== undefined
              ? { scheduledAt: dto.scheduledAt ?? null }
              : {}),
            ...(dto.examOpenAt !== undefined
              ? { examOpenAt: dto.examOpenAt ?? null }
              : {}),
            ...(dto.videoUrl !== undefined
              ? { videoUrl: normalizeOptionalText(dto.videoUrl) }
              : {}),
            ...(dto.completionMinScore !== undefined
              ? { completionMinScore: dto.completionMinScore }
              : {}),
            ...(dto.trialEnabled !== undefined ? { trialEnabled: dto.trialEnabled } : {}),
            ...(dto.status !== undefined ? { status } : {}),
            updatedById: actorUserId,
          },
          select: lessonSelect,
        });

        await tx.auditLog.create({
          data: {
            actorUserId,
            action: getStatusAuditAction("LESSON_UPDATED", updated.status),
            entityType: "Lesson",
            entityId: updated.id,
            before: toInputJson(serializeLesson(before)),
            after: toInputJson(serializeLesson(updated)),
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
          },
        });

        const sourceDocumentExtractions =
          dto.sourceDocumentExtractions !== undefined
            ? dto.sourceDocumentExtractions
            : dto.sourceDocumentPageRange !== undefined
              ? dto.sourceDocumentPageRange
                ? [dto.sourceDocumentPageRange]
                : []
              : undefined;
        const lessonDocuments =
          sourceDocumentExtractions !== undefined
            ? await this.sourceDocumentsService.syncLessonSourceExtractionsInTransaction(
                tx,
                {
                  actorUserId,
                  context,
                  extractions: sourceDocumentExtractions,
                  lessonId: updated.id,
                },
              )
            : [];

        return { lesson: updated, lessonDocuments };
      });

      await this.enqueueLessonDocuments(result.lessonDocuments);

      return serializeLesson(result.lesson);
    } catch (error) {
      handleKnownPrismaError(error);
    }
  }

  async softDelete(lessonId: string, actorUserId: string, context: RequestContext = {}) {
    try {
      await this.prisma.$transaction(async (tx) => {
        const before = await tx.lesson.findFirst({
          where: {
            id: lessonId,
            deletedAt: null,
            chapter: {
              deletedAt: null,
            },
            learningPath: {
              deletedAt: null,
            },
          },
          select: lessonSelect,
        });

        if (!before) {
          throwLessonNotFound();
        }

        const archivedOrderIndex = await this.getNextArchivedOrderIndex(
          tx,
          before.chapterId,
        );
        const deleted = await tx.lesson.update({
          where: { id: lessonId },
          data: {
            orderIndex: archivedOrderIndex,
            status: PublishStatus.ARCHIVED,
            deletedAt: new Date(),
            updatedById: actorUserId,
          },
          select: lessonSelect,
        });

        await tx.learningPath.update({
          where: { id: before.learningPathId },
          data: {
            totalLessonCount: {
              decrement: 1,
            },
            updatedById: actorUserId,
          },
        });

        await tx.auditLog.create({
          data: {
            actorUserId,
            action: "LESSON_SOFT_DELETED",
            entityType: "Lesson",
            entityId: deleted.id,
            before: toInputJson(serializeLesson(before)),
            after: toInputJson(serializeLesson(deleted)),
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
          },
        });
      });
    } catch (error) {
      handleKnownPrismaError(error);
    }

    return { success: true };
  }

  async publish(lessonId: string, actorUserId: string, context: RequestContext = {}) {
    try {
      const lesson = await this.prisma.$transaction(async (tx) => {
        const before = await tx.lesson.findFirst({
          where: {
            id: lessonId,
            deletedAt: null,
            chapter: {
              deletedAt: null,
            },
            learningPath: {
              deletedAt: null,
            },
          },
          select: lessonSelect,
        });

        if (!before) {
          throwLessonNotFound();
        }

        const updated = await tx.lesson.update({
          where: { id: lessonId },
          data: {
            status: PublishStatus.PUBLISHED,
            updatedById: actorUserId,
          },
          select: lessonSelect,
        });

        await tx.auditLog.create({
          data: {
            actorUserId,
            action: "LESSON_PUBLISHED",
            entityType: "Lesson",
            entityId: updated.id,
            before: toInputJson(serializeLesson(before)),
            after: toInputJson(serializeLesson(updated)),
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
          },
        });

        return updated;
      });

      return serializeLesson(lesson);
    } catch (error) {
      handleKnownPrismaError(error);
    }
  }

  private async assertChapterExists(chapterId: string) {
    const chapter = await this.prisma.learningPathChapter.findFirst({
      where: {
        id: chapterId,
        deletedAt: null,
        learningPath: {
          deletedAt: null,
        },
      },
      select: { id: true },
    });

    if (!chapter) {
      throwChapterNotFound();
    }
  }

  private async findActiveById(lessonId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        id: lessonId,
        deletedAt: null,
        chapter: {
          deletedAt: null,
        },
        learningPath: {
          deletedAt: null,
        },
      },
      select: lessonSelect,
    });

    if (!lesson) {
      throwLessonNotFound();
    }

    return lesson;
  }

  private async getNextArchivedOrderIndex(
    tx: Prisma.TransactionClient,
    chapterId: string,
  ) {
    const lesson = await tx.lesson.findFirst({
      where: {
        chapterId,
        orderIndex: {
          lt: 0,
        },
      },
      select: {
        orderIndex: true,
      },
      orderBy: {
        orderIndex: "asc",
      },
    });

    return lesson ? lesson.orderIndex - 1 : -1;
  }

  private enqueueLessonDocuments(documents: LessonDocumentRecord[]) {
    if (documents.length === 0) {
      return Promise.resolve();
    }

    return this.sourceDocumentsService.enqueueLessonDocumentProcessingJobs(documents);
  }

  private async assertLessonTitleAvailable(
    tx: Prisma.TransactionClient,
    chapterId: string,
    title: string,
    excludedLessonId?: string,
  ) {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(
        hashtext('lesson-title'),
        hashtext(${chapterId})
      )
    `;

    const duplicatedLesson = await tx.lesson.findFirst({
      where: {
        chapterId,
        deletedAt: null,
        title: {
          equals: title,
          mode: "insensitive",
        },
        ...(excludedLessonId ? { id: { not: excludedLessonId } } : {}),
      },
      select: {
        id: true,
      },
    });

    if (duplicatedLesson) {
      throwDuplicatedLessonTitle();
    }
  }

  private async moveLessonOrder(
    tx: Prisma.TransactionClient,
    before: Prisma.LessonGetPayload<{ select: typeof lessonSelect }>,
    targetOrderIndex: number,
  ) {
    const maxOrder = await tx.lesson.count({
      where: {
        chapterId: before.chapterId,
        deletedAt: null,
      },
    });
    const normalizedTarget = Math.min(Math.max(targetOrderIndex, 1), maxOrder);

    if (normalizedTarget === before.orderIndex) {
      return;
    }

    const temporaryOrderIndex = await this.getNextArchivedOrderIndex(
      tx,
      before.chapterId,
    );

    await tx.lesson.update({
      where: { id: before.id },
      data: { orderIndex: temporaryOrderIndex },
    });

    if (normalizedTarget < before.orderIndex) {
      await tx.lesson.updateMany({
        where: {
          chapterId: before.chapterId,
          deletedAt: null,
          orderIndex: {
            gte: normalizedTarget,
            lt: before.orderIndex,
          },
        },
        data: {
          orderIndex: {
            increment: 1,
          },
        },
      });
    } else {
      await tx.lesson.updateMany({
        where: {
          chapterId: before.chapterId,
          deletedAt: null,
          orderIndex: {
            gt: before.orderIndex,
            lte: normalizedTarget,
          },
        },
        data: {
          orderIndex: {
            decrement: 1,
          },
        },
      });
    }

    await tx.lesson.update({
      where: { id: before.id },
      data: { orderIndex: normalizedTarget },
    });
  }
}
