import { Inject, Injectable } from "@nestjs/common";
import { Prisma, PublishStatus } from "@prisma/client";
import { throwBadRequest } from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { CreateChapterDto } from "#api/modules/learning-paths/dto/create-chapter.dto";
import { UpdateChapterDto } from "#api/modules/learning-paths/dto/update-chapter.dto";
import { LearningPathStructureService } from "#api/modules/learning-paths/services/learning-path-structure.service";
import {
  chapterDetailSelect,
  chapterSelect,
} from "#api/modules/learning-paths/selectors/chapter.selects";
import {
  serializeChapter,
  serializeChapterDetail,
} from "#api/modules/learning-paths/serializers/chapter.serializers";
import type { RequestContext } from "#api/modules/learning-paths/types/chapter.types";
import {
  getStatusAuditAction,
  handleKnownPrismaError,
  normalizeOptionalText,
  normalizeText,
  throwChapterNotFound,
  throwLearningPathNotFound,
  toInputJson,
} from "#api/modules/learning-paths/utils/chapter.helpers";

@Injectable()
export class ChaptersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LearningPathStructureService)
    private readonly structureService: LearningPathStructureService,
  ) {}

  async listForAdmin(learningPathId: string) {
    await this.assertLearningPathExists(learningPathId);

    const chapters = await this.prisma.learningPathChapter.findMany({
      where: {
        learningPathId,
        deletedAt: null,
      },
      select: chapterDetailSelect,
      orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
    });

    return chapters.map(serializeChapterDetail);
  }

  async getForAdmin(chapterId: string) {
    const chapter = await this.findActiveById(chapterId);
    return serializeChapterDetail(chapter);
  }

  async create(
    learningPathId: string,
    actorUserId: string,
    dto: CreateChapterDto,
    context: RequestContext = {},
  ) {
    try {
      const chapter = await this.prisma.$transaction(async (tx) => {
        await this.assertLearningPathExists(learningPathId, tx);

        const status = dto.status ?? PublishStatus.DRAFT;
        const temporaryOrderIndex = await this.structureService.getTemporaryChapterOrder(
          tx,
          learningPathId,
        );
        const created = await tx.learningPathChapter.create({
          data: {
            learningPathId,
            orderIndex: temporaryOrderIndex,
            title: normalizeText(dto.title),
            overview: normalizeOptionalText(dto.overview),
            objectivesJson: toInputJson(dto.objectivesJson),
            status,
            createdById: actorUserId,
            updatedById: actorUserId,
          },
          select: chapterSelect,
        });
        await this.structureService.insertChapter(tx, learningPathId, created.id);

        await tx.learningPath.update({
          where: { id: learningPathId },
          data: {
            totalChapterCount: {
              increment: 1,
            },
            updatedById: actorUserId,
          },
        });
        const ordered = await tx.learningPathChapter.findUniqueOrThrow({
          where: { id: created.id },
          select: chapterSelect,
        });

        await tx.auditLog.create({
          data: {
            actorUserId,
            action: getStatusAuditAction("CHAPTER_CREATED", status),
            entityType: "LearningPathChapter",
            entityId: created.id,
            after: toInputJson(serializeChapter(ordered)),
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
          },
        });

        return ordered;
      });

      return serializeChapter(chapter);
    } catch (error) {
      handleKnownPrismaError(error);
    }
  }

  async update(
    chapterId: string,
    actorUserId: string,
    dto: UpdateChapterDto,
    context: RequestContext = {},
  ) {
    if (Object.keys(dto).length === 0) {
      throwBadRequest("VALIDATION_ERROR", "Cần cung cấp ít nhất một trường để cập nhật");
    }

    try {
      const chapter = await this.prisma.$transaction(async (tx) => {
        const before = await tx.learningPathChapter.findFirst({
          where: {
            id: chapterId,
            deletedAt: null,
            learningPath: {
              deletedAt: null,
            },
          },
          select: chapterSelect,
        });

        if (!before) {
          throwChapterNotFound();
        }

        if (dto.orderIndex !== undefined && dto.orderIndex !== before.orderIndex) {
          await this.structureService.moveChapter(
            tx,
            before.learningPathId,
            before.id,
            dto.orderIndex,
          );
        }

        const status = dto.status ?? before.status;
        const updated = await tx.learningPathChapter.update({
          where: { id: chapterId },
          data: {
            ...(dto.title !== undefined ? { title: normalizeText(dto.title) } : {}),
            ...(dto.overview !== undefined
              ? { overview: normalizeOptionalText(dto.overview) }
              : {}),
            ...(dto.objectivesJson !== undefined
              ? { objectivesJson: toInputJson(dto.objectivesJson) ?? Prisma.JsonNull }
              : {}),
            ...(dto.status !== undefined ? { status } : {}),
            updatedById: actorUserId,
          },
          select: chapterSelect,
        });

        await tx.learningPath.update({
          where: { id: before.learningPathId },
          data: {
            updatedById: actorUserId,
          },
        });

        await tx.auditLog.create({
          data: {
            actorUserId,
            action: getStatusAuditAction("CHAPTER_UPDATED", updated.status),
            entityType: "LearningPathChapter",
            entityId: updated.id,
            before: toInputJson(serializeChapter(before)),
            after: toInputJson(serializeChapter(updated)),
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
          },
        });

        return updated;
      });

      return serializeChapter(chapter);
    } catch (error) {
      handleKnownPrismaError(error);
    }
  }

  async softDelete(chapterId: string, actorUserId: string, context: RequestContext = {}) {
    try {
      await this.prisma.$transaction(async (tx) => {
        const before = await tx.learningPathChapter.findFirst({
          where: {
            id: chapterId,
            deletedAt: null,
            learningPath: {
              deletedAt: null,
            },
          },
          select: {
            ...chapterSelect,
            lessons: {
              where: {
                deletedAt: null,
              },
              select: {
                id: true,
              },
            },
          },
        });

        if (!before) {
          throwChapterNotFound();
        }

        const archivedOrderIndex = await this.getNextArchivedOrderIndex(
          tx,
          before.learningPathId,
        );
        const deletedAt = new Date();
        const deleted = await tx.learningPathChapter.update({
          where: { id: chapterId },
          data: {
            orderIndex: archivedOrderIndex,
            status: PublishStatus.ARCHIVED,
            deletedAt,
            updatedById: actorUserId,
            lessons: {
              updateMany: {
                where: {
                  deletedAt: null,
                },
                data: {
                  status: PublishStatus.ARCHIVED,
                  deletedAt,
                  updatedById: actorUserId,
                },
              },
            },
          },
          select: chapterSelect,
        });
        await this.structureService.removeChapter(tx, before.learningPathId);

        await tx.learningPath.update({
          where: { id: before.learningPathId },
          data: {
            totalChapterCount: {
              decrement: 1,
            },
            totalLessonCount: {
              decrement: before.lessons.length,
            },
            updatedById: actorUserId,
          },
        });

        await tx.auditLog.create({
          data: {
            actorUserId,
            action: "CHAPTER_SOFT_DELETED",
            entityType: "LearningPathChapter",
            entityId: deleted.id,
            before: toInputJson(serializeChapter(before)),
            after: toInputJson(serializeChapter(deleted)),
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

  async publish(chapterId: string, actorUserId: string, context: RequestContext = {}) {
    try {
      const chapter = await this.prisma.$transaction(async (tx) => {
        const before = await tx.learningPathChapter.findFirst({
          where: {
            id: chapterId,
            deletedAt: null,
            learningPath: {
              deletedAt: null,
            },
          },
          select: chapterSelect,
        });

        if (!before) {
          throwChapterNotFound();
        }

        const updated = await tx.learningPathChapter.update({
          where: { id: chapterId },
          data: {
            status: PublishStatus.PUBLISHED,
            updatedById: actorUserId,
          },
          select: chapterSelect,
        });

        await tx.auditLog.create({
          data: {
            actorUserId,
            action: "CHAPTER_PUBLISHED",
            entityType: "LearningPathChapter",
            entityId: updated.id,
            before: toInputJson(serializeChapter(before)),
            after: toInputJson(serializeChapter(updated)),
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
          },
        });

        return updated;
      });

      return serializeChapter(chapter);
    } catch (error) {
      handleKnownPrismaError(error);
    }
  }

  private async assertLearningPathExists(
    learningPathId: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const learningPath = await tx.learningPath.findFirst({
      where: { id: learningPathId, deletedAt: null },
      select: { id: true },
    });

    if (!learningPath) {
      throwLearningPathNotFound();
    }
  }

  private async findActiveById(chapterId: string) {
    const chapter = await this.prisma.learningPathChapter.findFirst({
      where: {
        id: chapterId,
        deletedAt: null,
        learningPath: {
          deletedAt: null,
        },
      },
      select: chapterDetailSelect,
    });

    if (!chapter) {
      throwChapterNotFound();
    }

    return chapter;
  }

  private async getNextArchivedOrderIndex(
    tx: Prisma.TransactionClient,
    learningPathId: string,
  ) {
    const chapter = await tx.learningPathChapter.findFirst({
      where: {
        learningPathId,
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

    return chapter ? chapter.orderIndex - 1 : -1;
  }
}
