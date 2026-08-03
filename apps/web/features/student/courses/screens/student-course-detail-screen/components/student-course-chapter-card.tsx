import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BookOpen, ChevronDown } from "lucide-react";
import type { StudentCourseDetailChapter } from "@/features/student/shared/student-courses-types";
import { StudentCourseLessonRow } from "@/features/student/courses/screens/student-course-detail-screen/components/student-course-lesson-row";
import { getStudentCourseAccentStyle } from "@/features/student/shared/utils/student-course-accent-palette";
import { cn } from "@/lib/utils";

export function StudentCourseChapterCard({
  accentCount,
  accentIndex,
  chapter,
  continueLessonActionLabel,
  continueLessonId,
  expanded,
  onToggle,
  showProgress,
}: {
  accentCount: number;
  accentIndex: number;
  chapter: StudentCourseDetailChapter;
  continueLessonActionLabel: string;
  continueLessonId: string;
  expanded: boolean;
  onToggle: () => void;
  showProgress: boolean;
}) {
  const shouldReduceMotion = useReducedMotion();
  const lessonCountLabel = `${chapter.lessons.length} buổi học`;
  const isUnpublishedChapter =
    !chapter.isStandaloneGroup &&
    chapter.status !== undefined &&
    chapter.status !== "PUBLISHED";

  return (
    <article
      style={getStudentCourseAccentStyle({ accentCount, accentIndex })}
      className="student-mobile-border student-chapter-card student-curriculum-accent-card overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)]"
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "relative grid w-full cursor-pointer grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-2 whitespace-normal pl-2 pr-9 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100",
          showProgress ? "min-h-[5.7rem] pb-1 pt-3" : "min-h-[4.35rem] pb-2.5 pt-3",
        )}
        aria-expanded={expanded}
      >
        <span className="student-chapter-number grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg font-black text-white">
          {chapter.isStandaloneGroup ? (
            <BookOpen className="h-5 w-5" aria-hidden="true" />
          ) : (
            chapter.order
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="student-soft-bold-text block break-words text-base font-black leading-6 text-slate-950 whitespace-normal dark:text-[var(--theme-text-strong)]">
            {chapter.title}
          </span>
          <span className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-sm font-medium leading-5 text-slate-500 dark:text-[var(--theme-text-muted)]">
            <span className="break-words whitespace-normal">{lessonCountLabel}</span>
            {isUnpublishedChapter ? (
              <span className="inline-flex min-h-6 shrink-0 items-center rounded-full bg-slate-100 px-2 text-[11px] font-black text-slate-600 ring-1 ring-slate-200 dark:bg-[var(--theme-surface-muted)] dark:text-[var(--theme-text-muted)] dark:ring-[var(--theme-border)]">
                Chưa phát hành
              </span>
            ) : null}
          </span>
          {showProgress ? (
            <span className="mt-2 flex flex-wrap items-center gap-2">
              <span className="student-chapter-progress inline-flex min-h-7 items-center rounded-full px-2.5 text-sm font-black">
                {chapter.progressPercent}% hoàn thành
              </span>
            </span>
          ) : null}
        </span>
        <span className="absolute right-1 top-4 grid h-8 w-8 place-items-center rounded-full text-slate-950 dark:text-[var(--theme-text-strong)]">
          <ChevronDown
            className={cn(
              "h-6 w-6 transition-transform duration-300 ease-out",
              expanded ? "rotate-180" : "rotate-0",
            )}
            aria-hidden="true"
          />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key="chapter-lessons"
            initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{
              duration: shouldReduceMotion ? 0.01 : 0.28,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="overflow-hidden"
          >
            <ul className="relative">
              <span
                aria-hidden="true"
                className="absolute bottom-8 left-[1.625rem] top-8 z-0 w-0.5 rounded-full bg-gradient-to-b from-[var(--student-course-accent-strong)] via-[var(--student-course-accent)] to-[var(--student-course-audience-bg)] dark:from-[var(--student-course-accent-dark-strong)] dark:via-[var(--student-course-accent-dark)] dark:to-[var(--student-course-audience-dark-bg)]"
              />
              {chapter.lessons.map((lesson, lessonIndex) => (
                <StudentCourseLessonRow
                  key={lesson.id}
                  continueLessonActionLabel={continueLessonActionLabel}
                  continueLessonId={continueLessonId}
                  lesson={lesson}
                  showSeparator={lessonIndex > 0}
                />
              ))}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </article>
  );
}
