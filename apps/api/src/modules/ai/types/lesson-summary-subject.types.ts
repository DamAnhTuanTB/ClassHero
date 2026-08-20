import { z } from "zod";

export const COURSE_SUBJECT_KEYS = [
  "MATH",
  "PHYSICS",
  "CHEMISTRY",
  "GENERAL",
] as const;

export const courseSubjectKeySchema = z.enum(COURSE_SUBJECT_KEYS);

export type CourseSubjectKey = z.infer<typeof courseSubjectKeySchema>;

export interface CourseSubjectSnapshot {
  key: CourseSubjectKey;
  name: string;
  slug: string;
}

// Compatibility aliases for the Summary-specific modules introduced first.
export const LESSON_SUMMARY_SUBJECT_KEYS = COURSE_SUBJECT_KEYS;
export const lessonSummarySubjectKeySchema = courseSubjectKeySchema;
export type LessonSummarySubjectKey = CourseSubjectKey;
export type LessonSummarySubjectSnapshot = CourseSubjectSnapshot;
