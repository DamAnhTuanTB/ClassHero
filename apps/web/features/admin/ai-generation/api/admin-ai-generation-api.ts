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
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";

const LESSON_SUMMARY_PROMPT_PREVIEW_TIMEOUT_MS = 20_000;

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
