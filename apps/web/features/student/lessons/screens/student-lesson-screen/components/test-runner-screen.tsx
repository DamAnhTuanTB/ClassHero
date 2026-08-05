"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Loader2,
  TriangleAlert,
} from "lucide-react";
import { ClassHeroLogo } from "@/components/common/brand/classhero-logo";
import { useDocumentScrollLock } from "@/features/student/lessons/hooks/use-document-scroll-lock";
import { AssessmentQuestionCard } from "@/features/student/lessons/screens/student-lesson-screen/components/assessment-question-card";
import { QuizExitConfirmDialog } from "@/features/student/lessons/screens/student-lesson-screen/components/quiz-exit-confirm-dialog";
import { TestSubmitConfirmDialog } from "@/features/student/lessons/screens/student-lesson-screen/components/test-submit-confirm-dialog";
import type {
  StudentAnswer,
  StudentTestAttempt,
} from "@/features/student/lessons/types/student-lesson-types";
import { getAssessmentQuestionInstruction } from "@/features/student/lessons/utils/assessment-question-utils";
import { formatDuration } from "@/features/student/lessons/utils/student-answer-utils";
import { pushTestRunnerHistoryEntry } from "@/features/student/lessons/utils/test-runner-history";
import { cn } from "@/lib/utils";

export function TestRunnerScreen({
  answer,
  answeredQuestionIds,
  attempt,
  currentIndex,
  onAnswerChange,
  onBack,
  onNext,
  onPrevious,
  onQuestionSelect,
  onSubmit,
  pendingAction,
  remainingSeconds,
}: {
  answer: StudentAnswer | undefined;
  answeredQuestionIds: ReadonlyArray<string>;
  attempt: StudentTestAttempt;
  currentIndex: number;
  onAnswerChange: (answer: StudentAnswer) => void;
  onBack: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onQuestionSelect: (index: number) => void;
  onSubmit: () => Promise<boolean>;
  pendingAction: string | null;
  remainingSeconds: number;
}) {
  useDocumentScrollLock();

  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);
  const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = useState(false);
  const [showIncompleteAlert, setShowIncompleteAlert] = useState(false);
  const isConfirmedHistoryExitRef = useRef(false);
  const isRunnerHistoryEntryActiveRef = useRef(false);
  const isSilentHistoryExitRef = useRef(false);
  const onBackRef = useRef(onBack);

  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "Bài thi hiện tại sẽ bị hủy và bạn phải làm một bài thi mới.";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useLayoutEffect(() => {
    pushTestRunnerHistoryEntry(attempt.id, attempt.testSet.id);
    isRunnerHistoryEntryActiveRef.current = true;

    function handlePopState() {
      isRunnerHistoryEntryActiveRef.current = false;

      if (isSilentHistoryExitRef.current) {
        isSilentHistoryExitRef.current = false;
        return;
      }

      if (isConfirmedHistoryExitRef.current) {
        isConfirmedHistoryExitRef.current = false;
        onBackRef.current();
        return;
      }

      setIsExitDialogOpen(true);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [attempt.id, attempt.testSet.id]);

  const question = attempt.questions[currentIndex];

  if (!question) return null;

  const totalCount = attempt.questions.length;
  const questionNumber = question.questionNumber ?? currentIndex + 1;
  const answeredQuestionIdSet = new Set(answeredQuestionIds);
  const incompleteQuestionNumbers = attempt.questions.flatMap((item, index) =>
    answeredQuestionIdSet.has(item.id) ? [] : [item.questionNumber ?? index + 1],
  );
  const progressPercent = ((currentIndex + 1) / Math.max(totalCount, 1)) * 100;
  const isPending = Boolean(pendingAction);

  function dismissIncompleteAlert() {
    setShowIncompleteAlert(false);
  }

  function handleAnswerChange(nextAnswer: StudentAnswer) {
    dismissIncompleteAlert();
    onAnswerChange(nextAnswer);
  }

  function handleQuestionSelect(index: number) {
    dismissIncompleteAlert();
    onQuestionSelect(index);
  }

  function handleSubmit() {
    dismissIncompleteAlert();
    setIsSubmitConfirmOpen(true);
  }

  async function handleConfirmSubmit() {
    setIsSubmitConfirmOpen(false);
    const didSubmit = await onSubmit();
    if (didSubmit && isRunnerHistoryEntryActiveRef.current) {
      isSilentHistoryExitRef.current = true;
      window.history.back();
    }
  }

  function handleConfirmExit() {
    setIsExitDialogOpen(false);

    if (isRunnerHistoryEntryActiveRef.current) {
      isConfirmedHistoryExitRef.current = true;
      window.history.back();
      return;
    }

    onBackRef.current();
  }

  function handleCancelExit() {
    if (!isRunnerHistoryEntryActiveRef.current) {
      pushTestRunnerHistoryEntry(attempt.id, attempt.testSet.id);
      isRunnerHistoryEntryActiveRef.current = true;
    }

    setIsExitDialogOpen(false);
  }

  return (
    <div
      data-testid="test-runner-screen"
      className="fixed inset-0 z-[80] overflow-y-auto bg-[linear-gradient(180deg,#def8e9_0%,#eefbf5_100%)] text-slate-950 dark:bg-none dark:bg-[var(--theme-bg)] dark:text-[var(--theme-text-strong)]"
    >
      <header className="sticky top-0 z-20 border-b border-emerald-100 bg-white/95 py-2 pl-1 pr-2 backdrop-blur dark:border-[var(--theme-border)] dark:bg-[color-mix(in_srgb,var(--theme-surface)_95%,transparent)] sm:pl-2 sm:pr-4">
        <div className="mx-auto flex min-h-14 max-w-2xl items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsExitDialogOpen(true)}
            className="grid h-11 w-10 shrink-0 place-items-center rounded-xl text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 dark:text-[var(--theme-text)] dark:hover:bg-[var(--theme-surface-soft)]"
            aria-label="Quay lại màn Bài thi"
          >
            <ChevronLeft className="h-8 w-8" strokeWidth={2.8} aria-hidden="true" />
          </button>
          <ClassHeroLogo className="h-10 max-w-[9rem]" priority />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-5 pb-10 sm:px-6 sm:py-7">
        <section aria-labelledby="test-question-title">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base font-black leading-tight text-emerald-600 dark:text-emerald-300 lg:text-lg">
                Bài thi · {totalCount} câu
              </p>
              <h1
                id="test-question-title"
                className="mt-1 text-2xl font-black leading-tight text-slate-950 dark:text-[var(--theme-text-strong)] sm:text-3xl"
              >
                Câu {questionNumber}
              </h1>
            </div>
            <span
              role="timer"
              aria-label={`Thời gian còn lại ${formatDuration(remainingSeconds)}`}
              className={cn(
                "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-2xl border px-3 py-2 text-sm font-black shadow-sm",
                remainingSeconds <= 60
                  ? "border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/15 dark:text-rose-300"
                  : "border-emerald-300 bg-emerald-200 text-emerald-800 shadow-[0_4px_0_rgb(110_231_183)] dark:border-emerald-400/40 dark:bg-emerald-500/25 dark:text-emerald-200 dark:shadow-[0_4px_0_rgb(6_78_59)]",
              )}
            >
              <Clock3 className="h-4 w-4" aria-hidden="true" />
              {formatDuration(remainingSeconds)}
            </span>
          </div>

          <div
            className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-[var(--theme-surface-muted)]"
            role="progressbar"
            aria-label="Tiến độ làm bài thi"
            aria-valuemin={0}
            aria-valuemax={totalCount}
            aria-valuenow={currentIndex + 1}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </section>

        <section className="mt-5 rounded-[1.6rem] border border-emerald-100 bg-white p-3 shadow-[0_24px_55px_-42px_rgb(16_185_129_/_60%)] dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] sm:p-4">
          <div className="mb-3 flex min-w-0 items-center gap-2.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-sm font-black text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              {String(questionNumber).padStart(2, "0")}
            </span>
            <h2 className="truncate text-base font-black text-emerald-700 dark:text-emerald-300 sm:text-lg">
              {getAssessmentQuestionInstruction(question.questionType)}
            </h2>
          </div>

          <AssessmentQuestionCard
            accent="test"
            question={question}
            answer={answer}
            onChange={handleAnswerChange}
          />
        </section>

        <section className="mt-5 rounded-[1.5rem] border border-emerald-100 bg-white p-4 shadow-[0_20px_50px_-42px_rgb(16_185_129_/_60%)] dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black text-slate-950 dark:text-[var(--theme-text-strong)]">
              Danh sách câu
            </h2>
            <span className="text-sm font-black text-emerald-600 dark:text-emerald-300">
              {answeredQuestionIds.length}/{totalCount} đã làm
            </span>
          </div>

          <nav
            className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-8"
            aria-label="Danh sách câu hỏi bài thi"
          >
            {attempt.questions.map((item, index) => {
              const itemQuestionNumber = item.questionNumber ?? index + 1;
              const isCurrent = index === currentIndex;
              const isAnswered = answeredQuestionIdSet.has(item.id);

              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={isPending}
                  onClick={() => handleQuestionSelect(index)}
                  aria-label={`Câu ${itemQuestionNumber}: ${
                    isAnswered ? "đã làm" : "chưa làm"
                  }`}
                  aria-current={isCurrent ? "step" : undefined}
                  className={cn(
                    "student-preserve-mobile-shadow inline-flex min-h-12 items-center justify-center rounded-xl text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 disabled:opacity-70 dark:focus-visible:ring-emerald-500/30",
                    isCurrent
                      ? "bg-emerald-500 text-white shadow-[0_4px_0_rgb(4_120_87)]"
                      : isAnswered
                        ? "bg-emerald-100 text-emerald-700 shadow-[0_3px_0_rgb(167_243_208)] dark:bg-emerald-500/15 dark:text-emerald-300 dark:shadow-[0_3px_0_rgb(6_78_59)]"
                        : "bg-slate-100 text-slate-500 shadow-[0_3px_0_rgb(203_213_225)] dark:bg-[var(--theme-surface-muted)] dark:text-[var(--theme-text-muted)] dark:shadow-[0_3px_0_rgb(30_41_59)]",
                  )}
                >
                  {itemQuestionNumber}
                </button>
              );
            })}
          </nav>
        </section>

        {showIncompleteAlert ? (
          <div
            role="alert"
            className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-400 bg-emerald-200/80 px-3 py-4 text-sm font-bold leading-5 text-emerald-800 shadow-[0_8px_20px_-16px_rgb(5_150_105_/_65%)] dark:border-emerald-400/50 dark:bg-emerald-500/25 dark:text-emerald-100"
          >
            <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              Cần hoàn thành{" "}
              {incompleteQuestionNumbers.length === 1 ? "câu hỏi" : "các câu hỏi"}{" "}
              {incompleteQuestionNumbers.join(", ")} trước khi nộp bài.
            </p>
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={currentIndex === 0 || isPending}
            onClick={() => {
              dismissIncompleteAlert();
              onPrevious();
            }}
            className="student-preserve-mobile-shadow inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-emerald-200 bg-white px-3 text-base font-black text-emerald-700 shadow-[0_4px_0_rgb(167_243_208)] transition hover:bg-emerald-50 active:translate-y-[3px] active:shadow-[0_1px_0_rgb(167_243_208)] disabled:cursor-not-allowed disabled:opacity-40 dark:border-emerald-400/30 dark:bg-[var(--theme-surface)] dark:text-emerald-300 dark:shadow-[0_4px_0_rgb(6_78_59)] dark:active:shadow-[0_1px_0_rgb(6_78_59)]"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            Câu trước
          </button>
          <button
            type="button"
            disabled={currentIndex >= totalCount - 1 || isPending}
            onClick={() => {
              dismissIncompleteAlert();
              onNext();
            }}
            className="student-preserve-mobile-shadow inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-emerald-600 px-3 text-base font-black text-white shadow-[0_4px_0_rgb(4_120_87)] transition hover:bg-emerald-500 active:translate-y-[3px] active:shadow-[0_1px_0_rgb(4_120_87)] disabled:cursor-not-allowed disabled:bg-emerald-200 disabled:text-emerald-500 disabled:shadow-none dark:disabled:bg-emerald-950/50 dark:disabled:text-emerald-500"
          >
            Câu tiếp
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <button
          type="button"
          disabled={isPending}
          onClick={() => void handleSubmit()}
          className="student-preserve-mobile-shadow mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2.5 whitespace-nowrap rounded-2xl bg-emerald-500 px-4 text-lg font-black text-white shadow-[0_5px_0_rgb(4_120_87)] transition hover:bg-emerald-400 active:translate-y-[4px] active:shadow-[0_1px_0_rgb(4_120_87)] disabled:opacity-60"
        >
          {pendingAction === "submit" ? (
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
          )}
          Nộp bài thi
        </button>
      </main>

      <QuizExitConfirmDialog
        accent="test"
        activityLabel="bài thi"
        description="Nếu quay lại, bài thi hiện tại sẽ bị hủy và bạn phải làm một bài thi mới."
        isOpen={isExitDialogOpen}
        onCancel={handleCancelExit}
        onConfirm={handleConfirmExit}
      />

      <TestSubmitConfirmDialog
        incompleteQuestionNumbers={incompleteQuestionNumbers}
        isPending={pendingAction === "submit"}
        isOpen={isSubmitConfirmOpen}
        onCancel={() => setIsSubmitConfirmOpen(false)}
        onConfirm={() => void handleConfirmSubmit()}
      />
    </div>
  );
}
