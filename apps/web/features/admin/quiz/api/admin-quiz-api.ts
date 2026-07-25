import { apiRequest } from "@/lib/api-client";

export interface AdminQuizSet {
  id: string;
  lessonId: string;
  title: string;
  difficulty: string;
  source: string;
  reviewStatus: string;
  questionCount: number;
  _count: {
    questions: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AdminQuizQuestion {
  id: string;
  quizSetId: string;
  questionType: string;
  difficulty: string;
  questionJson: any;
  optionsJson: any;
  correctAnswerJson: any;
  hintJson: any;
  gradingConfigJson: any;
  reviewStatus: string;
}

export async function getAdminQuizSets(lessonId: string, token: string) {
  return apiRequest<AdminQuizSet[]>(`/admin/lessons/${lessonId}/quiz-sets`, {
    method: "GET",
    token,
  });
}

export async function createAdminQuizSet(lessonId: string, data: any, token: string) {
  return apiRequest<AdminQuizSet>(`/admin/lessons/${lessonId}/quiz-sets`, {
    method: "POST",
    body: data,
    token,
  });
}

export async function updateAdminQuizSet(setId: string, data: any, token: string) {
  return apiRequest<AdminQuizSet>(`/admin/quiz-sets/${setId}`, {
    method: "PATCH",
    body: data,
    token,
  });
}

export async function deleteAdminQuizSet(setId: string, token: string) {
  return apiRequest<{ success: boolean }>(`/admin/quiz-sets/${setId}`, {
    method: "DELETE",
    token,
  });
}

export async function getAdminQuizQuestions(setId: string, token: string) {
  return apiRequest<AdminQuizQuestion[]>(`/admin/quiz-sets/${setId}/questions`, {
    method: "GET",
    token,
  });
}

export async function createAdminQuizQuestion(setId: string, data: any, token: string) {
  return apiRequest<AdminQuizQuestion>(`/admin/quiz-sets/${setId}/questions`, {
    method: "POST",
    body: data,
    token,
  });
}

export async function deleteAdminQuizQuestion(questionId: string, token: string) {
  return apiRequest<{ success: boolean }>(`/admin/quiz-questions/${questionId}`, {
    method: "DELETE",
    token,
  });
}
