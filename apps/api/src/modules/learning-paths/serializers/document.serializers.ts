import type {
  DocumentFileRecord,
  DocumentFileResponse,
  DocumentJobRecord,
  DocumentJobResponse,
  LessonDocumentPageRangeRecord,
  LessonDocumentPageRangeResponse,
  LessonDocumentRecord,
  LessonDocumentResponse,
  SourceDocumentPageRecord,
  SourceDocumentPageResponse,
  SourceDocumentRecord,
  SourceDocumentResponse,
} from "#api/modules/learning-paths/types/document.types";
import { readJobErrorDetails } from "#api/jobs/job-error";

const textPreviewLength = 240;

export function serializeDocumentFile(record: DocumentFileRecord): DocumentFileResponse {
  return {
    id: record.id,
    provider: record.provider,
    purpose: record.purpose,
    originalName: record.originalName,
    mimeType: record.mimeType,
    sizeBytes: Number(record.sizeBytes),
    visibility: record.visibility,
    status: record.status,
    uploadedById: record.uploadedById,
    publicUrl: record.publicUrl,
    checksum: record.checksum,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function serializeDocumentJob(
  record: DocumentJobRecord | null,
): DocumentJobResponse | null {
  if (!record) {
    return null;
  }

  const result = record.result as Record<string, unknown> | null;
  const progress =
    result && typeof result === "object" && typeof result.progress === "number"
      ? result.progress
      : undefined;

  return {
    jobId: record.id,
    queue: record.queue,
    status: record.status,
    resourceType: record.resourceType,
    resourceId: record.resourceId,
    progress,
    error: record.errorMessage,
    errorDetails: readJobErrorDetails(record.result),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    finishedAt: record.finishedAt,
  };
}

export function serializeSourceDocument(
  record: SourceDocumentRecord,
): SourceDocumentResponse {
  return {
    id: record.id,
    learningPathId: record.learningPathId,
    fileId: record.fileId,
    file: serializeDocumentFile(record.file),
    title: record.title,
    status: record.status,
    pageCount: record.pageCount,
    contentHash: record.contentHash,
    activeOcrArtifactId: record.activeOcrArtifactId,
    processingJobId: record.processingJobId,
    processingJob: serializeDocumentJob(record.processingJob),
    processedAt: record.processedAt,
    metadataJson: record.metadataJson,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt,
  };
}

export function serializeSourceDocumentPage(
  record: SourceDocumentPageRecord,
): SourceDocumentPageResponse {
  return {
    id: record.id,
    sourceDocumentId: record.sourceDocumentId,
    pageNumber: record.pageNumber,
    status: record.status,
    textSource: record.textSource,
    qualityScore: record.qualityScore,
    thumbnailFileId: record.thumbnailFileId,
    thumbnailFile: record.thumbnailFile
      ? serializeDocumentFile(record.thumbnailFile)
      : null,
    textPreview: record.text ? record.text.slice(0, textPreviewLength) : null,
    fullText: record.text ?? null,
    mathpixMarkdown: record.mathpixMarkdown ?? null,
    extractError: record.extractError,
    metadataJson: record.metadataJson,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function serializeLessonDocumentPageRange(
  record: LessonDocumentPageRangeRecord,
): LessonDocumentPageRangeResponse {
  return {
    id: record.id,
    lessonId: record.lessonId,
    sourceDocumentId: record.sourceDocumentId,
    pageStart: record.pageStart,
    pageEnd: record.pageEnd,
    createdById: record.createdById,
    metadataJson: record.metadataJson,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function serializeLessonDocument(
  record: LessonDocumentRecord,
): LessonDocumentResponse {
  return {
    id: record.id,
    lessonId: record.lessonId,
    fileId: record.fileId,
    file: serializeDocumentFile(record.file),
    sourceDocumentId: record.sourceDocumentId,
    sourceDocument: record.sourceDocument,
    pageRangeId: record.pageRangeId,
    pageRange: record.pageRange
      ? serializeLessonDocumentPageRange(record.pageRange)
      : null,
    kind: record.kind,
    sortOrder: record.sortOrder,
    title: record.title,
    status: record.status,
    extractError: record.extractError,
    contentHash: record.contentHash,
    activeOcrArtifactId: record.activeOcrArtifactId,
    chunkCount: record.chunkCount,
    processingJobId: record.processingJobId,
    processingJob: serializeDocumentJob(record.processingJob),
    processedAt: record.processedAt,
    embeddingProvider: record.embeddingProvider,
    embeddingModel: record.embeddingModel,
    embeddingDimensions: record.embeddingDimensions,
    metadataJson: record.metadataJson,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    replacedAt: record.replacedAt,
  };
}
