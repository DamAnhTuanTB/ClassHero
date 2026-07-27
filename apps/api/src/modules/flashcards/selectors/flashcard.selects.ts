import { Prisma } from "@prisma/client";

export const adminFlashcardSetSelect = {
  id: true,
  lessonId: true,
  title: true,
  difficulty: true,
  source: true,
  reviewStatus: true,
  isReserve: true,
  cardCount: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      flashcards: {
        where: { deletedAt: null },
      },
    },
  },
} satisfies Prisma.FlashcardSetSelect;

export const adminFlashcardSelect = {
  id: true,
  flashcardSetId: true,
  lessonId: true,
  frontJson: true,
  backJson: true,
  difficulty: true,
  reviewStatus: true,
  sortOrder: true,
  explanationId: true,
  explanation: {
    select: {
      id: true,
      contentJson: true,
    },
  },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.FlashcardSelect;

export const studentFlashcardSetSelect = {
  id: true,
  lessonId: true,
  title: true,
  difficulty: true,
  source: true,
  cardCount: true,
  sortOrder: true,
  flashcards: {
    where: {
      deletedAt: null,
      reviewStatus: "APPROVED",
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      frontJson: true,
      backJson: true,
      difficulty: true,
      sortOrder: true,
      explanation: {
        select: {
          contentJson: true,
          reviewStatus: true,
        },
      },
    },
  },
} satisfies Prisma.FlashcardSetSelect;

export type AdminFlashcardSetRecord = Prisma.FlashcardSetGetPayload<{
  select: typeof adminFlashcardSetSelect;
}>;

export type AdminFlashcardRecord = Prisma.FlashcardGetPayload<{
  select: typeof adminFlashcardSelect;
}>;

export type StudentFlashcardSetRecord = Prisma.FlashcardSetGetPayload<{
  select: typeof studentFlashcardSetSelect;
}>;
