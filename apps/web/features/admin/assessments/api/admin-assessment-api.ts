import { apiRequest, type ApiRequestOptions } from "@/lib/api-client";
import type {
  AdminAssessmentKind,
  AdminAssessmentQuestion,
  AdminAssessmentQuestionPayload,
  AdminAssessmentQuestionUpdatePayload,
  AdminAssessmentSet,
} from "@/features/admin/assessments/types/admin-assessment.types";
import type {
  AdminQuizBulkReviewResult,
  AdminQuizQuestion,
  AdminQuizSet,
} from "@/features/admin/quiz/api/admin-quiz-api";

type ReadOptions = Pick<ApiRequestOptions, "cache">;

const routes = {
  quiz: {
    lessonSets: (lessonId: string) => `/admin/lessons/${lessonId}/quiz-sets`,
    set: (setId: string) => `/admin/quiz-sets/${setId}`,
    questions: (setId: string) => `/admin/quiz-sets/${setId}/questions`,
    question: (questionId: string) => `/admin/quiz-questions/${questionId}`,
  },
  test: {
    lessonSets: (lessonId: string) => `/admin/lessons/${lessonId}/test-sets`,
    set: (setId: string) => `/admin/test-sets/${setId}`,
    questions: (setId: string) => `/admin/test-sets/${setId}/questions`,
    question: (questionId: string) => `/admin/test-questions/${questionId}`,
  },
} as const;

function normalizeSet(
  kind: AdminAssessmentKind,
  set: AdminQuizSet & { durationSeconds?: number },
): AdminAssessmentSet {
  return { ...set, ...(kind === "test" ? { durationSeconds: set.durationSeconds } : {}) };
}

function normalizeQuestion(
  kind: AdminAssessmentKind,
  question: AdminQuizQuestion & { testSetId?: string },
): AdminAssessmentQuestion {
  return {
    ...question,
    figures: question.figures ?? [],
    setId: kind === "test" ? (question.testSetId ?? "") : question.quizSetId,
  };
}

export async function getAdminAssessmentSets(
  kind: AdminAssessmentKind,
  lessonId: string,
  token: string,
  options: ReadOptions = {},
) {
  const sets = await apiRequest<Array<AdminQuizSet & { durationSeconds?: number }>>(
    routes[kind].lessonSets(lessonId),
    { cache: options.cache, method: "GET", token },
  );
  return sets.map((set) => normalizeSet(kind, set));
}

export async function createAdminAssessmentSet(
  kind: AdminAssessmentKind,
  lessonId: string,
  data: { title: string; durationSeconds?: number },
  token: string,
) {
  const result = await apiRequest<AdminQuizSet & { durationSeconds?: number }>(
    routes[kind].lessonSets(lessonId),
    { method: "POST", body: data, token },
  );
  return normalizeSet(kind, result);
}

export async function updateAdminAssessmentSet(
  kind: AdminAssessmentKind,
  setId: string,
  data: { title: string; durationSeconds?: number },
  token: string,
) {
  const result = await apiRequest<AdminQuizSet & { durationSeconds?: number }>(
    routes[kind].set(setId),
    { method: "PATCH", body: data, token },
  );
  return normalizeSet(kind, result);
}

export function deleteAdminAssessmentSet(
  kind: AdminAssessmentKind,
  setId: string,
  token: string,
) {
  return apiRequest<{ success: boolean }>(routes[kind].set(setId), {
    method: "DELETE",
    token,
  });
}

export async function getAdminAssessmentQuestions(
  kind: AdminAssessmentKind,
  setId: string,
  token: string,
  options: ReadOptions = {},
) {
  const questions = await apiRequest<Array<AdminQuizQuestion & { testSetId?: string }>>(
    routes[kind].questions(setId),
    { cache: options.cache, method: "GET", token },
  );
  return questions.map((question) => normalizeQuestion(kind, question));
}

export async function createAdminAssessmentQuestion(
  kind: AdminAssessmentKind,
  setId: string,
  data: AdminAssessmentQuestionPayload,
  token: string,
) {
  const question = await apiRequest<AdminQuizQuestion & { testSetId?: string }>(
    routes[kind].questions(setId),
    { method: "POST", body: data, token },
  );
  return normalizeQuestion(kind, question);
}

export async function updateAdminAssessmentQuestion(
  kind: AdminAssessmentKind,
  questionId: string,
  data: AdminAssessmentQuestionUpdatePayload,
  token: string,
) {
  const question = await apiRequest<AdminQuizQuestion & { testSetId?: string }>(
    routes[kind].question(questionId),
    { method: "PATCH", body: data, token },
  );
  return normalizeQuestion(kind, question);
}

export async function reviewAdminAssessmentQuestion(
  kind: AdminAssessmentKind,
  questionId: string,
  reviewStatus: "APPROVED" | "NEEDS_REVIEW",
  token: string,
) {
  const question = await apiRequest<AdminQuizQuestion & { testSetId?: string }>(
    `${routes[kind].question(questionId)}/review`,
    { method: "POST", body: { reviewStatus }, token },
  );
  return normalizeQuestion(kind, question);
}

export async function updateAdminAssessmentGenerationQuestionJson(
  kind: AdminAssessmentKind,
  questionId: string,
  generationQuestionJson: Record<string, unknown>,
  token: string,
) {
  const question = await apiRequest<AdminQuizQuestion & { testSetId?: string }>(
    `${routes[kind].question(questionId)}/generation-json`,
    { method: "PATCH", body: { generationQuestionJson }, token },
  );
  return normalizeQuestion(kind, question);
}

export function deleteAdminAssessmentQuestion(
  kind: AdminAssessmentKind,
  questionId: string,
  token: string,
) {
  return apiRequest<{ success: boolean }>(routes[kind].question(questionId), {
    method: "DELETE",
    token,
  });
}

export function reviewAllPendingAdminAssessmentQuestions(
  kind: AdminAssessmentKind,
  setId: string,
  token: string,
) {
  return apiRequest<AdminQuizBulkReviewResult>(
    `${routes[kind].questions(setId)}/review-all-ai`,
    { method: "POST", token },
  );
}
