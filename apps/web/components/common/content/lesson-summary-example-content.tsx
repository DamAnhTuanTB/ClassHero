"use client";

import {
  normalizeLessonSummaryAngleNotation,
  lessonSummaryGeometryStatementSchema,
  type LessonSummaryGeometryStatement,
} from "@learning-path/shared";
import { PlayCircle } from "lucide-react";
import type { ReactNode } from "react";
import {
  StemFigure,
  type StemFigureVisual,
} from "@/components/common/content/stem-figure";
import { normalizeInlineSubpartBreaks } from "@/components/common/content/lesson-summary-example-content-normalizer";
import { LessonSummaryGeometryStatementTable } from "@/components/common/content/lesson-summary-geometry-statement";
import { MathpixMarkdownRenderer } from "@/components/shared/mathpix-markdown-renderer";

export interface LessonSummaryExampleBlockData {
  type: "example";
  problem: string;
  solution: string | null;
  answer: string;
  geometryStatement?: LessonSummaryGeometryStatement;
  figures?: StemFigureVisual[];
}

export type LessonSummaryFigureRenderer = (visual: StemFigureVisual) => ReactNode;

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

export function LessonSummaryExampleContent({
  answerLabel = "Đáp án",
  block,
  showEditorialWarning = false,
  showProblem = true,
  renderFigure,
}: {
  answerLabel?: string;
  block: LessonSummaryExampleBlockData;
  showEditorialWarning?: boolean;
  showProblem?: boolean;
  renderFigure?: LessonSummaryFigureRenderer;
}) {
  const geometryStatement = readGeometryStatement(block);
  const normalizedAnswer = block.answer ? normalizeBlockMath(block.answer, block) : "";
  const shouldStackAnswerLabel = answerLabel === "Kết luận";
  return (
    <div className="space-y-3">
      {showProblem ? (
        <div>
          <MathpixMarkdownRenderer content={normalizeBlockMath(block.problem, block)} />
        </div>
      ) : null}

      {block.figures?.map((visual) =>
        visual.kind === "TEX_FIGURE" ? (
          <div key={visual.figureId}>
            {renderFigure ? (
              renderFigure(visual)
            ) : (
              <StemFigure visual={visual} showStatus={showEditorialWarning} />
            )}
          </div>
        ) : null,
      )}

      {geometryStatement ? (
        <LessonSummaryGeometryStatementTable statement={geometryStatement} />
      ) : null}

      {block.solution || block.answer ? (
        <div className="mb-3 space-y-3 border-l-[3px] border-blue-500/30 pl-4 text-sm dark:border-blue-400/30">
          {block.solution ? (
            <div>
              <div className="mb-1.5 text-center font-bold text-slate-900 dark:text-slate-100">
                Lời giải
              </div>
              <MathpixMarkdownRenderer
                content={normalizeSolutionForDisplay(block.solution, block)}
              />
            </div>
          ) : null}
          {block.answer ? (
            <div className="mt-2">
              {shouldStackAnswerLabel ? (
                <>
                  <div className="mb-1.5 block whitespace-nowrap font-bold text-slate-900 dark:text-slate-100">
                    {answerLabel}:
                  </div>
                  <MathpixMarkdownRenderer content={normalizedAnswer} />
                </>
              ) : (
                <MathpixMarkdownRenderer
                  content={`${answerLabel}: ${normalizedAnswer}`}
                />
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The canonical visual shell for an M9.2 EXAMPLE block. Summary, Quiz and Test
 * must render this component instead of recreating a similar-looking card.
 */
export function LessonSummaryExampleCard({
  answerLabel,
  block,
  displayNumber,
  label = "Ví dụ",
  showEditorialWarning = false,
  showProblem = true,
  renderFigure,
}: {
  answerLabel?: string;
  block: LessonSummaryExampleBlockData;
  displayNumber?: number | string | null;
  label?: string;
  showEditorialWarning?: boolean;
  showProblem?: boolean;
  renderFigure?: LessonSummaryFigureRenderer;
}) {
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900/50 dark:bg-blue-900/10 sm:p-5">
      <div className="mb-1 flex items-center gap-1.5 text-[13px] font-black uppercase tracking-wider text-blue-600/70 dark:text-blue-400/70">
        <PlayCircle className="h-4 w-4" aria-hidden="true" />
        {label} {displayNumber ?? ""}
      </div>
      <div className="space-y-2 text-[15px] leading-relaxed text-slate-800 opacity-90 dark:text-slate-200">
        <LessonSummaryExampleContent
          answerLabel={answerLabel}
          block={block}
          showEditorialWarning={showEditorialWarning}
          showProblem={showProblem}
          renderFigure={renderFigure}
        />
      </div>
    </div>
  );
}

function normalizeBlockMath(value: string, _block: LessonSummaryExampleBlockData) {
  return normalizeInlineSubpartBreaks(normalizeLessonSummaryAngleNotation(value));
}

function normalizeSolutionForDisplay(
  value: string,
  block: LessonSummaryExampleBlockData,
) {
  return normalizeBlockMath(value, block)
    .split("\n")
    .filter(
      (line) =>
        !/^\s*(?:#{1,6}\s*)?(?:\*\*|__)?(?:Lời giải|Chứng minh)\s*:?(?:\*\*|__)?\s*$/iu.test(
          line,
        ),
    )
    .join("\n")
    .trim();
}

function readGeometryStatement(block: LessonSummaryExampleBlockData) {
  const statement = block.geometryStatement;
  if (!statement) return null;
  const hypotheses = statement.hypotheses
    .map((value) => normalizeBlockMath(value, block))
    .filter(Boolean);
  const conclusions = statement.conclusions
    .map((value) => normalizeBlockMath(value, block))
    .filter(Boolean);
  return hypotheses.length > 0 && conclusions.length > 0
    ? { hypotheses, conclusions }
    : null;
}
