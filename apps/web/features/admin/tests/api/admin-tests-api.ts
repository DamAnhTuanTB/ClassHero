import { apiRequest } from "@/lib/api-client";
import type {
  AdminQuizQuestion,
  AdminQuizQuestionPayload,
  AdminQuizSet,
  QuizDifficulty,
} from "@/features/admin/quiz/api/admin-quiz-api";

export interface AdminTestSet extends Omit<AdminQuizSet, "questionCount" | "_count"> {
  durationSeconds: number;
  difficultyRatioJson: {
    easy?: number;
    medium?: number;
    hard?: number;
  } | null;
  questionCount: number;
  totalScore: string | number;
  _count: {
    questions: number;
  };
}

export interface AdminTestQuestion extends Omit<AdminQuizQuestion, "quizSetId"> {
  testSetId: string;
  points: number | null;
  effectivePoints: number;
}

export interface AdminTestSetPayload {
  title: string;
  durationSeconds: number;
  difficulty?: QuizDifficulty;
}

export type AdminTestQuestionPayload = AdminQuizQuestionPayload;

export async function getAdminTestSets(lessonId: string, token: string) {
  return apiRequest<AdminTestSet[]>(`/admin/lessons/${lessonId}/test-sets`, {
    method: "GET",
    token,
  });
}

export async function createAdminTestSet(
  lessonId: string,
  data: AdminTestSetPayload,
  token: string,
) {
  return apiRequest<AdminTestSet>(`/admin/lessons/${lessonId}/test-sets`, {
    method: "POST",
    body: data,
    token,
  });
}

export async function updateAdminTestSet(
  setId: string,
  data: AdminTestSetPayload,
  token: string,
) {
  return apiRequest<AdminTestSet>(`/admin/test-sets/${setId}`, {
    method: "PATCH",
    body: data,
    token,
  });
}

export async function deleteAdminTestSet(setId: string, token: string) {
  return apiRequest<{ success: boolean }>(`/admin/test-sets/${setId}`, {
    method: "DELETE",
    token,
  });
}

export async function getAdminTestQuestions(setId: string, token: string) {
  return apiRequest<AdminTestQuestion[]>(`/admin/test-sets/${setId}/questions`, {
    method: "GET",
    token,
  });
}

export async function createAdminTestQuestion(
  setId: string,
  data: AdminTestQuestionPayload,
  token: string,
) {
  return apiRequest<AdminTestQuestion>(`/admin/test-sets/${setId}/questions`, {
    method: "POST",
    body: data,
    token,
  });
}

export async function updateAdminTestQuestion(
  questionId: string,
  data: AdminTestQuestionPayload,
  token: string,
) {
  return apiRequest<AdminTestQuestion>(`/admin/test-questions/${questionId}`, {
    method: "PATCH",
    body: data,
    token,
  });
}

export async function deleteAdminTestQuestion(questionId: string, token: string) {
  return apiRequest<{ success: boolean }>(`/admin/test-questions/${questionId}`, {
    method: "DELETE",
    token,
  });
}
