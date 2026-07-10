import { Prisma, PublishStatus } from "@prisma/client";
import {
  isPrismaRecordNotFoundError,
  isPrismaUniqueConstraintError,
} from "#api/common/errors/prisma-error.mapper";
import {
  throwBadRequest,
  throwConflict,
  throwNotFound as throwApiNotFound,
} from "#api/common/errors/api-exception";

export function getPublicLearningPathOrderBy(): Prisma.LearningPathOrderByWithRelationInput[] {
  return [{ sortOrder: "asc" }, { publishedAt: "desc" }];
}

export function getIdOrSlugWhere(idOrSlug: string): Prisma.LearningPathWhereInput {
  if (isUuid(idOrSlug)) {
    return { id: idOrSlug };
  }

  return { slug: idOrSlug };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function assertPriceValid(originalPriceVnd: number, salePriceVnd?: number | null) {
  if (salePriceVnd !== undefined && salePriceVnd !== null) {
    if (salePriceVnd > originalPriceVnd) {
      throwBadRequest(
        "VALIDATION_ERROR",
        "Giá sau khuyến mãi không được lớn hơn giá gốc",
      );
    }
  }
}

export function createSlug(title: string) {
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

export function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function toInputJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function throwNotFound(): never {
  throwApiNotFound("NOT_FOUND", "Không tìm thấy lộ trình học");
}

export function getStatusAuditAction(defaultAction: string, status: PublishStatus) {
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

export function handleKnownPrismaError(error: unknown): never {
  if (isPrismaUniqueConstraintError(error)) {
    throwConflict("CONFLICT", "Slug lộ trình đã tồn tại");
  }

  if (isPrismaRecordNotFoundError(error)) {
    throwNotFound();
  }

  throw error;
}
