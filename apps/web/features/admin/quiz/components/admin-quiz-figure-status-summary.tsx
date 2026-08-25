"use client";

import { ChevronDown, Images, Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import type { AdminQuizQuestion } from "@/features/admin/quiz/api/admin-quiz-api";
import { hasActiveAdminFigure } from "@/lib/admin-figure-status";

const QuizFigureOverviewDialog = dynamic(
  () =>
    import("@/features/admin/quiz/components/admin-quiz-figure-overview-dialog").then(
      (module) => module.AdminQuizFigureOverviewDialog,
    ),
  { ssr: false },
);

export function AdminQuizFigureStatusSummary({
  approvedQuestions,
  onNavigateToQuestion,
  pendingQuestions,
  setId,
}: {
  approvedQuestions: AdminQuizQuestion[];
  onNavigateToQuestion: (questionId: string) => void;
  pendingQuestions: AdminQuizQuestion[];
  setId: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const figures = useMemo(
    () =>
      [...pendingQuestions, ...approvedQuestions].flatMap((question) => question.figures),
    [approvedQuestions, pendingQuestions],
  );
  const hasProcessingFigure = hasActiveAdminFigure(figures);

  return (
    <>
      <div aria-label="Theo dõi xử lý hình Quiz" role="group">
        <button
          aria-haspopup="dialog"
          className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-2.5 text-xs font-extrabold tabular-nums text-[var(--theme-text-muted)] transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:hover:border-sky-700 dark:hover:bg-sky-950/50 dark:hover:text-sky-200"
          onClick={() => setIsOpen(true)}
          type="button"
        >
          <Images className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Tổng {figures.length} ảnh</span>
          {hasProcessingFigure ? (
            <>
              <Loader2
                className="h-3.5 w-3.5 shrink-0 animate-spin text-sky-600 motion-reduce:animate-none dark:text-sky-300"
                aria-hidden="true"
              />
              <span className="sr-only">Còn ảnh đang xử lý</span>
            </>
          ) : null}
          <ChevronDown className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>

      {isOpen ? (
        <QuizFigureOverviewDialog
          approvedQuestions={approvedQuestions}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onNavigateToQuestion={(questionId) => {
            setIsOpen(false);
            onNavigateToQuestion(questionId);
          }}
          pendingQuestions={pendingQuestions}
          setId={setId}
        />
      ) : null}
    </>
  );
}
