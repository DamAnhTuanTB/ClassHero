import { Prisma } from "@prisma/client";

export const jobSelect = {
  id: true,
  queue: true,
  status: true,
  ownerUserId: true,
  lessonId: true,
  resourceType: true,
  resourceId: true,
  result: true,
  errorMessage: true,
  attempts: true,
  maxAttempts: true,
  availableAt: true,
  startedAt: true,
  finishedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BackgroundJobSelect;
