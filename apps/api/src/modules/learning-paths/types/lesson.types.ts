import { LessonType, Prisma, PublishStatus } from "@prisma/client";
import { lessonSelect } from "#api/modules/learning-paths/selectors/lesson.selects";

export type LessonRecord = Prisma.LessonGetPayload<{
  select: typeof lessonSelect;
}>;

export type LessonResponse = {
  id: string;
  learningPathId: string;
  chapterId: string | null;
  orderIndex: number;
  title: string;
  shortDescription: string | null;
  overviewContentJson: Prisma.JsonValue | null;
  lessonType: LessonType;
  liveUrl: string | null;
  scheduledAt: Date | null;
  examOpenAt: Date | null;
  videoUrl: string | null;
  customVideoSettings?: Prisma.JsonValue | null;
  completionMinScore: number;
  trialEnabled: boolean;
  status: PublishStatus;
  hasStudentCompletion: boolean;
  createdById: string | null;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type RequestContext = {
  ipAddress?: string;
  userAgent?: string;
};

export type StudentLessonAccessMode = "ENROLLMENT" | "TRIAL";

export type StudentLessonAccessContext = {
  evaluatedAt: Date;
  lessonId: string;
  learningPathId: string;
  mode: StudentLessonAccessMode;
};
