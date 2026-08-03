import type { LucideIcon } from "lucide-react";

export type StudentCourseSubject = string;
export type StudentCourseAccess = "completed" | "enrolled" | "locked";
export type StudentCourseTone = "math" | "physics" | "chemistry";

export type StudentCourseLesson = {
  examOpenLabel?: string;
  id: string;
  kind?: "first" | "inProgress" | "last" | "next";
  title: string;
};

export type StudentCourseDetailLessonStatus = "completed" | "current" | "locked" | "next";
export type StudentCourseLessonType = "BASIC" | "LIVE";

export type StudentCourseDetailContinueKind = "first" | "inProgress" | "last" | "next";
export type StudentCourseDetailChapterStatus =
  "DRAFT" | "PUBLISHED" | "HIDDEN" | "ARCHIVED";

export type StudentCourseDetailLesson = {
  durationMinutes: number;
  id: string;
  isTrial?: boolean;
  lessonType?: StudentCourseLessonType;
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
  status?: StudentCourseDetailChapterStatus;
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
  domainId: string;
  exerciseCount: number;
  grade: number;
  grades: number[];
  id: string;
  isUnderMaintenance?: boolean;
  lessonCount: number;
  lessonCountMin?: number;
  lessonCountMax?: number;
  nextLesson?: StudentCourseLesson;
  originalPriceVnd: number;
  progressPercent?: number;
  salePriceVnd?: number;
  slug: string;
  subject: StudentCourseSubject;
  targetAudienceId: string;
  targetAudienceIds: string[];
  targetAudienceName: string;
  targetAudienceNames: string[];
  thumbnailImageUrl?: string;
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
