import type {
  PublicLearningPathApi,
  PublicLearningPathChapterApi,
  PublicLearningPathLessonApi,
  StudentCoursesListMeta,
} from "@/features/student/shared/types/student-course-api-types";
import type {
  StudentCourse,
  StudentCourseAccess,
  StudentCourseDetailChapter,
  StudentCourseDetailChapterTone,
  StudentCourseDetailLessonStatus,
  StudentCourseSubject,
  StudentCourseTone,
} from "@/features/student/shared/student-courses-types";
import type {
  StudentCourseDetailResult,
  StudentCoursesListResult,
} from "@/features/student/shared/types/student-course-api-results";

export function mapLearningPathsToCoursesList(
  learningPaths: PublicLearningPathApi[],
  meta: StudentCoursesListMeta | undefined,
) {
  return {
    courses: learningPaths.map(mapLearningPathToCourse),
    meta: normalizeListMeta(meta),
  } satisfies StudentCoursesListResult;
}

export function mapLearningPathToCourseDetail(
  learningPath: PublicLearningPathApi,
): StudentCourseDetailResult {
  const course = mapLearningPathToCourse(learningPath);
  const orderedLessons = learningPath.lessons;
  const isCoursePublished = learningPath.status === "PUBLISHED";
  const completedLessonCount = learningPath.progress?.completedLessonCount ?? 0;
  const continueLessonId = isCoursePublished
    ? (learningPath.progress?.continueLessonId ?? learningPath.access.trialLessonId ?? "")
    : "";
  const continueLessonTitle = isCoursePublished
    ? (learningPath.progress?.continueLessonTitle ??
      orderedLessons.find((lesson) => lesson.id === continueLessonId)?.title ??
      "")
    : "";
  const continueLessonKind = learningPath.progress?.continueLessonKind ?? "first";
  const chapterSource = learningPath.chapters ?? [];

  return {
    course,
    detail: {
      chapters: chapterSource.map((chapter, chapterIndex) =>
        mapChapterToDetail({
          chapter,
          chapterIndex,
          completedLessonCount,
          continueLessonId,
          hasActiveEnrollment: learningPath.access.hasActiveEnrollment,
          isCoursePublished,
          orderedLessons,
        }),
      ),
      continueLessonId,
      continueLessonKind,
      continueLessonTitle,
      totalHours: Math.ceil((orderedLessons.length * 40) / 60),
    },
  };
}

function mapLearningPathToCourse(learningPath: PublicLearningPathApi): StudentCourse {
  const progress = learningPath.progress;
  const access = getCourseAccess(learningPath);
  const isUnderMaintenance =
    learningPath.status !== "PUBLISHED" && learningPath.access.hasActiveEnrollment;
  const continueLesson = isUnderMaintenance ? undefined : getContinueLesson(learningPath);

  return {
    access,
    chapterCount: learningPath.summary.chapterCount,
    description: extractDescriptionText(learningPath.descriptionJson),
    exerciseCount: 0,
    grade: learningPath.grade,
    id: learningPath.id,
    isUnderMaintenance,
    lessonCount: learningPath.summary.lessonCount,
    nextLesson: continueLesson
      ? {
          examOpenLabel: getExamOpenLabel(continueLesson.examOpenAt),
          id: continueLesson.id,
          kind: progress?.continueLessonKind ?? "first",
          title: continueLesson.title,
        }
      : undefined,
    originalPriceVnd: learningPath.originalPriceVnd,
    progressPercent:
      access !== "locked" && !isUnderMaintenance
        ? (progress?.progressPercent ?? 0)
        : undefined,
    salePriceVnd: learningPath.salePriceVnd ?? undefined,
    slug: learningPath.slug,
    subject: learningPath.subject,
    thumbnailImageUrl: learningPath.thumbnailFile?.url ?? undefined,
    title: learningPath.title,
    tone: subjectToneBySubject[learningPath.subject],
    trialLessonCount:
      access === "locked" && learningPath.access.trialAvailable ? 1 : undefined,
    updatedLabel: isUnderMaintenance
      ? "Đang bảo trì"
      : learningPath.publishedAt
        ? "Đã xuất bản"
        : undefined,
  };
}

function mapChapterToDetail({
  chapter,
  chapterIndex,
  completedLessonCount,
  continueLessonId,
  hasActiveEnrollment,
  isCoursePublished,
  orderedLessons,
}: {
  chapter: PublicLearningPathChapterApi;
  chapterIndex: number;
  completedLessonCount: number;
  continueLessonId: string;
  hasActiveEnrollment: boolean;
  isCoursePublished: boolean;
  orderedLessons: PublicLearningPathLessonApi[];
}): StudentCourseDetailChapter {
  const completedLessonIds = new Set(
    orderedLessons.slice(0, completedLessonCount).map((lesson) => lesson.id),
  );
  const isChapterPublished = chapter.status === "PUBLISHED";
  const progressPercent =
    !isCoursePublished || !isChapterPublished || chapter.lessons.length === 0
      ? 0
      : Math.round(
          (chapter.lessons.filter((lesson) => completedLessonIds.has(lesson.id)).length /
            chapter.lessons.length) *
            100,
        );

  return {
    description: chapter.overview ?? "Các nội dung trọng tâm trong chương này.",
    id: chapter.id,
    lessons: chapter.lessons.map((lesson) => ({
      durationMinutes: 40,
      id: lesson.id,
      isTrial: isCoursePublished && !hasActiveEnrollment && lesson.trialEnabled,
      lessonType: lesson.lessonType,
      status: getLessonStatus({
        completedLessonIds,
        continueLessonId,
        hasActiveEnrollment,
        isCoursePublished,
        isChapterPublished,
        lessonId: lesson.id,
        trialEnabled: lesson.trialEnabled,
      }),
      title: lesson.title,
    })),
    order: chapter.orderIndex,
    progressPercent,
    status: chapter.status,
    title: normalizeChapterTitle(chapter.title, chapter.orderIndex),
    tone: chapterToneSequence[chapterIndex % chapterToneSequence.length] ?? "emerald",
  };
}

function getCourseAccess(learningPath: PublicLearningPathApi): StudentCourseAccess {
  if (!learningPath.access.hasActiveEnrollment) {
    return "locked";
  }

  return learningPath.progress?.progressPercent === 100 ? "completed" : "enrolled";
}

function getContinueLesson(learningPath: PublicLearningPathApi) {
  const continueLessonId =
    learningPath.progress?.continueLessonId ?? learningPath.access.trialLessonId;

  if (!continueLessonId) {
    return undefined;
  }

  return learningPath.lessons.find((lesson) => lesson.id === continueLessonId);
}

function getLessonStatus({
  completedLessonIds,
  continueLessonId,
  hasActiveEnrollment,
  isCoursePublished,
  isChapterPublished,
  lessonId,
  trialEnabled,
}: {
  completedLessonIds: Set<string>;
  continueLessonId: string;
  hasActiveEnrollment: boolean;
  isCoursePublished: boolean;
  isChapterPublished: boolean;
  lessonId: string;
  trialEnabled: boolean;
}): StudentCourseDetailLessonStatus {
  if (!isCoursePublished || !isChapterPublished) {
    return "locked";
  }

  if (completedLessonIds.has(lessonId)) {
    return "completed";
  }

  if (!hasActiveEnrollment) {
    return trialEnabled ? "current" : "locked";
  }

  if (lessonId === continueLessonId) {
    return "current";
  }

  return "locked";
}

function normalizeListMeta(meta: StudentCoursesListMeta | undefined) {
  return {
    page: typeof meta?.page === "number" ? meta.page : 1,
    pageSize: typeof meta?.pageSize === "number" ? meta.pageSize : 100,
    total: typeof meta?.total === "number" ? meta.total : 0,
    totalPages: typeof meta?.totalPages === "number" ? meta.totalPages : 1,
    priorityGrade: typeof meta?.priorityGrade === "number" ? meta.priorityGrade : null,
    gradeGroups: Array.isArray(meta?.gradeGroups)
      ? meta.gradeGroups.filter(isGradeGroup)
      : [],
  };
}

function isGradeGroup(value: unknown): value is { grade: number; count: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    "grade" in value &&
    "count" in value &&
    typeof value.grade === "number" &&
    typeof value.count === "number"
  );
}

function extractDescriptionText(value: unknown) {
  const text = findFirstTextNode(value);

  return (
    text ?? "Khóa học theo từng chương, giúp em nắm chắc kiến thức và luyện tập đều đặn."
  );
}

function findFirstTextNode(value: unknown): string | null {
  if (typeof value === "string") {
    return value.trim() || null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  if ("text" in value && typeof value.text === "string") {
    return value.text.trim() || null;
  }

  if ("content" in value && Array.isArray(value.content)) {
    for (const child of value.content) {
      const text = findFirstTextNode(child);

      if (text) {
        return text;
      }
    }
  }

  return null;
}

function getExamOpenLabel(value: string | null) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return `Mở bài kiểm tra ${date.toLocaleDateString("vi-VN")}`;
}

function normalizeChapterTitle(title: string, orderIndex: number) {
  return title.replace(new RegExp(`^chương\\s*${orderIndex}\\s*[-:.]?\\s*`, "i"), "");
}

const subjectToneBySubject: Record<StudentCourseSubject, StudentCourseTone> = {
  CHEMISTRY: "chemistry",
  MATH: "math",
  PHYSICS: "physics",
};

const chapterToneSequence: StudentCourseDetailChapterTone[] = [
  "emerald",
  "amber",
  "violet",
];
