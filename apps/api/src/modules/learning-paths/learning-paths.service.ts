import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, PublishStatus } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreateLearningPathDto } from "./dto/create-learning-path.dto";
import { LearningPathQueryDto } from "./dto/learning-path-query.dto";
import { PublicLearningPathQueryDto } from "./dto/public-learning-path-query.dto";
import { UpdateLearningPathDto } from "./dto/update-learning-path.dto";

const learningPathSelect = {
  id: true,
  subject: true,
  grade: true,
  title: true,
  slug: true,
  originalPriceVnd: true,
  salePriceVnd: true,
  totalLessonCount: true,
  thumbnailFileId: true,
  descriptionJson: true,
  status: true,
  trialEnabled: true,
  publishedAt: true,
  sortOrder: true,
  createdById: true,
  updatedById: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LearningPathSelect;

type LearningPathRecord = Prisma.LearningPathGetPayload<{
  select: typeof learningPathSelect;
}>;

type RequestContext = {
  ipAddress?: string;
  userAgent?: string;
};

type LearningPathResponse = {
  id: string;
  subject: LearningPathRecord["subject"];
  grade: number;
  title: string;
  slug: string;
  originalPriceVnd: number;
  salePriceVnd: number | null;
  totalLessonCount: number;
  thumbnailFileId: string | null;
  descriptionJson: Prisma.JsonValue | null;
  status: PublishStatus;
  trialEnabled: boolean;
  publishedAt: Date | null;
  sortOrder: number;
  createdById: string | null;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const publicLearningPathSelect = {
  id: true,
  subject: true,
  grade: true,
  title: true,
  slug: true,
  originalPriceVnd: true,
  salePriceVnd: true,
  totalLessonCount: true,
  thumbnailFileId: true,
  descriptionJson: true,
  status: true,
  trialEnabled: true,
  publishedAt: true,
  sortOrder: true,
  lessons: {
    where: {
      deletedAt: null,
      status: PublishStatus.PUBLISHED,
    },
    select: {
      id: true,
      orderIndex: true,
      title: true,
      shortDescription: true,
      examOpenAt: true,
      status: true,
    },
    orderBy: {
      orderIndex: "asc",
    },
  },
} satisfies Prisma.LearningPathSelect;

type PublicLearningPathRecord = Prisma.LearningPathGetPayload<{
  select: typeof publicLearningPathSelect;
}>;

@Injectable()
export class LearningPathsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listPublished(query: PublicLearningPathQueryDto) {
    const page = query.page;
    const pageSize = query.pageSize;
    const where: Prisma.LearningPathWhereInput = {
      deletedAt: null,
      status: PublishStatus.PUBLISHED,
      ...(query.subject ? { subject: query.subject } : {}),
      ...(query.grade ? { grade: query.grade } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.learningPath.findMany({
        where,
        select: publicLearningPathSelect,
        orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.learningPath.count({ where }),
    ]);

    return {
      data: items.map(serializePublicLearningPath),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getPublished(id: string) {
    const learningPath = await this.prisma.learningPath.findFirst({
      where: {
        id,
        deletedAt: null,
        status: PublishStatus.PUBLISHED,
      },
      select: publicLearningPathSelect,
    });

    if (!learningPath) {
      throwNotFound();
    }

    return serializePublicLearningPath(learningPath);
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
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Cần cung cấp ít nhất một trường để cập nhật",
      });
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

    throw new ConflictException({
      code: "CONFLICT",
      message: "Không thể tạo slug duy nhất cho lộ trình",
    });
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
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Không tìm thấy ảnh đại diện lộ trình",
      });
    }
  }
}

function serializeLearningPath(record: LearningPathRecord): LearningPathResponse {
  return {
    id: record.id,
    subject: record.subject,
    grade: record.grade,
    title: record.title,
    slug: record.slug,
    originalPriceVnd: record.originalPriceVnd,
    salePriceVnd: record.salePriceVnd,
    totalLessonCount: record.totalLessonCount,
    thumbnailFileId: record.thumbnailFileId,
    descriptionJson: record.descriptionJson,
    status: record.status,
    trialEnabled: record.trialEnabled,
    publishedAt: record.publishedAt,
    sortOrder: record.sortOrder,
    createdById: record.createdById,
    updatedById: record.updatedById,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function serializePublicLearningPath(record: PublicLearningPathRecord) {
  return {
    id: record.id,
    subject: record.subject,
    grade: record.grade,
    title: record.title,
    slug: record.slug,
    originalPriceVnd: record.originalPriceVnd,
    salePriceVnd: record.salePriceVnd,
    totalLessonCount: record.totalLessonCount,
    thumbnailFileId: record.thumbnailFileId,
    descriptionJson: record.descriptionJson,
    status: record.status,
    trialEnabled: record.trialEnabled,
    publishedAt: record.publishedAt,
    sortOrder: record.sortOrder,
    lessons: record.lessons.map((lesson) => ({
      id: lesson.id,
      orderIndex: lesson.orderIndex,
      title: lesson.title,
      shortDescription: lesson.shortDescription,
      examOpenAt: lesson.examOpenAt,
      status: lesson.status,
    })),
  };
}

function assertPriceValid(originalPriceVnd: number, salePriceVnd?: number | null) {
  if (salePriceVnd !== undefined && salePriceVnd !== null) {
    if (salePriceVnd > originalPriceVnd) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Giá sau khuyến mãi không được lớn hơn giá gốc",
      });
    }
  }
}

function createSlug(title: string) {
  const slug = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug || "learning-path";
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function toInputJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function throwNotFound(): never {
  throw new NotFoundException({
    code: "NOT_FOUND",
    message: "Không tìm thấy lộ trình học",
  });
}

function getStatusAuditAction(defaultAction: string, status: PublishStatus) {
  if (status === PublishStatus.PUBLISHED) {
    return "LEARNING_PATH_PUBLISHED";
  }

  if (status === PublishStatus.HIDDEN) {
    return "LEARNING_PATH_HIDDEN";
  }

  if (status === PublishStatus.ARCHIVED) {
    return "LEARNING_PATH_ARCHIVED";
  }

  return defaultAction;
}

function handleKnownPrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new ConflictException({
        code: "CONFLICT",
        message: "Slug lộ trình đã tồn tại",
      });
    }

    if (error.code === "P2025") {
      throwNotFound();
    }
  }

  throw error;
}
