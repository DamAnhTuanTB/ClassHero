"use client";

import { lessonSummaryGeometryStatementSchema } from "@learning-path/shared";
import { PlayCircle } from "lucide-react";

import {
  LessonSummaryProblemContent,
  type LessonSummaryFigureRenderer,
  type LessonSummaryProblemBlockData,
} from "@/components/common/content/lesson-summary-problem-content";
import { VideoStartTimeBadge } from "@/components/common/content/video-start-time-badge";

export type LessonSummaryExampleBlockData = LessonSummaryProblemBlockData & {
  type: "example";
};

export function isLessonSummaryExampleBlockData(
  value: unknown,
): value is LessonSummaryExampleBlockData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const block = value as Record<string, unknown>;
  if (
    block.type !== "example" ||
    typeof block.problem !== "string" ||
    (block.solution !== null && typeof block.solution !== "string") ||
    typeof block.answer !== "string"
  ) {
    return false;
  }
  if (
    block.geometryStatement !== undefined &&
    !lessonSummaryGeometryStatementSchema.safeParse(block.geometryStatement).success
  ) {
    return false;
  }
  if (block.figures !== undefined) {
    if (!Array.isArray(block.figures)) return false;
    for (const value of block.figures) {
      if (!value || typeof value !== "object" || Array.isArray(value)) return false;
      const visual = value as Record<string, unknown>;
      if (
        visual.kind !== "TEX_FIGURE" ||
        typeof visual.figureId !== "string" ||
        typeof visual.altText !== "string" ||
        (visual.caption !== null && typeof visual.caption !== "string")
      ) {
        return false;
      }
    }
  }
  return true;
}

export function LessonSummaryExampleCard({
  answerLabel,
  block,
  displayNumber,
  label = "Ví dụ",
  showEditorialWarning = false,
  showProblem = true,
  renderFigure,
  onVideoSeek,
  videoEndTimeSeconds,
  videoStartTimeOffsetSeconds = 0,
}: {
  answerLabel?: string;
  block: LessonSummaryExampleBlockData;
  displayNumber?: number | string | null;
  label?: string;
  showEditorialWarning?: boolean;
  showProblem?: boolean;
  renderFigure?: LessonSummaryFigureRenderer;
  onVideoSeek?: (seconds: number) => void;
  videoEndTimeSeconds?: number;
  videoStartTimeOffsetSeconds?: number;
}) {
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900/50 dark:bg-blue-900/10 sm:p-5">
      <div className="mb-1 flex items-center gap-2 text-[13px] font-black uppercase tracking-wider text-blue-600/70 dark:text-blue-400/70">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <PlayCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {label} {displayNumber ?? ""}
        </span>
        <VideoStartTimeBadge
          endSeconds={videoEndTimeSeconds}
          offsetSeconds={videoStartTimeOffsetSeconds}
          seconds={block.startSeconds}
          onSeek={onVideoSeek}
        />
      </div>
      <div className="learning-content-text space-y-2 leading-relaxed text-slate-800 opacity-90 dark:text-slate-200">
        <LessonSummaryProblemContent
          answerLabel={answerLabel}
          block={block}
          renderFigure={renderFigure}
          showEditorialWarning={showEditorialWarning}
          showProblem={showProblem}
          solutionBorderClassName="border-blue-500/30 dark:border-blue-400/30"
        />
      </div>
    </div>
  );
}
