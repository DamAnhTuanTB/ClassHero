import { BookOpen } from "lucide-react";
import { LessonSummaryTableOfContents } from "@/components/common/content/lesson-summary-table-of-contents";
import { TiptapContentView } from "@/components/common/content/tiptap-content-view";
import type { StudentLesson } from "@/features/student/lessons/types/student-lesson-types";
import { SummaryBlockRenderer } from "./summary-block-renderer";

export function LessonSummaryPanel({ lesson }: { lesson: StudentLesson }) {
  const content = lesson.summary?.contentJson as any;
  const isBlocksFormat = content?.type === "lesson_summary_blocks";

  return (
    <section className="rounded-[1.5rem] border border-sky-100 bg-white p-4 shadow-[0_20px_50px_-42px_rgb(2_132_199_/_60%)] dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            <BookOpen className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-black text-slate-950 dark:text-[var(--theme-text-strong)] sm:text-xl">
              Kiến thức trọng tâm
            </h2>
          </div>
        </div>

        {lesson.summary && isBlocksFormat ? (
          <LessonSummaryTableOfContents
            accentTrigger
            desktopBorderless
            hasObjectives={Boolean(content.data?.objectives?.length)}
            sections={content.data?.sections ?? []}
          />
        ) : null}
      </div>

      {lesson.summary ? (
        isBlocksFormat ? (
          <SummaryBlockRenderer
            data={content.data}
            displayTitle={lesson.title}
            hideTitle
            viewMode="UI_ONLY"
          />
        ) : (
          <TiptapContentView
            content={lesson.summary.contentJson}
            className="mt-3 sm:mt-4"
          />
        )
      ) : (
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600 dark:text-[var(--theme-text-muted)] sm:mt-4 lg:text-base lg:leading-7">
          Bài học này chưa có bản kiến thức trọng tâm.
        </p>
      )}
    </section>
  );
}
