"use client";

import {
  normalizeLessonSummaryAngleNotation,
  lessonSummaryDiagramSpecSchema,
  lessonSummaryGeometryStatementSchema,
  type LessonSummaryDiagramSpec,
  type LessonSummaryGeometryStatement,
} from "@learning-path/shared";
import { PlayCircle } from "lucide-react";
import { LessonSummaryDiagram } from "@/components/common/content/lesson-summary-diagram";
import type { LessonSummaryDiagramEditor } from "@/components/common/content/lesson-summary-diagram-editing";
import { LessonSummaryGeometryStatementTable } from "@/components/common/content/lesson-summary-geometry-statement";
import { MathpixMarkdownRenderer } from "@/components/shared/mathpix-markdown-renderer";

export interface LessonSummaryExampleBlockData {
  type: "example";
  problem: string;
  solution: string | null;
  answer: string;
  geometryStatement?: LessonSummaryGeometryStatement;
  visual?: {
    kind: "DIAGRAM_SPEC";
    spec: LessonSummaryDiagramSpec;
  };
}

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
  if (block.visual !== undefined) {
    if (
      !block.visual ||
      typeof block.visual !== "object" ||
      Array.isArray(block.visual)
    ) {
      return false;
    }
    const visual = block.visual as Record<string, unknown>;
    if (
      visual.kind !== "DIAGRAM_SPEC" ||
      !lessonSummaryDiagramSpecSchema.safeParse(visual.spec).success
    ) {
      return false;
    }
  }
  return true;
}

export function LessonSummaryExampleContent({
  block,
  diagramEditor,
  showEditorialWarning = false,
  showProblem = true,
}: {
  block: LessonSummaryExampleBlockData;
  diagramEditor?: LessonSummaryDiagramEditor;
  showEditorialWarning?: boolean;
  showProblem?: boolean;
}) {
  const geometryStatement = readGeometryStatement(block);
  return (
    <div className="space-y-3">
      {showProblem ? (
        <div>
          <MathpixMarkdownRenderer content={normalizeBlockMath(block.problem, block)} />
        </div>
      ) : null}

      {block.visual?.kind === "DIAGRAM_SPEC" ? (
        <LessonSummaryDiagram
          editor={diagramEditor}
          spec={block.visual.spec}
          showEditorialWarning={showEditorialWarning}
        />
      ) : null}

      {geometryStatement ? (
        <LessonSummaryGeometryStatementTable statement={geometryStatement} />
      ) : null}

      {block.solution || block.answer ? (
        <div className="mb-3 space-y-3 border-l-[3px] border-blue-500/30 pl-4 text-sm dark:border-blue-400/30">
          {block.solution ? (
            <div>
              {geometryStatement ? (
                <div className="mb-1.5 font-bold text-slate-900 dark:text-slate-100">
                  Chứng minh
                </div>
              ) : null}
              <MathpixMarkdownRenderer
                content={normalizeBlockMath(block.solution, block)}
              />
            </div>
          ) : null}
          {block.answer ? (
            <div className="mt-2">
              <MathpixMarkdownRenderer
                content={`${geometryStatement ? "Vậy " : "Đáp án: "}${normalizeBlockMath(block.answer, block)}`}
              />
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
  block,
  diagramEditor,
  displayNumber,
  label = "Ví dụ",
  showEditorialWarning = false,
  showProblem = true,
}: {
  block: LessonSummaryExampleBlockData;
  diagramEditor?: LessonSummaryDiagramEditor;
  displayNumber?: number | string | null;
  label?: string;
  showEditorialWarning?: boolean;
  showProblem?: boolean;
}) {
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900/50 dark:bg-blue-900/10 sm:p-5">
      <div className="mb-1 flex items-center gap-1.5 text-[13px] font-black uppercase tracking-wider text-blue-600/70 dark:text-blue-400/70">
        <PlayCircle className="h-4 w-4" aria-hidden="true" />
        {label} {displayNumber ?? ""}
      </div>
      <div className="space-y-2 text-[15px] leading-relaxed text-slate-800 opacity-90 dark:text-slate-200">
        <LessonSummaryExampleContent
          block={block}
          diagramEditor={diagramEditor}
          showEditorialWarning={showEditorialWarning}
          showProblem={showProblem}
        />
      </div>
    </div>
  );
}

function normalizeBlockMath(value: string, block: LessonSummaryExampleBlockData) {
  return normalizeLessonSummaryAngleNotation(value, block.visual?.spec);
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
