import { Prisma, PublishStatus } from "@prisma/client";
import { lessonSelect } from "#api/modules/learning-paths/selectors/lesson.selects";

export type LessonRecord = Prisma.LessonGetPayload<{
  select: typeof lessonSelect;
}>;

export type LessonResponse = {
  id: string;
  learningPathId: string;
  chapterId: string;
  orderIndex: number;
  title: string;
  shortDescription: string | null;
  scheduledAt: Date | null;
  examOpenAt: Date | null;
  videoUrl: string | null;
  completionMinScore: number;
  trialEnabled: boolean;
  status: PublishStatus;
  createdById: string | null;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type RequestContext = {
  ipAddress?: string;
  userAgent?: string;
};
