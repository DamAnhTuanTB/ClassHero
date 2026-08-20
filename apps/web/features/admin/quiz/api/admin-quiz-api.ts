import { apiRequest, type ApiRequestOptions } from "@/lib/api-client";
import type { TiptapTextDocument } from "@/types/rich-text";

export type QuizDifficulty = "EASY" | "MEDIUM" | "HARD" | "MIXED";
export type QuizQuestionType =
  "MULTIPLE_CHOICE" | "TRUE_FALSE" | "MULTI_STATEMENT_TRUE_FALSE" | "TEXT_INPUT";

export interface AdminQuizOption {
  id: string;
  richText: TiptapTextDocument;
}

export interface AdminMultiStatementAnswer {
  statementId: string;
  value: boolean;
}

export interface AdminQuizQuestionPayload {
  questionType: QuizQuestionType;
  difficulty: Exclude<QuizDifficulty, "MIXED">;
  questionJson: TiptapTextDocument;
  optionsJson?: AdminQuizOption[];
  correctAnswerJson: string[] | boolean | AdminMultiStatementAnswer[];
  hintJson?: TiptapTextDocument | null;
  gradingConfigJson?: {
    caseSensitive: boolean;
    exactMatch: boolean;
    keywords?: string[];
  };
  explanationJson?: TiptapTextDocument | null;
}

export type AdminQuizQuestionUpdatePayload = Partial<AdminQuizQuestionPayload> & {
  exampleBlock?: unknown;
};

export interface AdminQuizSet {
  id: string;
  lessonId: string;
  title: string;
  difficulty: QuizDifficulty;
  source: string;
  reviewStatus: string;
  questionCount: number;
  sortOrder: number;
  _count?: {
    questions: number;
  };
  pendingReviewQuestionCount?: number;
  aiGenerations?: Array<{
    id: string;
    createdAt: string;
    inputMetaJson: AdminQuizSet["aiGeneration"] extends infer T
      ? T extends { inputMetaJson: infer M }
        ? M
        : never
      : never;
  }>;
  aiGeneration?: {
    id: string;
    inputMetaJson: {
      generationAudit?: {
        requestedCount: number;
        initialGeneratedCount: number;
        deletedCount: number;
        currentActiveCount: number;
      };
      generationIssues?: Array<{
        code: string;
        message: string;
        blocking?: boolean;
      }>;
      [key: string]: unknown;
    } | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminQuizQuestion {
  id: string;
  quizSetId: string;
  questionType: QuizQuestionType;
  difficulty: Exclude<QuizDifficulty, "MIXED">;
  questionJson: TiptapTextDocument;
  optionsJson: AdminQuizOption[] | null;
  correctAnswerJson: string[] | boolean | AdminMultiStatementAnswer[];
  hintJson: TiptapTextDocument | null;
  gradingConfigJson: {
    caseSensitive?: boolean;
    exactMatch?: boolean;
    keywords?: string[];
  } | null;
  explanation: {
    id: string;
    contentJson: TiptapTextDocument;
    reviewStatus: string;
    staleAt: string | null;
  } | null;
  sourceMetadataJson: {
    aiGenerationId?: string;
    generationQuestionIndex?: number;
    exampleBlock?: unknown;
    [key: string]: unknown;
  } | null;
  reviewStatus: string;
}

export interface AdminQuizInitialData {
  questions: AdminQuizQuestion[];
  questionSetId: string | null;
  sets: AdminQuizSet[];
}

type AdminQuizReadOptions = Pick<ApiRequestOptions, "cache">;

export async function getAdminQuizSets(
  lessonId: string,
  token: string,
  options: AdminQuizReadOptions = {},
) {
  return apiRequest<AdminQuizSet[]>(`/admin/lessons/${lessonId}/quiz-sets`, {
    cache: options.cache,
    method: "GET",
    token,
  });
}

export async function createAdminQuizSet(
  lessonId: string,
  data: { title: string; difficulty?: QuizDifficulty },
  token: string,
) {
  return apiRequest<AdminQuizSet>(`/admin/lessons/${lessonId}/quiz-sets`, {
    method: "POST",
    body: data,
    token,
  });
}

export async function updateAdminQuizSet(
  setId: string,
  data: { title?: string; difficulty?: QuizDifficulty },
  token: string,
) {
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

export async function getAdminQuizQuestions(
  setId: string,
  token: string,
  options: AdminQuizReadOptions = {},
) {
  return apiRequest<AdminQuizQuestion[]>(`/admin/quiz-sets/${setId}/questions`, {
    cache: options.cache,
    method: "GET",
    token,
  });
}

export async function createAdminQuizQuestion(
  setId: string,
  data: AdminQuizQuestionPayload,
  token: string,
) {
  return apiRequest<AdminQuizQuestion>(`/admin/quiz-sets/${setId}/questions`, {
    method: "POST",
    body: data,
    token,
  });
}

export async function updateAdminQuizQuestion(
  questionId: string,
  data: AdminQuizQuestionUpdatePayload,
  token: string,
) {
  return apiRequest<AdminQuizQuestion>(`/admin/quiz-questions/${questionId}`, {
    method: "PATCH",
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

export async function uploadAdminQuizImage(file: File, token: string) {
  const formData = new FormData();
  formData.set("purpose", "QUESTION_IMAGE");
  formData.set("file", file);

  const uploadedFile = await apiRequest<{
    id: string;
    originalName: string;
    publicUrl: string | null;
  }>("/files/upload", {
    method: "POST",
    body: formData,
    token,
  });
  const imageUrl = uploadedFile.publicUrl
    ? uploadedFile.publicUrl
    : (
        await apiRequest<{ url: string }>(`/files/${uploadedFile.id}/signed-url`, {
          token,
        })
      ).url;

  return {
    fileId: uploadedFile.id,
    fileName: uploadedFile.originalName,
    imageUrl,
  };
}
