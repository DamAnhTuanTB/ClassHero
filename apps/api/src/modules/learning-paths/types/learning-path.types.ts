import { EnrollmentStatus, Prisma, PublishStatus } from "@prisma/client";
import type { AuthenticatedUser } from "#api/common/auth/authenticated-request";
import {
  learningPathSelect,
  publicLearningPathSelect,
} from "#api/modules/learning-paths/selectors/learning-path.selects";

export type LearningPathRecord = Prisma.LearningPathGetPayload<{
  select: typeof learningPathSelect;
}>;

export type LearningPathResponse = {
  id: string;
  subject: LearningPathRecord["subject"];
  grade: number;
  title: string;
  slug: string;
  originalPriceVnd: number;
  salePriceVnd: number | null;
  totalLessonCount: number;
  thumbnailFileId: string | null;
  descriptionJson: Prisma.JsonValue | null;
  status: PublishStatus;
  trialEnabled: boolean;
  publishedAt: Date | null;
  sortOrder: number;
  createdById: string | null;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PublicLearningPathRecord = Prisma.LearningPathGetPayload<{
  select: typeof publicLearningPathSelect;
}>;

export type ActiveEnrollmentRecord = {
  id: string;
  status: EnrollmentStatus;
  startsAt: Date;
  expiresAt: Date;
};

export type PublicViewerContext = {
  user?: AuthenticatedUser;
  studentGrade?: number;
  activeEnrollmentByLearningPathId: Map<string, ActiveEnrollmentRecord>;
};

export type RequestContext = {
  ipAddress?: string;
  userAgent?: string;
};
