import { Prisma } from "@prisma/client";

export const lessonSummarySelect = {
  id: true,
  lessonId: true,
  contentJson: true,
  source: true,
  reviewStatus: true,
  aiGenerationId: true,
  createdById: true,
  updatedById: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} satisfies Prisma.LessonSummarySelect;
