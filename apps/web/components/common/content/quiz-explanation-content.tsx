"use client";

import { PlayCircle } from "lucide-react";
import { normalizeMathTextLatexCommands } from "@learning-path/shared";
import type { ReactNode } from "react";

import {
  removeQuizDisplayMathTerminalPeriods,
  resolveQuizAnswerOptionDisplay,
  resolveQuizCorrectAnswerDisplay,
  type QuizExplanationQuestionType,
} from "@/components/common/content/quiz-explanation-content-normalizer";
import { MathpixMarkdownRenderer } from "@/components/shared/mathpix-markdown-renderer";

export interface QuizExplanationBlockData {
  type: "quizExplanation";
  problem: string;
  solution: string | null;
  isGeometry?: boolean;
}

export function isQuizExplanationBlockData(
  value: unknown,
): value is QuizExplanationBlockData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const block = value as Record<string, unknown>;
  return (
    block.type === "quizExplanation" &&
    typeof block.problem === "string" &&
    (block.solution === null || typeof block.solution === "string") &&
    (block.isGeometry === undefined || typeof block.isGeometry === "boolean")
  );
}

export function QuizExplanationCard({
  block,
  correctAnswer,
  label = "Lời giải",
  media,
  optionIds,
  questionType,
  separateAnswerItems = false,
  showProblem = true,
  headerAction,
}: {
  block: QuizExplanationBlockData;
  correctAnswer?: unknown;
  label?: string;
  media?: ReactNode;
  optionIds?: readonly string[];
  questionType?: QuizExplanationQuestionType;
  separateAnswerItems?: boolean;
  showProblem?: boolean;
  headerAction?: ReactNode;
}) {
  const correctAnswerDisplay = questionType
    ? resolveQuizCorrectAnswerDisplay({ correctAnswer, optionIds, questionType })
    : null;
  const normalizedAnswer = normalizeQuizAnswer(
    correctAnswerDisplay?.content ?? "",
  );
  const answerDisplay = questionType
    ? correctAnswerDisplay
      ? { ...correctAnswerDisplay, content: normalizedAnswer }
      : { content: "", optionLabel: null }
    : separateAnswerItems
      ? { content: normalizedAnswer, optionLabel: null }
      : resolveQuizAnswerOptionDisplay(normalizedAnswer, null);
  const answerContent = answerDisplay.content;
  const answerItems = separateAnswerItems ? splitMultiStatementAnswer(answerContent) : [];

  return (
    <div className="learning-content-text rounded-xl border border-sky-200 bg-sky-50/50 p-3 dark:border-sky-900/50 dark:bg-sky-900/10">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-sky-600/70 dark:text-sky-400/70">
          <PlayCircle className="size-4 shrink-0" aria-hidden="true" />
          {label}
        </div>
        {headerAction}
      </div>
      {media ? <div className="mb-3">{media}</div> : null}
      <div className="space-y-3 leading-relaxed text-slate-800 opacity-90 dark:text-slate-200">
        {showProblem ? (
          <MathpixMarkdownRenderer content={normalizeQuizMath(block.problem)} />
        ) : null}
        {block.solution || answerContent ? (
          <div className="space-y-1.5 border-l-[3px] border-sky-500/30 pl-4 dark:border-sky-400/30">
            {block.solution ? (
              <MathpixMarkdownRenderer
                className="quiz-explanation-solution"
                content={normalizeQuizSolution(block.solution)}
              />
            ) : null}
            {answerContent ? (
              separateAnswerItems ? (
                <div className="space-y-0.5">
                  <p className="font-extrabold text-slate-700 dark:text-slate-200">
                    Đáp án:
                  </p>
                  <div className="space-y-1">
                    {answerItems.map((answerItem, index) => (
                      <MathpixMarkdownRenderer
                        key={`${index}-${answerItem}`}
                        className="[&_p]:m-0"
                        content={answerItem}
                        contentAlignment="left"
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-extrabold text-slate-700 dark:text-slate-200">
                    Đáp án:
                  </span>
                  {answerDisplay.optionLabel ? (
                    <span
                      aria-label={`Phương án ${answerDisplay.optionLabel}`}
                      className="student-mobile-border grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-slate-500 text-sm font-extrabold text-slate-900 dark:border-slate-400 dark:text-slate-100"
                    >
                      {answerDisplay.optionLabel}
                    </span>
                  ) : null}
                  {!answerDisplay.optionLabel ? (
                    <MathpixMarkdownRenderer
                      className="min-w-0 flex-1 [&>div]:inline [&_p]:m-0 [&_p]:inline"
                      content={answerContent}
                      contentAlignment="left"
                    />
                  ) : null}
                </div>
              )
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function normalizeQuizSolution(value: string) {
  return removeQuizDisplayMathTerminalPeriods(
    normalizeQuizMath(value)
      .split("\n")
      .filter(
        (line) =>
          !/^\s*(?:#{1,6}\s*)?(?:\*\*|__)?(?:Lời giải|Chứng minh)\s*:?(?:\*\*|__)?\s*$/iu.test(
            line,
          ),
      )
      .join("\n")
      .trim(),
  );
}

function normalizeQuizMath(value: string) {
  return normalizeMathTextLatexCommands(value)
    .replace(
      /\\angle\s*\{([A-Za-z](?:['′″]|[0-9₀-₉]){0,3})([A-Za-z](?:['′″]|[0-9₀-₉]){0,3})([A-Za-z](?:['′″]|[0-9₀-₉]){0,3})\}/gu,
      (_, first: string, vertex: string, second: string) =>
        `\\widehat{${first}${vertex}${second}}`,
    )
    .replace(
      /\\angle\s+([A-Za-z](?:['′″]|[0-9₀-₉]){0,3})([A-Za-z](?:['′″]|[0-9₀-₉]){0,3})([A-Za-z](?:['′″]|[0-9₀-₉]){0,3})(?![A-Za-z0-9_'′″₀-₉])/gu,
      (_, first: string, vertex: string, second: string) =>
        `\\widehat{${first}${vertex}${second}}`,
    );
}

function normalizeQuizAnswer(value: string) {
  return normalizeQuizMath(value)
    .replace(/^\s*(?:\*\*|__)?Đáp án\s*:\s*(?:\*\*|__)?/iu, "")
    .trim();
}

function splitMultiStatementAnswer(value: string) {
  const answerItems = value
    .split(/(?:\s*;\s*|\n+)(?=[a-z]\s*[.)]\s*)/giu)
    .map((item) => item.trim())
    .filter(Boolean);

  return answerItems.length > 0 ? answerItems : [value];
}
