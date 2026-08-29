"use client";

import { BookOpen } from "lucide-react";
import { useMemo, useState } from "react";
import {
  isQuizExplanationBlockData,
  QuizExplanationCard,
} from "@/components/common/content/quiz-explanation-content";
import { TiptapContentView } from "@/components/common/content/tiptap-content-view";
import type { TiptapTextDocument } from "@/types/rich-text";
import type {
  AssessmentQuestionType,
  QuizFigureAsset,
} from "@/features/student/lessons/types/student-lesson-types";
import { getStemFigureDisplayPercent } from "@/lib/stem-figure-display";
import { cn } from "@/lib/utils";

export function AssessmentExplanationPanel({
  content,
  correctAnswer,
  explanationBlock,
  isOpen: controlledIsOpen,
  onToggle,
  optionIds,
  questionType,
  separateAnswerItems = false,
  solutionFigure,
}: {
  content: TiptapTextDocument | null | undefined;
  correctAnswer?: unknown;
  explanationBlock?: unknown | null;
  isOpen?: boolean;
  onToggle?: () => void;
  optionIds?: readonly string[];
  questionType?: AssessmentQuestionType;
  separateAnswerItems?: boolean;
  solutionFigure?: QuizFigureAsset | null;
}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const structuredExplanation = useMemo(
    () => (isQuizExplanationBlockData(explanationBlock) ? explanationBlock : null),
    [explanationBlock],
  );
  const solutionFigureDisplayPercent = getStemFigureDisplayPercent(
    solutionFigure?.displayScale,
  );
  if (!content && !structuredExplanation && !solutionFigure?.url) return null;
  const isOpen = controlledIsOpen ?? internalIsOpen;

  function handleToggle() {
    if (onToggle) {
      onToggle();
      return;
    }
    setInternalIsOpen((value) => !value);
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={handleToggle}
        className="inline-flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-xl bg-sky-100 px-4 text-base font-black text-sky-700 transition hover:bg-sky-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 dark:bg-sky-500/20 dark:text-sky-300 dark:hover:bg-sky-500/30 dark:focus-visible:ring-sky-500/30"
      >
        <BookOpen className="h-5 w-5" aria-hidden="true" />
        {isOpen ? "Ẩn lời giải chi tiết" : "Xem lời giải chi tiết"}
      </button>
      {isOpen ? (
        <div className="mt-2 space-y-3">
          {structuredExplanation ? (
            <QuizExplanationCard
              block={structuredExplanation}
              correctAnswer={correctAnswer}
              label="Lời giải"
              optionIds={optionIds}
              questionType={questionType}
              separateAnswerItems={separateAnswerItems}
              showProblem={false}
            />
          ) : (
            <div className="learning-content-text rounded-2xl border border-sky-200 bg-sky-50/70 p-3 dark:border-sky-400/30 dark:bg-sky-500/10">
              <>{content ? <TiptapContentView content={content} /> : null}</>
            </div>
          )}
          {solutionFigure?.url ? (
            <figure
              className="mx-auto overflow-hidden rounded-2xl border border-sky-200 bg-white p-3 dark:border-sky-400/30 dark:bg-[var(--theme-surface)]"
              style={
                solutionFigureDisplayPercent === null
                  ? undefined
                  : { width: `${solutionFigureDisplayPercent}%` }
              }
            >
              <img
                src={solutionFigure.url}
                alt={solutionFigure.altText}
                className={cn(
                  "mx-auto max-h-[28rem] max-w-full object-contain",
                  solutionFigureDisplayPercent === null ? "w-auto" : "w-full",
                )}
              />
              {solutionFigure.caption ? (
                <figcaption className="mt-2 text-center text-sm font-bold text-slate-500 dark:text-[var(--theme-text-muted)]">
                  {solutionFigure.caption}
                </figcaption>
              ) : null}
            </figure>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
