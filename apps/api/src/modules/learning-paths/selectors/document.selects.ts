import { Prisma } from "@prisma/client";

export const documentFileSelect = {
  id: true,
  provider: true,
  purpose: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  visibility: true,
  status: true,
  uploadedById: true,
  publicUrl: true,
  checksum: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.FileSelect;

export const documentJobSelect = {
  id: true,
  queue: true,
  status: true,
  resourceType: true,
  resourceId: true,
  result: true,
  errorMessage: true,
  createdAt: true,
  updatedAt: true,
  finishedAt: true,
} satisfies Prisma.BackgroundJobSelect;

export const sourceDocumentSelect = {
  id: true,
  learningPathId: true,
  fileId: true,
  file: {
    select: documentFileSelect,
  },
  title: true,
  status: true,
  pageCount: true,
  contentHash: true,
  activeOcrArtifactId: true,
  processingJobId: true,
  processingJob: {
    select: documentJobSelect,
  },
  processedAt: true,
  metadataJson: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} satisfies Prisma.SourceDocumentSelect;

export const sourceDocumentPageSelect = {
  id: true,
  sourceDocumentId: true,
  pageNumber: true,
  status: true,
  text: true,
  mathpixMarkdown: true,
  textSource: true,
  qualityScore: true,
  thumbnailFileId: true,
  thumbnailFile: {
    select: documentFileSelect,
  },
  extractError: true,
  metadataJson: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SourceDocumentPageSelect;

export const lessonDocumentPageRangeSelect = {
  id: true,
  lessonId: true,
  sourceDocumentId: true,
  pageStart: true,
  pageEnd: true,
  createdById: true,
  metadataJson: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LessonDocumentPageRangeSelect;

export const lessonDocumentSelect = {
  id: true,
  lessonId: true,
  fileId: true,
  file: {
    select: documentFileSelect,
  },
  sourceDocumentId: true,
  sourceDocument: {
    select: {
      id: true,
      learningPathId: true,
      title: true,
      status: true,
      pageCount: true,
    },
  },
  pageRangeId: true,
  pageRange: {
    select: lessonDocumentPageRangeSelect,
  },
  kind: true,
  sortOrder: true,
  title: true,
  status: true,
  extractedText: true,
  extractError: true,
  contentHash: true,
  activeOcrArtifactId: true,
  chunkCount: true,
  processingJobId: true,
  processingJob: {
    select: documentJobSelect,
  },
  processedAt: true,
  embeddingProvider: true,
  embeddingModel: true,
  embeddingDimensions: true,
  metadataJson: true,
  createdAt: true,
  updatedAt: true,
  replacedAt: true,
} satisfies Prisma.LessonDocumentSelect;
