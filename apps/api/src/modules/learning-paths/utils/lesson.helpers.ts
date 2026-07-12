import { Prisma, PublishStatus } from "@prisma/client";
import {
  isPrismaRecordNotFoundError,
  isPrismaUniqueConstraintError,
} from "#api/common/errors/prisma-error.mapper";
import {
  throwBadRequest,
  throwConflict,
  throwNotFound,
} from "#api/common/errors/api-exception";

export function assertVideoUrlAllowed(videoUrl: string | null | undefined) {
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
  throwBadRequest(
    "VALIDATION_ERROR",
    "Video URL chỉ chấp nhận YouTube hoặc Google Drive",
  );
}

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

export function throwLearningPathNotFound(): never {
  throwNotFound("NOT_FOUND", "Không tìm thấy lộ trình học");
}

export function throwChapterNotFound(): never {
  throwNotFound("NOT_FOUND", "Không tìm thấy chương học");
}

export function throwLessonNotFound(): never {
  throwNotFound("NOT_FOUND", "Không tìm thấy buổi học");
}

export function getStatusAuditAction(defaultAction: string, status: PublishStatus) {
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

export function handleKnownPrismaError(error: unknown): never {
  if (isPrismaUniqueConstraintError(error)) {
    throwConflict("CONFLICT", "Thứ tự buổi học đã tồn tại trong chương");
  }

  if (isPrismaRecordNotFoundError(error)) {
    throwLessonNotFound();
  }

  throw error;
}
