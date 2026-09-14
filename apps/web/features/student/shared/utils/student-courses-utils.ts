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

type TargetAudienceOption = StudentCourseCatalogOptionsApi["targetAudiences"][number];

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
  "vat ly":
    "bg-teal-50 text-teal-700 dark:bg-[var(--theme-success-bg)] dark:text-teal-300",
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
  3: "text-[hsl(200_88%_40%)] dark:text-sky-200",
  4: "text-[hsl(213_86%_44%)] dark:text-blue-200",
  5: "text-[hsl(226_84%_46%)] dark:text-blue-200",
  6: "text-[hsl(208_80%_39%)] dark:text-sky-200",
  7: "text-[hsl(221_78%_43%)] dark:text-blue-200",
  8: "text-[hsl(204_88%_45%)] dark:text-sky-200",
  9: "text-[hsl(217_88%_40%)] dark:text-blue-200",
  10: "text-[hsl(230_80%_45%)] dark:text-blue-200",
  11: "text-[hsl(211_76%_39%)] dark:text-sky-200",
  12: "text-[hsl(224_86%_47%)] dark:text-blue-200",
};

const gradeBadgeClasses: Record<number, string> = {
  3: "bg-[hsl(200_100%_94%)] dark:bg-[hsl(200_74%_20%/.55)]",
  4: "bg-[hsl(213_98%_92%)] dark:bg-[hsl(213_74%_20%/.55)]",
  5: "bg-[hsl(226_96%_93%)] dark:bg-[hsl(226_74%_20%/.55)]",
  6: "bg-[hsl(208_98%_94%)] dark:bg-[hsl(208_74%_20%/.55)]",
  7: "bg-[hsl(221_96%_92%)] dark:bg-[hsl(221_74%_20%/.55)]",
  8: "bg-[hsl(204_100%_93%)] dark:bg-[hsl(204_74%_20%/.55)]",
  9: "bg-[hsl(217_98%_94%)] dark:bg-[hsl(217_74%_20%/.55)]",
  10: "bg-[hsl(230_96%_92%)] dark:bg-[hsl(230_74%_20%/.55)]",
  11: "bg-[hsl(211_94%_94%)] dark:bg-[hsl(211_74%_20%/.55)]",
  12: "bg-[hsl(224_100%_92%)] dark:bg-[hsl(224_74%_20%/.55)]",
};

const targetAudienceTextClassesByCode: Record<string, string> = {
  ALL_STUDENTS: "text-[hsl(215_84%_46%)] dark:text-blue-200",
  HIGH_SCHOOL: "text-[hsl(228_76%_43%)] dark:text-blue-200",
  PRIMARY_SCHOOL: "text-[hsl(202_84%_44%)] dark:text-sky-200",
  SECONDARY_SCHOOL: "text-[hsl(219_82%_42%)] dark:text-blue-200",
  WORKING_ADULT: "text-[hsl(232_76%_41%)] dark:text-blue-200",
};

const targetAudienceBadgeClassesByCode: Record<string, string> = {
  ALL_STUDENTS: "!border-0 bg-[hsl(215_98%_91%)] dark:bg-[hsl(215_74%_20%/.6)]",
  HIGH_SCHOOL: "!border-0 bg-[hsl(228_94%_91%)] dark:bg-[hsl(228_74%_20%/.6)]",
  PRIMARY_SCHOOL: "!border-0 bg-[hsl(202_98%_92%)] dark:bg-[hsl(202_74%_20%/.6)]",
  SECONDARY_SCHOOL: "!border-0 bg-[hsl(219_96%_93%)] dark:bg-[hsl(219_74%_20%/.6)]",
  WORKING_ADULT: "!border-0 bg-[hsl(232_92%_92%)] dark:bg-[hsl(232_72%_20%/.6)]",
};

export function getGradeTextClass(grade: number) {
  return gradeTextClasses[grade] ?? "text-blue-900 dark:text-blue-300";
}

export function getGradeBadgeClass(grade: number) {
  return gradeBadgeClasses[grade] ?? "bg-slate-100 dark:bg-slate-800";
}

export function getTargetAudienceTextClass(
  targetAudienceCode: string | undefined,
  grade: number,
) {
  return (
    (targetAudienceCode
      ? targetAudienceTextClassesByCode[targetAudienceCode]
      : undefined) ?? getGradeTextClass(grade)
  );
}

export function getTargetAudienceBadgeClass(
  targetAudienceCode: string | undefined,
  grade: number,
) {
  return (
    (targetAudienceCode
      ? targetAudienceBadgeClassesByCode[targetAudienceCode]
      : undefined) ?? getGradeBadgeClass(grade)
  );
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

export function getVisibleCourseLessonCtaIds(
  courses: Array<Pick<StudentCourse, "access" | "isUnderMaintenance" | "nextLesson">>,
) {
  return courses.flatMap((course) =>
    course.access === "enrolled" &&
    course.isUnderMaintenance !== true &&
    course.nextLesson
      ? [course.nextLesson.id]
      : [],
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
        ? [
            [
              course.id,
              { code: audience.code, grade: audience.grade, name: audience.name },
            ],
          ]
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
            targetAudienceCode: audience.code,
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
    return `grade-${audience.grade}` as Extract<AudienceRibbonTone, `grade-${number}`>;
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
  domainName,
  query,
  targetAudienceId,
}: {
  courses: StudentCourse[];
  domainId: string | null;
  domainName: string | null;
  query: string;
  targetAudienceId: string | null;
}) {
  const normalizedQuery = normalizeSearchableText(query);

  return courses.filter((course) => {
    const matchesTargetAudience =
      targetAudienceId === null || course.targetAudienceIds.includes(targetAudienceId);
    const matchesDomain =
      domainId === null ||
      course.domainId === domainId ||
      (domainName !== null &&
        normalizeSearchableText(course.subject) === normalizeSearchableText(domainName));
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
