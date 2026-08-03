import { EnrollmentStatus, Prisma, PublishStatus } from "@prisma/client";
import { chapterDetailSelect } from "#api/modules/learning-paths/selectors/chapter.selects";
import { lessonSelect } from "#api/modules/learning-paths/selectors/lesson.selects";

const thumbnailFileSelect = {
  id: true,
  originalName: true,
  objectKey: true,
  publicUrl: true,
} satisfies Prisma.FileSelect;

const targetAudiencesRelation = {
  select: {
    targetAudience: {
      select: { id: true, code: true, name: true, grade: true, sortOrder: true },
    },
  },
  orderBy: { targetAudience: { sortOrder: "asc" } },
} satisfies Prisma.LearningPathTargetAudienceFindManyArgs;

export const learningPathSelect = {
  id: true,
  kind: true,
  sourceLearningPathId: true,
  domainId: true,
  domain: { select: { id: true, name: true, slug: true } },
  targetAudiences: targetAudiencesRelation,
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
  startDate: true,
  endDate: true,
  lessonCountMin: true,
  lessonCountMax: true,
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
  lessons: {
    where: {
      chapterId: null,
      deletedAt: null,
    },
    select: lessonSelect,
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
  },
  chapters: {
    where: {
      deletedAt: null,
    },
    select: chapterDetailSelect,
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
  },
} satisfies Prisma.LearningPathSelect;

const publicLessonMetadataSelect = {
  id: true,
  chapterId: true,
  orderIndex: true,
  title: true,
  shortDescription: true,
  lessonType: true,
  examOpenAt: true,
  trialEnabled: true,
  status: true,
} satisfies Prisma.LessonSelect;

const publicLessonMetadataOrderBy = [
  { orderIndex: "asc" },
  { createdAt: "asc" },
] satisfies Prisma.LessonOrderByWithRelationInput[];

const publicLessonMetadataRelation = {
  where: {
    deletedAt: null,
    status: PublishStatus.PUBLISHED,
  },
  select: publicLessonMetadataSelect,
  orderBy: publicLessonMetadataOrderBy,
} satisfies Prisma.LessonFindManyArgs;

const publicFlatLessonMetadataRelation = {
  where: {
    deletedAt: null,
    status: PublishStatus.PUBLISHED,
    OR: [
      { chapterId: null },
      {
        chapter: {
          deletedAt: null,
          status: PublishStatus.PUBLISHED,
        },
      },
    ],
  },
  select: publicLessonMetadataSelect,
  orderBy: publicLessonMetadataOrderBy,
} satisfies Prisma.LessonFindManyArgs;

export const publicLearningPathSelect = {
  id: true,
  domainId: true,
  domain: { select: { id: true, name: true, slug: true } },
  targetAudiences: targetAudiencesRelation,
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
  startDate: true,
  endDate: true,
  lessonCountMin: true,
  lessonCountMax: true,
  status: true,
  trialEnabled: true,
  publishedAt: true,
  sortOrder: true,
  lessons: publicFlatLessonMetadataRelation,
} satisfies Prisma.LearningPathSelect;

export const publicLearningPathDetailSelect = {
  ...publicLearningPathSelect,
  chapters: {
    where: {
      deletedAt: null,
    },
    select: {
      id: true,
      orderIndex: true,
      title: true,
      overview: true,
      status: true,
      lessons: publicLessonMetadataRelation,
    },
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
  },
} satisfies Prisma.LearningPathSelect;
