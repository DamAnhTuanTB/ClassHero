import { serializeChapterDetail } from "#api/modules/learning-paths/serializers/chapter.serializers";
import type {
  LearningPathDetailRecord,
  LearningPathRecord,
  LearningPathResponse,
  PublicLearningPathRecord,
  PublicViewerContext,
} from "#api/modules/learning-paths/types/learning-path.types";

export function serializeLearningPath(
  record: LearningPathRecord | LearningPathDetailRecord,
  thumbnailUrl: string | null = null,
): LearningPathResponse {
  return {
    id: record.id,
    subject: record.subject,
    grade: record.grade,
    title: record.title,
    slug: record.slug,
    originalPriceVnd: record.originalPriceVnd,
    salePriceVnd: record.salePriceVnd,
    enrolledStudentCount: record._count.enrollments,
    totalChapterCount: record.totalChapterCount,
    totalLessonCount: record.totalLessonCount,
    thumbnailFileId: record.thumbnailFileId,
    thumbnailFile: record.thumbnailFile
      ? {
          id: record.thumbnailFile.id,
          originalName: record.thumbnailFile.originalName,
          url: thumbnailUrl,
        }
      : null,
    descriptionJson: record.descriptionJson,
    status: record.status,
    trialEnabled: record.trialEnabled,
    publishedAt: record.publishedAt,
    sortOrder: record.sortOrder,
    createdById: record.createdById,
    updatedById: record.updatedById,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    ...("chapters" in record
      ? { chapters: record.chapters.map(serializeChapterDetail) }
      : {}),
  };
}

export function serializePublicLearningPath(
  record: PublicLearningPathRecord,
  viewer: PublicViewerContext,
) {
  const activeEnrollment = viewer.activeEnrollmentByLearningPathId.get(record.id);
  const firstLesson = record.lessons[0];
  const trialLessonId = record.trialEnabled && !activeEnrollment ? firstLesson?.id : null;

  return {
    id: record.id,
    subject: record.subject,
    grade: record.grade,
    title: record.title,
    slug: record.slug,
    originalPriceVnd: record.originalPriceVnd,
    salePriceVnd: record.salePriceVnd,
    totalChapterCount: record.totalChapterCount,
    totalLessonCount: record.totalLessonCount,
    thumbnailFileId: record.thumbnailFileId,
    descriptionJson: record.descriptionJson,
    status: record.status,
    trialEnabled: record.trialEnabled,
    publishedAt: record.publishedAt,
    sortOrder: record.sortOrder,
    summary: {
      chapterCount: record.totalChapterCount,
      lessonCount: record.lessons.length,
      firstLessonId: firstLesson?.id ?? null,
      effectivePriceVnd: record.salePriceVnd ?? record.originalPriceVnd,
      hasDiscount: record.salePriceVnd !== null,
    },
    access: {
      hasActiveEnrollment: Boolean(activeEnrollment),
      enrollment: activeEnrollment
        ? {
            id: activeEnrollment.id,
            status: activeEnrollment.status,
            startsAt: activeEnrollment.startsAt,
            expiresAt: activeEnrollment.expiresAt,
          }
        : null,
      trialAvailable: Boolean(trialLessonId),
      trialLessonId,
    },
    lessons: record.lessons.map((lesson) => ({
      id: lesson.id,
      orderIndex: lesson.orderIndex,
      title: lesson.title,
      shortDescription: lesson.shortDescription,
      examOpenAt: lesson.examOpenAt,
      status: lesson.status,
    })),
  };
}
