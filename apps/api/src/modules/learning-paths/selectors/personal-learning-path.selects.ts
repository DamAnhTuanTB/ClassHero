import { Prisma } from "@prisma/client";

export const personalLearningPathSummarySelect = {
  id: true,
  kind: true,
  sourceLearningPathId: true,
  title: true,
  slug: true,
  subject: true,
  grade: true,
  status: true,
  totalChapterCount: true,
  totalLessonCount: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LearningPathSelect;

export const personalLearningPathEnrollmentSelect = {
  id: true,
  status: true,
  startsAt: true,
  expiresAt: true,
  studentUserId: true,
  studentUser: {
    select: {
      id: true,
      fullName: true,
      username: true,
      email: true,
      phone: true,
      studentProfile: {
        select: {
          displayName: true,
        },
      },
    },
  },
  learningPath: {
    select: personalLearningPathSummarySelect,
  },
  deliveryLearningPath: {
    select: personalLearningPathSummarySelect,
  },
} satisfies Prisma.EnrollmentSelect;

export const personalLearningPathJobSelect = {
  id: true,
  queue: true,
  status: true,
  idempotencyKey: true,
  resourceType: true,
  resourceId: true,
  result: true,
  errorMessage: true,
  attempts: true,
  maxAttempts: true,
  startedAt: true,
  finishedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BackgroundJobSelect;
