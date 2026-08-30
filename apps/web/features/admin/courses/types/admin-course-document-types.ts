import type { AdminJobErrorDetails } from "@/lib/admin-job-error";

export type AdminDocumentStatus = "UPLOADED" | "PROCESSING" | "READY" | "FAILED";

export type AdminBackgroundJobStatus =
  "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

export type AdminLessonDocumentKind = "PRIMARY_FROM_SOURCE" | "SUPPLEMENT" | "HOMEWORK";

export type AdminDocumentFileApi = {
  id: string;
  provider: string;
  purpose: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  visibility: string;
  status: string;
  uploadedById: string | null;
  publicUrl: string | null;
  checksum: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminDocumentJobApi = {
  jobId: string;
  queue: string;
  status: AdminBackgroundJobStatus;
  resourceType: string | null;
  resourceId: string | null;
  progress?: number;
  error: string | null;
  errorDetails: AdminJobErrorDetails | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
};

export type AdminSourceDocumentApi = {
  id: string;
  learningPathId: string;
  fileId: string;
  file: AdminDocumentFileApi;
  title: string | null;
  status: AdminDocumentStatus;
  pageCount: number | null;
  contentHash: string | null;
  processingJobId: string | null;
  processingJob: AdminDocumentJobApi | null;
  processedAt: string | null;
  metadataJson: unknown;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  readiness?: {
    status: "READY" | "NEEDS_CONFIRMATION" | "PROCESSING" | "FAILED" | "NOT_READY";
    isEligibleForExtraction: boolean;
    warningPageCount: number;
    readyPageCount: number;
    totalPageRecords: number;
  };
};

export type AdminSourceDocumentPageApi = {
  id: string;
  sourceDocumentId: string;
  pageNumber: number;
  status: AdminDocumentStatus;
  textSource: string | null;
  qualityScore: number | null;
  thumbnailFileId: string | null;
  thumbnailFile: AdminDocumentFileApi | null;
  textPreview: string | null;
  fullText: string | null;
  mathpixMarkdown: string | null;
  orderedContent?: string | null;
  ocrImages?: AdminSourceDocumentPageOcrImageApi[];
  extractError: string | null;
  metadataJson: unknown;
  createdAt: string;
  updatedAt: string;
};

export type AdminSourceDocumentPageOcrImageApi = {
  caption: string | null;
  imageId: string;
  kind: string | null;
  mimeType: string | null;
  orderInPage: number;
  url: string;
};

export type AdminSearchablePdfValidationStatus =
  "PENDING" | "PASSED" | "WARNING" | "FAILED" | "PROMOTED" | "EXPIRED";

export type AdminSearchablePdfValidationApi = {
  id: string;
  status: AdminSearchablePdfValidationStatus;
  expiresAt: string;
  promotedAt?: string | null;
  contactSheetUrl: string | null;
  report: {
    version: 1;
    pageCount: number;
    geometryEquivalent: boolean;
    layoutEquivalent: boolean;
    searchablePageCount: number;
    searchablePageRatio: number;
    emptyTextPageNumbers: number[];
    cropAudit: { checked: number; passed: number; failedImageIds: string[] };
    hardFailures: string[];
    warnings: string[];
  };
};

export type AdminLessonDocumentPageRangeApi = {
  id: string;
  lessonId: string;
  sourceDocumentId: string;
  pageStart: number;
  pageEnd: number;
  createdById: string | null;
  metadataJson: unknown;
  createdAt: string;
  updatedAt: string;
};

export type AdminLessonDocumentApi = {
  id: string;
  lessonId: string;
  fileId: string;
  file: AdminDocumentFileApi;
  sourceDocumentId: string | null;
  sourceDocument: {
    id: string;
    learningPathId: string;
    title: string | null;
    status: AdminDocumentStatus;
    pageCount: number | null;
  } | null;
  pageRangeId: string | null;
  pageRange: AdminLessonDocumentPageRangeApi | null;
  kind: AdminLessonDocumentKind;
  sortOrder: number;
  title: string | null;
  status: AdminDocumentStatus;
  extractError: string | null;
  contentHash: string | null;
  chunkCount: number;
  processingJobId: string | null;
  processingJob: AdminDocumentJobApi | null;
  processedAt: string | null;
  embeddingProvider: string | null;
  embeddingModel: string | null;
  embeddingDimensions: number | null;
  metadataJson: unknown;
  createdAt: string;
  updatedAt: string;
  replacedAt: string | null;
};

export type AdminPageRangeWarningApi = {
  code: "PAGE_RANGE_OVERLAP" | "PAGE_RANGE_GAP";
  message: string;
  details: unknown;
};

export type AdminPageRangeSaveResponseApi = {
  sourceDocument: AdminSourceDocumentApi;
  ranges: AdminLessonDocumentPageRangeApi[];
  lessonDocuments: AdminLessonDocumentApi[];
  warnings: AdminPageRangeWarningApi[];
};

export type AdminFileUploadApi = {
  id: string;
  originalName: string;
  publicUrl: string | null;
};

export type AdminSignedUrlApi = {
  url: string;
  expiresAt: string;
};

export type AdminLessonPageRangeInput = {
  lessonId: string;
  pageStart: number;
  pageEnd: number;
  isPrimary?: boolean;
};
