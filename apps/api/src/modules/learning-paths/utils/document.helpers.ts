import { DocumentStatus, Prisma } from "@prisma/client";
import {
  isPrismaForeignKeyConstraintError,
  isPrismaUniqueConstraintError,
} from "#api/common/errors/prisma-error.mapper";
import {
  throwBadRequest,
  throwConflict,
  throwNotFound,
} from "#api/common/errors/api-exception";
import type { LessonPageRangeDto } from "#api/modules/learning-paths/dto/update-lesson-page-ranges.dto";
import type { PageRangeWarning } from "#api/modules/learning-paths/types/document.types";

type SourceDocumentPageReader = Pick<Prisma.TransactionClient, "sourceDocumentPage">;

type PageRangeSourceDocument = {
  id: string;
  pageCount: number | null;
  status: DocumentStatus;
};

export function normalizeOptionalTitle(value: string | null | undefined) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized : null;
}

export function toDocumentInputJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function assertPageRangeOrder(pageStart: number, pageEnd: number) {
  if (pageStart > pageEnd) {
    throwBadRequest(
      "VALIDATION_ERROR",
      "Trang bắt đầu phải nhỏ hơn hoặc bằng trang kết thúc",
    );
  }
}

export function assertNoDuplicateLessonRanges(ranges: LessonPageRangeDto[]) {
  const lessonIds = new Set<string>();
  const duplicatedLessonIds = new Set<string>();

  for (const range of ranges) {
    if (lessonIds.has(range.lessonId)) {
      duplicatedLessonIds.add(range.lessonId);
    }
    lessonIds.add(range.lessonId);
  }

  if (duplicatedLessonIds.size > 0) {
    throwBadRequest("VALIDATION_ERROR", "Một buổi học chỉ được gửi một page range", {
      duplicatedLessonIds: [...duplicatedLessonIds],
    });
  }
}

export async function assertSourceDocumentReadyForPageRanges(
  tx: SourceDocumentPageReader,
  sourceDocument: PageRangeSourceDocument,
) {
  if (sourceDocument.status !== DocumentStatus.READY) {
    throwBadRequest("SOURCE_DOCUMENT_NOT_READY", "Tài liệu nguồn chưa xử lý xong");
  }

  const pageLimit = await resolveSourceDocumentPageLimit(tx, sourceDocument);
  const totalPages = await tx.sourceDocumentPage.count({
    where: {
      sourceDocumentId: sourceDocument.id,
    },
  });

  if (totalPages < pageLimit) {
    throwBadRequest(
      "SOURCE_DOCUMENT_NOT_READY",
      "Tài liệu nguồn chưa có đủ dữ liệu trang",
      {
        expectedPageCount: pageLimit,
        readyPageRows: totalPages,
      },
    );
  }

  const notReadyPageCount = await tx.sourceDocumentPage.count({
    where: {
      sourceDocumentId: sourceDocument.id,
      status: {
        not: DocumentStatus.READY,
      },
    },
  });

  if (notReadyPageCount > 0) {
    throwBadRequest(
      "SOURCE_DOCUMENT_NOT_READY",
      "Tài liệu nguồn còn trang chưa sẵn sàng",
      {
        pageCount: notReadyPageCount,
      },
    );
  }

  const pageMetadata = await tx.sourceDocumentPage.findMany({
    where: {
      sourceDocumentId: sourceDocument.id,
    },
    select: {
      metadataJson: true,
    },
  });
  const printedPageWarningCount = pageMetadata.filter((page) =>
    hasPrintedPageWarning(page.metadataJson),
  ).length;

  if (printedPageWarningCount > 0) {
    throwBadRequest(
      "SOURCE_DOCUMENT_PAGE_REVIEW_REQUIRED",
      "Tài liệu nguồn còn trang cần xác nhận",
      {
        pageCount: printedPageWarningCount,
      },
    );
  }

  return pageLimit;
}

export async function resolveSourceDocumentPageLimit(
  tx: SourceDocumentPageReader,
  sourceDocument: Pick<PageRangeSourceDocument, "id" | "pageCount">,
) {
  if (sourceDocument.pageCount) {
    return sourceDocument.pageCount;
  }

  const latestPage = await tx.sourceDocumentPage.findFirst({
    where: {
      sourceDocumentId: sourceDocument.id,
    },
    select: {
      pageNumber: true,
    },
    orderBy: {
      pageNumber: "desc",
    },
  });

  if (!latestPage) {
    throwBadRequest(
      "VALIDATION_ERROR",
      "Tài liệu nguồn chưa có thông tin số trang để gán page range",
    );
  }

  return latestPage.pageNumber;
}

export function buildPageRangeWarnings(
  ranges: LessonPageRangeDto[],
  pageCount: number | null,
): PageRangeWarning[] {
  const warnings: PageRangeWarning[] = [];
  const sortedRanges = [...ranges].sort((left, right) => {
    if (left.pageStart === right.pageStart) {
      return left.pageEnd - right.pageEnd;
    }

    return left.pageStart - right.pageStart;
  });

  const overlaps = [];
  for (let index = 1; index < sortedRanges.length; index += 1) {
    const previous = sortedRanges[index - 1]!;
    const current = sortedRanges[index]!;

    if (current.pageStart <= previous.pageEnd) {
      overlaps.push({
        lessonId: current.lessonId,
        pageStart: current.pageStart,
        pageEnd: current.pageEnd,
        overlapsWithLessonId: previous.lessonId,
      });
    }
  }

  if (overlaps.length > 0) {
    warnings.push({
      code: "PAGE_RANGE_OVERLAP",
      message: "Có khoảng trang bị trùng giữa các buổi học",
      details: overlaps,
    });
  }

  if (pageCount && sortedRanges.length > 0) {
    const gaps = [];
    let cursor = 1;

    for (const range of sortedRanges) {
      if (range.pageStart > cursor) {
        gaps.push({ pageStart: cursor, pageEnd: range.pageStart - 1 });
      }
      cursor = Math.max(cursor, range.pageEnd + 1);
    }

    if (cursor <= pageCount) {
      gaps.push({ pageStart: cursor, pageEnd: pageCount });
    }

    if (gaps.length > 0) {
      warnings.push({
        code: "PAGE_RANGE_GAP",
        message: "Có trang trong tài liệu nguồn chưa được gán vào buổi học",
        details: gaps,
      });
    }
  }

  return warnings;
}

export function throwSourceDocumentNotFound(): never {
  throwNotFound("NOT_FOUND", "Không tìm thấy tài liệu nguồn");
}

export function throwLessonDocumentNotFound(): never {
  throwNotFound("NOT_FOUND", "Không tìm thấy tài liệu của buổi học");
}

export function throwDocumentFileNotFound(): never {
  throwNotFound("NOT_FOUND", "Không tìm thấy file tài liệu");
}

export function handleDocumentPrismaError(error: unknown): never {
  if (isPrismaUniqueConstraintError(error)) {
    throwConflict("CONFLICT", "Tài liệu hoặc page range đã tồn tại");
  }

  if (isPrismaForeignKeyConstraintError(error)) {
    throwBadRequest("VALIDATION_ERROR", "Dữ liệu liên kết không hợp lệ");
  }

  throw error;
}

function hasPrintedPageWarning(metadataJson: unknown) {
  const metadata = readRecord(metadataJson);
  const printedPage = readRecord(metadata?.printedPage);
  const warning = printedPage?.warning;

  return typeof warning === "string" && warning.trim().length > 0;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
