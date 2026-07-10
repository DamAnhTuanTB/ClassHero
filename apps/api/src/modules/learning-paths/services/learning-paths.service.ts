import { Inject, Injectable } from "@nestjs/common";
import { EnrollmentStatus, Prisma, PublishStatus, UserRole } from "@prisma/client";
import type { AuthenticatedUser } from "#api/common/auth/authenticated-request";
import {
  throwBadRequest,
  throwConflict,
  throwNotFound as throwApiNotFound,
} from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { CreateLearningPathDto } from "#api/modules/learning-paths/dto/create-learning-path.dto";
import { LearningPathQueryDto } from "#api/modules/learning-paths/dto/learning-path-query.dto";
import { PublicLearningPathQueryDto } from "#api/modules/learning-paths/dto/public-learning-path-query.dto";
import { UpdateLearningPathDto } from "#api/modules/learning-paths/dto/update-learning-path.dto";
import {
  assertPriceValid,
  createSlug,
  getIdOrSlugWhere,
  getPublicLearningPathOrderBy,
  getStatusAuditAction,
  handleKnownPrismaError,
  normalizeText,
  throwNotFound,
  toInputJson,
} from "#api/modules/learning-paths/utils/learning-path.helpers";
import {
  learningPathSelect,
  publicLearningPathSelect,
} from "#api/modules/learning-paths/selectors/learning-path.selects";
import {
  serializeLearningPath,
  serializePublicLearningPath,
} from "#api/modules/learning-paths/serializers/learning-path.serializers";
import type {
  PublicViewerContext,
  RequestContext,
} from "#api/modules/learning-paths/types/learning-path.types";

@Injectable()
export class LearningPathsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listPublished(query: PublicLearningPathQueryDto, user?: AuthenticatedUser) {
    const page = query.page;
    const pageSize = query.pageSize;
    const viewer = await this.createPublicViewerContext(user);
    const where: Prisma.LearningPathWhereInput = {
      deletedAt: null,
      status: PublishStatus.PUBLISHED,
      ...(query.subject ? { subject: query.subject } : {}),
      ...(query.grade ? { grade: query.grade } : {}),
    };

    const [items, total, gradeGroups] = await Promise.all([
      this.findPublishedPage(where, query.grade, viewer.studentGrade, page, pageSize),
      this.prisma.learningPath.count({ where }),
      this.prisma.learningPath.groupBy({
        by: ["grade"],
        where,
        _count: {
          _all: true,
        },
        orderBy: {
          grade: "asc",
        },
      }),
    ]);

    await this.attachActiveEnrollments(
      viewer,
      items.map((item) => item.id),
    );

    return {
      data: items.map((item) => serializePublicLearningPath(item, viewer)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        priorityGrade: query.grade ?? viewer.studentGrade ?? null,
        gradeGroups: gradeGroups.map((group) => ({
          grade: group.grade,
          count: group._count._all,
        })),
      },
    };
  }

  async getPublished(idOrSlug: string, user?: AuthenticatedUser) {
    const viewer = await this.createPublicViewerContext(user);
    const learningPath = await this.prisma.learningPath.findFirst({
      where: {
        ...getIdOrSlugWhere(idOrSlug),
        deletedAt: null,
        status: PublishStatus.PUBLISHED,
      },
      select: publicLearningPathSelect,
    });

    if (!learningPath) {
      throwNotFound();
    }

    await this.attachActiveEnrollments(viewer, [learningPath.id]);

    return serializePublicLearningPath(learningPath, viewer);
  }

  private async findPublishedPage(
    where: Prisma.LearningPathWhereInput,
    explicitGrade: number | undefined,
    priorityGrade: number | undefined,
    page: number,
    pageSize: number,
  ) {
    const orderBy = getPublicLearningPathOrderBy();
    const skip = (page - 1) * pageSize;

    if (explicitGrade || !priorityGrade) {
      return this.prisma.learningPath.findMany({
        where,
        select: publicLearningPathSelect,
        orderBy,
        skip,
        take: pageSize,
      });
    }

    const priorityWhere: Prisma.LearningPathWhereInput = {
      ...where,
      grade: priorityGrade,
    };
    const otherWhere: Prisma.LearningPathWhereInput = {
      ...where,
      NOT: {
        grade: priorityGrade,
      },
    };
    const priorityTotal = await this.prisma.learningPath.count({
      where: priorityWhere,
    });

    if (skip >= priorityTotal) {
      return this.prisma.learningPath.findMany({
        where: otherWhere,
        select: publicLearningPathSelect,
        orderBy,
        skip: skip - priorityTotal,
        take: pageSize,
      });
    }

    const priorityItems = await this.prisma.learningPath.findMany({
      where: priorityWhere,
      select: publicLearningPathSelect,
      orderBy,
      skip,
      take: pageSize,
    });
    const remaining = pageSize - priorityItems.length;

    if (remaining <= 0) {
      return priorityItems;
    }

    const otherItems = await this.prisma.learningPath.findMany({
      where: otherWhere,
      select: publicLearningPathSelect,
      orderBy,
      take: remaining,
    });

    return [...priorityItems, ...otherItems];
  }

  private async createPublicViewerContext(
    user: AuthenticatedUser | undefined,
  ): Promise<PublicViewerContext> {
    if (!user || user.role !== UserRole.STUDENT) {
      return {
        user,
        activeEnrollmentByLearningPathId: new Map(),
      };
    }

    const studentProfile = await this.prisma.studentProfile.findUnique({
      where: {
        userId: user.id,
      },
      select: {
        grade: true,
      },
    });

    return {
      user,
      studentGrade: studentProfile?.grade,
      activeEnrollmentByLearningPathId: new Map(),
    };
  }

  private async attachActiveEnrollments(
    viewer: PublicViewerContext,
    learningPathIds: string[],
  ) {
    if (
      !viewer.user ||
      viewer.user.role !== UserRole.STUDENT ||
      learningPathIds.length === 0
    ) {
      return;
    }

    const now = new Date();
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        studentUserId: viewer.user.id,
        learningPathId: {
          in: learningPathIds,
        },
        status: EnrollmentStatus.ACTIVE,
        startsAt: {
          lte: now,
        },
        expiresAt: {
          gt: now,
        },
      },
      select: {
        id: true,
        learningPathId: true,
        status: true,
        startsAt: true,
        expiresAt: true,
      },
    });

    for (const enrollment of enrollments) {
      viewer.activeEnrollmentByLearningPathId.set(enrollment.learningPathId, {
        id: enrollment.id,
        status: enrollment.status,
        startsAt: enrollment.startsAt,
        expiresAt: enrollment.expiresAt,
      });
    }
  }

  async listForAdmin(query: LearningPathQueryDto) {
    const page = query.page;
    const pageSize = query.pageSize;
    const where: Prisma.LearningPathWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
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
      data: items.map(serializeLearningPath),
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
    return serializeLearningPath(learningPath);
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
            thumbnailFileId: dto.thumbnailFileId ?? null,
            descriptionJson: toInputJson(dto.descriptionJson),
            status,
            trialEnabled: dto.trialEnabled ?? true,
            publishedAt: status === PublishStatus.PUBLISHED ? now : null,
            sortOrder: dto.sortOrder ?? 0,
            createdById: actorUserId,
            updatedById: actorUserId,
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

      return serializeLearningPath(learningPath);
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
            ? { thumbnailFileId: dto.thumbnailFileId ?? null }
            : {}),
          ...(dto.descriptionJson !== undefined
            ? { descriptionJson: toInputJson(dto.descriptionJson) }
            : {}),
          ...(dto.trialEnabled !== undefined ? { trialEnabled: dto.trialEnabled } : {}),
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

      return serializeLearningPath(learningPath);
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

        const deleted = await tx.learningPath.update({
          where: { id },
          data: {
            status: PublishStatus.ARCHIVED,
            publishedAt: null,
            deletedAt: new Date(),
            updatedById: actorUserId,
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
            updatedById: actorUserId,
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

      return serializeLearningPath(learningPath);
    } catch (error) {
      handleKnownPrismaError(error);
    }
  }

  private async findActiveById(id: string) {
    const learningPath = await this.prisma.learningPath.findFirst({
      where: { id, deletedAt: null },
      select: learningPathSelect,
    });

    if (!learningPath) {
      throwNotFound();
    }

    return learningPath;
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

  private async assertThumbnailFileAllowed(fileId: string | undefined) {
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
      },
    });

    if (!file) {
      throwApiNotFound("NOT_FOUND", "Không tìm thấy ảnh đại diện lộ trình");
    }
  }
}
