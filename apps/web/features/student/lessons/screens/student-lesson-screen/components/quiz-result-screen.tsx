"use client";

import {
  CheckCircle2,
  ChevronLeft,
  ListChecks,
  Loader2,
  RefreshCcw,
  RotateCcw,
  SearchX,
  Sparkles,
} from "lucide-react";
import { ClassHeroLogo } from "@/components/common/brand/classhero-logo";
import { useDocumentScrollLock } from "@/features/student/lessons/hooks/use-document-scroll-lock";
import { AssessmentResultConfetti } from "@/features/student/lessons/screens/student-lesson-screen/components/assessment-result-confetti";
import type { AttemptSummary } from "@/features/student/lessons/types/student-lesson-types";
import { getAssessmentResultEncouragement } from "@/features/student/lessons/utils/assessment-result-encouragement";
import { cn } from "@/lib/utils";

export function QuizResultScreen({
  onBack,
  onRestartAll,
  onRestartIncorrect,
  onReviewAll,
  onReviewIncorrect,
  onStartNewSet,
  pendingAction,
  result,
  shouldCelebrate,
}: {
  onBack: () => void;
  onRestartAll: () => void;
  onRestartIncorrect: () => void;
  onReviewAll: () => void;
  onReviewIncorrect: () => void;
  onStartNewSet: () => void;
  pendingAction: string | null;
  result: AttemptSummary;
  shouldCelebrate: boolean;
}) {
  useDocumentScrollLock();

  const accuracy =
    result.accuracyPercent ??
    Math.round((result.correctCount / Math.max(result.totalCount, 1)) * 100);
  const scoreOnTen = Number((accuracy / 10).toFixed(1));
  const isPassing = scoreOnTen >= 5;
  const scoreRingColor = isPassing ? "rgb(16 185 129)" : "rgb(244 63 94)";
  const resultEncouragement = getAssessmentResultEncouragement(scoreOnTen);
  const actions = [
    {
      disabled: result.wrongCount === 0,
      icon: SearchX,
      label: "Xem lại câu sai",
      onClick: onReviewIncorrect,
      pending: pendingAction === "review-INCORRECT",
      primary: false,
      showsLocalPending: true,
    },
    {
      disabled: false,
      icon: ListChecks,
      label: "Xem lại tất cả",
      onClick: onReviewAll,
      pending: pendingAction === "review-ALL",
      primary: false,
      showsLocalPending: true,
    },
    {
      disabled: result.wrongCount === 0,
      icon: RotateCcw,
      label: "Làm lại câu sai",
      onClick: onRestartIncorrect,
      pending: pendingAction === "start-INCORRECT",
      primary: true,
      showsLocalPending: false,
    },
    {
      disabled: false,
      icon: RefreshCcw,
      label: "Làm lại tất cả",
      onClick: onRestartAll,
      pending: pendingAction === "start-ALL",
      primary: true,
      showsLocalPending: false,
    },
  ];

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-[linear-gradient(180deg,#e0f2fe_0%,#f0f9ff_100%)] text-slate-950 dark:bg-none dark:bg-[var(--theme-bg)] dark:text-[var(--theme-text-strong)]">
      {shouldCelebrate ? <AssessmentResultConfetti /> : null}
      <header className="sticky top-0 z-20 border-b border-sky-100 bg-white/95 py-2 pl-1 pr-2 backdrop-blur dark:border-[var(--theme-border)] dark:bg-[color-mix(in_srgb,var(--theme-surface)_95%,transparent)] sm:pl-2 sm:pr-4">
        <div className="mx-auto flex min-h-14 max-w-2xl items-center gap-1.5">
          <button
            type="button"
            onClick={onBack}
            className="grid h-11 w-10 shrink-0 place-items-center rounded-xl text-slate-700 transition hover:bg-sky-50 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100 dark:text-[var(--theme-text)] dark:hover:bg-[var(--theme-surface-soft)]"
            aria-label="Quay lại màn Quiz"
          >
            <ChevronLeft className="h-8 w-8" strokeWidth={2.8} aria-hidden="true" />
          </button>
          <ClassHeroLogo className="h-10 max-w-[9rem]" priority />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-6 pb-10 sm:px-6 sm:py-8">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-sm font-black text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            Đã hoàn thành
          </span>
          <h1 className="mt-4 text-3xl font-black text-slate-950 dark:text-[var(--theme-text-strong)]">
            Kết quả Quiz
          </h1>
          <p
            className={cn(
              "mx-auto mt-2 max-w-lg text-base font-bold leading-6 sm:text-lg",
              resultEncouragement.className,
            )}
          >
            <span aria-hidden="true" className="mr-1.5 inline-block text-lg sm:text-xl">
              {resultEncouragement.emoji}
            </span>
            {resultEncouragement.message}
          </p>
        </div>

        <section className="mt-6 rounded-[1.7rem] border border-sky-100 bg-white p-5 shadow-[0_24px_55px_-42px_rgb(2_132_199_/_60%)] dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] sm:p-7">
          <div
            className="mx-auto grid h-40 w-40 place-items-center rounded-full p-4"
            style={{
              background: `conic-gradient(${scoreRingColor} ${accuracy}%, rgb(226 232 240) ${accuracy}% 100%)`,
            }}
          >
            <div className="grid h-full w-full place-items-center rounded-full bg-white text-center dark:bg-[var(--theme-surface)]">
              <div>
                <p
                  className={cn(
                    "text-4xl font-black",
                    isPassing
                      ? "text-emerald-600 dark:text-emerald-300"
                      : "text-rose-600 dark:text-rose-300",
                  )}
                >
                  {result.correctCount}/{result.totalCount}
                </p>
                <p className="mt-1 text-base font-black text-slate-500 dark:text-[var(--theme-text-muted)]">
                  {accuracy}%
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2 text-center">
            <Metric label="Câu sai" value={result.wrongCount} tone="danger" />
            <Metric label="Câu đúng" value={result.correctCount} tone="success" />
            <Metric label="Điểm" value={scoreOnTen} tone="primary" />
          </div>
        </section>

        <div className="mt-5 grid grid-cols-2 gap-3">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                disabled={action.disabled || action.pending}
                onClick={action.onClick}
                className={cn(
                  "student-preserve-mobile-shadow inline-flex h-14 w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-2 text-[13px] font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-45 dark:focus-visible:ring-sky-500/30 sm:px-3 sm:text-base",
                  action.primary
                    ? "bg-sky-600 text-white shadow-[0_4px_0_rgb(3_105_161)] active:translate-y-[3px] active:shadow-[0_1px_0_rgb(3_105_161)] enabled:hover:bg-sky-500"
                    : "student-mobile-border border border-sky-500 bg-white text-sky-700 shadow-[0_4px_0_rgb(186_230_253)] active:translate-y-[3px] active:shadow-[0_1px_0_rgb(186_230_253)] enabled:hover:bg-sky-50 dark:border-sky-400 dark:bg-[var(--theme-surface)] dark:text-sky-300 dark:shadow-[0_4px_0_rgb(7_89_133)] dark:active:shadow-[0_1px_0_rgb(7_89_133)] dark:enabled:hover:bg-sky-500/10",
                )}
              >
                {action.pending && action.showsLocalPending ? (
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden="true" />
                ) : (
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                )}
                {action.label}
              </button>
            );
          })}
          <button
            type="button"
            aria-busy={pendingAction === "start-new-set"}
            disabled={pendingAction === "start-new-set"}
            onClick={onStartNewSet}
            className="student-preserve-mobile-shadow col-span-2 inline-flex h-14 w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl border-2 border-sky-500 bg-sky-500 px-4 text-[13px] font-black text-white shadow-[0_4px_0_rgb(3_105_161)] transition enabled:hover:border-sky-600 enabled:hover:bg-sky-600 active:translate-y-[3px] active:shadow-[0_1px_0_rgb(3_105_161)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 disabled:cursor-wait disabled:opacity-60 dark:border-sky-600 dark:bg-sky-600 dark:text-white dark:shadow-[0_4px_0_rgb(7_89_133)] dark:enabled:hover:border-sky-700 dark:enabled:hover:bg-sky-700 dark:focus-visible:ring-sky-500/30 sm:text-base"
          >
            <Sparkles className="h-5 w-5 shrink-0" aria-hidden="true" />
            Làm bộ Quiz mới
          </button>
        </div>
      </main>
    </div>
  );
}

function Metric({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "danger" | "primary" | "success";
  value: number | string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl px-2 py-4",
        tone === "success"
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
          : tone === "danger"
            ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
            : "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
      )}
    >
      <p className="text-xl font-black sm:text-2xl">{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-wide sm:text-xs">
        {label}
      </p>
    </div>
  );
}
