import { Prisma, PublishStatus } from "@prisma/client";
import {
  chapterDetailSelect,
  chapterSelect,
} from "#api/modules/learning-paths/selectors/chapter.selects";
import type { LessonResponse } from "#api/modules/learning-paths/types/lesson.types";

export type ChapterRecord = Prisma.LearningPathChapterGetPayload<{
  select: typeof chapterSelect;
}>;

export type ChapterDetailRecord = Prisma.LearningPathChapterGetPayload<{
  select: typeof chapterDetailSelect;
}>;

export type ChapterResponse = {
  id: string;
  learningPathId: string;
  orderIndex: number;
  title: string;
  overview: string | null;
  objectivesJson: Prisma.JsonValue | null;
  status: PublishStatus;
  createdById: string | null;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ChapterDetailResponse = ChapterResponse & {
  lessons: LessonResponse[];
};

export type RequestContext = {
  ipAddress?: string;
  userAgent?: string;
};
