import { Prisma, PublishStatus } from "@prisma/client";

export const learningPathSelect = {
  id: true,
  subject: true,
  grade: true,
  title: true,
  slug: true,
  originalPriceVnd: true,
  salePriceVnd: true,
  totalLessonCount: true,
  thumbnailFileId: true,
  descriptionJson: true,
  status: true,
  trialEnabled: true,
  publishedAt: true,
  sortOrder: true,
  createdById: true,
  updatedById: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LearningPathSelect;

export const publicLearningPathSelect = {
  id: true,
  subject: true,
  grade: true,
  title: true,
  slug: true,
  originalPriceVnd: true,
  salePriceVnd: true,
  totalLessonCount: true,
  thumbnailFileId: true,
  descriptionJson: true,
  status: true,
  trialEnabled: true,
  publishedAt: true,
  sortOrder: true,
  lessons: {
    where: {
      deletedAt: null,
      status: PublishStatus.PUBLISHED,
    },
    select: {
      id: true,
      orderIndex: true,
      title: true,
      shortDescription: true,
      examOpenAt: true,
      status: true,
    },
    orderBy: {
      orderIndex: "asc",
    },
  },
} satisfies Prisma.LearningPathSelect;
