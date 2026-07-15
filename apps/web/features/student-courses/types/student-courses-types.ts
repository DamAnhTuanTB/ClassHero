import type { LucideIcon } from "lucide-react";

export type StudentCourseSubject = "MATH" | "PHYSICS" | "CHEMISTRY";
export type StudentCourseSubjectFilter = StudentCourseSubject | "ALL";
export type StudentCourseAccess = "enrolled" | "trial" | "locked" | "expiring";
export type StudentCourseTone = "math" | "physics" | "chemistry";

export type StudentCourseLesson = {
  examOpenLabel?: string;
  id: string;
  title: string;
};

export type StudentCourse = {
  access: StudentCourseAccess;
  chapterCount: number;
  description: string;
  exerciseCount: number;
  expiresInDays?: number;
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
