import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, PublishStatus } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreateLessonDto } from "./dto/create-lesson.dto";
import { UpdateLessonDto } from "./dto/update-lesson.dto";

const lessonSelect = {
  id: true,
  learningPathId: true,
  orderIndex: true,
  title: true,
  shortDescription: true,
  scheduledAt: true,
  examOpenAt: true,
  videoUrl: true,
  completionMinScore: true,
  status: true,
  createdById: true,
  updatedById: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LessonSelect;

type LessonRecord = Prisma.LessonGetPayload<{
  select: typeof lessonSelect;
}>;

type LessonResponse = {
  id: string;
  learningPathId: string;
  orderIndex: number;
  title: string;
  shortDescription: string | null;
  scheduledAt: Date | null;
  examOpenAt: Date | null;
  videoUrl: string | null;
  completionMinScore: number;
  status: PublishStatus;
  createdById: string | null;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type RequestContext = {
  ipAddress?: string;
  userAgent?: string;
};

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
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Cần cung cấp ít nhất một trường để cập nhật",
      });
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

function serializeLesson(record: LessonRecord): LessonResponse {
  return {
    id: record.id,
    learningPathId: record.learningPathId,
    orderIndex: record.orderIndex,
    title: record.title,
    shortDescription: record.shortDescription,
    scheduledAt: record.scheduledAt,
    examOpenAt: record.examOpenAt,
    videoUrl: record.videoUrl,
    completionMinScore: Number(record.completionMinScore),
    status: record.status,
    createdById: record.createdById,
    updatedById: record.updatedById,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function assertVideoUrlAllowed(videoUrl: string | null | undefined) {
  const normalized = videoUrl?.trim();
  if (!normalized) {
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throwInvalidVideoUrl();
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const isAllowedProtocol = parsed.protocol === "https:" || parsed.protocol === "http:";
  const isAllowedHost =
    hostname === "youtube.com" ||
    hostname === "m.youtube.com" ||
    hostname === "youtu.be" ||
    hostname === "youtube-nocookie.com" ||
    hostname === "drive.google.com";

  if (!isAllowedProtocol || !isAllowedHost) {
    throwInvalidVideoUrl();
  }
}

function throwInvalidVideoUrl(): never {
  throw new BadRequestException({
    code: "VALIDATION_ERROR",
    message: "Video URL chỉ chấp nhận YouTube hoặc Google Drive",
  });
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeOptionalText(value: string | null | undefined) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
}

function toInputJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function throwLearningPathNotFound(): never {
  throw new NotFoundException({
    code: "NOT_FOUND",
    message: "Không tìm thấy lộ trình học",
  });
}

function throwLessonNotFound(): never {
  throw new NotFoundException({
    code: "NOT_FOUND",
    message: "Không tìm thấy buổi học",
  });
}

function getStatusAuditAction(defaultAction: string, status: PublishStatus) {
  if (status === PublishStatus.PUBLISHED) {
    return "LESSON_PUBLISHED";
  }

  if (status === PublishStatus.HIDDEN) {
    return "LESSON_HIDDEN";
  }

  if (status === PublishStatus.ARCHIVED) {
    return "LESSON_ARCHIVED";
  }

  return defaultAction;
}

function handleKnownPrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new ConflictException({
        code: "CONFLICT",
        message: "Thứ tự buổi học đã tồn tại trong lộ trình",
      });
    }

    if (error.code === "P2025") {
      throwLessonNotFound();
    }
  }

  throw error;
}
