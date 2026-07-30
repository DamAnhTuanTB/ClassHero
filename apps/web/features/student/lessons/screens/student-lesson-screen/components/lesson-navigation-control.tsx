"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { ImmediateTooltip } from "@/components/common/ui/immediate-tooltip";
import { StudentLessonTransitionLink } from "@/components/student/learning-transition/student-lesson-transition-link";
import { cn } from "@/lib/utils";

type LessonNavigationItem = {
  id: string;
  title: string;
};

export function LessonNavigationControl({
  backHref,
  direction,
  disabledReason,
  isEnabled,
  lesson,
}: {
  backHref?: string;
  direction: "previous" | "next";
  disabledReason: string;
  isEnabled: boolean;
  lesson: LessonNavigationItem | null;
}) {
  const isPrevious = direction === "previous";
  const isBackToCourse = isPrevious && !lesson && Boolean(backHref);
  const label = isBackToCourse
    ? "Trở về"
    : isPrevious
      ? "Bài học trước"
      : "Bài học kế tiếp";
  const fallbackTitle = isPrevious ? "Khóa học" : "Đây là bài học cuối cùng";
  const displayTitle = lesson?.title ?? fallbackTitle;
  const canNavigate = isBackToCourse || (Boolean(lesson) && isEnabled);
  const className = cn(
    "flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 text-base font-black transition focus-visible:outline-none focus-visible:ring-4",
    isPrevious ? "text-left" : "justify-end text-right",
    canNavigate
      ? "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 focus-visible:ring-sky-200 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-300 dark:hover:bg-sky-500/15 dark:focus-visible:ring-sky-500/30"
      : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface-muted)] dark:text-[var(--theme-text-muted)]",
  );
  const content = (
    <>
      {isPrevious ? <ArrowLeft className="h-6 w-6 shrink-0" aria-hidden="true" /> : null}
      <span className="min-w-0">
        <span className={cn("block", !isBackToCourse && "text-xs opacity-75")}>
          {label}
        </span>
        {!isBackToCourse ? (
          <span className="block truncate">{displayTitle}</span>
        ) : null}
      </span>
      {!isPrevious ? (
        <ArrowRight className="h-6 w-6 shrink-0" aria-hidden="true" />
      ) : null}
    </>
  );

  if (isBackToCourse && backHref) {
    return (
      <Link
        href={backHref}
        aria-label={label}
        className={className}
      >
        {content}
      </Link>
    );
  }

  if (canNavigate && lesson) {
    return (
      <StudentLessonTransitionLink
        lessonId={lesson.id}
        aria-label={`${label} ${displayTitle}`}
        className={className}
      >
        {content}
      </StudentLessonTransitionLink>
    );
  }

  return (
    <ImmediateTooltip content={disabledReason}>
      <span className="block w-full">
        <button
          type="button"
          aria-label={`${label} ${displayTitle}`}
          className={className}
          disabled
        >
          {content}
        </button>
      </span>
    </ImmediateTooltip>
  );
}
