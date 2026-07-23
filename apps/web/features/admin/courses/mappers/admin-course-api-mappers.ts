import type {
  AdminChapter,
  AdminLearningPath,
  AdminLesson,
} from "@/features/admin/courses/admin-courses-data";
import type {
  AdminChapterApi,
  AdminLearningPathApi,
  AdminLessonApi,
} from "@/features/admin/courses/types/admin-course-api-types";

export function mapLearningPath(path: AdminLearningPathApi): AdminLearningPath {
  const chapters = (path.chapters ?? []).map(mapChapter);

  return {
    id: path.id,
    title: path.title,
    slug: path.slug,
    thumbnailFileId: path.thumbnailFileId,
    thumbnailFileName: path.thumbnailFile?.originalName ?? "",
    thumbnailImageUrl: path.thumbnailFile?.url ?? "",
    description: descriptionJsonToText(path.descriptionJson),
    subject: path.subject,
    grade: path.grade,
    originalPriceVnd: path.originalPriceVnd,
    salePriceVnd: path.salePriceVnd,
    enrolledStudentCount: path.enrolledStudentCount,
    totalChapterCount: path.totalChapterCount,
    totalLessonCount: path.totalLessonCount,
    status: path.status,
    sortOrder: path.sortOrder,
    updatedAt: path.updatedAt,
    chapters,
  };
}

export function mapChapter(chapter: AdminChapterApi): AdminChapter {
  return {
    id: chapter.id,
    orderIndex: chapter.orderIndex,
    title: chapter.title,
    overview: chapter.overview ?? "",
    objectives: objectivesJsonToText(chapter.objectivesJson),
    status: chapter.status,
    lessons: (chapter.lessons ?? []).map(mapLesson),
  };
}

export function mapLesson(lesson: AdminLessonApi): AdminLesson {
  return {
    id: lesson.id,
    chapterId: lesson.chapterId,
    orderIndex: lesson.orderIndex,
    title: lesson.title,
    shortDescription: lesson.shortDescription ?? "",
    lessonType: lesson.lessonType,
    liveUrl: lesson.liveUrl ?? "",
    scheduledAt: toDateTimeLocalValue(lesson.scheduledAt),
    examOpenAt: toDateTimeLocalValue(lesson.examOpenAt),
    videoUrl: lesson.videoUrl ?? "",
    completionMinScore: lesson.completionMinScore,
    trialEnabled: lesson.trialEnabled ?? false,
    status: lesson.status,
  };
}

function descriptionJsonToText(value: unknown) {
  if (isRecord(value) && typeof value.text === "string") {
    return value.text;
  }

  return extractTextFromTiptap(value);
}

function objectivesJsonToText(value: unknown) {
  if (isRecord(value) && typeof value.text === "string") {
    return value.text;
  }

  return "";
}

function extractTextFromTiptap(value: unknown): string {
  if (!isRecord(value)) {
    return "";
  }

  const content = Array.isArray(value.content) ? value.content : [];
  const text = content
    .map((item) => {
      if (isRecord(item) && typeof item.text === "string") {
        return item.text;
      }

      return extractTextFromTiptap(item);
    })
    .filter(Boolean)
    .join(" ");

  return text.trim();
}

function toDateTimeLocalValue(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
