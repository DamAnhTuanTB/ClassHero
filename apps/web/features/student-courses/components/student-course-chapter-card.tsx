import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { StudentCourseDetailChapter } from "@/features/student-courses/types";
import { StudentCourseLessonRow } from "@/features/student-courses/components/student-course-lesson-row";
import { cn } from "@/lib/utils";

const chapterToneClasses: Record<StudentCourseDetailChapter["tone"], string> = {
  amber: "student-chapter-card--amber text-orange-500",
  emerald: "student-chapter-card--emerald text-emerald-600",
  violet: "student-chapter-card--violet text-violet-500",
};

const chapterNumberClasses: Record<StudentCourseDetailChapter["tone"], string> = {
  amber: "bg-orange-400 text-white",
  emerald: "bg-emerald-500 text-white",
  violet: "bg-violet-500 text-white",
};

const chapterProgressClasses: Record<StudentCourseDetailChapter["tone"], string> = {
  amber: "bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300",
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  violet: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
};

const chapterConnectorClasses: Record<StudentCourseDetailChapter["tone"], string> = {
  amber:
    "from-orange-400 via-orange-300 to-orange-100 dark:from-orange-300 dark:via-orange-400 dark:to-orange-500/30",
  emerald:
    "from-emerald-500 via-emerald-400 to-emerald-100 dark:from-emerald-300 dark:via-emerald-400 dark:to-emerald-500/30",
  violet:
    "from-violet-500 via-violet-400 to-violet-100 dark:from-violet-300 dark:via-violet-400 dark:to-violet-500/30",
};

export function StudentCourseChapterCard({
  chapter,
  continueLessonActionLabel,
  continueLessonId,
  expanded,
  onToggle,
  showProgress,
}: {
  chapter: StudentCourseDetailChapter;
  continueLessonActionLabel: string;
  continueLessonId: string;
  expanded: boolean;
  onToggle: () => void;
  showProgress: boolean;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <article
      className={cn(
        "student-mobile-border student-chapter-card overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)]",
        chapterToneClasses[chapter.tone],
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="relative grid min-h-[5.7rem] w-full cursor-pointer grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-2 whitespace-normal py-3 pl-2 pr-9 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100"
        aria-expanded={expanded}
      >
        <span
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg font-black",
            chapterNumberClasses[chapter.tone],
          )}
        >
          {chapter.order}
        </span>
        <span className="min-w-0 flex-1">
          <span className="student-soft-bold-text block break-words text-base font-black leading-6 text-slate-950 whitespace-normal dark:text-[var(--theme-text-strong)]">
            Chương {chapter.order}. {chapter.title}
          </span>
          <span className="mt-1 block break-words text-sm font-medium leading-5 text-slate-500 whitespace-normal dark:text-[var(--theme-text-muted)]">
            {chapter.description}
          </span>
          {showProgress ? (
            <span className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex min-h-7 items-center rounded-full px-2.5 text-sm font-black",
                  chapterProgressClasses[chapter.tone],
                )}
              >
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
                className={cn(
                  "absolute bottom-8 left-[1.625rem] top-8 z-0 w-0.5 rounded-full bg-gradient-to-b",
                  chapterConnectorClasses[chapter.tone],
                )}
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
