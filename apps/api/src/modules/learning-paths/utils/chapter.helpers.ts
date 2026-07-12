import { Prisma, PublishStatus } from "@prisma/client";
import {
  isPrismaRecordNotFoundError,
  isPrismaUniqueConstraintError,
} from "#api/common/errors/prisma-error.mapper";
import { throwConflict, throwNotFound } from "#api/common/errors/api-exception";

export function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeOptionalText(value: string | null | undefined) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
}

export function toInputJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function throwChapterNotFound(): never {
  throwNotFound("NOT_FOUND", "Không tìm thấy chương học");
}

export function throwLearningPathNotFound(): never {
  throwNotFound("NOT_FOUND", "Không tìm thấy lộ trình học");
}

export function getStatusAuditAction(defaultAction: string, status: PublishStatus) {
  if (status === PublishStatus.PUBLISHED) {
    return "CHAPTER_PUBLISHED";
  }

  if (status === PublishStatus.HIDDEN) {
    return "CHAPTER_HIDDEN";
  }

  if (status === PublishStatus.ARCHIVED) {
    return "CHAPTER_ARCHIVED";
  }

  return defaultAction;
}

export function handleKnownPrismaError(error: unknown): never {
  if (isPrismaUniqueConstraintError(error)) {
    throwConflict("CONFLICT", "Thứ tự chương học đã tồn tại trong lộ trình");
  }

  if (isPrismaRecordNotFoundError(error)) {
    throwChapterNotFound();
  }

  throw error;
}
