import type {
  StudentCourse,
  StudentCourseAccess,
  StudentCourseSubject,
  StudentCourseSubjectFilter,
} from "@/features/student-courses/types";

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
  MATH:
    "bg-blue-50 text-blue-700 dark:bg-[var(--theme-primary-soft)] dark:text-[var(--theme-primary)]",
  PHYSICS:
    "bg-teal-50 text-teal-700 dark:bg-[var(--theme-success-bg)] dark:text-teal-300",
};

export const accessLabels: Record<StudentCourseAccess, string> = {
  enrolled: "Đang học",
  expiring: "Sắp hết hạn",
  locked: "Chưa mua",
  trial: "Có học thử",
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
    (course) => course.access === "enrolled" || course.access === "expiring",
  );
}

export function getExploreCourseGroups(courses: StudentCourse[]) {
  const purchasedCourses = getPurchasedCourses(courses);
  const otherCourses = courses.filter(
    (course) => course.access !== "enrolled" && course.access !== "expiring",
  );

  return {
    otherCourses,
    purchasedCourses,
  };
}

export function filterStudentCourses({
  courses,
  grade,
  query,
  subject,
}: {
  courses: StudentCourse[];
  grade: number;
  query: string;
  subject: StudentCourseSubjectFilter;
}) {
  const normalizedQuery = normalizeSearchableText(query);

  return courses.filter((course) => {
    const matchesGrade = course.grade === grade;
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

function normalizeSearchableText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}
