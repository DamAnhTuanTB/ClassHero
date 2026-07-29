import { BookOpen } from "lucide-react";
import { TiptapContentView } from "@/components/common/content/tiptap-content-view";
import type { StudentLesson } from "@/features/student/lessons/types/student-lesson-types";

export function LessonSummaryPanel({ lesson }: { lesson: StudentLesson }) {
  return (
    <section className="rounded-[1.5rem] border border-sky-100 bg-white p-4 shadow-[0_20px_50px_-42px_rgb(2_132_199_/_60%)] dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] sm:p-5">
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          <BookOpen className="h-6 w-6" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-black text-slate-950 dark:text-[var(--theme-text-strong)] sm:text-lg">
            Kiến thức trọng tâm
          </h2>
        </div>
      </div>

      {lesson.summary ? (
        <TiptapContentView
          content={lesson.summary.contentJson}
          className="mt-3 sm:mt-4"
        />
      ) : (
        <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-4 text-sm font-bold text-slate-500 dark:bg-[var(--theme-surface-muted)] dark:text-[var(--theme-text-muted)] sm:mt-4">
          Bài học này chưa có bản tóm tắt.
        </div>
      )}
    </section>
  );
}
