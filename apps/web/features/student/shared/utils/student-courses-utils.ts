import type {
  StudentCourse,
  StudentCourseAccess,
  StudentCourseStat,
  StudentCourseSubject,
  StudentTodayGoal,
} from "@/features/student/shared/student-courses-types";
import type { StudentCourseCatalogOptionsApi } from "@/features/student/shared/types/student-course-api-types";

type AudienceRibbonTone =
  | "audience"
  | "all-students"
  | "high-school"
  | "primary-school"
  | "secondary-school"
  | "working-adult"
  | "grade-3"
  | "grade-4"
  | "grade-5"
  | "grade-6"
  | "grade-7"
  | "grade-8"
  | "grade-9"
  | "grade-10"
  | "grade-11"
  | "grade-12";

type TargetAudienceOption =
  StudentCourseCatalogOptionsApi["targetAudiences"][number];

const targetAudienceSectionOrder = [
  "GRADE_12",
  "GRADE_11",
  "GRADE_10",
  "HIGH_SCHOOL",
  "GRADE_9",
  "GRADE_8",
  "GRADE_7",
  "GRADE_6",
  "SECONDARY_SCHOOL",
  "GRADE_5",
  "GRADE_4",
  "GRADE_3",
  "PRIMARY_SCHOOL",
  "ALL_STUDENTS",
  "WORKING_ADULT",
] as const;

export const subjectLabels: Record<StudentCourseSubject, string> = {
  CHEMISTRY: "HÓA",
  MATH: "TOÁN",
  PHYSICS: "LÝ",
};

const subjectBadgeClasses: Record<StudentCourseSubject, string> = {
  CHEMISTRY:
    "bg-orange-50 text-orange-700 dark:bg-[var(--theme-warning-bg)] dark:text-[var(--theme-warning-text)]",
  MATH: "bg-blue-50 text-blue-700 dark:bg-[var(--theme-primary-soft)] dark:text-[var(--theme-primary)]",
  PHYSICS:
    "bg-teal-50 text-teal-700 dark:bg-[var(--theme-success-bg)] dark:text-teal-300",
};

const domainBadgeClassesByName: Record<string, string> = {
  "hoa hoc": "bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
  "tieng anh": "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  toan: "bg-blue-50 text-blue-700 dark:bg-[var(--theme-primary-soft)] dark:text-[var(--theme-primary)]",
  "vat ly": "bg-teal-50 text-teal-700 dark:bg-[var(--theme-success-bg)] dark:text-teal-300",
};

const fallbackDomainBadgeClasses = [
  "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300",
  "bg-lime-50 text-lime-700 dark:bg-lime-950/50 dark:text-lime-300",
  "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/50 dark:text-fuchsia-300",
];

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

const gradeBadgeClasses: Record<number, string> = {
  3: "bg-rose-50 dark:bg-rose-950/50",
  4: "bg-orange-50 dark:bg-orange-950/50",
  5: "bg-amber-50 dark:bg-amber-950/50",
  6: "bg-lime-50 dark:bg-lime-950/50",
  7: "bg-blue-50 dark:bg-blue-950/50",
  8: "bg-teal-50 dark:bg-teal-950/50",
  9: "bg-violet-50 dark:bg-violet-950/50",
  10: "bg-fuchsia-50 dark:bg-fuchsia-950/50",
  11: "bg-cyan-50 dark:bg-cyan-950/50",
  12: "bg-emerald-50 dark:bg-emerald-950/50",
};

export function getGradeTextClass(grade: number) {
  return gradeTextClasses[grade] ?? "text-blue-900 dark:text-blue-300";
}

export function getGradeBadgeClass(grade: number) {
  return gradeBadgeClasses[grade] ?? "bg-slate-100 dark:bg-slate-800";
}

export function getSubjectBadgeClass(subject: StudentCourseSubject) {
  const normalizedSubject = normalizeSearchableText(subject);
  const domainBadgeClass = domainBadgeClassesByName[normalizedSubject];

  if (domainBadgeClass) {
    return domainBadgeClass;
  }

  if (subjectBadgeClasses[subject]) {
    return subjectBadgeClasses[subject];
  }

  const subjectHash = Array.from(normalizedSubject).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );

  return (
    fallbackDomainBadgeClasses[subjectHash % fallbackDomainBadgeClasses.length] ??
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
  );
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

export function getExploreAllCourseSections(
  courses: StudentCourse[],
  studentGrade: number | null,
  targetAudiences: StudentCourseCatalogOptionsApi["targetAudiences"],
) {
  const purchasedCourses = getPurchasedCourses(courses);
  const unpurchasedCourses = courses.filter(
    (course) => course.access !== "completed" && course.access !== "enrolled",
  );
  const recommendedCourseContexts = Object.fromEntries(
    unpurchasedCourses.flatMap((course) => {
      const audience = getRecommendedAudience(course, studentGrade, targetAudiences);

      return audience
        ? [[course.id, { grade: audience.grade, name: audience.name }]]
        : [];
    }),
  );
  const recommendedCourses = unpurchasedCourses.filter(
    (course) => recommendedCourseContexts[course.id] !== undefined,
  );
  const audienceByCode = new Map(
    targetAudiences.map((audience) => [audience.code, audience]),
  );
  const orderedAudiences = targetAudienceSectionOrder.flatMap((code) => {
    const audience = audienceByCode.get(code);
    return audience ? [audience] : [];
  });
  const audienceGroups = orderedAudiences.flatMap((audience) => {
    const audienceCourses = unpurchasedCourses.filter((course) =>
      course.targetAudienceIds.includes(audience.id),
    );

    return audienceCourses.length > 0
      ? [
          {
            courses: audienceCourses,
            grade: audience.grade,
            id: audience.id,
            targetAudienceName: audience.name,
            title: getAudienceSectionTitle(audience),
            tone: getAudienceRibbonTone(audience),
          },
        ]
      : [];
  });

  return {
    audienceGroups,
    purchasedCourses,
    recommendedCourseContexts,
    recommendedCourses,
  };
}

function getRecommendedAudience(
  course: StudentCourse,
  studentGrade: number | null,
  targetAudiences: StudentCourseCatalogOptionsApi["targetAudiences"],
) {
  const assignedAudiences = targetAudiences.filter((audience) =>
    course.targetAudienceIds.includes(audience.id),
  );
  const exactGradeAudience = assignedAudiences.find(
    (audience) => audience.grade === studentGrade,
  );

  if (exactGradeAudience) {
    return exactGradeAudience;
  }

  const educationLevelCode = getEducationLevelCode(studentGrade);
  const educationLevelAudience = assignedAudiences.find(
    (audience) => audience.code === educationLevelCode,
  );

  return (
    educationLevelAudience ??
    assignedAudiences.find((audience) => audience.code === "ALL_STUDENTS") ??
    null
  );
}

function getEducationLevelCode(studentGrade: number | null) {
  if (studentGrade !== null && studentGrade >= 1 && studentGrade <= 5) {
    return "PRIMARY_SCHOOL";
  }
  if (studentGrade !== null && studentGrade >= 6 && studentGrade <= 9) {
    return "SECONDARY_SCHOOL";
  }
  if (studentGrade !== null && studentGrade >= 10 && studentGrade <= 12) {
    return "HIGH_SCHOOL";
  }
  return null;
}

function getAudienceSectionTitle(audience: TargetAudienceOption) {
  if (audience.grade !== null) {
    return `Dành cho khối ${audience.grade}`;
  }

  const titleByCode: Record<string, string> = {
    ALL_STUDENTS: "Dành cho toàn khối học sinh",
    HIGH_SCHOOL: "Dành cho toàn khối THPT",
    PRIMARY_SCHOOL: "Dành cho toàn khối Tiểu học",
    SECONDARY_SCHOOL: "Dành cho toàn khối THCS",
    WORKING_ADULT: "Dành cho Người đi làm",
  };

  return titleByCode[audience.code] ?? `Dành cho ${audience.name}`;
}

function getAudienceRibbonTone(audience: TargetAudienceOption): AudienceRibbonTone {
  if (audience.grade !== null) {
    return `grade-${audience.grade}` as Extract<
      AudienceRibbonTone,
      `grade-${number}`
    >;
  }

  const toneByCode: Record<string, AudienceRibbonTone> = {
    ALL_STUDENTS: "all-students",
    HIGH_SCHOOL: "high-school",
    PRIMARY_SCHOOL: "primary-school",
    SECONDARY_SCHOOL: "secondary-school",
    WORKING_ADULT: "working-adult",
  };

  return toneByCode[audience.code] ?? "audience";
}

export function filterStudentCourses({
  courses,
  domainId,
  query,
  targetAudienceId,
}: {
  courses: StudentCourse[];
  domainId: string | null;
  query: string;
  targetAudienceId: string | null;
}) {
  const normalizedQuery = normalizeSearchableText(query);

  return courses.filter((course) => {
    const matchesTargetAudience =
      targetAudienceId === null || course.targetAudienceIds.includes(targetAudienceId);
    const matchesDomain = domainId === null || course.domainId === domainId;
    const matchesQuery =
      !normalizedQuery ||
      normalizeSearchableText(
        `${course.title} ${course.description} ${course.subject} ${course.targetAudienceNames.join(" ")}`,
      ).includes(normalizedQuery);

    return matchesTargetAudience && matchesDomain && matchesQuery;
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
    { label: "buổi học hôm nay", value: String(nextLessonCount) },
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
