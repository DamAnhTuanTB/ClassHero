import type {
  StudentCourseDetailChapterStatus,
  StudentCourseDetailContinueKind,
} from "@/features/student/shared/student-courses-types";

export type PublicLearningPathSubject = "MATH" | "PHYSICS" | "CHEMISTRY";
export type PublicLearningPathPublishStatus = StudentCourseDetailChapterStatus;

export type PublicLearningPathProgressApi = {
  completedLessonCount: number;
  progressPercent: number;
  continueLessonId: string | null;
  continueLessonKind: StudentCourseDetailContinueKind;
  continueLessonTitle: string | null;
};

export type PublicLearningPathAccessApi = {
  hasActiveEnrollment: boolean;
  enrollment: {
    id: string;
    status: string;
    startsAt: string;
    expiresAt: string;
  } | null;
  trialAvailable: boolean;
  trialLessonId: string | null;
};

export type PublicLearningPathLessonApi = {
  id: string;
  orderIndex: number;
  title: string;
  shortDescription: string | null;
  examOpenAt: string | null;
  status: PublicLearningPathPublishStatus;
  trialEnabled: boolean;
};

export type PublicLearningPathChapterApi = {
  id: string;
  orderIndex: number;
  title: string;
  overview: string | null;
  status: PublicLearningPathPublishStatus;
  lessons: PublicLearningPathLessonApi[];
};

export type PublicLearningPathThumbnailApi = {
  id: string;
  originalName: string;
  url: string | null;
};

export type PublicLearningPathApi = {
  id: string;
  subject: PublicLearningPathSubject;
  grade: number;
  title: string;
  slug: string;
  status: PublicLearningPathPublishStatus;
  originalPriceVnd: number;
  salePriceVnd: number | null;
  totalChapterCount: number;
  totalLessonCount: number;
  thumbnailFileId: string | null;
  thumbnailFile: PublicLearningPathThumbnailApi | null;
  descriptionJson: unknown;
  trialEnabled: boolean;
  publishedAt: string | null;
  summary: {
    chapterCount: number;
    lessonCount: number;
    firstLessonId: string | null;
    effectivePriceVnd: number;
    hasDiscount: boolean;
  };
  access: PublicLearningPathAccessApi;
  progress: PublicLearningPathProgressApi | null;
  lessons: PublicLearningPathLessonApi[];
  chapters?: PublicLearningPathChapterApi[];
};

export type StudentCoursesListMeta = Record<string, unknown> & {
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
  priorityGrade?: number | null;
  gradeGroups?: Array<{
    grade: number;
    count: number;
  }>;
};

export type MockPurchaseResult = {
  mode: "MOCK_SUCCESS" | "ALREADY_ENROLLED";
  learningPathId: string;
  payment: {
    id: string;
    status: string;
    amountVnd: number;
    paidAt: string | null;
  } | null;
  enrollment: {
    id: string;
    status: string;
    startsAt: string;
    expiresAt: string;
  };
};
