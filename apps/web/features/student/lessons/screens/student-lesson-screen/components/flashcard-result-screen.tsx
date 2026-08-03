"use client";

import {
  CheckCircle2,
  ChevronLeft,
  Heart,
  RefreshCcw,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { ClassHeroLogo } from "@/components/common/brand/classhero-logo";
import { useDocumentScrollLock } from "@/features/student/lessons/hooks/use-document-scroll-lock";
import { AssessmentResultConfetti } from "@/features/student/lessons/screens/student-lesson-screen/components/assessment-result-confetti";
import { FlashcardProgressMetrics } from "@/features/student/lessons/screens/student-lesson-screen/components/flashcard-progress-metrics";
import type { FlashcardProgressSummary } from "@/features/student/lessons/types/student-lesson-types";
import { getAssessmentResultEncouragement } from "@/features/student/lessons/utils/assessment-result-encouragement";
import { cn } from "@/lib/utils";

export function FlashcardResultScreen({
  favoriteCount,
  onBack,
  onReviewFavorites,
  onRestartAll,
  onRestartUnknown,
  onStartNewSet,
  pendingAction,
  progress,
  shouldCelebrate,
}: {
  favoriteCount: number;
  onBack: () => void;
  onReviewFavorites: () => void;
  onRestartAll: () => void;
  onRestartUnknown: () => void;
  onStartNewSet: () => void;
  pendingAction: string | null;
  progress: FlashcardProgressSummary;
  shouldCelebrate: boolean;
}) {
  useDocumentScrollLock();
  const knownPercent =
    progress.totalCount > 0
      ? Math.round((progress.knownCount / progress.totalCount) * 100)
      : 0;
  const scoreOnTen = Number((knownPercent / 10).toFixed(1));
  const isPassing = scoreOnTen >= 5;
  const scoreRingColor = isPassing ? "rgb(16 185 129)" : "rgb(244 63 94)";
  const resultEncouragement = getAssessmentResultEncouragement(scoreOnTen);

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-[linear-gradient(180deg,#ede9fe_0%,#faf5ff_100%)] text-slate-950 dark:bg-none dark:bg-[var(--theme-bg)] dark:text-[var(--theme-text-strong)]">
      {shouldCelebrate ? <AssessmentResultConfetti /> : null}
      <header className="sticky top-0 z-20 border-b border-violet-100 bg-white/95 py-2 pl-1 pr-2 backdrop-blur dark:border-[var(--theme-border)] dark:bg-[color-mix(in_srgb,var(--theme-surface)_95%,transparent)] sm:pl-2 sm:pr-4">
        <div className="mx-auto flex min-h-14 max-w-2xl items-center gap-1.5">
          <button
            type="button"
            onClick={onBack}
            className="grid h-11 w-10 shrink-0 place-items-center rounded-xl text-slate-700 transition hover:bg-violet-50 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100 dark:text-[var(--theme-text)] dark:hover:bg-[var(--theme-surface-soft)]"
            aria-label="Quay lại màn Flashcard"
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
            Kết quả Flashcard
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

        <section className="mt-6 rounded-[1.7rem] border border-violet-100 bg-white p-5 shadow-[0_24px_55px_-42px_rgb(124_58_237_/_65%)] dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] sm:p-7">
          <div
            className="mx-auto grid h-40 w-40 place-items-center rounded-full p-4"
            role="progressbar"
            aria-label="Tỷ lệ Flashcard đã thuộc"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={knownPercent}
            style={{
              background: `conic-gradient(${scoreRingColor} ${knownPercent}%, rgb(226 232 240) ${knownPercent}% 100%)`,
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
                  {progress.knownCount}/{progress.totalCount}
                </p>
                <p className="mt-1 text-base font-black text-slate-500 dark:text-[var(--theme-text-muted)]">
                  {knownPercent}%
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <FlashcardProgressMetrics progress={progress} />
          </div>
        </section>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            aria-busy={pendingAction === "restart-unknown"}
            disabled={progress.unknownCount === 0 || pendingAction === "restart-unknown"}
            onClick={onRestartUnknown}
            className="student-preserve-mobile-shadow inline-flex h-14 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl border border-violet-400 bg-white px-1.5 text-sm font-black text-violet-700 shadow-[0_4px_0_rgb(221_214_254)] transition active:translate-y-[3px] active:shadow-[0_1px_0_rgb(221_214_254)] disabled:cursor-not-allowed disabled:opacity-45 dark:border-violet-400/50 dark:bg-[var(--theme-surface)] dark:text-violet-300 dark:shadow-[0_4px_0_rgb(76_29_149)] sm:px-3 sm:text-[17px]"
          >
            <RotateCcw className="h-5 w-5 shrink-0" aria-hidden="true" />
            Ôn lại thẻ chưa thuộc
          </button>
          <button
            type="button"
            aria-busy={pendingAction === "restart-all"}
            disabled={pendingAction === "restart-all"}
            onClick={onRestartAll}
            className="student-preserve-mobile-shadow inline-flex h-14 w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-violet-300/70 bg-violet-500/90 px-2 text-sm font-black text-white shadow-[0_5px_0_rgb(124_58_237),0_12px_22px_-10px_rgb(124_58_237_/_38%)] transition enabled:hover:bg-violet-400/90 active:translate-y-[3px] active:shadow-[0_2px_0_rgb(124_58_237),0_6px_12px_-10px_rgb(124_58_237_/_30%)] disabled:cursor-wait disabled:border-slate-300 disabled:bg-slate-300 disabled:opacity-60 disabled:shadow-none dark:border-violet-400/50 dark:bg-violet-600/90 dark:shadow-[0_5px_0_rgb(91_33_182),0_12px_22px_-10px_rgb(91_33_182_/_45%)] dark:disabled:border-slate-700 dark:disabled:bg-slate-700 sm:text-[17px]"
          >
            <RefreshCcw className="h-5 w-5 shrink-0" aria-hidden="true" />
            Ôn lại tất cả
          </button>
          <button
            type="button"
            aria-busy={pendingAction === "review-favorites"}
            disabled={favoriteCount === 0 || pendingAction === "review-favorites"}
            onClick={onReviewFavorites}
            className="student-preserve-mobile-shadow col-span-2 inline-flex h-14 w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-rose-400/60 bg-rose-500/90 px-3 text-sm font-black text-white shadow-[0_5px_0_rgb(225_29_72),0_12px_22px_-10px_rgb(159_18_57_/_65%)] transition enabled:hover:bg-rose-400 active:translate-y-[3px] active:shadow-[0_2px_0_rgb(225_29_72),0_6px_12px_-10px_rgb(159_18_57_/_50%)] disabled:cursor-not-allowed disabled:border-rose-200 disabled:bg-rose-100 disabled:text-rose-400 disabled:shadow-[0_4px_0_rgb(254_205_211)] dark:disabled:border-rose-400/30 dark:disabled:bg-rose-500/10 dark:disabled:text-rose-300 dark:disabled:shadow-[0_4px_0_rgb(136_19_55_/_55%)] sm:text-[17px]"
          >
            <Heart
              className={cn("h-5 w-5 shrink-0", favoriteCount > 0 && "fill-current")}
              aria-hidden="true"
            />
            Xem lại thẻ yêu thích
          </button>
          <button
            type="button"
            aria-busy={pendingAction === "start-new-set"}
            disabled={pendingAction === "start-new-set"}
            onClick={onStartNewSet}
            className="student-preserve-mobile-shadow col-span-2 inline-flex h-14 w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl border-2 border-purple-400/70 bg-purple-500/90 px-4 text-sm font-black text-white shadow-[0_4px_0_rgb(147_51_234)] transition enabled:hover:border-purple-600 enabled:hover:bg-purple-600/90 active:translate-y-[3px] active:shadow-[0_1px_0_rgb(147_51_234)] disabled:cursor-wait disabled:opacity-60 dark:border-purple-500/60 dark:bg-purple-600/90 dark:text-white dark:shadow-[0_4px_0_rgb(126_34_206)] dark:enabled:hover:border-purple-500 dark:enabled:hover:bg-purple-500/90 sm:text-[17px]"
          >
            <Sparkles className="h-5 w-5 shrink-0" aria-hidden="true" />
            Học bộ Flashcard mới
          </button>
        </div>
      </main>
    </div>
  );
}
