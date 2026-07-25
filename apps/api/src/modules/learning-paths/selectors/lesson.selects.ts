import { Prisma } from "@prisma/client";

export const lessonSelect = {
  id: true,
  learningPathId: true,
  chapterId: true,
  orderIndex: true,
  title: true,
  shortDescription: true,
  lessonType: true,
  liveUrl: true,
  scheduledAt: true,
  examOpenAt: true,
  videoUrl: true,
  customVideoSettings: true,
  completionMinScore: true,
  trialEnabled: true,
  status: true,
  createdById: true,
  updatedById: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LessonSelect;
