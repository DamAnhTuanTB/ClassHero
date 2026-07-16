import { BookOpen, ChevronRight, Clock3, Star } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { CourseIllustration } from "@/components/student/courses/course-illustration";
import { CourseStatusBadge } from "@/components/student/courses/course-status-badge";
import { CourseSubjectBadge } from "@/components/student/courses/course-subject-badge";
import type { StudentCourse } from "@/features/student/shared/student-courses-types";
import { getGradeTextClass } from "@/features/student/shared/utils/student-courses-utils";
import { cn } from "@/lib/utils";

export function PurchasedCourseCard({
  course,
  prominent = false,
}: {
  course: StudentCourse;
  prominent?: boolean;
}) {
  if (prominent) {
    return <ProminentPurchasedCourseCard course={course} />;
  }

  return <CompactPurchasedCourseCard course={course} />;
}

function ProminentPurchasedCourseCard({ course }: { course: StudentCourse }) {
  return (
    <article className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)]">
      <div className="grid min-w-0 grid-cols-[7.25rem_minmax(0,1fr)] gap-3 sm:grid-cols-[9.75rem_minmax(0,1fr)] sm:gap-4">
        <CourseIllustration
          tone={course.tone}
          className="h-[7.25rem] min-h-0 sm:h-auto"
        />

        <div className="min-w-0">
          <CourseCardBadges course={course} />
          <h2 className="student-soft-bold-text mt-2 line-clamp-2 text-lg font-extrabold leading-tight text-slate-600 dark:text-[var(--theme-text-strong)] sm:mt-3 sm:text-xl">
            {course.title}
          </h2>

          <div className="mt-4">
            <ProgressLine value={course.progressPercent ?? 0} />
          </div>

          {course.nextLesson ? (
            <div className="mt-4 grid gap-2 text-sm">
              <div className="flex min-w-0 items-center gap-2 font-bold text-slate-700 dark:text-[var(--theme-text)]">
                <BookOpen
                  className="h-5 w-5 shrink-0 text-slate-500"
                  aria-hidden="true"
                />
                <span className="truncate">{course.nextLesson.title}</span>
                <ChevronRight className="ml-auto h-5 w-5 shrink-0 text-slate-400" />
              </div>
              {course.nextLesson.examOpenLabel ? (
                <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-[var(--theme-text-muted)]">
                  <Clock3 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{course.nextLesson.examOpenLabel}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {course.nextLesson ? (
            <Link
              href={`/student/lessons/${course.nextLesson.id}`}
              className="mt-5 inline-flex min-h-11 w-full min-w-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 sm:min-h-12 sm:px-4"
            >
              Vào học ngay
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function CompactPurchasedCourseCard({ course }: { course: StudentCourse }) {
  return (
    <article className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)]">
      <div className="grid min-w-0 grid-cols-[6.25rem_minmax(0,1fr)] gap-3 sm:grid-cols-[7.25rem_minmax(0,1fr)] sm:gap-4">
        <CourseIllustration
          tone={course.tone}
          className="h-[6.25rem] min-h-0 sm:h-auto"
        />
        <div className="min-w-0">
          <CourseCardBadges course={course} />
          <h2 className="student-soft-bold-text mt-3 truncate text-base font-extrabold text-slate-600 dark:text-[var(--theme-text-strong)]">
            {course.title}
          </h2>
          <div className="mt-3">
            <ProgressLine value={course.progressPercent ?? 0} compact />
          </div>
          {course.nextLesson ? (
            <div className="mt-3 flex min-w-0 items-center gap-2 text-sm font-medium text-slate-600 dark:text-[var(--theme-text-muted)]">
              <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{course.nextLesson.title}</span>
            </div>
          ) : null}
          {course.nextLesson ? (
            <Link
              href={`/student/lessons/${course.nextLesson.id}`}
              className="mt-3 inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-lg border border-blue-600 bg-white px-3 text-xs font-extrabold text-blue-600 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 sm:px-4 sm:text-sm"
            >
              Tiếp tục
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function CourseCardBadges({ course }: { course: StudentCourse }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="flex shrink-0 items-center gap-2 whitespace-nowrap">
        <CourseSubjectBadge subject={course.subject} />
        <span
          data-grade={course.grade}
          className={cn(
            "student-grade-label shrink-0 whitespace-nowrap text-xs font-extrabold lg:text-sm",
            getGradeTextClass(course.grade),
          )}
        >
          Lớp {course.grade}
        </span>
      </span>
      <span className="ml-auto shrink-0">
        <CourseStatusBadge access={course.access} />
      </span>
    </div>
  );
}

function ProgressLine({ compact = false, value }: { compact?: boolean; value: number }) {
  const markerLeft = Math.min(Math.max(value, 4), 96);
  const progressStyle = {
    "--student-progress-marker": `${markerLeft}%`,
    "--student-progress-value": `${value}%`,
  } as CSSProperties;

  return (
    <div className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-3">
      <span
        className={cn(
          "student-progress-label font-medium text-sky-700 dark:text-sky-300",
          compact ? "text-xs" : "text-sm",
        )}
      >
        Tiến độ
      </span>
      <span
        className={cn(
          "student-progress-accent-text font-extrabold text-sky-600 dark:text-sky-300",
          compact ? "text-sm" : "text-sm sm:text-2xl",
        )}
      >
        {value}%
      </span>
      <span className="relative h-4">
        <span className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full bg-slate-400/60 dark:bg-[var(--theme-surface-muted)]">
          <span
            className="student-progress-animated-fill block h-full rounded-full bg-sky-500 dark:bg-sky-400"
            style={progressStyle}
          />
        </span>
        <span
          className="student-progress-animated-marker student-progress-star-marker absolute top-1/2 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-sky-50 text-sky-600 shadow-sm dark:bg-sky-50 dark:text-sky-600"
          style={progressStyle}
        >
          <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
        </span>
      </span>
    </div>
  );
}
