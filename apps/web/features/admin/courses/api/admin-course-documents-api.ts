import { apiRequest } from "@/lib/api-client";
import type {
  AdminFileUploadApi,
  AdminLessonDocumentApi,
  AdminLessonPageRangeInput,
  AdminPageRangeSaveResponseApi,
  AdminSignedUrlApi,
  AdminSearchablePdfValidationApi,
  AdminSourceDocumentApi,
  AdminSourceDocumentPageApi,
} from "@/features/admin/courses/types/admin-course-document-types";

export async function uploadAdminLessonDocumentFile(file: File, token: string) {
  const formData = new FormData();
  formData.set("purpose", "LESSON_DOCUMENT");
  formData.set("file", file);

  return apiRequest<AdminFileUploadApi>("/files/upload", {
    method: "POST",
    body: formData,
    token,
  });
}

export function getAdminFileSignedUrl(fileId: string, token: string) {
  return apiRequest<AdminSignedUrlApi>(`/files/${fileId}/signed-url`, {
    token,
  });
}

export function listAdminSourceDocuments(learningPathId: string, token: string) {
  return apiRequest<AdminSourceDocumentApi[]>(
    `/admin/learning-paths/${learningPathId}/source-documents`,
    { token },
  );
}

export function createAdminSourceDocument(
  learningPathId: string,
  payload: { fileId: string; title?: string },
  token: string,
) {
  return apiRequest<AdminSourceDocumentApi>(
    `/admin/learning-paths/${learningPathId}/source-documents`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function requestAdminSourceDocumentProcessing(
  sourceDocumentId: string,
  token: string,
  forceNewOcr?: boolean,
) {
  return apiRequest<AdminSourceDocumentApi>(
    `/admin/source-documents/${sourceDocumentId}/process`,
    {
      method: "POST",
      token,
      body: { forceNewOcr },
    },
  );
}

export function validateAdminSourceDocumentSearchablePdf(
  sourceDocumentId: string,
  candidateFileId: string,
  token: string,
) {
  return apiRequest<AdminSearchablePdfValidationApi>(
    `/admin/source-documents/${sourceDocumentId}/searchable-pdf/validate`,
    { method: "POST", body: { candidateFileId }, token, timeoutMs: 300_000 },
  );
}

export function promoteAdminSourceDocumentSearchablePdf(
  sourceDocumentId: string,
  validationId: string,
  acceptWarnings: boolean,
  token: string,
) {
  return apiRequest<AdminSourceDocumentApi>(
    `/admin/source-documents/${sourceDocumentId}/searchable-pdf/promote`,
    { method: "POST", body: { validationId, acceptWarnings }, token },
  );
}

export function deleteAdminSourceDocument(sourceDocumentId: string, token: string) {
  return apiRequest<{ success: boolean }>(`/admin/source-documents/${sourceDocumentId}`, {
    method: "DELETE",
    token,
  });
}

export function listAdminSourceDocumentPages(sourceDocumentId: string, token: string) {
  return apiRequest<AdminSourceDocumentPageApi[]>(
    `/admin/source-documents/${sourceDocumentId}/pages`,
    { token },
  );
}

export function getAdminSourceDocumentCacheStatus(
  sourceDocumentId: string,
  token: string,
) {
  return apiRequest<{ hasCache: boolean }>(
    `/admin/source-documents/${sourceDocumentId}/cache-status`,
    { token },
  );
}

export function getAdminSourceDocumentOcrPreviewContent(
  sourceDocumentId: string,
  token: string,
) {
  return apiRequest<{ content: string; format: "mathpix_markdown" }>(
    `/admin/source-documents/${sourceDocumentId}/ocr-preview-content`,
    { token },
  );
}

export function confirmAdminSourceDocumentPagePrintedPage(
  sourceDocumentId: string,
  pageId: string,
  payload: { printedPageNumber: number | null; printedPageLabel: string | null },
  token: string,
) {
  return apiRequest<AdminSourceDocumentPageApi>(
    `/admin/learning-paths/source-documents/${sourceDocumentId}/pages/${pageId}/confirm-printed-page`,
    {
      method: "PATCH",
      body: payload,
      token,
    },
  );
}

export function saveAdminLessonPageRanges(
  sourceDocumentId: string,
  ranges: AdminLessonPageRangeInput[],
  token: string,
) {
  return apiRequest<AdminPageRangeSaveResponseApi>(
    `/admin/source-documents/${sourceDocumentId}/lesson-page-ranges`,
    {
      method: "PUT",
      body: { ranges },
      token,
    },
  );
}

export function listAdminLearningPathLessonDocuments(
  learningPathId: string,
  token: string,
) {
  return apiRequest<AdminLessonDocumentApi[]>(
    `/admin/learning-paths/${learningPathId}/lesson-documents`,
    { token },
  );
}

export function replaceAdminLessonPrimaryDocument(
  lessonId: string,
  payload:
    | { fileId: string; title?: string }
    | { sourceDocumentId: string; pageStart: number; pageEnd: number; title?: string },
  token: string,
) {
  return apiRequest<AdminLessonDocumentApi>(
    `/admin/lessons/${lessonId}/primary-document/replace`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function createAdminLessonDocument(
  lessonId: string,
  payload: {
    fileId: string;
    title?: string;
    kind: "PRIMARY_FROM_SOURCE" | "SUPPLEMENT" | "HOMEWORK";
    processingMode?: "PROCESSING" | "STORAGE_ONLY";
    sortOrder?: number;
  },
  token: string,
) {
  return apiRequest<AdminLessonDocumentApi>(`/admin/lessons/${lessonId}/documents`, {
    method: "POST",
    body: payload,
    token,
  });
}

export function updateAdminLessonDocument(
  lessonId: string,
  documentId: string,
  payload: {
    title?: string;
    kind?: "PRIMARY_FROM_SOURCE" | "SUPPLEMENT" | "HOMEWORK";
    sortOrder?: number;
  },
  token: string,
) {
  return apiRequest<AdminLessonDocumentApi>(
    `/admin/lessons/${lessonId}/documents/${documentId}`,
    {
      method: "PATCH",
      body: payload,
      token,
    },
  );
}

export function deleteAdminLessonDocument(
  lessonId: string,
  documentId: string,
  token: string,
) {
  return apiRequest<{ success: boolean }>(
    `/admin/lessons/${lessonId}/documents/${documentId}`,
    {
      method: "DELETE",
      token,
    },
  );
}
