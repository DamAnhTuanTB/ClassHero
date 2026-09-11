import { apiRequest } from "@/lib/api-client";
import type { TiptapTextDocument } from "@learning-path/shared";
import type { AiReasoningEffort } from "@learning-path/shared";
import type { AdminAiModelConfiguration } from "@/features/admin/ai-generation/types/admin-ai-generation.types";

export type FlashcardDifficulty = "EASY" | "MEDIUM" | "HARD" | "MIXED";
export type FlashcardItemDifficulty = Exclude<FlashcardDifficulty, "MIXED">;

export interface AdminFlashcardSet {
  id: string;
  lessonId: string;
  title: string;
  difficulty: FlashcardDifficulty;
  source: string;
  reviewStatus: string;
  isReserve: boolean;
  cardCount: number;
  pendingReviewCardCount?: number;
  unpublishedApprovedCardCount?: number;
  aiGenerations?: Array<{
    id: string;
    createdAt: string;
    finishedAt: string | null;
    inputMetaJson: Record<string, unknown> | null;
    model: string | null;
    startedAt: string | null;
    status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
    totalCostVnd: number;
    usageEventCount: number;
  }>;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminFlashcard {
  id: string;
  flashcardSetId: string;
  lessonId: string;
  frontJson: TiptapTextDocument;
  backJson: TiptapTextDocument;
  solutionJson: TiptapTextDocument | null;
  figures?: AdminFlashcardFigure[];
  difficulty: FlashcardItemDifficulty;
  reviewStatus: string;
  publishedAt: string | null;
  sourceMetadataJson: {
    aiGenerationId?: string;
    requiresSolutionFigure?: boolean;
    [key: string]: unknown;
  } | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminFlashcardFigure {
  id: string;
  role: "SOLUTION";
  status: "QUEUED" | "RENDERING" | "SUCCEEDED" | "NEEDS_REVIEW" | "FAILED";
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  currentRevision: {
    id: string;
    sourceKind: "AI_TEX" | "ADMIN_UPLOAD";
    latexSource: string | null;
    altText: string;
    caption: string | null;
    deliveryFile: { id: string; publicUrl: string | null } | null;
  } | null;
}

export interface AdminFlashcardSetPayload {
  title: string;
  difficulty: FlashcardDifficulty;
}

export interface AdminFlashcardPayload {
  frontJson: TiptapTextDocument;
  backJson: TiptapTextDocument;
  solutionJson: TiptapTextDocument | null;
  difficulty: FlashcardItemDifficulty;
}

export type AdminFlashcardSolutionFigureMode = "REGENERATE" | "EDIT_CURRENT";

export interface AdminFlashcardFigurePreviewInput {
  mode?: AdminFlashcardSolutionFigureMode;
  adminInstructions: string | null;
  model?: string | null;
  temperature?: number | null;
  reasoningEffort?: AiReasoningEffort | null;
  systemPrompt?: string | null;
  userPrompt?: string | null;
}

export interface AdminFlashcardFigurePreview {
  requestHash: string;
  role: "SOLUTION";
  mode: AdminFlashcardSolutionFigureMode;
  adminInstructions: string | null;
  providerInput: Record<string, unknown>;
  configuration: AdminAiModelConfiguration;
  systemPrompt: string;
  userPrompt: string;
  context: {
    textInputTokens: number;
    imageInputTokens: number;
    estimatedTokens: number;
    tokenBreakdown: {
      systemInstructionsTokens: number;
      userPromptTokens: number;
      contextTokens: number;
      schemaTokens: number;
      textInputTokens: number;
      pdfInputTokens: number;
      estimatedTokens: number;
    };
  };
  estimatedCost: {
    available: boolean;
    inputUpperBoundUsd: number | null;
    inputUpperBoundVnd: number | null;
    outputUpperBoundUsd: number | null;
    outputUpperBoundVnd: number | null;
    upperBoundUsd: number | null;
    upperBoundVnd: number | null;
    fxRateVndPerUsd: number;
  };
}

export interface AdminFlashcardFigureCreateResult {
  jobId: string;
  figureId: string;
  revisionId: string;
  role: "SOLUTION";
  mode: AdminFlashcardSolutionFigureMode;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
}

export function getAdminFlashcardSets(lessonId: string, token: string) {
  return apiRequest<AdminFlashcardSet[]>(`/admin/lessons/${lessonId}/flashcard-sets`, {
    token,
  });
}

export function createAdminFlashcardSet(
  lessonId: string,
  payload: AdminFlashcardSetPayload,
  token: string,
) {
  return apiRequest<AdminFlashcardSet>(`/admin/lessons/${lessonId}/flashcard-sets`, {
    method: "POST",
    body: payload,
    token,
  });
}

export function updateAdminFlashcardSet(
  setId: string,
  payload: AdminFlashcardSetPayload,
  token: string,
) {
  return apiRequest<AdminFlashcardSet>(`/admin/flashcard-sets/${setId}`, {
    method: "PATCH",
    body: payload,
    token,
  });
}

export function deleteAdminFlashcardSet(setId: string, token: string) {
  return apiRequest<{ success: boolean }>(`/admin/flashcard-sets/${setId}`, {
    method: "DELETE",
    token,
  });
}

export function getAdminFlashcards(setId: string, token: string) {
  return apiRequest<AdminFlashcard[]>(`/admin/flashcard-sets/${setId}/cards`, {
    token,
  });
}

export function createAdminFlashcard(
  setId: string,
  payload: AdminFlashcardPayload,
  token: string,
) {
  return apiRequest<AdminFlashcard>(`/admin/flashcard-sets/${setId}/cards`, {
    method: "POST",
    body: payload,
    token,
  });
}

export function updateAdminFlashcard(
  flashcardId: string,
  payload: AdminFlashcardPayload,
  token: string,
) {
  return apiRequest<AdminFlashcard>(`/admin/flashcards/${flashcardId}`, {
    method: "PATCH",
    body: payload,
    token,
  });
}

export function reviewAdminFlashcard(
  flashcardId: string,
  reviewStatus: "APPROVED" | "NEEDS_REVIEW" | "HIDDEN",
  token: string,
) {
  return apiRequest<AdminFlashcard>(`/admin/flashcards/${flashcardId}/review`, {
    method: "POST",
    body: { reviewStatus },
    token,
  });
}

export function reviewAllPendingAiFlashcards(setId: string, token: string) {
  return apiRequest<{
    approvedCardCount: number;
    pendingReviewCardCount: number;
  }>(`/admin/flashcard-sets/${setId}/cards/review-all-ai`, {
    method: "POST",
    token,
  });
}

export function reviewAdminFlashcardSet(
  setId: string,
  reviewStatus: "DRAFT" | "APPROVED" | "NEEDS_REVIEW" | "HIDDEN",
  action: "SAVE" | "PUBLISH" | "WITHDRAW",
  token: string,
) {
  return apiRequest<AdminFlashcardSet>(`/admin/flashcard-sets/${setId}/review`, {
    method: "POST",
    body: { reviewStatus, action },
    token,
  });
}

export function deleteAdminFlashcard(flashcardId: string, token: string) {
  return apiRequest<{ success: boolean }>(`/admin/flashcards/${flashcardId}`, {
    method: "DELETE",
    token,
  });
}

export async function uploadAdminFlashcardSolutionImage(file: File, token: string) {
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

  return { fileId: uploadedFile.id, fileName: uploadedFile.originalName };
}

export function attachAdminFlashcardSolutionFigureUpload(
  flashcardId: string,
  data: { fileId: string; altText: string; caption?: string },
  token: string,
) {
  return apiRequest<AdminFlashcardFigure>(
    `/admin/flashcards/${flashcardId}/figures/admin-upload`,
    { method: "POST", body: data, token },
  );
}

export function deleteAdminFlashcardFigure(
  flashcardId: string,
  figureId: string,
  token: string,
) {
  return apiRequest<{ deleted: true; figureId: string }>(
    `/admin/flashcards/${flashcardId}/figures/${figureId}`,
    { method: "DELETE", token },
  );
}

export function previewAdminFlashcardFigureWithAi(
  flashcardId: string,
  data: AdminFlashcardFigurePreviewInput,
  token: string,
) {
  return apiRequest<AdminFlashcardFigurePreview>(
    `/admin/flashcards/${flashcardId}/figures/create-ai/preview`,
    { method: "POST", body: data, token },
  );
}

export function createAdminFlashcardFigureWithAi(
  flashcardId: string,
  data: AdminFlashcardFigurePreviewInput,
  token: string,
) {
  return apiRequest<AdminFlashcardFigureCreateResult>(
    `/admin/flashcards/${flashcardId}/figures/create-ai`,
    { method: "POST", body: data, token },
  );
}
