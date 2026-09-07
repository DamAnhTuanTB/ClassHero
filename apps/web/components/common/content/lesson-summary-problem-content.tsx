"use client";

import {
  normalizeLessonSummaryAngleNotation,
  type LessonSummaryGeometryStatement,
} from "@learning-path/shared";
import type { ReactNode } from "react";

import { normalizeInlineSubpartBreaks } from "@/components/common/content/lesson-summary-example-content-normalizer";
import { LessonSummaryGeometryStatementTable } from "@/components/common/content/lesson-summary-geometry-statement";
import {
  StemFigure,
  type StemFigureVisual,
} from "@/components/common/content/stem-figure";
import { MathpixMarkdownRenderer } from "@/components/shared/mathpix-markdown-renderer";

export interface LessonSummaryProblemBlockData {
  type: "example" | "exercise";
  problem: string;
  solution: string | null;
  answer: string;
  geometryStatement?: LessonSummaryGeometryStatement;
  figures?: StemFigureVisual[];
}

export type LessonSummaryFigureRenderer = (visual: StemFigureVisual) => ReactNode;

export function LessonSummaryProblemContent({
  answerLabel = "Đáp án",
  block,
  solutionBorderClassName,
  showEditorialWarning = false,
  showProblem = true,
  renderFigure,
}: {
  answerLabel?: string;
  block: LessonSummaryProblemBlockData;
  solutionBorderClassName: string;
  showEditorialWarning?: boolean;
  showProblem?: boolean;
  renderFigure?: LessonSummaryFigureRenderer;
}) {
  const geometryStatement = readGeometryStatement(block);
  const normalizedAnswer = block.answer ? normalizeBlockMath(block.answer) : "";
  const shouldStackAnswerLabel = answerLabel === "Kết luận";
  const positionedFigures = (block.figures ?? []).flatMap((visual, index) =>
    visual?.kind === "TEX_FIGURE"
      ? [{ visual, figureIndex: visual.figureIndex ?? index }]
      : [],
  );
  const questionFigures = positionedFigures.filter(
    ({ figureIndex }) => figureIndex !== 1,
  );
  const solutionFigures = positionedFigures.filter(
    ({ figureIndex }) => figureIndex === 1,
  );
  const hasSolutionSection = Boolean(block.solution) || solutionFigures.length > 0;
  return (
    <div className="space-y-3">
      {showProblem ? (
        <div>
          <MathpixMarkdownRenderer content={normalizeBlockMath(block.problem)} />
        </div>
      ) : null}

      {questionFigures.map(({ visual }) => (
        <div data-summary-figure-placement="question" key={visual.figureId}>
          {renderFigure ? (
            renderFigure(visual)
          ) : (
            <StemFigure visual={visual} showStatus={showEditorialWarning} />
          )}
        </div>
      ))}

      {geometryStatement ? (
        <LessonSummaryGeometryStatementTable statement={geometryStatement} />
      ) : null}

      {hasSolutionSection || block.answer ? (
        <div
          className={`learning-content-text mb-3 space-y-3 border-l-[3px] pl-4 ${solutionBorderClassName}`}
        >
          {hasSolutionSection ? (
            <div>
              <div
                className="mb-1.5 text-center font-bold text-slate-900 dark:text-slate-100"
                data-summary-solution-heading
              >
                Lời giải
              </div>
              {solutionFigures.map(({ visual }) => (
                <div data-summary-figure-placement="solution" key={visual.figureId}>
                  {renderFigure ? (
                    renderFigure(visual)
                  ) : (
                    <StemFigure visual={visual} showStatus={showEditorialWarning} />
                  )}
                </div>
              ))}
              {block.solution ? (
                <MathpixMarkdownRenderer
                  content={normalizeSolutionForDisplay(block.solution)}
                />
              ) : null}
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

function normalizeBlockMath(value: string) {
  return normalizeInlineSubpartBreaks(normalizeLessonSummaryAngleNotation(value));
}

function normalizeSolutionForDisplay(value: string) {
  return normalizeBlockMath(value)
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

function readGeometryStatement(block: LessonSummaryProblemBlockData) {
  const statement = block.geometryStatement;
  if (!statement) return null;
  const hypotheses = statement.hypotheses.map(normalizeBlockMath).filter(Boolean);
  const conclusions = statement.conclusions.map(normalizeBlockMath).filter(Boolean);
  return hypotheses.length > 0 && conclusions.length > 0
    ? { hypotheses, conclusions }
    : null;
}
