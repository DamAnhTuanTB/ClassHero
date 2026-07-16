import type { LucideIcon } from "lucide-react";

export type StudentCourseSubject = "MATH" | "PHYSICS" | "CHEMISTRY";
export type StudentCourseSubjectFilter = StudentCourseSubject | "ALL";
export type StudentCourseAccess = "completed" | "enrolled" | "locked";
export type StudentCourseTone = "math" | "physics" | "chemistry";

export type StudentCourseLesson = {
  examOpenLabel?: string;
  id: string;
  kind?: "first" | "inProgress" | "last" | "next";
  title: string;
};

export type StudentCourseDetailLessonStatus = "completed" | "current" | "locked" | "next";

export type StudentCourseDetailContinueKind = "first" | "inProgress" | "last" | "next";

export type StudentCourseDetailLesson = {
  durationMinutes: number;
  id: string;
  isTrial?: boolean;
  status: StudentCourseDetailLessonStatus;
  title: string;
};

export type StudentCourseDetailChapterTone = "amber" | "emerald" | "violet";

export type StudentCourseDetailChapter = {
  description: string;
  id: string;
  lessons: StudentCourseDetailLesson[];
  order: number;
  progressPercent: number;
  title: string;
  tone: StudentCourseDetailChapterTone;
};

export type StudentCourseDetail = {
  chapters: StudentCourseDetailChapter[];
  continueLessonId: string;
  continueLessonKind: StudentCourseDetailContinueKind;
  continueLessonTitle: string;
  totalHours: number;
};

export type StudentCourse = {
  access: StudentCourseAccess;
  chapterCount: number;
  description: string;
  exerciseCount: number;
  grade: number;
  id: string;
  lessonCount: number;
  nextLesson?: StudentCourseLesson;
  originalPriceVnd: number;
  progressPercent?: number;
  salePriceVnd?: number;
  slug: string;
  subject: StudentCourseSubject;
  title: string;
  tone: StudentCourseTone;
  trialLessonCount?: number;
  updatedLabel?: string;
};

export type StudentCourseNavItem = {
  description: string;
  href: string;
  icon: LucideIcon;
  label: string;
};

export type StudentCourseStat = {
  label: string;
  value: string;
};

export type StudentTodayGoal = {
  completed: boolean;
  icon: "lesson" | "practice" | "score";
  id: string;
  metric: string;
  title: string;
  tone: "sky" | "emerald" | "amber" | "indigo";
};
