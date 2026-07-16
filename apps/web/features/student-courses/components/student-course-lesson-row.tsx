import { Check, Crown, LockKeyhole, Play, Radio } from "lucide-react";
import Link from "next/link";
import type { StudentCourseDetailLesson } from "@/features/student-courses/types";
import { cn } from "@/lib/utils";

const lessonIconClassByStatus: Record<StudentCourseDetailLesson["status"], string> = {
  completed: "bg-emerald-500 text-white",
  current:
    "border-2 border-blue-500 bg-white text-blue-600 dark:bg-[var(--theme-surface)] dark:text-sky-300",
  locked:
    "border-2 border-slate-300 bg-slate-100 text-slate-500 shadow-[0_0_0_4px_rgb(241_245_249)] dark:border-slate-500 dark:bg-slate-700 dark:text-slate-200 dark:shadow-[0_0_0_4px_rgb(30_41_59)]",
  next: "bg-blue-50 text-blue-600 dark:bg-[var(--theme-primary-soft)] dark:text-sky-300",
};

export function StudentCourseLessonRow({
  continueLessonActionLabel,
  continueLessonId,
  lesson,
  showSeparator,
}: {
  continueLessonActionLabel: string;
  continueLessonId: string;
  lesson: StudentCourseDetailLesson;
  showSeparator: boolean;
}) {
  const isLocked = lesson.status === "locked";
  const isCurrent = lesson.status === "current";
  const isCompleted = lesson.status === "completed";
  const isContinueLesson = lesson.id === continueLessonId;
  const isTrialLesson = lesson.isTrial === true;
  const shouldShowLessonCta = !isLocked && (isTrialLesson || isContinueLesson);
  const lessonCtaLabel = isTrialLesson ? "Vào học" : continueLessonActionLabel;
  const statusLabel = isTrialLesson
    ? "Học thử"
    : isCompleted
      ? "Hoàn thành"
      : isCurrent
        ? "Đang học"
        : isLocked
          ? "Khóa"
          : "Tiếp theo";
  const StatusIcon = shouldShowLessonCta
    ? Play
    : isCompleted
      ? Check
      : isCurrent
        ? Play
        : isLocked
          ? LockKeyhole
          : Radio;

  return (
    <li className="relative z-10 grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] items-start gap-3 px-3 py-3">
      {showSeparator ? (
        <span
          aria-hidden="true"
          className="absolute left-14 right-3 top-0 h-px bg-slate-200 dark:bg-[var(--theme-border-strong)]"
        />
      ) : null}
      <span
        className={cn(
          "relative z-10 grid h-7 w-7 place-items-center rounded-full",
          shouldShowLessonCta
            ? "border-2 border-blue-500 bg-white text-blue-600 dark:bg-[var(--theme-surface)] dark:text-sky-300"
            : lessonIconClassByStatus[lesson.status],
        )}
        aria-label={statusLabel}
      >
        <StatusIcon
          className={cn(
            isLocked ? "h-[1.125rem] w-[1.125rem]" : "h-4 w-4",
            isCurrent || shouldShowLessonCta ? "fill-current" : "",
          )}
          aria-hidden="true"
        />
      </span>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            href={isLocked ? "#" : `/student/lessons/${lesson.id}`}
            aria-disabled={isLocked}
            className={cn(
              "min-w-0 break-words text-base font-bold leading-6 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100",
              isLocked
                ? "pointer-events-none text-slate-500 dark:text-[var(--theme-text-muted)]"
                : isCurrent
                  ? "text-blue-600 dark:text-sky-300"
                  : "text-slate-700 hover:text-blue-600 dark:text-[var(--theme-text)] dark:hover:text-sky-300",
            )}
          >
            {lesson.title}
          </Link>
          {isTrialLesson && !isLocked ? (
            <span className="inline-flex min-h-6 shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 text-[11px] font-black text-amber-600 ring-1 ring-amber-200/80 dark:bg-[var(--theme-warning-bg)] dark:text-[var(--theme-warning-text)] dark:ring-[var(--theme-warning-border)]">
              <Crown className="h-3.5 w-3.5" aria-hidden="true" />
              Học thử
            </span>
          ) : null}
        </div>
        {shouldShowLessonCta ? (
          <Link
            href={`/student/lessons/${lesson.id}`}
            className="inline-flex min-h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-sky-500 px-2.5 text-[11px] font-black text-white shadow-sm transition hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100 dark:bg-sky-400 dark:text-slate-950 dark:hover:bg-sky-300"
          >
            {lessonCtaLabel}
          </Link>
        ) : null}
      </div>
    </li>
  );
}
