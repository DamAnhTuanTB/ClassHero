import type {
  AdminChapter,
  AdminLearningPath,
  AdminLesson,
} from "@/features/admin/courses/admin-courses-data";
import {
  statusLabels,
  subjectLabels,
  type AdminPublishStatus,
  type AdminSubject,
} from "@/features/admin/courses/admin-courses-data";
import type {
  ChapterFormValues,
  LearningPathFormValues,
  LessonFormValues,
} from "@/features/admin/courses/admin-courses-schemas";
import type {
  LearningPathSortKey,
  SortDirection,
} from "@/features/admin/courses/admin-courses-types";

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
    thumbnailFileId: path.thumbnailFileId ?? "",
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
    throw new Error("Course subject and grade are required");
  }

  return {
    title: values.title.trim(),
    slug: values.slug.trim(),
    thumbnailFileId: values.thumbnailFileId.trim(),
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
    trialEnabled: lesson.trialEnabled,
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
    trialEnabled: values.trialEnabled,
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

export function moveItemById<TItem extends { id: string }>(
  items: TItem[],
  sourceId: string,
  targetId: string,
) {
  const sourceIndex = items.findIndex((item) => item.id === sourceId);
  const targetIndex = items.findIndex((item) => item.id === targetId);

  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(sourceIndex, 1);
  if (!movedItem) {
    return items;
  }

  nextItems.splice(targetIndex, 0, movedItem);

  return nextItems;
}

export function reindexChapters(chapters: AdminChapter[]) {
  return chapters.map((chapter, index) => ({
    ...chapter,
    orderIndex: index + 1,
  }));
}

export function reindexLessons(lessons: AdminLesson[]) {
  return lessons.map((lesson, index) => ({
    ...lesson,
    orderIndex: index + 1,
  }));
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
  const roundedValue = Math.trunc(value);
  const sign = roundedValue < 0 ? "-" : "";
  const absoluteValue = Math.abs(roundedValue).toString();
  const groupedValue = absoluteValue.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return `${sign}${groupedValue} VND`;
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

  const dateParts = parseVietnamDateTimeParts(value);

  if (!dateParts) {
    return "Chưa đặt";
  }

  return `${padDatePart(dateParts.day)}/${padDatePart(dateParts.month)}/${dateParts.year} ${padDatePart(dateParts.hour)}:${padDatePart(dateParts.minute)}`;
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
  const normalizedLeftValue = normalizeSearchableText(leftValue);
  const normalizedRightValue = normalizeSearchableText(rightValue);

  if (normalizedLeftValue < normalizedRightValue) {
    return -1;
  }

  if (normalizedLeftValue > normalizedRightValue) {
    return 1;
  }

  return compareCodePointText(leftValue, rightValue);
}

type DateTimeParts = {
  day: number;
  hour: number;
  minute: number;
  month: number;
  year: number;
};

const VIETNAM_TIME_OFFSET_MS = 7 * 60 * 60 * 1000;

function parseVietnamDateTimeParts(value: string): DateTimeParts | null {
  const localMatch = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d{1,3})?)?$/,
  );

  if (localMatch) {
    return {
      year: Number(localMatch[1]),
      month: Number(localMatch[2]),
      day: Number(localMatch[3]),
      hour: Number(localMatch[4]),
      minute: Number(localMatch[5]),
    };
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const vietnamDate = new Date(date.getTime() + VIETNAM_TIME_OFFSET_MS);

  return {
    year: vietnamDate.getUTCFullYear(),
    month: vietnamDate.getUTCMonth() + 1,
    day: vietnamDate.getUTCDate(),
    hour: vietnamDate.getUTCHours(),
    minute: vietnamDate.getUTCMinutes(),
  };
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function normalizeSearchableText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

function compareCodePointText(leftValue: string, rightValue: string) {
  if (leftValue < rightValue) {
    return -1;
  }

  if (leftValue > rightValue) {
    return 1;
  }

  return 0;
}
