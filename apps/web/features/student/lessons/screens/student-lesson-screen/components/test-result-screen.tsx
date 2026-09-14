"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  ListChecks,
  Loader2,
  Medal,
  RefreshCcw,
  SearchX,
  Trophy,
  XCircle,
} from "lucide-react";
import { ClassHeroLogo } from "@/components/common/brand/classhero-logo";
import { StudentAiChatHeaderTrigger } from "@/features/student/ai-chat/components/student-ai-chat-header-trigger";
import type { AiChatEntryContext } from "@/features/student/ai-chat/utils/ai-chat-link";
import { useDocumentScrollLock } from "@/features/student/lessons/hooks/use-document-scroll-lock";
import { AssessmentResultConfetti } from "@/features/student/lessons/screens/student-lesson-screen/components/assessment-result-confetti";
import type { StudentTestResult } from "@/features/student/lessons/types/student-lesson-types";
import { getTestResultComment } from "@/features/student/lessons/utils/assessment-result-encouragement";
import { formatDuration } from "@/features/student/lessons/utils/student-answer-utils";
import { cn } from "@/lib/utils";

export function TestResultScreen({
  aiChatContext,
  bestScore,
  onBack,
  onNextLesson,
  onReviewAll,
  onReviewIncorrect,
  onStartNewTest,
  pendingAction,
  result,
  shouldCelebrate,
}: {
  aiChatContext?: AiChatEntryContext;
  bestScore?: number | null;
  onBack: () => void;
  onReviewAll: () => void;
  onReviewIncorrect: () => void;
  onStartNewTest: () => void;
  onNextLesson?: () => void;
  pendingAction: string | null;
  result: StudentTestResult;
  shouldCelebrate: boolean;
}) {
  useDocumentScrollLock();

  const accuracy = Math.round(
    (result.correctCount / Math.max(result.totalCount, 1)) * 100,
  );
  const resultComment = getTestResultComment(result.score);
  const ResultCommentIcon =
    result.score >= 9 ? Trophy : result.score >= 7 ? Medal : XCircle;
  const scoreRingColor = result.passed ? "rgb(16 185 129)" : "rgb(244 63 94)";

  const actions: Array<{
    disabled: boolean;
    fullWidth: boolean;
    icon: typeof SearchX;
    label: string;
    onClick: () => void;
    pending: boolean;
    variant: "primary" | "teal" | "secondary";
  }> = [
    {
      disabled: result.wrongCount === 0,
      fullWidth: false,
      icon: SearchX,
      label: "Xem lại câu sai",
      onClick: onReviewIncorrect,
      pending: pendingAction === "review-INCORRECT",
      variant: "secondary",
    },
    {
      disabled: false,
      fullWidth: false,
      icon: ListChecks,
      label: "Xem lại tất cả",
      onClick: onReviewAll,
      pending: pendingAction === "review-ALL",
      variant: "secondary",
    },
  ];

  const isAllTimePassed =
    result.passed || (typeof bestScore === "number" && bestScore >= 7);

  const metrics = [
    {
      className: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
      label: "Câu sai",
      value: result.wrongCount,
    },
    {
      className:
        "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
      label: "Câu đúng",
      value: result.correctCount,
    },
    {
      className: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200",
      label: "Điểm",
      value: Number(result.score.toFixed(2)),
    },
  ];

  return (
    <div
      data-testid="test-result-screen"
      className="fixed inset-0 z-[80] overflow-y-auto bg-[linear-gradient(180deg,#def8e9_0%,#eefbf5_100%)] text-slate-950 dark:bg-none dark:bg-[var(--theme-bg)] dark:text-[var(--theme-text-strong)]"
    >
      {shouldCelebrate ? <AssessmentResultConfetti /> : null}
      <header className="sticky top-0 z-20 border-b border-emerald-100 bg-white/95 py-2 pl-1 pr-2 backdrop-blur dark:border-[var(--theme-border)] dark:bg-[color-mix(in_srgb,var(--theme-surface)_95%,transparent)] sm:pl-2 sm:pr-4">
        <div className="mx-auto flex min-h-14 max-w-2xl items-center gap-1.5">
          <button
            type="button"
            onClick={onBack}
            className="grid h-11 w-10 shrink-0 place-items-center rounded-xl text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 dark:text-[var(--theme-text)] dark:hover:bg-[var(--theme-surface-soft)]"
            aria-label="Quay lại màn Bài thi"
          >
            <ChevronLeft className="h-8 w-8" strokeWidth={2.8} aria-hidden="true" />
          </button>
          <ClassHeroLogo className="h-10 max-w-[9rem]" priority />
          {aiChatContext ? (
            <StudentAiChatHeaderTrigger
              context={aiChatContext}
              testId="student-ai-chat-trigger-test-result"
            />
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-6 pb-10 sm:px-6 sm:py-8">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400 bg-emerald-500 px-4 py-2 text-sm font-black text-white shadow-[0_4px_0_rgb(4_120_87)] dark:border-emerald-300/60 dark:bg-emerald-600 dark:text-white">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            Đã hoàn thành
          </span>
          <h1 className="mt-4 text-3xl font-black text-slate-950 dark:text-[var(--theme-text-strong)]">
            Kết quả Bài thi
          </h1>
          <p
            className={cn(
              "mx-auto mt-2 flex w-fit items-center justify-center gap-1.5 text-lg font-black leading-6",
              resultComment.className,
            )}
          >
            <ResultCommentIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
            {resultComment.message}
          </p>
        </div>

        <section className="mt-6 rounded-[1.7rem] border border-emerald-100 bg-white p-5 shadow-[0_24px_55px_-42px_rgb(16_185_129_/_65%)] dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] sm:p-7">
          <div
            className="mx-auto grid h-40 w-40 place-items-center rounded-full p-4"
            role="progressbar"
            aria-label="Tỷ lệ trả lời đúng bài thi"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={accuracy}
            style={{
              background: `conic-gradient(${scoreRingColor} ${accuracy}%, rgb(226 232 240) ${accuracy}% 100%)`,
            }}
          >
            <div className="grid h-full w-full place-items-center rounded-full bg-white text-center dark:bg-[var(--theme-surface)]">
              <div>
                <p
                  className={cn(
                    "text-4xl font-black",
                    result.passed
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
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className={cn("rounded-2xl px-2 py-4", metric.className)}
              >
                <p className="text-xl font-black sm:text-2xl">{metric.value}</p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-wide sm:text-xs">
                  {metric.label}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <p className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              <Clock3 className="h-5 w-5 shrink-0" aria-hidden="true" />
              Thời gian: {formatDuration(result.durationSeconds)}
            </p>
            <p className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-black text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              <Trophy
                className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
                aria-hidden="true"
              />
              Điểm cao nhất:{" "}
              {Number(
                (bestScore != null
                  ? Math.max(bestScore, result.score)
                  : result.score
                ).toFixed(2),
              )}
            </p>
          </div>
        </section>

        {!result.passed ? (
          <div
            role="alert"
            className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-400 bg-emerald-200/80 p-4 text-sm font-bold text-emerald-800 shadow-[0_8px_20px_-16px_rgb(5_150_105_/_65%)] dark:border-emerald-400/50 dark:bg-emerald-500/25 dark:text-emerald-100"
          >
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p>Bạn cần phải làm lại bài thi mới.</p>
              <p className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-200">
                Điểm tối thiểu để đỗ bài thi là 7 điểm.
              </p>
            </div>
          </div>
        ) : null}

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
                  "student-preserve-mobile-shadow inline-flex h-14 w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-2 text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-45 dark:focus-visible:ring-emerald-500/30 sm:px-3 sm:text-[17px]",
                  action.variant === "primary" &&
                    "bg-emerald-500 text-white shadow-[0_4px_0_rgb(4_120_87)] active:translate-y-[3px] active:shadow-[0_1px_0_rgb(4_120_87)] enabled:hover:bg-emerald-400",
                  action.variant === "teal" &&
                    "bg-teal-600 text-white shadow-[0_4px_0_rgb(15_118_110)] active:translate-y-[3px] active:shadow-[0_1px_0_rgb(15_118_110)] enabled:hover:bg-teal-500 dark:bg-teal-700 dark:shadow-[0_4px_0_rgb(13_94_88)] dark:enabled:hover:bg-teal-600",
                  action.variant === "secondary" &&
                    "student-mobile-border border border-emerald-200 bg-white text-emerald-700 shadow-[0_4px_0_rgb(167_243_208)] active:translate-y-[3px] active:shadow-[0_1px_0_rgb(167_243_208)] enabled:hover:bg-emerald-50 dark:border-emerald-400/30 dark:bg-[var(--theme-surface)] dark:text-emerald-300 dark:shadow-[0_4px_0_rgb(6_78_59)] dark:active:shadow-[0_1px_0_rgb(6_78_59)] dark:enabled:hover:bg-emerald-500/10",
                  action.fullWidth && "col-span-2",
                )}
              >
                {action.pending ? (
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
            onClick={onStartNewTest}
            className="student-preserve-mobile-shadow col-span-2 inline-flex h-14 w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-emerald-500 px-2 text-sm font-black text-white shadow-[0_4px_0_rgb(4_120_87)] transition active:translate-y-[3px] active:shadow-[0_1px_0_rgb(4_120_87)] enabled:hover:bg-emerald-400 sm:px-3 sm:text-[17px]"
          >
            <RefreshCcw className="h-5 w-5 shrink-0" aria-hidden="true" />
            Làm lại bài thi mới
          </button>
          <button
            type="button"
            onClick={onBack}
            aria-label="Quay về bài học"
            className={cn(
              "student-preserve-mobile-shadow student-mobile-border inline-flex h-14 items-center justify-center justify-self-center gap-1.5 whitespace-nowrap rounded-xl border border-emerald-200 bg-white px-4 text-sm font-black text-emerald-700 shadow-[0_3px_0_rgb(167_243_208)] transition hover:bg-emerald-50 hover:text-emerald-700 active:translate-y-[2px] active:shadow-[0_1px_0_rgb(167_243_208)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 dark:border-emerald-400/30 dark:bg-[var(--theme-surface)] dark:text-emerald-300 dark:shadow-[0_3px_0_rgb(6_78_59)] dark:hover:bg-[var(--theme-surface-soft)] dark:hover:text-emerald-300 dark:active:shadow-[0_1px_0_rgb(6_78_59)] dark:focus-visible:ring-emerald-500/30",
              isAllTimePassed && onNextLesson ? "w-full" : "col-span-2 w-1/2",
            )}
          >
            <ChevronLeft
              className="h-5 w-5 shrink-0"
              strokeWidth={2.8}
              aria-hidden="true"
            />
            Trở về
          </button>
          {isAllTimePassed && onNextLesson ? (
            <button
              type="button"
              onClick={onNextLesson}
              className="student-preserve-mobile-shadow inline-flex h-14 w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-teal-600 px-2 text-sm font-black text-white shadow-[0_4px_0_rgb(15_118_110)] transition active:translate-y-[3px] active:shadow-[0_1px_0_rgb(15_118_110)] enabled:hover:bg-teal-500 dark:bg-teal-700 dark:shadow-[0_4px_0_rgb(13_94_88)] dark:enabled:hover:bg-teal-600 sm:px-3 sm:text-[17px]"
            >
              <ArrowRight className="h-5 w-5 shrink-0" aria-hidden="true" />
              Bài học kế tiếp
            </button>
          ) : null}
        </div>
      </main>
    </div>
  );
}
