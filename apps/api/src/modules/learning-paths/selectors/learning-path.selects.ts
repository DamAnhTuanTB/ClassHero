import { EnrollmentStatus, Prisma, PublishStatus } from "@prisma/client";
import { chapterDetailSelect } from "#api/modules/learning-paths/selectors/chapter.selects";

const thumbnailFileSelect = {
  id: true,
  originalName: true,
  objectKey: true,
  publicUrl: true,
} satisfies Prisma.FileSelect;

export const learningPathSelect = {
  id: true,
  subject: true,
  grade: true,
  title: true,
  slug: true,
  originalPriceVnd: true,
  salePriceVnd: true,
  totalChapterCount: true,
  totalLessonCount: true,
  thumbnailFileId: true,
  thumbnailFile: {
    select: thumbnailFileSelect,
  },
  descriptionJson: true,
  status: true,
  trialEnabled: true,
  publishedAt: true,
  sortOrder: true,
  createdById: true,
  updatedById: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      enrollments: {
        where: {
          status: EnrollmentStatus.ACTIVE,
        },
      },
    },
  },
} satisfies Prisma.LearningPathSelect;

export const learningPathDetailSelect = {
  ...learningPathSelect,
  chapters: {
    where: {
      deletedAt: null,
    },
    select: chapterDetailSelect,
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
  },
} satisfies Prisma.LearningPathSelect;

export const publicLearningPathSelect = {
  id: true,
  subject: true,
  grade: true,
  title: true,
  slug: true,
  originalPriceVnd: true,
  salePriceVnd: true,
  totalChapterCount: true,
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
