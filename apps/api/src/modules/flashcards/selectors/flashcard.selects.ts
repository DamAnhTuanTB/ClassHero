import { Prisma } from "@prisma/client";

export const adminFlashcardSetSelect = {
  id: true,
  lessonId: true,
  title: true,
  difficulty: true,
  source: true,
  reviewStatus: true,
  isReserve: true,
  generatedByUserId: true,
  aiGenerationId: true,
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
  solutionJson: true,
  sourceMetadataJson: true,
  difficulty: true,
  reviewStatus: true,
  publishedAt: true,
  sortOrder: true,
  figures: {
    where: { deletedAt: null, role: "SOLUTION" },
    orderBy: { role: "asc" },
    select: {
      id: true,
      role: true,
      status: true,
      lastErrorCode: true,
      lastErrorMessage: true,
      currentRevision: {
        select: {
          id: true,
          sourceKind: true,
          latexSource: true,
          altText: true,
          caption: true,
          deliveryFile: {
            select: {
              id: true,
              objectKey: true,
              publicUrl: true,
              visibility: true,
            },
          },
        },
      },
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
      publishedAt: { not: null },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      frontJson: true,
      backJson: true,
      solutionJson: true,
      difficulty: true,
      sortOrder: true,
      figures: {
        where: {
          deletedAt: null,
          role: "SOLUTION",
          status: "SUCCEEDED",
        },
        orderBy: { role: "asc" },
        select: {
          role: true,
          currentRevision: {
            select: {
              altText: true,
              caption: true,
              deliveryFile: {
                select: {
                  id: true,
                  mimeType: true,
                  objectKey: true,
                  publicUrl: true,
                  visibility: true,
                },
              },
            },
          },
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
