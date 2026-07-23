import type {
  AdminChapter,
  AdminLessonType,
  AdminPublishStatus,
  AdminSubject,
} from "@/features/admin/courses/admin-courses-data";

export type AdminLearningPathApi = {
  id: string;
  title: string;
  slug: string;
  thumbnailFileId: string | null;
  thumbnailFile: {
    id: string;
    originalName: string;
    url: string | null;
  } | null;
  descriptionJson: unknown;
  subject: AdminSubject;
  grade: number;
  originalPriceVnd: number;
  salePriceVnd: number | null;
  enrolledStudentCount: number;
  totalChapterCount: number;
  totalLessonCount: number;
  status: AdminPublishStatus;
  sortOrder: number;
  updatedAt: string;
  chapters?: AdminChapterApi[];
};

export type AdminChapterApi = {
  id: string;
  learningPathId: string;
  orderIndex: number;
  title: string;
  overview: string | null;
  objectivesJson: unknown;
  status: AdminPublishStatus;
  lessons?: AdminLessonApi[];
};

export type AdminLessonApi = {
  id: string;
  chapterId: string;
  orderIndex: number;
  title: string;
  shortDescription: string | null;
  lessonType: AdminLessonType;
  liveUrl: string | null;
  scheduledAt: string | null;
  examOpenAt: string | null;
  videoUrl: string | null;
  completionMinScore: number;
  trialEnabled: boolean;
  status: AdminPublishStatus;
};

export type UploadedFileApi = {
  id: string;
  originalName: string;
  publicUrl: string | null;
};

export type SignedUrlApi = {
  url: string;
  expiresAt: string;
};

export type AdminLearningPathPayload = {
  descriptionJson?: Record<string, unknown>;
  grade: number;
  originalPriceVnd: number;
  salePriceVnd?: number | null;
  slug?: string;
  sortOrder: number;
  status: Exclude<AdminPublishStatus, "ARCHIVED">;
  subject: AdminSubject;
  thumbnailFileId?: string | null;
  title: string;
};

export type AdminChapterPayload = {
  objectivesJson?: Record<string, unknown> | null;
  orderIndex?: number;
  overview?: string | null;
  status?: AdminPublishStatus;
  title?: string;
};

export type AdminLessonPayload = {
  completionMinScore?: number;
  examOpenAt?: string | null;
  lessonType?: AdminLessonType;
  liveUrl?: string | null;
  orderIndex?: number;
  scheduledAt?: string | null;
  shortDescription?: string | null;
  status?: AdminPublishStatus;
  sourceDocumentExtractions?: Array<{
    id?: string;
    sourceDocumentId: string;
    pageStart: number;
    pageEnd: number;
    sortOrder?: number;
  }>;
  title?: string;
  trialEnabled?: boolean;
  videoUrl?: string | null;
};

export type MappedAdminChapter = AdminChapter;
