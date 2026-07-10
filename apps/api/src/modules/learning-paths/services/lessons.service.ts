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
  throwLearningPathNotFound,
  throwLessonNotFound,
  toInputJson,
} from "#api/modules/learning-paths/utils/lesson.helpers";
import { lessonSelect } from "#api/modules/learning-paths/selectors/lesson.selects";
import { serializeLesson } from "#api/modules/learning-paths/serializers/lesson.serializers";
import type { RequestContext } from "#api/modules/learning-paths/types/lesson.types";

@Injectable()
export class LessonsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listForAdmin(learningPathId: string) {
    await this.assertLearningPathExists(learningPathId);

    const lessons = await this.prisma.lesson.findMany({
      where: {
        learningPathId,
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
    learningPathId: string,
    actorUserId: string,
    dto: CreateLessonDto,
    context: RequestContext = {},
  ) {
    assertVideoUrlAllowed(dto.videoUrl);

    try {
      const lesson = await this.prisma.$transaction(async (tx) => {
        const learningPath = await tx.learningPath.findFirst({
          where: { id: learningPathId, deletedAt: null },
          select: { id: true },
        });

        if (!learningPath) {
          throwLearningPathNotFound();
        }

        const status = dto.status ?? PublishStatus.DRAFT;
        const created = await tx.lesson.create({
          data: {
            learningPathId,
            orderIndex: dto.orderIndex,
            title: normalizeText(dto.title),
            shortDescription: normalizeOptionalText(dto.shortDescription),
            scheduledAt: dto.scheduledAt ?? null,
            examOpenAt: dto.examOpenAt ?? null,
            videoUrl: normalizeOptionalText(dto.videoUrl),
            completionMinScore: dto.completionMinScore ?? 7,
            status,
            createdById: actorUserId,
            updatedById: actorUserId,
          },
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
            after: toInputJson(serializeLesson(created)),
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
          },
        });

        return created;
      });

      return serializeLesson(lesson);
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
      const lesson = await this.prisma.$transaction(async (tx) => {
        const before = await tx.lesson.findFirst({
          where: {
            id: lessonId,
            deletedAt: null,
            learningPath: {
              deletedAt: null,
            },
          },
          select: lessonSelect,
        });

        if (!before) {
          throwLessonNotFound();
        }

        const status = dto.status ?? before.status;
        const updated = await tx.lesson.update({
          where: { id: lessonId },
          data: {
            ...(dto.orderIndex !== undefined ? { orderIndex: dto.orderIndex } : {}),
            ...(dto.title !== undefined ? { title: normalizeText(dto.title) } : {}),
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

        return updated;
      });

      return serializeLesson(lesson);
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
          before.learningPathId,
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

  private async assertLearningPathExists(learningPathId: string) {
    const learningPath = await this.prisma.learningPath.findFirst({
      where: { id: learningPathId, deletedAt: null },
      select: { id: true },
    });

    if (!learningPath) {
      throwLearningPathNotFound();
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
  ) {
    const lesson = await tx.lesson.findFirst({
      where: {
        learningPathId,
        deletedAt: {
          not: null,
        },
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
}
