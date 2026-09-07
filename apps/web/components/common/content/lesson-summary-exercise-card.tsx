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
      className="rounded-xl border border-cyan-200 bg-cyan-50/60 p-3 dark:border-cyan-900/50 dark:bg-cyan-950/20 sm:p-5"
      data-lesson-summary-block-type="exercise"
    >
      <div className="mb-1 flex items-center gap-1.5 text-[13px] font-black uppercase tracking-wider text-cyan-700/80 dark:text-cyan-300/80">
        <NotebookPen className="h-4 w-4" aria-hidden="true" />
        Bài tập {displayNumber}
      </div>
      <div className="learning-content-text space-y-2 leading-relaxed text-slate-800 opacity-90 dark:text-slate-200">
        <LessonSummaryProblemContent
          answerLabel="Kết luận"
          block={block}
          renderFigure={renderFigure}
          showEditorialWarning={showEditorialWarning}
          solutionBorderClassName="border-cyan-500/35 dark:border-cyan-400/35"
        />
      </div>
    </div>
  );
}
