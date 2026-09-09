import type { Difficulty, ReviewStatus } from "@prisma/client";

export type FlashcardRequestContext = {
  ipAddress?: string;
  userAgent?: string;
};

export type CreateFlashcardSetInput = {
  title: string;
  difficulty?: Difficulty;
};

export type UpdateFlashcardSetInput = {
  title?: string;
  difficulty?: Difficulty;
};

export type ReviewFlashcardSetInput = {
  reviewStatus: ReviewStatus;
  action?: "SAVE" | "PUBLISH" | "WITHDRAW";
};

export type CreateFlashcardInput = {
  frontJson: Record<string, unknown>;
  backJson: Record<string, unknown>;
  solutionJson?: Record<string, unknown> | null;
  difficulty?: Difficulty;
  sortOrder?: number;
};

export type UpdateFlashcardInput = Partial<CreateFlashcardInput>;
