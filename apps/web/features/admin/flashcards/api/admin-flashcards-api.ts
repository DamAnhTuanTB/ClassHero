import { apiRequest } from "@/lib/api-client";
import type { TiptapTextDocument } from "@learning-path/shared";

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
  explanation: {
    id?: string;
    contentJson: TiptapTextDocument;
  } | null;
  difficulty: FlashcardItemDifficulty;
  reviewStatus: string;
  sortOrder: number;
  explanationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminFlashcardSetPayload {
  title: string;
  difficulty: FlashcardDifficulty;
}

export interface AdminFlashcardPayload {
  frontJson: TiptapTextDocument;
  backJson: TiptapTextDocument;
  explanationJson: TiptapTextDocument | null;
  difficulty: FlashcardItemDifficulty;
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

export function deleteAdminFlashcard(flashcardId: string, token: string) {
  return apiRequest<{ success: boolean }>(`/admin/flashcards/${flashcardId}`, {
    method: "DELETE",
    token,
  });
}
