import { Inject, Injectable } from "@nestjs/common";
import { LessonType, Prisma, PublishStatus } from "@prisma/client";
import { tiptapTextDocumentSchema } from "@learning-path/shared";
import { throwBadRequest } from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { CreateLessonDto } from "#api/modules/learning-paths/dto/create-lesson.dto";
import { CreateLearningPathLessonDto } from "#api/modules/learning-paths/dto/create-learning-path-lesson.dto";
import { MoveLessonDto } from "#api/modules/learning-paths/dto/move-lesson.dto";
import { UpdateLessonDto } from "#api/modules/learning-paths/dto/update-lesson.dto";
import {
  assertVideoUrlAllowed,
  getStatusAuditAction,
  handleKnownPrismaError,
  normalizeLessonLiveUrl,
  normalizeOptionalText,
  normalizeText,
  throwChapterNotFound,
  throwDuplicatedLessonTitle,
  throwLearningPathNotFound,
  throwLessonNotFound,
  toInputJson,
} from "#api/modules/learning-paths/utils/lesson.helpers";
import { lessonSelect } from "#api/modules/learning-paths/selectors/lesson.selects";
import { serializeLesson } from "#api/modules/learning-paths/serializers/lesson.serializers";
import { SourceDocumentsService } from "#api/modules/learning-paths/services/source-documents.service";
import { LearningPathStructureService } from "#api/modules/learning-paths/services/learning-path-structure.service";
import type { LessonDocumentRecord } from "#api/modules/learning-paths/types/document.types";
import type { RequestContext } from "#api/modules/learning-paths/types/lesson.types";

@Injectable()
export class LessonsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SourceDocumentsService)
    private readonly sourceDocumentsService: SourceDocumentsService,
    @Inject(LearningPathStructureService)
    private readonly structureService: LearningPathStructureService,
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
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        id: lessonId,
        deletedAt: null,
      },
      select: {
        ...lessonSelect,
        learningPath: {
          select: {
            title: true,
          },
        },
        chapter: {
          select: {
            title: true,
          },
        },
      },
    });

    if (!lesson) {
      throwLessonNotFound();
    }

    return {
      ...serializeLesson(lesson),
      courseTitle: lesson.learningPath.title,
      chapterTitle: lesson.chapter?.title ?? null,
      learningPathId: lesson.learningPathId,
    };
  }

  async createInChapter(
    chapterId: string,
    actorUserId: string,
    dto: CreateLessonDto,
    context: RequestContext = {},
  ) {
    const chapter = await this.prisma.learningPathChapter.findFirst({
      where: {
        id: chapterId,
        deletedAt: null,
        learningPath: { deletedAt: null },
      },
      select: { learningPathId: true },
    });
    if (!chapter) {
      throwChapterNotFound();
    }

    return this.createForLearningPath(
      chapter.learningPathId,
      actorUserId,
      Object.assign(new CreateLearningPathLessonDto(), dto, { chapterId }),
      context,
    );
  }

  async createForLearningPath(
    learningPathId: string,
    actorUserId: string,
    dto: CreateLearningPathLessonDto,
    context: RequestContext = {},
  ) {
    assertVideoUrlAllowed(dto.videoUrl);
    const lessonType = dto.lessonType ?? LessonType.BASIC;
    const liveUrl = normalizeLessonLiveUrl(lessonType, dto.liveUrl);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const learningPath = await tx.learningPath.findFirst({
          where: { id: learningPathId, deletedAt: null },
          select: { id: true },
        });
        if (!learningPath) {
          throwLearningPathNotFound();
        }

        const chapterId = dto.chapterId ?? null;
        if (chapterId) {
          const chapter = await tx.learningPathChapter.findFirst({
            where: { id: chapterId, learningPathId, deletedAt: null },
            select: { id: true },
          });
          if (!chapter) {
            throwChapterNotFound();
          }
        }

        const normalizedTitle = normalizeText(dto.title);
        await this.assertLessonTitleAvailable(
          tx,
          learningPathId,
          chapterId,
          normalizedTitle,
        );

        const status = dto.status ?? PublishStatus.DRAFT;
        const temporaryOrderIndex = await this.structureService.getTemporaryLessonOrder(
          tx,
          learningPathId,
          chapterId,
        );
        const created = await tx.lesson.create({
          data: {
            learningPathId,
            chapterId,
            orderIndex: temporaryOrderIndex,
            title: normalizedTitle,
            shortDescription: normalizeOptionalText(dto.shortDescription),
            ...(dto.overviewContentJson !== undefined
              ? {
                  overviewContentJson: parseLessonOverviewContent(
                    dto.overviewContentJson,
                  ),
                }
              : {}),
            lessonType,
            liveUrl,
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
        await this.structureService.insertLesson(tx, {
          chapterId,
          learningPathId,
          lessonId: created.id,
        });
        const ordered = await tx.lesson.findUniqueOrThrow({
          where: { id: created.id },
          select: lessonSelect,
        });

        await tx.learningPath.update({
          where: { id: learningPathId },
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
            after: toInputJson(serializeLesson(ordered)),
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

        return { lesson: ordered, lessonDocuments };
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
    this.assertTranscriptIsChronological(dto.customVideoSettings?.transcript);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const before = await tx.lesson.findFirst({
          where: {
            id: lessonId,
            deletedAt: null,
            learningPath: {
              deletedAt: null,
            },
            OR: [{ chapterId: null }, { chapter: { deletedAt: null } }],
          },
          select: lessonSelect,
        });

        if (!before) {
          throwLessonNotFound();
        }

        assertVideoUrlAllowed(dto.videoUrl);
        const lessonType = dto.lessonType ?? before.lessonType;
        const liveUrl = normalizeLessonLiveUrl(
          lessonType,
          dto.liveUrl === undefined ? before.liveUrl : dto.liveUrl,
        );
        const normalizedTitle =
          dto.title !== undefined ? normalizeText(dto.title) : undefined;
        if (normalizedTitle !== undefined) {
          await this.assertLessonTitleAvailable(
            tx,
            before.learningPathId,
            before.chapterId,
            normalizedTitle,
            before.id,
          );
        }

        if (dto.orderIndex !== undefined && dto.orderIndex !== before.orderIndex) {
          await this.structureService.moveLesson(tx, {
            chapterId: before.chapterId,
            learningPathId: before.learningPathId,
            lessonId: before.id,
            targetOrderIndex: dto.orderIndex,
          });
        }

        const status = dto.status ?? before.status;
        const updated = await tx.lesson.update({
          where: { id: lessonId },
          data: {
            ...(normalizedTitle !== undefined ? { title: normalizedTitle } : {}),
            ...(dto.shortDescription !== undefined
              ? { shortDescription: normalizeOptionalText(dto.shortDescription) }
              : {}),
            ...(dto.overviewContentJson !== undefined
              ? {
                  overviewContentJson:
                    dto.overviewContentJson === null
                      ? Prisma.DbNull
                      : parseLessonOverviewContent(dto.overviewContentJson),
                }
              : {}),
            ...(dto.lessonType !== undefined ? { lessonType } : {}),
            ...(dto.lessonType !== undefined || dto.liveUrl !== undefined
              ? { liveUrl }
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
            ...(dto.customVideoSettings !== undefined
              ? {
                  customVideoSettings: dto.customVideoSettings
                    ? (dto.customVideoSettings as unknown as Prisma.InputJsonValue)
                    : Prisma.DbNull,
                }
              : {}),
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

  async move(
    lessonId: string,
    actorUserId: string,
    dto: MoveLessonDto,
    context: RequestContext = {},
  ) {
    try {
      const moved = await this.prisma.$transaction(async (tx) => {
        const before = await tx.lesson.findFirst({
          where: {
            id: lessonId,
            deletedAt: null,
            learningPath: { deletedAt: null },
            OR: [{ chapterId: null }, { chapter: { deletedAt: null } }],
          },
          select: lessonSelect,
        });
        if (!before) {
          throwLessonNotFound();
        }

        if (dto.chapterId) {
          const destination = await tx.learningPathChapter.findFirst({
            where: {
              id: dto.chapterId,
              learningPathId: before.learningPathId,
              deletedAt: null,
            },
            select: { id: true },
          });
          if (!destination) {
            throwChapterNotFound();
          }
        }

        await this.assertLessonTitleAvailable(
          tx,
          before.learningPathId,
          dto.chapterId,
          before.title,
          before.id,
        );
        await this.structureService.moveLesson(tx, {
          chapterId: dto.chapterId,
          learningPathId: before.learningPathId,
          lessonId: before.id,
          targetOrderIndex: dto.targetOrderIndex,
        });
        const updated = await tx.lesson.findUniqueOrThrow({
          where: { id: before.id },
          select: lessonSelect,
        });
        await tx.auditLog.create({
          data: {
            actorUserId,
            action: "LESSON_MOVED",
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

      return serializeLesson(moved);
    } catch (error) {
      handleKnownPrismaError(error);
    }
  }

  private assertTranscriptIsChronological(
    transcript: NonNullable<UpdateLessonDto["customVideoSettings"]>["transcript"],
  ) {
    if (!transcript) {
      return;
    }

    for (let index = 0; index < transcript.length; index += 1) {
      const segment = transcript[index];
      if (!segment || segment.text.trim().length === 0) {
        throwBadRequest(
          "VIDEO_TRANSCRIPT_INVALID",
          "Nội dung transcript không được để trống",
          { index },
        );
      }

      if (segment.endTime !== undefined && segment.endTime < segment.time) {
        throwBadRequest(
          "VIDEO_TRANSCRIPT_INVALID",
          "Thời gian kết thúc transcript phải lớn hơn hoặc bằng thời gian bắt đầu",
          { index },
        );
      }

      if (index > 0 && segment.time < transcript[index - 1]!.time) {
        throwBadRequest(
          "VIDEO_TRANSCRIPT_INVALID",
          "Các đoạn transcript phải được sắp xếp theo thời gian tăng dần",
          { index },
        );
      }
    }
  }

  async softDelete(lessonId: string, actorUserId: string, context: RequestContext = {}) {
    try {
      await this.prisma.$transaction(async (tx) => {
        const before = await tx.lesson.findFirst({
          where: {
            id: lessonId,
            deletedAt: null,
            learningPath: {
              deletedAt: null,
            },
            OR: [{ chapterId: null }, { chapter: { deletedAt: null } }],
          },
          select: lessonSelect,
        });

        if (!before) {
          throwLessonNotFound();
        }

        const archivedOrderIndex = await this.getNextArchivedOrderIndex(
          tx,
          before.learningPathId,
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
        await this.structureService.removeLesson(
          tx,
          before.learningPathId,
          before.chapterId,
        );

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
            learningPath: {
              deletedAt: null,
            },
            OR: [{ chapterId: null }, { chapter: { deletedAt: null } }],
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
        learningPath: {
          deletedAt: null,
        },
        OR: [{ chapterId: null }, { chapter: { deletedAt: null } }],
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
    learningPathId: string,
    chapterId: string | null,
  ) {
    const lesson = await tx.lesson.findFirst({
      where: {
        learningPathId,
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
    learningPathId: string,
    chapterId: string | null,
    title: string,
    excludedLessonId?: string,
  ) {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(
        hashtext('lesson-title'),
        hashtext(${chapterId ?? learningPathId})
      )
    `;

    const duplicatedLesson = await tx.lesson.findFirst({
      where: {
        learningPathId,
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
}

function parseLessonOverviewContent(
  value: Record<string, unknown>,
): Prisma.InputJsonValue {
  const parsed = tiptapTextDocumentSchema.safeParse(value);
  if (!parsed.success) {
    throwBadRequest(
      "VALIDATION_ERROR",
      "Tổng quan buổi học phải là tài liệu Tiptap hợp lệ",
    );
  }

  return parsed.data as Prisma.InputJsonValue;
}
