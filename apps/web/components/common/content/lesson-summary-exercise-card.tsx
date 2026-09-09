"use client";

import { NotebookPen } from "lucide-react";

import {
  LessonSummaryProblemContent,
  type LessonSummaryFigureRenderer,
  type LessonSummaryProblemBlockData,
} from "@/components/common/content/lesson-summary-problem-content";

export function LessonSummaryExerciseCard({
  block,
  displayNumber,
  showEditorialWarning = false,
  renderFigure,
}: {
  block: LessonSummaryProblemBlockData & { type: "exercise" };
  displayNumber: number | string;
  showEditorialWarning?: boolean;
  renderFigure?: LessonSummaryFigureRenderer;
}) {
  return (
    <div
      className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900/50 dark:bg-blue-900/10 sm:p-5"
      data-lesson-summary-block-type="exercise"
    >
      <div className="mb-1 flex items-center gap-1.5 text-[13px] font-black uppercase tracking-wider text-blue-600/70 dark:text-blue-400/70">
        <NotebookPen className="h-4 w-4" aria-hidden="true" />
        Bài tập {displayNumber}
        {block.origin === "AI_AUTHORED" && (
          <span className="ml-1 rounded bg-blue-500/20 px-1.5 py-[1px] text-[9px] font-bold text-blue-700 dark:bg-blue-500/30 dark:text-blue-300">
            NEW
          </span>
        )}
      </div>
      <div className="learning-content-text space-y-2 leading-relaxed text-slate-800 opacity-90 dark:text-slate-200">
        <LessonSummaryProblemContent
          answerLabel="Kết luận"
          block={block}
          renderFigure={renderFigure}
          showEditorialWarning={showEditorialWarning}
          solutionBorderClassName="border-blue-500/30 dark:border-blue-400/30"
        />
      </div>
    </div>
  );
}
