import { Prisma } from "@prisma/client";
import { lessonSelect } from "#api/modules/learning-paths/selectors/lesson.selects";

export const chapterSelect = {
  id: true,
  learningPathId: true,
  orderIndex: true,
  title: true,
  overview: true,
  objectivesJson: true,
  status: true,
  createdById: true,
  updatedById: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LearningPathChapterSelect;

export const chapterDetailSelect = {
  ...chapterSelect,
  lessons: {
    where: {
      deletedAt: null,
    },
    select: lessonSelect,
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
  },
} satisfies Prisma.LearningPathChapterSelect;
