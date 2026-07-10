import type {
  AdminChapter,
  AdminLearningPath,
  AdminLesson,
} from "@/features/admin-courses/data";
import {
  statusLabels,
  subjectLabels,
  type AdminPublishStatus,
  type AdminSubject,
} from "@/features/admin-courses/data";
import type {
  ChapterFormValues,
  LearningPathFormValues,
  LessonFormValues,
} from "@/features/admin-courses/schemas";
import type { LearningPathSortKey, SortDirection } from "@/features/admin-courses/types";

export type LearningPathFilterInput = {
  query: string;
  subjectFilter: AdminSubject | "ALL";
  statusFilter: AdminPublishStatus | "ALL";
  gradeFilter: number | "ALL";
  sortKey: LearningPathSortKey;
  sortDirection: SortDirection;
};

export type AdminCourseStats = {
  archived: number;
  notPublished: number;
  published: number;
  total: number;
};

export type AdminCourseDetailStats = {
  archivedChapters: number;
  archivedLessons: number;
  enrolledStudents: number;
  publishedChapters: number;
  publishedLessons: number;
  totalChapters: number;
  totalLessons: number;
};

export type LessonMatch = {
  chapter: AdminChapter;
  lesson: AdminLesson;
};

export function toPathFormValues(path: AdminLearningPath): LearningPathFormValues {
  return {
    title: path.title,
    slug: path.slug,
    thumbnailFileName: path.thumbnailFileName ?? "",
    thumbnailImageUrl: path.thumbnailImageUrl,
    description: path.description,
    subject: path.subject,
    grade: path.grade,
    originalPriceVnd: path.originalPriceVnd,
    salePriceVnd: path.salePriceVnd ?? "",
    status: path.status === "ARCHIVED" ? "DRAFT" : path.status,
    sortOrder: path.sortOrder,
  };
}

export function toLearningPathPayload(values: LearningPathFormValues) {
  if (!values.subject || values.grade === "") {
    throw new Error("Learning path subject and grade are required");
  }

  return {
    title: values.title.trim(),
    slug: values.slug.trim(),
    thumbnailFileName: values.thumbnailFileName.trim(),
    thumbnailImageUrl: values.thumbnailImageUrl.trim(),
    description: values.description.trim(),
    subject: values.subject,
    grade: Number(values.grade),
    originalPriceVnd:
      values.originalPriceVnd === "" ? 0 : Number(values.originalPriceVnd),
    salePriceVnd: values.salePriceVnd === "" ? null : Number(values.salePriceVnd),
    status: values.status,
    sortOrder: Number(values.sortOrder),
  };
}

export function toLessonFormValues(lesson: AdminLesson): LessonFormValues {
  return {
    orderIndex: lesson.orderIndex,
    title: lesson.title,
    shortDescription: lesson.shortDescription,
    scheduledAt: lesson.scheduledAt,
    examOpenAt: lesson.examOpenAt,
    videoUrl: lesson.videoUrl,
    completionMinScore: lesson.completionMinScore,
    status: lesson.status,
  };
}

export function toLessonPayload(values: LessonFormValues): Omit<AdminLesson, "id"> {
  return {
    orderIndex: Number(values.orderIndex),
    title: values.title.trim(),
    shortDescription: values.shortDescription?.trim() ?? "",
    scheduledAt: values.scheduledAt ?? "",
    examOpenAt: values.examOpenAt ?? "",
    videoUrl: values.videoUrl?.trim() ?? "",
    completionMinScore: Number(values.completionMinScore),
    status: values.status,
  };
}

export function toChapterFormValues(chapter: AdminChapter): ChapterFormValues {
  return {
    orderIndex: chapter.orderIndex,
    title: chapter.title,
    overview: chapter.overview,
    objectives: chapter.objectives,
    status: chapter.status,
  };
}

export function toChapterPayload(
  values: ChapterFormValues,
): Omit<AdminChapter, "id" | "lessons"> {
  return {
    orderIndex: Number(values.orderIndex),
    title: values.title.trim(),
    overview: values.overview?.trim() ?? "",
    objectives: values.objectives?.trim() ?? "",
    status: values.status,
  };
}

export function byChapterOrder(left: AdminChapter, right: AdminChapter) {
  return left.orderIndex - right.orderIndex;
}

export function byLessonOrder(left: AdminLesson, right: AdminLesson) {
  return left.orderIndex - right.orderIndex;
}

export function getLessonsFromPath(path: AdminLearningPath) {
  return path.chapters.flatMap((chapter) => chapter.lessons);
}

export function getActiveLearningPaths(paths: AdminLearningPath[]) {
  return paths.filter((path) => path.status !== "ARCHIVED");
}

export function getArchivedLearningPaths(paths: AdminLearningPath[]) {
  return paths.filter((path) => path.status === "ARCHIVED");
}

export function filterAndSortLearningPaths(
  paths: AdminLearningPath[],
  filters: LearningPathFilterInput,
) {
  const keyword = filters.query.trim().toLowerCase();
  const matchedPaths = paths.filter((path) => {
    const matchesKeyword =
      !keyword ||
      path.title.toLowerCase().includes(keyword) ||
      path.slug.toLowerCase().includes(keyword);
    const matchesSubject =
      filters.subjectFilter === "ALL" || path.subject === filters.subjectFilter;
    const matchesStatus =
      filters.statusFilter === "ALL" || path.status === filters.statusFilter;
    const matchesGrade =
      filters.gradeFilter === "ALL" || path.grade === filters.gradeFilter;

    return matchesKeyword && matchesSubject && matchesStatus && matchesGrade;
  });

  return [...matchedPaths].sort((leftPath, rightPath) => {
    const result = compareLearningPaths(leftPath, rightPath, filters.sortKey);

    return filters.sortDirection === "asc" ? result : -result;
  });
}

export function getAdminCourseStats(
  activePaths: AdminLearningPath[],
  archivedPaths: AdminLearningPath[],
): AdminCourseStats {
  const published = activePaths.filter((path) => path.status === "PUBLISHED").length;
  const notPublished = activePaths.filter(
    (path) => path.status === "DRAFT" || path.status === "HIDDEN",
  ).length;

  return {
    archived: archivedPaths.length,
    notPublished,
    published,
    total: activePaths.length,
  };
}

export function getAdminCourseDetailStats(
  path: AdminLearningPath | null,
): AdminCourseDetailStats {
  const chapters = path?.chapters ?? [];
  const lessons = path ? getLessonsFromPath(path) : [];

  return {
    archivedChapters: chapters.filter((chapter) => chapter.status === "ARCHIVED").length,
    archivedLessons: lessons.filter((lesson) => lesson.status === "ARCHIVED").length,
    enrolledStudents: path?.enrolledStudentCount ?? 0,
    publishedChapters: chapters.filter((chapter) => chapter.status === "PUBLISHED")
      .length,
    publishedLessons: lessons.filter((lesson) => lesson.status === "PUBLISHED").length,
    totalChapters: chapters.length,
    totalLessons: lessons.length,
  };
}

export function findLessonMatch(
  path: AdminLearningPath | null,
  lessonId: string | null,
): LessonMatch | null {
  if (!path || !lessonId) {
    return null;
  }

  for (const chapter of path.chapters) {
    const lesson = chapter.lessons.find((item) => item.id === lessonId);

    if (lesson) {
      return { chapter, lesson };
    }
  }

  return null;
}

export function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function formatPrice(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

export function getPriceChangePercent(originalPriceVnd: number, currentPriceVnd: number) {
  if (originalPriceVnd <= 0 || originalPriceVnd === currentPriceVnd) {
    return null;
  }

  return Math.round(((currentPriceVnd - originalPriceVnd) / originalPriceVnd) * 100);
}

export function formatDateTime(value: string) {
  if (!value) {
    return "Chưa đặt";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function isAllowedVideoUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");

    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      (hostname === "youtube.com" ||
        hostname === "m.youtube.com" ||
        hostname === "youtu.be" ||
        hostname === "youtube-nocookie.com" ||
        hostname === "drive.google.com")
    );
  } catch {
    return false;
  }
}

function compareLearningPaths(
  leftPath: AdminLearningPath,
  rightPath: AdminLearningPath,
  sortKey: LearningPathSortKey,
) {
  switch (sortKey) {
    case "title":
      return compareText(leftPath.title, rightPath.title);
    case "subject":
      return compareText(
        subjectLabels[leftPath.subject],
        subjectLabels[rightPath.subject],
      );
    case "grade":
      return compareNumber(leftPath.grade, rightPath.grade);
    case "price":
      return compareNumber(getCurrentPrice(leftPath), getCurrentPrice(rightPath));
    case "status":
      return compareText(statusLabels[leftPath.status], statusLabels[rightPath.status]);
    default:
      return 0;
  }
}

function getCurrentPrice(path: AdminLearningPath) {
  return path.salePriceVnd ?? path.originalPriceVnd;
}

function compareNumber(leftValue: number, rightValue: number) {
  return leftValue - rightValue;
}

function compareText(leftValue: string, rightValue: string) {
  return leftValue.localeCompare(rightValue, "vi", {
    numeric: true,
    sensitivity: "base",
  });
}
