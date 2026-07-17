import {
  BackgroundJobQueue,
  BackgroundJobStatus,
  DocumentStatus,
  FileProvider,
  FilePurpose,
  FileStatus,
  FileVisibility,
  LessonDocumentKind,
  Prisma,
} from "@prisma/client";
import {
  documentFileSelect,
  documentJobSelect,
  lessonDocumentPageRangeSelect,
  lessonDocumentSelect,
  sourceDocumentPageSelect,
  sourceDocumentSelect,
} from "#api/modules/learning-paths/selectors/document.selects";

export type DocumentFileRecord = Prisma.FileGetPayload<{
  select: typeof documentFileSelect;
}>;

export type DocumentJobRecord = Prisma.BackgroundJobGetPayload<{
  select: typeof documentJobSelect;
}>;

export type SourceDocumentRecord = Prisma.SourceDocumentGetPayload<{
  select: typeof sourceDocumentSelect;
}>;

export type SourceDocumentPageRecord = Prisma.SourceDocumentPageGetPayload<{
  select: typeof sourceDocumentPageSelect;
}>;

export type LessonDocumentPageRangeRecord =
  Prisma.LessonDocumentPageRangeGetPayload<{
    select: typeof lessonDocumentPageRangeSelect;
  }>;

export type LessonDocumentRecord = Prisma.LessonDocumentGetPayload<{
  select: typeof lessonDocumentSelect;
}>;

export type DocumentFileResponse = {
  id: string;
  provider: FileProvider;
  purpose: FilePurpose;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  visibility: FileVisibility;
  status: FileStatus;
  uploadedById: string | null;
  publicUrl: string | null;
  checksum: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DocumentJobResponse = {
  jobId: string;
  queue: BackgroundJobQueue;
  status: BackgroundJobStatus;
  resourceType: string | null;
  resourceId: string | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
  finishedAt: Date | null;
};

export type SourceDocumentResponse = {
  id: string;
  learningPathId: string;
  fileId: string;
  file: DocumentFileResponse;
  title: string | null;
  status: DocumentStatus;
  pageCount: number | null;
  contentHash: string | null;
  processingJobId: string | null;
  processingJob: DocumentJobResponse | null;
  processedAt: Date | null;
  metadataJson: unknown;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export type SourceDocumentPageResponse = {
  id: string;
  sourceDocumentId: string;
  pageNumber: number;
  status: DocumentStatus;
  textSource: string | null;
  qualityScore: number | null;
  thumbnailFileId: string | null;
  thumbnailFile: DocumentFileResponse | null;
  textPreview: string | null;
  extractError: string | null;
  metadataJson: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export type LessonDocumentPageRangeResponse = {
  id: string;
  lessonId: string;
  sourceDocumentId: string;
  pageStart: number;
  pageEnd: number;
  createdById: string | null;
  metadataJson: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export type LessonDocumentResponse = {
  id: string;
  lessonId: string;
  fileId: string;
  file: DocumentFileResponse;
  sourceDocumentId: string | null;
  sourceDocument: {
    id: string;
    learningPathId: string;
    title: string | null;
    status: DocumentStatus;
    pageCount: number | null;
  } | null;
  kind: LessonDocumentKind;
  title: string | null;
  status: DocumentStatus;
  extractError: string | null;
  contentHash: string | null;
  chunkCount: number;
  processingJobId: string | null;
  processingJob: DocumentJobResponse | null;
  processedAt: Date | null;
  embeddingProvider: string | null;
  embeddingModel: string | null;
  embeddingDimensions: number | null;
  metadataJson: unknown;
  createdAt: Date;
  updatedAt: Date;
  replacedAt: Date | null;
};

export type PageRangeWarning = {
  code: "PAGE_RANGE_OVERLAP" | "PAGE_RANGE_GAP";
  message: string;
  details: unknown;
};

export type PageRangeSaveResponse = {
  sourceDocument: SourceDocumentResponse;
  ranges: LessonDocumentPageRangeResponse[];
  lessonDocuments: LessonDocumentResponse[];
  warnings: PageRangeWarning[];
};
