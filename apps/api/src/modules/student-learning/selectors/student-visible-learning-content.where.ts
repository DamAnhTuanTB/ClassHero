import { Prisma, ReviewStatus } from "@prisma/client";

export const studentVisibleQuizQuestionWhere = {
  deletedAt: null,
  reviewStatus: ReviewStatus.APPROVED,
  publishedAt: { not: null },
} satisfies Prisma.QuizQuestionWhereInput;

export const studentVisibleFlashcardWhere = {
  deletedAt: null,
  reviewStatus: ReviewStatus.APPROVED,
  publishedAt: { not: null },
} satisfies Prisma.FlashcardWhereInput;

export const studentVisibleTestQuestionWhere = {
  deletedAt: null,
  reviewStatus: ReviewStatus.APPROVED,
  publishedAt: { not: null },
} satisfies Prisma.TestQuestionWhereInput;

export const studentVisibleQuizSetWhere = {
  deletedAt: null,
  isReserve: false,
  reviewStatus: ReviewStatus.APPROVED,
} satisfies Prisma.QuizSetWhereInput;

export const studentVisibleFlashcardSetWhere = {
  deletedAt: null,
  isReserve: false,
  reviewStatus: ReviewStatus.APPROVED,
} satisfies Prisma.FlashcardSetWhereInput;

export const studentVisibleTestSetWhere = {
  deletedAt: null,
  isReserve: false,
  reviewStatus: ReviewStatus.APPROVED,
} satisfies Prisma.TestSetWhereInput;
