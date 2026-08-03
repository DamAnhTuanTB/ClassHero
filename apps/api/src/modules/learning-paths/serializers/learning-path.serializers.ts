import { LessonProgressStatus } from "@prisma/client";
import { serializeChapterDetail } from "#api/modules/learning-paths/serializers/chapter.serializers";
import { serializeLesson } from "#api/modules/learning-paths/serializers/lesson.serializers";
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
  const chapters = "chapters" in record ? record.chapters.map(serializeChapterDetail) : [];
  const ungroupedLessons =
    "lessons" in record ? record.lessons.map(serializeLesson) : [];

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
      ? {
          chapters,
          structureItems: [
            ...chapters.map((chapter) => ({ type: "CHAPTER" as const, ...chapter })),
            ...ungroupedLessons.map((lesson) => ({
              type: "LESSON" as const,
              ...lesson,
            })),
          ].sort(compareStructureItems),
        }
      : {}),
  };
}

export function serializePublicLearningPath(
  record: PublicLearningPathAnyRecord,
  viewer: PublicViewerContext,
  thumbnailUrl: string | null = null,
) {
  const activeEnrollment = viewer.activeEnrollmentByLearningPathId.get(record.id);
  const orderedLessons = getOrderedPublicLessons(record);
  const firstLesson = orderedLessons[0];
  const trialLesson = orderedLessons.find((lesson) => lesson.trialEnabled);
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
      lessonCount: orderedLessons.length,
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
    lessons: orderedLessons.map(serializePublicLesson),
    ...("chapters" in record
      ? {
          chapters: record.chapters.map(serializePublicChapter),
          structureItems: serializePublicStructureItems(record),
        }
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
    chapterId: lesson.chapterId,
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

  const orderedLessons = getOrderedPublicLessons(record);

  if (!activeEnrollment || orderedLessons.length === 0) {
    return null;
  }

  const completedLessons = orderedLessons.filter(
    (lesson) =>
      viewer.lessonProgressByLessonId.get(lesson.id)?.status ===
      LessonProgressStatus.COMPLETED,
  );
  const inProgressLesson = orderedLessons.find(
    (lesson) =>
      viewer.lessonProgressByLessonId.get(lesson.id)?.status ===
      LessonProgressStatus.IN_PROGRESS,
  );
  const firstIncompleteLesson =
    inProgressLesson ??
    orderedLessons.find(
      (lesson) =>
        viewer.lessonProgressByLessonId.get(lesson.id)?.status !==
        LessonProgressStatus.COMPLETED,
    ) ??
    orderedLessons.at(-1);
  const completedLessonCount = completedLessons.length;
  const progressPercent = Math.round(
    (completedLessonCount / orderedLessons.length) * 100,
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

function getOrderedPublicLessons(record: PublicLearningPathAnyRecord) {
  if (!("chapters" in record)) {
    return record.lessons;
  }

  return getPublicStructureNodes(record).flatMap((item) =>
    item.type === "LESSON"
      ? [item.lesson]
      : item.chapter.status === "PUBLISHED"
        ? item.chapter.lessons
        : [],
  );
}

function getPublicStructureNodes(record: PublicLearningPathDetailRecord) {
  const chapters = record.chapters.map((chapter) => ({
    type: "CHAPTER" as const,
    orderIndex: chapter.orderIndex,
    chapter,
  }));
  const lessons = record.lessons
    .filter((lesson) => lesson.chapterId === null)
    .map((lesson) => ({
      type: "LESSON" as const,
      orderIndex: lesson.orderIndex,
      lesson,
    }));

  return [...chapters, ...lessons].sort(compareStructureItems);
}

function serializePublicStructureItems(record: PublicLearningPathDetailRecord) {
  return getPublicStructureNodes(record).map((item) =>
    item.type === "LESSON"
      ? { type: item.type, ...serializePublicLesson(item.lesson) }
      : { type: item.type, ...serializePublicChapter(item.chapter) },
  );
}

function compareStructureItems(
  left: { orderIndex: number; type: "CHAPTER" | "LESSON" },
  right: { orderIndex: number; type: "CHAPTER" | "LESSON" },
) {
  return left.orderIndex - right.orderIndex || left.type.localeCompare(right.type);
}
