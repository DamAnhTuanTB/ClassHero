import { apiRequest } from "@/lib/api-client";
import type {
  AdminAiGenerationPanelData,
  AdminAiGenerationPayload,
  AdminAiJobData,
  AdminAiQueuedJob,
  AdminLessonSummaryContent,
  AdminLessonSummaryPromptPreview,
  AdminLessonSummary,
  AdminLessonSummaryReviewStatus,
  AdminSummaryGenerationPayload,
  AdminQuizGenerationPayload,
  AdminStemFigure,
  AdminStemFigureCreateAiInput,
  AdminStemFigureCreateAiPreview,
  AdminStemFigureCompileResult,
  AdminStemFigureRasterEditApplyResult,
  AdminStemFigureRasterEditInput,
  AdminStemFigureRasterEditPreview,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import type { LessonSummaryPhaseOneLayoutOperation } from "@/features/admin/ai-generation/utils/lesson-summary-phase-one-preview";

const LESSON_SUMMARY_PROMPT_PREVIEW_TIMEOUT_MS = 120_000;

export function getAdminAiGenerationPanel(lessonId: string, token: string) {
  return apiRequest<AdminAiGenerationPanelData>(
    `/admin/lessons/${lessonId}/ai-generation-panel`,
    { method: "GET", token },
  );
}

export function getAdminAiJob(jobId: string, token: string) {
  return apiRequest<AdminAiJobData>(`/jobs/${jobId}`, { method: "GET", token });
}

export function generateAdminLessonContent(
  lessonId: string,
  payload: AdminAiGenerationPayload,
  token: string,
) {
  const endpoints = {
    SUMMARY: `/admin/lessons/${lessonId}/summary/generate-ai`,
    QUIZ: `/admin/lessons/${lessonId}/quiz-sets/generate-ai`,
    FLASHCARD: `/admin/lessons/${lessonId}/flashcard-sets/generate-ai`,
    TEST: `/admin/lessons/${lessonId}/test-sets/generate-ai`,
  } as const;
  const { type: _type, ...body } = payload;

  return apiRequest<AdminAiQueuedJob>(endpoints[payload.type], {
    method: "POST",
    body,
    token,
  });
}

export function previewAdminLessonSummaryPrompt(
  lessonId: string,
  payload: AdminSummaryGenerationPayload,
  token: string,
) {
  const { type: _type, ...body } = payload;
  return apiRequest<AdminLessonSummaryPromptPreview>(
    `/admin/lessons/${lessonId}/summary/prompt-preview`,
    {
      method: "POST",
      body,
      token,
      timeoutMs: LESSON_SUMMARY_PROMPT_PREVIEW_TIMEOUT_MS,
    },
  );
}

export function previewAdminQuizPrompt(
  lessonId: string,
  payload: AdminQuizGenerationPayload,
  token: string,
) {
  const { type: _type, ...body } = payload;
  return apiRequest<AdminLessonSummaryPromptPreview>(
    `/admin/lessons/${lessonId}/quiz-sets/prompt-preview`,
    {
      method: "POST",
      body,
      token,
      timeoutMs: LESSON_SUMMARY_PROMPT_PREVIEW_TIMEOUT_MS,
    },
  );
}

export function getAdminLessonSummary(lessonId: string, token: string) {
  return apiRequest<AdminLessonSummary | null>(`/admin/lessons/${lessonId}/summary`, {
    method: "GET",
    token,
  });
}

export function upsertAdminLessonSummary(
  lessonId: string,
  data: {
    contentJson: AdminLessonSummaryContent;
    source: "ADMIN" | "AI";
    reviewStatus: AdminLessonSummaryReviewStatus;
  },
  token: string,
) {
  return apiRequest<AdminLessonSummary>(`/admin/lessons/${lessonId}/summary`, {
    method: "PUT",
    body: data,
    token,
  });
}

export function updateAdminLessonSummaryPhaseOneBlocks(
  lessonId: string,
  data: {
    phaseOneBlockJsonByPath: Record<string, unknown>;
    phaseOneLayoutOperations?: LessonSummaryPhaseOneLayoutOperation[];
    source: "ADMIN" | "AI";
    reviewStatus: AdminLessonSummaryReviewStatus;
  },
  token: string,
) {
  return apiRequest<AdminLessonSummary>(
    `/admin/lessons/${lessonId}/summary/phase-one-blocks`,
    {
      method: "PUT",
      body: data,
      token,
    },
  );
}

export function deleteAdminLessonSummary(lessonId: string, token: string) {
  return apiRequest<{ deleted: boolean }>(`/admin/lessons/${lessonId}/summary`, {
    method: "DELETE",
    token,
  });
}

export function getAdminStemFigures(lessonId: string, token: string) {
  return apiRequest<AdminStemFigure[]>(`/admin/lessons/${lessonId}/stem-figures`, {
    method: "GET",
    token,
  });
}

export function ensureAdminStemFigureForBlock(
  lessonId: string,
  blockPath: string,
  token: string,
) {
  return apiRequest<AdminStemFigure>(
    `/admin/lessons/${lessonId}/stem-figures/blocks/ensure`,
    { method: "POST", body: { blockPath }, token },
  );
}

export function retryAdminStemFigure(
  lessonId: string,
  figure: AdminStemFigure,
  token: string,
) {
  return apiRequest<{
    jobId: string;
    status: string;
    retryUsesAi: boolean;
    issueCount: number;
    estimatedMaxCostVnd?: number | null;
  }>(`/admin/lessons/${lessonId}/stem-figures/${figure.id}/retry`, {
    method: "POST",
    body: stemFigureMutationGuard(figure, true),
    token,
  });
}

export function deleteAdminStemFigure(
  lessonId: string,
  figure: AdminStemFigure,
  token: string,
) {
  return apiRequest<{ deleted: boolean; figureId: string }>(
    `/admin/lessons/${lessonId}/stem-figures/${figure.id}`,
    { method: "DELETE", body: stemFigureMutationGuard(figure), token },
  );
}

export function createNewAdminStemFigure(
  lessonId: string,
  input: AdminStemFigureCreateAiInput,
  token: string,
) {
  return apiRequest<{
    jobId: string;
    status: string;
    estimatedMaxCostVnd: number | null;
  }>(`/admin/lessons/${lessonId}/stem-figures/${input.figure.id}/create-new-ai`, {
    method: "POST",
    body: {
      ...stemFigureMutationGuard(input.figure),
      referenceImageMode: input.referenceImageMode,
      adminInstructions: input.adminInstructions,
      model: input.model,
      temperature: input.temperature,
      reasoningEffort: input.reasoningEffort,
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
    },
    token,
  });
}

export function previewCreateNewAdminStemFigure(
  lessonId: string,
  input: AdminStemFigureCreateAiInput,
  token: string,
) {
  return apiRequest<AdminStemFigureCreateAiPreview>(
    `/admin/lessons/${lessonId}/stem-figures/${input.figure.id}/create-new-ai/preview`,
    {
      method: "POST",
      body: {
        ...stemFigureMutationGuard(input.figure),
        referenceImageMode: input.referenceImageMode,
        adminInstructions: input.adminInstructions,
        model: input.model,
        temperature: input.temperature,
        reasoningEffort: input.reasoningEffort,
        systemPrompt: input.systemPrompt,
        userPrompt: input.userPrompt,
      },
      token,
    },
  );
}

export function replaceAdminStemFigure(
  lessonId: string,
  figure: AdminStemFigure,
  file: File,
  token: string,
) {
  const body = new FormData();
  body.set("file", file);
  const guard = stemFigureMutationGuard(figure);
  if (guard.baseCurrentRevisionId) {
    body.set("baseCurrentRevisionId", guard.baseCurrentRevisionId);
  }
  if (guard.basePendingRevisionId) {
    body.set("basePendingRevisionId", guard.basePendingRevisionId);
  }
  body.set("baseSourceVersion", String(guard.baseSourceVersion));
  return apiRequest<AdminStemFigure>(
    `/admin/lessons/${lessonId}/stem-figures/${figure.id}/replace-upload`,
    { method: "POST", body, token },
  );
}

export function promoteAdminStemFigureSourceCrop(
  lessonId: string,
  figure: AdminStemFigure,
  sourceObjectKey: string,
  enhance: boolean,
  token: string,
) {
  return apiRequest<AdminStemFigure>(
    `/admin/lessons/${lessonId}/stem-figures/${figure.id}/use-source-crop`,
    {
      method: "POST",
      body: {
        ...stemFigureMutationGuard(figure),
        sourceSnapshotHash: figure.sourceReferenceSnapshotHash,
        sourceObjectKey,
        enhance,
      },
      token,
    },
  );
}

export function previewAdminStemFigureRasterEdit(
  lessonId: string,
  input: AdminStemFigureRasterEditInput,
  token: string,
) {
  return apiRequest<AdminStemFigureRasterEditPreview>(
    `/admin/lessons/${lessonId}/stem-figures/${input.figure.id}/raster-edits/preview`,
    {
      method: "POST",
      body: stemFigureRasterEditFormData(input),
      token,
      timeoutMs: 30_000,
    },
  );
}

export function applyAdminStemFigureRasterEdit(
  lessonId: string,
  input: AdminStemFigureRasterEditInput,
  token: string,
) {
  return apiRequest<AdminStemFigureRasterEditApplyResult>(
    `/admin/lessons/${lessonId}/stem-figures/${input.figure.id}/raster-edits/apply`,
    {
      method: "POST",
      body: stemFigureRasterEditFormData(input),
      token,
      timeoutMs: 30_000,
    },
  );
}

function stemFigureRasterEditFormData(input: AdminStemFigureRasterEditInput) {
  const body = new FormData();
  const guard = stemFigureMutationGuard(input.figure);
  if (guard.baseCurrentRevisionId) {
    body.set("baseCurrentRevisionId", guard.baseCurrentRevisionId);
  }
  if (guard.basePendingRevisionId) {
    body.set("basePendingRevisionId", guard.basePendingRevisionId);
  }
  body.set("baseSourceVersion", String(guard.baseSourceVersion));
  body.set("operations", JSON.stringify(input.operations));
  if (input.mask) body.set("mask", input.mask, "mask.png");
  return body;
}

function stemFigureMutationGuard(figure: AdminStemFigure, includeDiagnostic = false) {
  return {
    baseCurrentRevisionId: figure.currentRevisionId,
    basePendingRevisionId: figure.pendingRevisionId,
    baseSourceVersion: figure.sourceVersion,
    ...(includeDiagnostic
      ? {
          latestAttemptId: figure.latestAttemptId,
          diagnosticBatchHash: figure.diagnosticBatch?.batchHash ?? null,
        }
      : {}),
  };
}

export function compileAdminStemFigureDraft(
  lessonId: string,
  figureId: string,
  body: {
    baseRevisionId: string | null;
    sourceVersion: number;
    latexSource: string;
    altText: string;
    caption: string | null;
  },
  token: string,
) {
  return apiRequest<AdminStemFigureCompileResult>(
    `/admin/lessons/${lessonId}/stem-figures/${figureId}/drafts/compile`,
    { method: "POST", body, token },
  );
}

export function applyAdminStemFigureDraft(
  lessonId: string,
  figureId: string,
  body: {
    baseRevisionId: string | null;
    revisionId: string;
    sourceVersion: number;
    altText: string;
    caption: string | null;
  },
  token: string,
) {
  return apiRequest<{ status: "SUCCEEDED"; revisionId: string }>(
    `/admin/lessons/${lessonId}/stem-figures/${figureId}/drafts/apply`,
    { method: "POST", body, token },
  );
}

export function reviewAdminGeneratedSet(
  type: "QUIZ" | "FLASHCARD" | "TEST",
  resourceId: string,
  reviewStatus: AdminLessonSummaryReviewStatus,
  token: string,
) {
  const resource = {
    QUIZ: "quiz-sets",
    FLASHCARD: "flashcard-sets",
    TEST: "test-sets",
  }[type];
  return apiRequest<unknown>(`/admin/${resource}/${resourceId}/review`, {
    method: "POST",
    body: { reviewStatus },
    token,
  });
}
