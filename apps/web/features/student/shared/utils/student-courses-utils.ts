import type {
  StudentCourse,
  StudentCourseAccess,
  StudentCourseStat,
  StudentCourseSubject,
  StudentCourseSubjectFilter,
  StudentTodayGoal,
} from "@/features/student/shared/student-courses-types";

export const subjectLabels: Record<StudentCourseSubject, string> = {
  CHEMISTRY: "HÓA",
  MATH: "TOÁN",
  PHYSICS: "LÝ",
};

export const subjectDisplayLabels: Record<StudentCourseSubject, string> = {
  CHEMISTRY: "Hóa",
  MATH: "Toán",
  PHYSICS: "Lý",
};

const subjectBadgeClasses: Record<StudentCourseSubject, string> = {
  CHEMISTRY:
    "bg-orange-50 text-orange-700 dark:bg-[var(--theme-warning-bg)] dark:text-[var(--theme-warning-text)]",
  MATH: "bg-blue-50 text-blue-700 dark:bg-[var(--theme-primary-soft)] dark:text-[var(--theme-primary)]",
  PHYSICS:
    "bg-teal-50 text-teal-700 dark:bg-[var(--theme-success-bg)] dark:text-teal-300",
};

export const accessLabels: Record<StudentCourseAccess, string> = {
  completed: "Đã hoàn thành",
  enrolled: "Đang học",
  locked: "Chưa mua",
};

const gradeTextClasses: Record<number, string> = {
  3: "text-rose-900 dark:text-rose-300",
  4: "text-orange-900 dark:text-orange-300",
  5: "text-amber-900 dark:text-amber-300",
  6: "text-lime-900 dark:text-lime-300",
  7: "text-blue-900 dark:text-blue-300",
  8: "text-teal-900 dark:text-teal-300",
  9: "text-violet-900 dark:text-violet-300",
  10: "text-fuchsia-900 dark:text-fuchsia-300",
  11: "text-cyan-900 dark:text-cyan-300",
  12: "text-emerald-900 dark:text-emerald-300",
};

export function getGradeTextClass(grade: number) {
  return gradeTextClasses[grade] ?? "text-blue-900 dark:text-blue-300";
}

export function getSubjectBadgeClass(subject: StudentCourseSubject) {
  return subjectBadgeClasses[subject];
}

export function formatVnd(value: number) {
  return `${Math.trunc(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".")} VND`;
}

export function getCoursePrice(course: StudentCourse) {
  return course.salePriceVnd ?? course.originalPriceVnd;
}

export function getPurchasedCourses(courses: StudentCourse[]) {
  return courses.filter(
    (course) => course.access === "completed" || course.access === "enrolled",
  );
}

export function getExploreCourseGroups(courses: StudentCourse[]) {
  const purchasedCourses = getPurchasedCourses(courses);
  const otherCourses = courses.filter(
    (course) => course.access !== "completed" && course.access !== "enrolled",
  );

  return {
    otherCourses,
    purchasedCourses,
  };
}

export function hasMixedExploreCourseAccess(courses: StudentCourse[]) {
  const { otherCourses, purchasedCourses } = getExploreCourseGroups(courses);

  return purchasedCourses.length > 0 && otherCourses.length > 0;
}

export function filterStudentCourses({
  courses,
  grade,
  query,
  subject,
}: {
  courses: StudentCourse[];
  grade: number | null;
  query: string;
  subject: StudentCourseSubjectFilter;
}) {
  const normalizedQuery = normalizeSearchableText(query);

  return courses.filter((course) => {
    const matchesGrade = grade === null || course.grade === grade;
    const matchesSubject = subject === "ALL" || course.subject === subject;
    const matchesQuery =
      !normalizedQuery ||
      normalizeSearchableText(
        `${course.title} ${course.description} ${subjectDisplayLabels[course.subject]} lớp ${course.grade}`,
      ).includes(normalizedQuery);

    return matchesGrade && matchesSubject && matchesQuery;
  });
}

export function getAverageProgress(courses: StudentCourse[]) {
  const progressValues = courses
    .map((course) => course.progressPercent)
    .filter((value): value is number => typeof value === "number");

  if (progressValues.length === 0) {
    return 0;
  }

  return Math.round(
    progressValues.reduce((total, value) => total + value, 0) / progressValues.length,
  );
}

export function getPurchasedCourseStats(courses: StudentCourse[]): StudentCourseStat[] {
  const purchasedCourses = getPurchasedCourses(courses);
  const averageProgress = getAverageProgress(purchasedCourses);
  const nextLessonCount = purchasedCourses.filter((course) => course.nextLesson).length;

  return [
    { label: "đang học", value: String(purchasedCourses.length) },
    { label: "tiến độ", value: `${averageProgress}%` },
    { label: "bài học hôm nay", value: String(nextLessonCount) },
  ];
}

export function buildTodayLearningGoals(courses: StudentCourse[]): StudentTodayGoal[] {
  const purchasedCourses = getPurchasedCourses(courses);
  const nextCourse = purchasedCourses.find((course) => course.nextLesson);

  return [
    {
      completed: purchasedCourses.length > 0,
      icon: "lesson",
      id: "open-next-lesson",
      metric: nextCourse?.nextLesson ? "Sẵn sàng" : "Chọn khóa học",
      title: nextCourse?.nextLesson
        ? `Mở ${nextCourse.nextLesson.title}`
        : "Khám phá khóa học phù hợp",
      tone: "sky",
    },
    {
      completed: averageProgressIsStrong(purchasedCourses),
      icon: "score",
      id: "keep-study-progress",
      metric: "Mục tiêu đều đặn",
      title: "Giữ nhịp học để tăng tiến độ",
      tone: "indigo",
    },
  ];
}

function averageProgressIsStrong(courses: StudentCourse[]) {
  return courses.length > 0 && getAverageProgress(courses) >= 50;
}

function normalizeSearchableText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}
