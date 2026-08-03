import { LessonProgressStatus } from "@prisma/client";
import { serializeChapterDetail } from "#api/modules/learning-paths/serializers/chapter.serializers";
import type {
  PublicLearningPathDetailRecord,
  LearningPathDetailRecord,
  LearningPathRecord,
  LearningPathResponse,
  PublicLearningPathRecord,
  PublicViewerContext,
} from "#api/modules/learning-paths/types/learning-path.types";

type PublicLearningPathAnyRecord =
  PublicLearningPathRecord | PublicLearningPathDetailRecord;
type PublicLessonRecord = PublicLearningPathRecord["lessons"][number];
type PublicChapterRecord = PublicLearningPathDetailRecord["chapters"][number];

export function serializeLearningPath(
  record: LearningPathRecord | LearningPathDetailRecord,
  thumbnailUrl: string | null = null,
): LearningPathResponse {
  return {
    id: record.id,
    kind: record.kind,
    sourceLearningPathId: record.sourceLearningPathId,
    domain: record.domain,
    targetAudiences: record.targetAudiences.map((item) => item.targetAudience),
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
    startDate: record.startDate,
    endDate: record.endDate,
    lessonCountMin: record.lessonCountMin,
    lessonCountMax: record.lessonCountMax,
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
  record: PublicLearningPathAnyRecord,
  viewer: PublicViewerContext,
  thumbnailUrl: string | null = null,
) {
  const activeEnrollment = viewer.activeEnrollmentByLearningPathId.get(record.id);
  const firstLesson = record.lessons[0];
  const trialLesson = record.lessons.find((lesson) => lesson.trialEnabled);
  const trialLessonId = !activeEnrollment ? trialLesson?.id : null;
  const learningProgress = getStudentLearningProgress(record, viewer);

  return {
    id: record.id,
    domain: record.domain,
    targetAudiences: record.targetAudiences.map((item) => item.targetAudience),
    title: record.title,
    slug: record.slug,
    originalPriceVnd: record.originalPriceVnd,
    salePriceVnd: record.salePriceVnd,
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
    startDate: record.startDate,
    endDate: record.endDate,
    lessonCountMin: record.lessonCountMin,
    lessonCountMax: record.lessonCountMax,
    status: record.status,
    trialEnabled: Boolean(trialLesson),
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
    progress: learningProgress,
    lessons: record.lessons.map(serializePublicLesson),
    ...("chapters" in record
      ? { chapters: record.chapters.map(serializePublicChapter) }
      : {}),
  };
}

function serializePublicChapter(chapter: PublicChapterRecord) {
  return {
    id: chapter.id,
    orderIndex: chapter.orderIndex,
    title: chapter.title,
    overview: chapter.overview,
    status: chapter.status,
    lessons: chapter.lessons.map(serializePublicLesson),
  };
}

function serializePublicLesson(lesson: PublicLessonRecord) {
  return {
    id: lesson.id,
    orderIndex: lesson.orderIndex,
    title: lesson.title,
    shortDescription: lesson.shortDescription,
    lessonType: lesson.lessonType,
    examOpenAt: lesson.examOpenAt,
    status: lesson.status,
    trialEnabled: lesson.trialEnabled,
  };
}

function getStudentLearningProgress(
  record: PublicLearningPathAnyRecord,
  viewer: PublicViewerContext,
) {
  const activeEnrollment = viewer.activeEnrollmentByLearningPathId.get(record.id);

  if (!activeEnrollment || record.lessons.length === 0) {
    return null;
  }

  const completedLessons = record.lessons.filter(
    (lesson) =>
      viewer.lessonProgressByLessonId.get(lesson.id)?.status ===
      LessonProgressStatus.COMPLETED,
  );
  const inProgressLesson = record.lessons.find(
    (lesson) =>
      viewer.lessonProgressByLessonId.get(lesson.id)?.status ===
      LessonProgressStatus.IN_PROGRESS,
  );
  const firstIncompleteLesson =
    inProgressLesson ??
    record.lessons.find(
      (lesson) =>
        viewer.lessonProgressByLessonId.get(lesson.id)?.status !==
        LessonProgressStatus.COMPLETED,
    ) ??
    record.lessons.at(-1);
  const completedLessonCount = completedLessons.length;
  const progressPercent = Math.round(
    (completedLessonCount / record.lessons.length) * 100,
  );
  const continueLessonKind =
    progressPercent >= 100
      ? "last"
      : inProgressLesson
        ? "inProgress"
        : completedLessonCount === 0
          ? "first"
          : "next";

  return {
    completedLessonCount,
    progressPercent,
    continueLessonId: firstIncompleteLesson?.id ?? null,
    continueLessonKind,
    continueLessonTitle: firstIncompleteLesson?.title ?? null,
  };
}
