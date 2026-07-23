import {
  EnrollmentStatus,
  LessonProgressStatus,
  Prisma,
  PublishStatus,
} from "@prisma/client";
import type { AuthenticatedUser } from "#api/common/auth/authenticated-request";
import {
  publicLearningPathDetailSelect,
  learningPathDetailSelect,
  learningPathSelect,
  publicLearningPathSelect,
} from "#api/modules/learning-paths/selectors/learning-path.selects";
import type { ChapterDetailResponse } from "#api/modules/learning-paths/types/chapter.types";

export type LearningPathRecord = Prisma.LearningPathGetPayload<{
  select: typeof learningPathSelect;
}>;

export type LearningPathDetailRecord = Prisma.LearningPathGetPayload<{
  select: typeof learningPathDetailSelect;
}>;

export type LearningPathResponse = {
  id: string;
  kind: LearningPathRecord["kind"];
  sourceLearningPathId: string | null;
  subject: LearningPathRecord["subject"];
  grade: number;
  title: string;
  slug: string;
  originalPriceVnd: number;
  salePriceVnd: number | null;
  enrolledStudentCount: number;
  totalChapterCount: number;
  totalLessonCount: number;
  thumbnailFileId: string | null;
  thumbnailFile: {
    id: string;
    originalName: string;
    url: string | null;
  } | null;
  descriptionJson: Prisma.JsonValue | null;
  status: PublishStatus;
  trialEnabled: boolean;
  publishedAt: Date | null;
  sortOrder: number;
  createdById: string | null;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  chapters?: ChapterDetailResponse[];
};

export type PublicLearningPathRecord = Prisma.LearningPathGetPayload<{
  select: typeof publicLearningPathSelect;
}>;

export type PublicLearningPathDetailRecord = Prisma.LearningPathGetPayload<{
  select: typeof publicLearningPathDetailSelect;
}>;

export type ActiveEnrollmentRecord = {
  id: string;
  status: EnrollmentStatus;
  startsAt: Date;
  expiresAt: Date;
};

export type StudentLessonProgressRecord = {
  lessonId: string;
  status: LessonProgressStatus;
  completedAt: Date | null;
};

export type PublicViewerContext = {
  user?: AuthenticatedUser;
  studentGrade?: number;
  activeEnrollmentByLearningPathId: Map<string, ActiveEnrollmentRecord>;
  lessonProgressByLessonId: Map<string, StudentLessonProgressRecord>;
};

export type RequestContext = {
  ipAddress?: string;
  userAgent?: string;
};
