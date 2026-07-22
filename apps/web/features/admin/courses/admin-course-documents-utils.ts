import type {
  AdminLesson,
  AdminLearningPath,
} from "@/features/admin/courses/admin-courses-data";
import type {
  AdminBackgroundJobStatus,
  AdminDocumentStatus,
  AdminLessonDocumentApi,
  AdminLessonDocumentKind,
  AdminLessonPageRangeInput,
  AdminPageRangeWarningApi,
  AdminSourceDocumentApi,
  AdminSourceDocumentPageApi,
} from "@/features/admin/courses/types/admin-course-document-types";

export type AdminLessonWithChapter = {
  chapterOrder: number;
  chapterTitle: string;
  lesson: AdminLesson;
};

export type LessonRangeDraft = Record<
  string,
  {
    pageEnd: string;
    pageStart: string;
  }
>;

export type LessonRangeValidationIssue = {
  lessonId: string;
  message: string;
};

export type LessonRangeValidationResult = {
  issues: LessonRangeValidationIssue[];
  ranges: AdminLessonPageRangeInput[];
};

export type PrintedPageView = {
  confidence: number | null;
  pdfPageNumber: number | null;
  printedPageLabel: string | null;
  printedPageNumber: number | null;
  warning: string | null;
};

export type PageVisualSummary = {
  artifactAuditKey: string | null;
  hasVisualAssets: boolean;
  imageManifestKey: string | null;
  visualAssetCount: number;
};

export type SourceDocumentRangeReadiness = {
  isReady: boolean;
  reason: string;
  warningPageCount: number;
};

export type DocumentStatusView = {
  label: string;
  toneClass: string;
};

const documentStatusViews: Record<AdminDocumentStatus, DocumentStatusView> = {
  FAILED: {
    label: "Có lỗi",
    toneClass:
      "border-[var(--theme-danger-border)] bg-[var(--theme-danger-soft)] text-[var(--theme-danger)]",
  },
  PROCESSING: {
    label: "Đang xử lý",
    toneClass:
      "border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] text-[var(--theme-warning-text)]",
  },
  READY: {
    label: "Sẵn sàng",
    toneClass:
      "border-[var(--theme-success-border)] bg-[var(--theme-success-bg)] text-[var(--theme-success-text)]",
  },
  UPLOADED: {
    label: "Đã tải lên",
    toneClass:
      "border-[var(--theme-primary-border)] bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]",
  },
};

const jobStatusLabels: Record<AdminBackgroundJobStatus, string> = {
  CANCELLED: "Đã hủy",
  FAILED: "Có lỗi",
  QUEUED: "Đang chờ",
  RUNNING: "Đang chạy",
  SUCCEEDED: "Đã xong",
};

export function getDocumentStatusView(status: AdminDocumentStatus) {
  return documentStatusViews[status];
}

export function getJobStatusLabel(status: AdminBackgroundJobStatus | null | undefined) {
  return status ? jobStatusLabels[status] : "Chưa có";
}

export function getLessonsWithChapter(path: AdminLearningPath): AdminLessonWithChapter[] {
  return path.chapters.flatMap((chapter) =>
    chapter.lessons.map((lesson) => ({
      chapterOrder: chapter.orderIndex,
      chapterTitle: chapter.title,
      lesson,
    })),
  );
}

export function groupLessonDocumentsByLessonId(documents: AdminLessonDocumentApi[]) {
  return documents.reduce<Record<string, AdminLessonDocumentApi[]>>(
    (groups, document) => {
      groups[document.lessonId] = [...(groups[document.lessonId] ?? []), document];
      return groups;
    },
    {},
  );
}

export function getPrimaryLessonDocument(documents: AdminLessonDocumentApi[]) {
  return documents.find((document) => document.kind !== "SUPPLEMENT") ?? null;
}

export function getSupplementLessonDocuments(documents: AdminLessonDocumentApi[]) {
  return documents.filter((document) => document.kind === "SUPPLEMENT");
}

export function getLessonDocumentRange(document: AdminLessonDocumentApi | null) {
  const metadata = readRecord(document?.metadataJson);
  const pageStart = readNumber(metadata?.pageStart);
  const pageEnd = readNumber(metadata?.pageEnd);

  if (pageStart === null || pageEnd === null) {
    return null;
  }

  return { pageStart, pageEnd };
}

export function createInitialRangeDraft(
  lessons: AdminLessonWithChapter[],
  documentsByLessonId: Record<string, AdminLessonDocumentApi[]>,
  sourceDocumentId: string | null | undefined,
  sourcePages: AdminSourceDocumentPageApi[],
): LessonRangeDraft {
  return lessons.reduce<LessonRangeDraft>((draft, item) => {
    const primary = getPrimaryLessonDocument(documentsByLessonId[item.lesson.id] ?? []);
    const range =
      primary?.sourceDocumentId === sourceDocumentId
        ? getLessonDocumentRange(primary)
        : null;

    draft[item.lesson.id] = {
      pageStart: range ? getPrintedPageFromPdfPage(range.pageStart, sourcePages) : "",
      pageEnd: range ? getPrintedPageFromPdfPage(range.pageEnd, sourcePages) : "",
    };

    return draft;
  }, {});
}

export function getLessonSourceRangeFormValues(
  lessonId: string | null | undefined,
  documentsByLessonId: Record<string, AdminLessonDocumentApi[]>,
  fallbackSourceDocumentId: string | null | undefined,
  sourcePages: AdminSourceDocumentPageApi[],
) {
  if (!lessonId) {
    return {
      sourceDocumentId: fallbackSourceDocumentId ?? "",
      pageStart: "",
      pageEnd: "",
    };
  }

  const primary = getPrimaryLessonDocument(documentsByLessonId[lessonId] ?? []);
  const range = getLessonDocumentRange(primary);

  return {
    sourceDocumentId: primary?.sourceDocumentId ?? fallbackSourceDocumentId ?? "",
    pageStart: range ? getPrintedPageFromPdfPage(range.pageStart, sourcePages) : "",
    pageEnd: range ? getPrintedPageFromPdfPage(range.pageEnd, sourcePages) : "",
  };
}

export function validateLessonRangeDraft(
  lessons: AdminLessonWithChapter[],
  draft: LessonRangeDraft,
  pageLimit: number | null,
  sourcePages: AdminSourceDocumentPageApi[],
): LessonRangeValidationResult {
  const issues: LessonRangeValidationIssue[] = [];
  const ranges: AdminLessonPageRangeInput[] = [];

  for (const item of lessons) {
    const values = draft[item.lesson.id] ?? { pageEnd: "", pageStart: "" };
    const pageStart = getPdfPageFromPrintedPage(values.pageStart, sourcePages);
    const pageEnd = getPdfPageFromPrintedPage(values.pageEnd, sourcePages);

    if (values.pageStart.trim() === "" || values.pageEnd.trim() === "") {
      issues.push({
        lessonId: item.lesson.id,
        message: "Nhập đủ trang bắt đầu và kết thúc.",
      });
      continue;
    }

    if (pageStart === null || pageEnd === null) {
      issues.push({
        lessonId: item.lesson.id,
        message: "Số trang phải là số nguyên dương.",
      });
      continue;
    }

    if (pageStart > pageEnd) {
      issues.push({
        lessonId: item.lesson.id,
        message: "Trang bắt đầu không được lớn hơn trang kết thúc.",
      });
      continue;
    }

    if (pageLimit !== null && pageEnd > pageLimit) {
      issues.push({
        lessonId: item.lesson.id,
        message: `Tài liệu chỉ có ${pageLimit} trang.`,
      });
      continue;
    }

    ranges.push({
      lessonId: item.lesson.id,
      pageEnd,
      pageStart,
    });
  }

  return { issues, ranges };
}

export function buildLocalPageRangeWarnings(
  ranges: AdminLessonPageRangeInput[],
  pageCount: number | null,
): AdminPageRangeWarningApi[] {
  const warnings: AdminPageRangeWarningApi[] = [];
  const sortedRanges = [...ranges].sort((left, right) => {
    if (left.pageStart === right.pageStart) {
      return left.pageEnd - right.pageEnd;
    }

    return left.pageStart - right.pageStart;
  });
  const overlaps: Array<{
    lessonId: string;
    overlapsWithLessonId: string;
    pageEnd: number;
    pageStart: number;
  }> = [];

  for (let index = 1; index < sortedRanges.length; index += 1) {
    const previous = sortedRanges[index - 1]!;
    const current = sortedRanges[index]!;

    if (current.pageStart <= previous.pageEnd) {
      overlaps.push({
        lessonId: current.lessonId,
        overlapsWithLessonId: previous.lessonId,
        pageEnd: current.pageEnd,
        pageStart: current.pageStart,
      });
    }
  }

  if (overlaps.length > 0) {
    warnings.push({
      code: "PAGE_RANGE_OVERLAP",
      details: overlaps,
      message: "Có khoảng trang bị trùng giữa các buổi học",
    });
  }

  if (pageCount && sortedRanges.length > 0) {
    const gaps: Array<{ pageEnd: number; pageStart: number }> = [];
    let cursor = 1;

    for (const range of sortedRanges) {
      if (range.pageStart > cursor) {
        gaps.push({ pageEnd: range.pageStart - 1, pageStart: cursor });
      }
      cursor = Math.max(cursor, range.pageEnd + 1);
    }

    if (cursor <= pageCount) {
      gaps.push({ pageEnd: pageCount, pageStart: cursor });
    }

    if (gaps.length > 0) {
      warnings.push({
        code: "PAGE_RANGE_GAP",
        details: gaps,
        message: "Có trang trong tài liệu chính chưa được gán vào buổi học",
      });
    }
  }

  return warnings;
}

export function getSourceDocumentPageLimit(
  sourceDocument: AdminSourceDocumentApi | null,
  pages: AdminSourceDocumentPageApi[],
) {
  if (sourceDocument?.pageCount) {
    return sourceDocument.pageCount;
  }

  return pages.at(-1)?.pageNumber ?? null;
}

export function getSourceDocumentStats(pages: AdminSourceDocumentPageApi[]) {
  const readyPages = pages.filter((page) => page.status === "READY").length;
  const failedPages = pages.filter((page) => page.status === "FAILED").length;
  const processingPages = pages.filter((page) => page.status === "PROCESSING").length;
  const qualityScores = pages
    .map((page) => page.qualityScore)
    .filter((score): score is number => typeof score === "number");
  const averageQuality =
    qualityScores.length > 0
      ? qualityScores.reduce((total, score) => total + score, 0) / qualityScores.length
      : null;

  return {
    averageQuality,
    failedPages,
    processingPages,
    readyPages,
    totalPages: pages.length,
  };
}

export function getSourceDocumentRangeReadiness(
  sourceDocument: AdminSourceDocumentApi | null,
  pages: AdminSourceDocumentPageApi[],
): SourceDocumentRangeReadiness {
  if (!sourceDocument) {
    return {
      isReady: false,
      reason: "Chưa có tài liệu chính.",
      warningPageCount: 0,
    };
  }

  if (sourceDocument.status !== "READY") {
    return {
      isReady: false,
      reason: "Tài liệu chưa đọc xong.",
      warningPageCount: 0,
    };
  }

  const failedPages = pages.filter((page) => page.status === "FAILED").length;
  if (failedPages > 0) {
    return {
      isReady: false,
      reason: `${failedPages} trang cần xử lý lại.`,
      warningPageCount: failedPages,
    };
  }

  const pendingPages = pages.filter((page) => page.status !== "READY").length;
  if (pendingPages > 0) {
    return {
      isReady: false,
      reason: `${pendingPages} trang chưa sẵn sàng.`,
      warningPageCount: pendingPages,
    };
  }

  const pageLimit = getSourceDocumentPageLimit(sourceDocument, pages);
  if (!pageLimit || pages.length < pageLimit) {
    return {
      isReady: false,
      reason: "Đang chờ đủ dữ liệu trang.",
      warningPageCount: 0,
    };
  }

  const printedPageWarnings = pages.filter((page) => {
    const printedPage = getPrintedPageView(page);
    return Boolean(printedPage.warning);
  }).length;

  if (printedPageWarnings > 0) {
    return {
      isReady: false,
      reason: `${printedPageWarnings} trang cần kiểm tra số trang in.`,
      warningPageCount: printedPageWarnings,
    };
  }

  return {
    isReady: true,
    reason: "Tài liệu đã sẵn sàng.",
    warningPageCount: 0,
  };
}

export function getPrintedPageView(page: AdminSourceDocumentPageApi): PrintedPageView {
  const metadata = readRecord(page.metadataJson);
  const printedPage = readRecord(metadata?.printedPage);

  return {
    confidence: readNumber(printedPage?.confidence),
    pdfPageNumber: readNumber(printedPage?.pdfPageNumber) ?? page.pageNumber,
    printedPageLabel: readString(printedPage?.printedPageLabel),
    printedPageNumber: readNumber(printedPage?.printedPageNumber),
    warning: readString(printedPage?.warning),
  };
}

export function getPageVisualSummary(
  page: AdminSourceDocumentPageApi,
): PageVisualSummary {
  const metadata = readRecord(page.metadataJson);
  const artifacts = readRecord(metadata?.artifacts);
  const visualAssetCount =
    readNumber(metadata?.visualAssetCount) ??
    readNumber(metadata?.visualsCount) ??
    readNumber(artifacts?.visualAssetCount) ??
    0;

  return {
    artifactAuditKey:
      readString(metadata?.artifactAuditKey) ?? readString(artifacts?.artifactAuditJson),
    hasVisualAssets:
      Boolean(metadata?.hasVisualAssets) ||
      visualAssetCount > 0 ||
      Boolean(page.thumbnailFile),
    imageManifestKey:
      readString(metadata?.imageManifestKey) ?? readString(artifacts?.imageManifestJson),
    visualAssetCount,
  };
}

export function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatQualityPercent(score: number | null) {
  if (score === null) {
    return "Chưa có";
  }

  return `${Math.round(score * 100)}%`;
}

export function formatDocumentKind(kind: AdminLessonDocumentKind) {
  if (kind === "SUPPLEMENT") {
    return "Bổ sung";
  }

  if (kind === "PRIMARY_REPLACEMENT") {
    return "Tài liệu chính";
  }

  return "Từ tài liệu chính";
}

export type OcrPageIssue = {
  pageNumber: number;
  type: "failed" | "warning" | "processing";
  message: string;
};

export type OcrStatusSummary = {
  totalPages: number;
  readyPages: number;
  failedPages: number;
  processingPages: number;
  warningPages: number;
  issues: OcrPageIssue[];
  isAllClear: boolean;
};

export function getOcrStatusSummary(
  pages: AdminSourceDocumentPageApi[],
): OcrStatusSummary {
  const issues: OcrPageIssue[] = [];
  let readyPages = 0;
  let failedPages = 0;
  let processingPages = 0;
  let warningPages = 0;

  for (const page of pages) {
    if (page.status === "FAILED") {
      failedPages += 1;
      issues.push({
        pageNumber: page.pageNumber,
        type: "failed",
        message: page.extractError ?? "Lỗi không xác định",
      });
    } else if (page.status === "PROCESSING") {
      processingPages += 1;
      issues.push({
        pageNumber: page.pageNumber,
        type: "processing",
        message: "Đang xử lý",
      });
    } else if (page.status === "READY") {
      const printedPage = getPrintedPageView(page);
      if (printedPage.warning) {
        warningPages += 1;
        readyPages += 1;
        issues.push({
          pageNumber: page.pageNumber,
          type: "warning",
          message: `Trang in chưa rõ — ${printedPage.warning}`,
        });
      } else {
        readyPages += 1;
      }
    }
  }

  return {
    totalPages: pages.length,
    readyPages,
    failedPages,
    processingPages,
    warningPages,
    issues,
    isAllClear: issues.length === 0 && pages.length > 0,
  };
}

function parsePositiveInteger(value: string) {
  if (!/^\d+$/.test(value.trim())) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function getPdfPageFromPrintedPage(
  printedPageStr: string,
  sourcePages: AdminSourceDocumentPageApi[],
): number | null {
  if (!printedPageStr.trim()) {
    return null;
  }

  const str = printedPageStr.trim().toLowerCase();

  for (const page of sourcePages) {
    const printedPage = getPrintedPageView(page);
    if (printedPage.printedPageLabel?.toLowerCase() === str) {
      return page.pageNumber;
    }
    if (printedPage.printedPageNumber?.toString() === str) {
      return page.pageNumber;
    }
  }

  const parsed = parsePositiveInteger(printedPageStr);
  if (parsed !== null && sourcePages.some((p) => p.pageNumber === parsed)) {
    return parsed;
  }

  return null;
}

export function getPrintedPageFromPdfPage(
  pdfPageNum: number | null | undefined,
  sourcePages: AdminSourceDocumentPageApi[],
): string {
  if (pdfPageNum == null) {
    return "";
  }

  const page = sourcePages.find((p) => p.pageNumber === pdfPageNum);
  if (!page) {
    return String(pdfPageNum);
  }

  const printedPage = getPrintedPageView(page);
  return (
    printedPage.printedPageLabel ??
    printedPage.printedPageNumber?.toString() ??
    String(pdfPageNum)
  );
}

