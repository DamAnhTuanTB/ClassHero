import { Inject, Injectable } from "@nestjs/common";
import {
  FilePurpose,
  LearningPathKind,
  Prisma,
  PublishStatus,
} from "@prisma/client";
import {
  throwBadRequest,
  throwConflict,
  throwNotFound as throwApiNotFound,
} from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { FilesService } from "#api/modules/files/services/files.service";
import { CreateLearningPathDto } from "#api/modules/learning-paths/dto/create-learning-path.dto";
import { LearningPathQueryDto } from "#api/modules/learning-paths/dto/learning-path-query.dto";
import { UpdateLearningPathDto } from "#api/modules/learning-paths/dto/update-learning-path.dto";
import {
  assertPriceValid,
  createSlug,
  getStatusAuditAction,
  handleKnownPrismaError,
  normalizeText,
  throwNotFound,
  toInputJson,
} from "#api/modules/learning-paths/utils/learning-path.helpers";
import {
  learningPathDetailSelect,
  learningPathSelect,
} from "#api/modules/learning-paths/selectors/learning-path.selects";
import { serializeLearningPath } from "#api/modules/learning-paths/serializers/learning-path.serializers";
import type {
  LearningPathDetailRecord,
  LearningPathRecord,
  RequestContext,
} from "#api/modules/learning-paths/types/learning-path.types";

@Injectable()
export class LearningPathsService {
  constructor(
    @Inject(FilesService) private readonly filesService: FilesService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async listForAdmin(query: LearningPathQueryDto) {
    const page = query.page;
    const pageSize = query.pageSize;
    const shouldListArchived = query.status === PublishStatus.ARCHIVED;
    const where: Prisma.LearningPathWhereInput = {
      kind: LearningPathKind.CATALOG,
      deletedAt: shouldListArchived ? { not: null } : null,
      ...(query.status
        ? { status: query.status }
        : { status: { not: PublishStatus.ARCHIVED } }),
      ...(query.subject ? { subject: query.subject } : {}),
      ...(query.grade ? { grade: query.grade } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: "insensitive" } },
              { slug: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.learningPath.findMany({
        where,
        select: learningPathSelect,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.learningPath.count({ where }),
    ]);

    return {
      data: await Promise.all(
        items.map((item) => this.serializeLearningPathWithFiles(item)),
      ),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getForAdmin(id: string) {
    const learningPath = await this.findActiveById(id);
    return this.serializeLearningPathWithFiles(learningPath);
  }

  async create(
    actorUserId: string,
    dto: CreateLearningPathDto,
    context: RequestContext = {},
  ) {
    assertPriceValid(dto.originalPriceVnd, dto.salePriceVnd);
    await this.assertThumbnailFileAllowed(dto.thumbnailFileId);

    const slug = dto.slug ?? (await this.createUniqueSlug(dto.title));
    const status = dto.status ?? PublishStatus.DRAFT;
    const now = new Date();

    try {
      const learningPath = await this.prisma.$transaction(async (tx) => {
        const created = await tx.learningPath.create({
          data: {
            subject: dto.subject,
            grade: dto.grade,
            title: normalizeText(dto.title),
            slug,
            originalPriceVnd: dto.originalPriceVnd,
            salePriceVnd: dto.salePriceVnd ?? null,
            ...(dto.thumbnailFileId
              ? {
                  thumbnailFile: {
                    connect: {
                      id: dto.thumbnailFileId,
                    },
                  },
                }
              : {}),
            descriptionJson: toInputJson(dto.descriptionJson),
            status,
            publishedAt: status === PublishStatus.PUBLISHED ? now : null,
            sortOrder: dto.sortOrder ?? 0,
            createdBy: {
              connect: {
                id: actorUserId,
              },
            },
            updatedBy: {
              connect: {
                id: actorUserId,
              },
            },
          },
          select: learningPathSelect,
        });

        await tx.auditLog.create({
          data: {
            actorUserId,
            action: getStatusAuditAction("LEARNING_PATH_CREATED", status),
            entityType: "LearningPath",
            entityId: created.id,
            after: toInputJson(serializeLearningPath(created)),
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
          },
        });

        return created;
      });

      return this.serializeLearningPathWithFiles(learningPath);
    } catch (error) {
      handleKnownPrismaError(error);
    }
  }

  async update(
    id: string,
    actorUserId: string,
    dto: UpdateLearningPathDto,
    context: RequestContext = {},
  ) {
    if (Object.keys(dto).length === 0) {
      throwBadRequest("VALIDATION_ERROR", "Cần cung cấp ít nhất một trường để cập nhật");
    }

    await this.assertThumbnailFileAllowed(dto.thumbnailFileId);

    try {
      const learningPath = await this.prisma.$transaction(async (tx) => {
        const before = await tx.learningPath.findFirst({
          where: { id, deletedAt: null },
          select: learningPathSelect,
        });

        if (!before) {
          throwNotFound();
        }
        if (
          before.kind === LearningPathKind.PERSONALIZED &&
          dto.status !== undefined &&
          dto.status !== PublishStatus.PUBLISHED
        ) {
          throwConflict(
            "PERSONAL_LEARNING_PATH_STATUS_CHANGE_FORBIDDEN",
            "Khóa học cá nhân đang là chương trình chính thức và phải luôn được phát hành",
          );
        }

        const originalPriceVnd = dto.originalPriceVnd ?? before.originalPriceVnd;
        const salePriceVnd =
          dto.salePriceVnd === undefined ? before.salePriceVnd : dto.salePriceVnd;
        assertPriceValid(originalPriceVnd, salePriceVnd);

        const status = dto.status ?? before.status;
        const now = new Date();
        const data: Prisma.LearningPathUpdateInput = {
          ...(dto.title !== undefined ? { title: normalizeText(dto.title) } : {}),
          ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
          ...(dto.subject !== undefined ? { subject: dto.subject } : {}),
          ...(dto.grade !== undefined ? { grade: dto.grade } : {}),
          ...(dto.originalPriceVnd !== undefined
            ? { originalPriceVnd: dto.originalPriceVnd }
            : {}),
          ...(dto.salePriceVnd !== undefined
            ? { salePriceVnd: dto.salePriceVnd ?? null }
            : {}),
          ...(dto.thumbnailFileId !== undefined
            ? {
                thumbnailFile: dto.thumbnailFileId
                  ? {
                      connect: {
                        id: dto.thumbnailFileId,
                      },
                    }
                  : {
                      disconnect: true,
                    },
              }
            : {}),
          ...(dto.descriptionJson !== undefined
            ? { descriptionJson: toInputJson(dto.descriptionJson) }
            : {}),
          ...(dto.status !== undefined ? { status } : {}),
          ...(dto.status === PublishStatus.PUBLISHED &&
          before.status !== PublishStatus.PUBLISHED
            ? { publishedAt: now }
            : {}),
          ...(dto.status !== undefined && dto.status !== PublishStatus.PUBLISHED
            ? { publishedAt: null }
            : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          updatedBy: {
            connect: {
              id: actorUserId,
            },
          },
        };

        const updated = await tx.learningPath.update({
          where: { id },
          data,
          select: learningPathSelect,
        });

        await tx.auditLog.create({
          data: {
            actorUserId,
            action: getStatusAuditAction("LEARNING_PATH_UPDATED", updated.status),
            entityType: "LearningPath",
            entityId: updated.id,
            before: toInputJson(serializeLearningPath(before)),
            after: toInputJson(serializeLearningPath(updated)),
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
          },
        });

        return updated;
      });

      return this.serializeLearningPathWithFiles(learningPath);
    } catch (error) {
      handleKnownPrismaError(error);
    }
  }

  async softDelete(id: string, actorUserId: string, context: RequestContext = {}) {
    try {
      await this.prisma.$transaction(async (tx) => {
        const before = await tx.learningPath.findFirst({
          where: { id, deletedAt: null },
          select: learningPathSelect,
        });

        if (!before) {
          throwNotFound();
        }
        this.assertCanDeleteLearningPath(before.kind);

        const deleted = await tx.learningPath.update({
          where: { id },
          data: {
            status: PublishStatus.ARCHIVED,
            publishedAt: null,
            deletedAt: new Date(),
            updatedBy: {
              connect: {
                id: actorUserId,
              },
            },
          },
          select: learningPathSelect,
        });

        await tx.auditLog.create({
          data: {
            actorUserId,
            action: "LEARNING_PATH_SOFT_DELETED",
            entityType: "LearningPath",
            entityId: deleted.id,
            before: toInputJson(serializeLearningPath(before)),
            after: toInputJson(serializeLearningPath(deleted)),
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

  async restore(id: string, actorUserId: string, context: RequestContext = {}) {
    try {
      const learningPath = await this.prisma.$transaction(async (tx) => {
        const before = await tx.learningPath.findFirst({
          where: {
            id,
            status: PublishStatus.ARCHIVED,
            deletedAt: {
              not: null,
            },
          },
          select: learningPathSelect,
        });

        if (!before) {
          throwNotFound();
        }

        const restored = await tx.learningPath.update({
          where: { id },
          data: {
            status: PublishStatus.DRAFT,
            publishedAt: null,
            deletedAt: null,
            updatedBy: {
              connect: {
                id: actorUserId,
              },
            },
          },
          select: learningPathSelect,
        });

        await tx.auditLog.create({
          data: {
            actorUserId,
            action: "LEARNING_PATH_RESTORED",
            entityType: "LearningPath",
            entityId: restored.id,
            before: toInputJson(serializeLearningPath(before)),
            after: toInputJson(serializeLearningPath(restored)),
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
          },
        });

        return restored;
      });

      return this.serializeLearningPathWithFiles(learningPath);
    } catch (error) {
      handleKnownPrismaError(error);
    }
  }

  async permanentDelete(id: string, actorUserId: string, context: RequestContext = {}) {
    try {
      await this.prisma.$transaction(async (tx) => {
        const before = await tx.learningPath.findFirst({
          where: {
            id,
            status: PublishStatus.ARCHIVED,
            deletedAt: {
              not: null,
            },
          },
          select: learningPathSelect,
        });

        if (!before) {
          throwNotFound();
        }
        this.assertCanDeleteLearningPath(before.kind);

        await tx.auditLog.create({
          data: {
            actorUserId,
            action: "LEARNING_PATH_PERMANENT_DELETED",
            entityType: "LearningPath",
            entityId: before.id,
            before: toInputJson(serializeLearningPath(before)),
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
          },
        });

        await tx.learningPath.delete({
          where: { id },
        });
      });
    } catch (error) {
      handleKnownPrismaError(error);
    }

    return { success: true };
  }

  async publish(id: string, actorUserId: string, context: RequestContext = {}) {
    try {
      const learningPath = await this.prisma.$transaction(async (tx) => {
        const before = await tx.learningPath.findFirst({
          where: { id, deletedAt: null },
          select: learningPathSelect,
        });

        if (!before) {
          throwNotFound();
        }

        const updated = await tx.learningPath.update({
          where: { id },
          data: {
            status: PublishStatus.PUBLISHED,
            publishedAt: before.publishedAt ?? new Date(),
            updatedBy: {
              connect: {
                id: actorUserId,
              },
            },
          },
          select: learningPathSelect,
        });

        await tx.auditLog.create({
          data: {
            actorUserId,
            action: "LEARNING_PATH_PUBLISHED",
            entityType: "LearningPath",
            entityId: updated.id,
            before: toInputJson(serializeLearningPath(before)),
            after: toInputJson(serializeLearningPath(updated)),
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
          },
        });

        return updated;
      });

      return this.serializeLearningPathWithFiles(learningPath);
    } catch (error) {
      handleKnownPrismaError(error);
    }
  }

  private async findActiveById(id: string) {
    const learningPath = await this.prisma.learningPath.findFirst({
      where: { id, deletedAt: null },
      select: learningPathDetailSelect,
    });

    if (!learningPath) {
      throwNotFound();
    }

    return learningPath;
  }

  private assertCanDeleteLearningPath(kind: LearningPathKind) {
    if (kind === LearningPathKind.PERSONALIZED) {
      throwConflict(
        "PERSONAL_LEARNING_PATH_DELETE_FORBIDDEN",
        "Khóa học cá nhân là chương trình học vĩnh viễn của enrollment và không thể xóa",
      );
    }
  }

  private async serializeLearningPathWithFiles(
    learningPath: LearningPathRecord | LearningPathDetailRecord,
  ) {
    const thumbnailUrl = await this.filesService.resolveAccessUrl(
      learningPath.thumbnailFile,
    );

    return serializeLearningPath(learningPath, thumbnailUrl);
  }

  private async createUniqueSlug(title: string) {
    const baseSlug = createSlug(title);
    const existing = await this.prisma.learningPath.findMany({
      where: {
        slug: {
          startsWith: baseSlug,
        },
      },
      select: {
        slug: true,
      },
    });

    const existingSlugs = new Set(existing.map((item) => item.slug));
    if (!existingSlugs.has(baseSlug)) {
      return baseSlug;
    }

    for (let index = 2; index <= 1000; index += 1) {
      const candidate = `${baseSlug}-${index}`;
      if (!existingSlugs.has(candidate)) {
        return candidate;
      }
    }

    throwConflict("CONFLICT", "Không thể tạo slug duy nhất cho lộ trình");
  }

  private async assertThumbnailFileAllowed(fileId: string | null | undefined) {
    if (!fileId) {
      return;
    }

    const file = await this.prisma.file.findFirst({
      where: {
        id: fileId,
        deletedAt: null,
      },
      select: {
        id: true,
        purpose: true,
      },
    });

    if (!file) {
      throwApiNotFound("NOT_FOUND", "Không tìm thấy ảnh đại diện lộ trình");
    }

    if (file.purpose !== FilePurpose.EDITOR_IMAGE) {
      throwBadRequest(
        "FILE_PURPOSE_NOT_ALLOWED",
        "Ảnh đại diện lộ trình phải dùng purpose EDITOR_IMAGE",
      );
    }
  }
}
