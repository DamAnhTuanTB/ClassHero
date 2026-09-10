"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Lightbulb,
  Loader2,
  SkipForward,
  TriangleAlert,
} from "lucide-react";
import { ClassHeroLogo } from "@/components/common/brand/classhero-logo";
import { TiptapContentView } from "@/components/common/content/tiptap-content-view";
import { useDocumentScrollLock } from "@/features/student/lessons/hooks/use-document-scroll-lock";
import { AssessmentQuestionCard } from "@/features/student/lessons/screens/student-lesson-screen/components/assessment-question-card";
import { AssessmentExplanationPanel } from "@/features/student/lessons/screens/student-lesson-screen/components/assessment-explanation-panel";
import { QuizExitConfirmDialog } from "@/features/student/lessons/screens/student-lesson-screen/components/quiz-exit-confirm-dialog";
import type {
  CheckedAnswer,
  QuizAttempt,
  StudentAnswer,
} from "@/features/student/lessons/types/student-lesson-types";
import {
  popQuizRunnerHistoryEntryPreservingResult,
  pushQuizRunnerHistoryEntry,
} from "@/features/student/lessons/utils/quiz-runner-history";
import { getAssessmentQuestionInstruction } from "@/features/student/lessons/utils/assessment-question-utils";
import { isStudentAnswerComplete } from "@/features/student/lessons/utils/student-answer-utils";
import { cn } from "@/lib/utils";

export function QuizRunnerLoadingScreen() {
  useDocumentScrollLock();

  return (
    <div
      className="fixed inset-0 z-[80] overflow-hidden bg-[linear-gradient(180deg,#e0f2fe_0%,#f0f9ff_100%)] text-slate-950 dark:bg-none dark:bg-[var(--theme-bg)] dark:text-[var(--theme-text-strong)]"
      aria-busy="true"
      aria-label="Đang mở lại lượt Quiz"
    >
      <header className="border-b border-sky-100 bg-white/95 py-2 pl-1 pr-2 dark:border-[var(--theme-border)] dark:bg-[color-mix(in_srgb,var(--theme-surface)_95%,transparent)] sm:pl-2 sm:pr-4">
        <div className="mx-auto flex min-h-14 max-w-2xl items-center gap-1.5">
          <span
            className="grid h-11 w-10 shrink-0 place-items-center rounded-xl text-slate-300 dark:text-slate-600"
            aria-hidden="true"
          >
            <ChevronLeft className="h-8 w-8" strokeWidth={2.8} />
          </span>
          <ClassHeroLogo className="h-10 max-w-[9rem]" priority />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl animate-pulse px-4 py-5 pb-10 motion-reduce:animate-none sm:px-6 sm:py-7">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="h-3 w-32 rounded-full bg-[var(--theme-skeleton)]" />
            <div className="mt-3 h-8 w-44 rounded-xl bg-[var(--theme-skeleton)]" />
          </div>
          <div className="h-9 w-24 rounded-2xl bg-[var(--theme-skeleton)]" />
        </div>

        <div className="mt-4 h-3 overflow-hidden rounded-full bg-[var(--theme-skeleton-soft)]">
          <div className="h-full w-1/4 rounded-full bg-[var(--theme-skeleton-strong)]" />
        </div>

        <div className="mt-5 rounded-[1.6rem] bg-white p-4 shadow-[0_24px_55px_-42px_rgb(15_23_42_/_16%)] dark:bg-[var(--theme-surface)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-3">
              <div className="h-11 w-11 shrink-0 rounded-2xl bg-[var(--theme-skeleton)]" />
              <div className="h-5 w-36 rounded-lg bg-[var(--theme-skeleton)]" />
            </div>
            <div className="h-8 w-14 rounded-xl bg-[var(--theme-skeleton)]" />
          </div>

          <div className="mt-8 h-6 w-2/3 rounded-lg bg-[var(--theme-skeleton)]" />
          <div className="mt-7 space-y-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="h-16 rounded-2xl bg-[var(--theme-skeleton-soft)]"
              />
            ))}
          </div>
        </div>

        <div className="mt-5 flex justify-center gap-2">
          <div className="h-3 w-8 rounded-full bg-[var(--theme-skeleton-strong)]" />
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className="h-3 w-3 rounded-full bg-[var(--theme-skeleton)]"
            />
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="h-12 rounded-2xl bg-[var(--theme-skeleton-soft)]" />
          <div className="h-12 rounded-2xl bg-[var(--theme-skeleton)]" />
        </div>
      </main>
    </div>
  );
}

export function QuizRunnerScreen({
  answer,
  answeredQuestionIds,
  attempt,
  currentIndex,
  feedback,
  feedbackByQuestionId,
  handledQuestionIds,
  isExplanationOpen,
  isHintOpen,
  lessonTitle,
  onAnswerChange,
  onBack,
  onCheck,
  onNext,
  onPrevious,
  onQuestionSelect,
  onSkip,
  onSubmit,
  onToggleExplanation,
  onToggleHint,
  pendingAction,
}: {
  answer: StudentAnswer | undefined;
  answeredQuestionIds: ReadonlyArray<string>;
  attempt: QuizAttempt;
  currentIndex: number;
  feedback: CheckedAnswer | undefined;
  feedbackByQuestionId: Readonly<Record<string, CheckedAnswer>>;
  handledQuestionIds: ReadonlyArray<string>;
  isExplanationOpen: boolean;
  isHintOpen: boolean;
  lessonTitle: string;
  onAnswerChange: (answer: StudentAnswer) => void;
  onBack: () => void;
  onCheck: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onQuestionSelect: (index: number) => void;
  onSkip: () => void;
  onSubmit: () => Promise<boolean>;
  onToggleExplanation: () => void;
  onToggleHint: () => void;
  pendingAction: string | null;
}) {
  useDocumentScrollLock();

  const [incompleteAlertAttemptId, setIncompleteAlertAttemptId] = useState<string | null>(
    null,
  );
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);
  const isConfirmedHistoryExitRef = useRef(false);
  const isRunnerHistoryEntryActiveRef = useRef(false);
  const isSilentHistoryExitRef = useRef(false);
  const onBackRef = useRef(onBack);

  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  useLayoutEffect(() => {
    pushQuizRunnerHistoryEntry(attempt.id, attempt.quizSet.id);
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
  }, [attempt.id, attempt.quizSet.id]);

  const question = attempt.questions[currentIndex];
  const totalCount = attempt.questions.length;
  const questionNumber = question?.questionNumber ?? currentIndex + 1;
  const isLast = currentIndex === totalCount - 1;
  const isAnswerComplete = question
    ? isStudentAnswerComplete(question, answer)
    : false;
  const progressPercent = ((currentIndex + 1) / Math.max(totalCount, 1)) * 100;
  const answeredQuestionIdSet = new Set(answeredQuestionIds);
  const handledQuestionIdSet = new Set(handledQuestionIds);
  const incompleteQuestionNumbers = attempt.questions.flatMap((item, index) =>
    handledQuestionIdSet.has(item.id) ? [] : [item.questionNumber ?? index + 1],
  );
  const isIncompleteAlertVisible =
    incompleteAlertAttemptId === attempt.id && incompleteQuestionNumbers.length > 0;
  const keyboardShortcutStateRef = useRef({
    currentIndex,
    hasFeedback: Boolean(feedback),
    isAnswerComplete,
    isExitDialogOpen,
    isPending: Boolean(pendingAction),
    onCheck,
    onNext,
    onPrevious,
    totalCount,
  });
  keyboardShortcutStateRef.current = {
    currentIndex,
    hasFeedback: Boolean(feedback),
    isAnswerComplete,
    isExitDialogOpen,
    isPending: Boolean(pendingAction),
    onCheck,
    onNext,
    onPrevious,
    totalCount,
  };

  function dismissIncompleteAlert() {
    setIncompleteAlertAttemptId(null);
  }

  function handleOpenExitDialog() {
    dismissIncompleteAlert();
    setIsExitDialogOpen(true);
  }

  function handleAnswerChange(nextAnswer: StudentAnswer) {
    dismissIncompleteAlert();
    onAnswerChange(nextAnswer);
  }

  function handleCheck() {
    dismissIncompleteAlert();
    onCheck();
  }

  function handleNext() {
    dismissIncompleteAlert();
    onNext();
  }

  function handleToggleHint() {
    dismissIncompleteAlert();
    onToggleHint();
  }

  function handleSkip() {
    dismissIncompleteAlert();
    onSkip();
  }

  function handleToggleExplanation() {
    dismissIncompleteAlert();
    onToggleExplanation();
  }

  async function handleSubmit() {
    if (incompleteQuestionNumbers.length > 0) {
      setIncompleteAlertAttemptId(attempt.id);
      return;
    }

    dismissIncompleteAlert();
    const didSubmit = await onSubmit();
    if (didSubmit && isRunnerHistoryEntryActiveRef.current) {
      isSilentHistoryExitRef.current = true;
      popQuizRunnerHistoryEntryPreservingResult();
    }
  }

  function handlePrevious() {
    dismissIncompleteAlert();
    onPrevious();
  }

  function handleQuestionSelect(index: number) {
    dismissIncompleteAlert();
    onQuestionSelect(index);
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
      pushQuizRunnerHistoryEntry(attempt.id, attempt.quizSet.id);
      isRunnerHistoryEntryActiveRef.current = true;
    }

    setIsExitDialogOpen(false);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const shortcutState = keyboardShortcutStateRef.current;

      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        shortcutState.isExitDialogOpen ||
        shortcutState.isPending
      ) {
        return;
      }

      if (event.key === "Enter") {
        if (shortcutState.hasFeedback || !shortcutState.isAnswerComplete) return;

        event.preventDefault();
        setIncompleteAlertAttemptId(null);
        shortcutState.onCheck();
        return;
      }

      if (isQuizAnswerEditingTarget(event.target)) return;

      if (event.key === "ArrowLeft" && shortcutState.currentIndex > 0) {
        event.preventDefault();
        setIncompleteAlertAttemptId(null);
        shortcutState.onPrevious();
        return;
      }

      if (
        event.key === "ArrowRight" &&
        shortcutState.currentIndex < shortcutState.totalCount - 1
      ) {
        event.preventDefault();
        setIncompleteAlertAttemptId(null);
        shortcutState.onNext();
      }
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  if (!question) return null;

  return (
    <div
      className="fixed inset-0 z-[80] overflow-y-auto bg-[linear-gradient(180deg,#e0f2fe_0%,#f0f9ff_100%)] text-slate-950 dark:bg-none dark:bg-[var(--theme-bg)] dark:text-[var(--theme-text-strong)]"
      data-testid="quiz-runner-screen"
    >
      <header className="sticky top-0 z-20 border-b border-sky-100 bg-white/95 py-2 pl-1 pr-2 backdrop-blur dark:border-[var(--theme-border)] dark:bg-[color-mix(in_srgb,var(--theme-surface)_95%,transparent)] sm:pl-2 sm:pr-4">
        <div className="mx-auto flex min-h-14 max-w-2xl items-center gap-1.5">
          <button
            type="button"
            onClick={handleOpenExitDialog}
            className="grid h-11 w-10 shrink-0 place-items-center rounded-xl text-slate-700 transition hover:bg-sky-50 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100 dark:text-[var(--theme-text)] dark:hover:bg-[var(--theme-surface-soft)]"
            aria-label="Quay lại màn Quiz"
          >
            <ChevronLeft className="h-8 w-8" strokeWidth={2.8} aria-hidden="true" />
          </button>
          <ClassHeroLogo className="h-10 max-w-[9rem]" priority />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-5 pb-10 sm:px-6 sm:py-7">
        <section aria-labelledby="quiz-question-title">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base font-black leading-tight text-sky-600 dark:text-sky-300 lg:text-lg">
                {lessonTitle}
              </p>
              <h1
                id="quiz-question-title"
                className="mt-1 text-2xl font-black leading-tight text-slate-950 dark:text-[var(--theme-text-strong)]"
              >
                Câu hỏi {questionNumber}
              </h1>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="student-preserve-mobile-shadow rounded-2xl border border-blue-300 bg-blue-200 px-3 py-2 text-xs font-black text-blue-800 shadow-[0_3px_0_rgb(147_197_253)] dark:border-blue-300/30 dark:bg-blue-500/20 dark:text-blue-200 dark:shadow-[0_3px_0_rgb(30_58_138)]">
                Đã làm {answeredQuestionIds.length}
              </span>
              <span className="student-preserve-mobile-shadow rounded-2xl border border-sky-300 bg-sky-200 px-3 py-2 text-xs font-black text-sky-800 shadow-[0_3px_0_rgb(125_211_252)] dark:border-sky-400/30 dark:bg-sky-500/25 dark:text-sky-200 dark:shadow-[0_3px_0_rgb(12_74_110)]">
                {totalCount} câu
              </span>
            </div>
          </div>

          <div
            className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-[var(--theme-surface-muted)] sm:mt-4"
            role="progressbar"
            aria-label="Tiến độ làm Quiz"
            aria-valuemin={0}
            aria-valuemax={totalCount}
            aria-valuenow={currentIndex + 1}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </section>

        <div className="mt-4 rounded-[1.25rem] border border-sky-100 bg-white px-2 py-2.5 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] sm:py-3">
          <div className="mb-0 flex items-center px-0.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-100 text-sm font-black text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                {String(questionNumber).padStart(2, "0")}
              </span>
              <h2 className="truncate text-base font-black text-sky-700 dark:text-sky-300 sm:text-lg">
                {getAssessmentQuestionInstruction(question.questionType)}
              </h2>
            </div>
          </div>

          <AssessmentQuestionCard
            question={question}
            answer={answer}
            feedback={feedback}
            onChange={handleAnswerChange}
          />

          {!feedback && isAnswerComplete ? (
            <div className="mt-2 flex justify-end md:justify-center">
              <button
                type="button"
                aria-label="Kiểm tra đáp án"
                aria-keyshortcuts="Enter"
                disabled={Boolean(pendingAction)}
                onClick={handleCheck}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2.5 whitespace-nowrap rounded-2xl bg-sky-500 px-5 text-base font-black text-white shadow-[0_4px_0_rgb(3_105_161)] transition hover:bg-sky-400 active:translate-y-[3px] active:shadow-[0_1px_0_rgb(3_105_161)] disabled:opacity-60 dark:bg-sky-600 dark:shadow-[0_4px_0_rgb(7_89_133)] dark:hover:bg-sky-500 dark:active:shadow-[0_1px_0_rgb(7_89_133)] sm:w-auto md:px-8"
              >
                {pendingAction === "check" ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                )}
                Kiểm tra
              </button>
            </div>
          ) : null}

          {!feedback ? (
            <div className="mt-4">
              <div className="flex flex-wrap items-center gap-2">
                {question.hintJson ? (
                  <button
                    type="button"
                    disabled={Boolean(pendingAction)}
                    onClick={handleToggleHint}
                    className="inline-flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-xl bg-amber-100 px-4 text-base font-black text-amber-700 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-amber-500/15 dark:text-amber-300 dark:hover:bg-amber-500/25"
                  >
                    <Lightbulb className="h-5 w-5" aria-hidden="true" />
                    {isHintOpen ? "Ẩn gợi ý" : "Gợi ý"}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={Boolean(pendingAction)}
                  onClick={handleSkip}
                  className="student-mobile-border inline-flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-xl border border-slate-300 bg-white px-4 text-base font-black text-slate-700 transition hover:border-slate-400 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface-soft)] dark:text-[var(--theme-text)] dark:hover:border-slate-500 dark:hover:bg-slate-700/60 dark:hover:text-slate-100"
                >
                  <SkipForward className="h-[18px] w-[18px]" aria-hidden="true" />
                  Bỏ qua
                </button>
              </div>
              {question.hintJson && isHintOpen ? (
                <div className="learning-content-text mt-2 rounded-2xl border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-400/30 dark:bg-amber-500/10">
                  <TiptapContentView content={question.hintJson} />
                </div>
              ) : null}
            </div>
          ) : null}

          {feedback ? (
            <AssessmentExplanationPanel
              content={feedback.explanationJson}
              correctAnswer={feedback.correctAnswerJson}
              explanationBlock={feedback.explanationBlock}
              optionIds={question.optionsJson?.map((option) => option.id)}
              questionType={question.questionType}
              separateAnswerItems={question.questionType === "MULTI_STATEMENT_TRUE_FALSE"}
              solutionFigure={question.solutionFigure}
              isOpen={isExplanationOpen}
              onToggle={handleToggleExplanation}
            />
          ) : null}
        </div>

        <nav
          className="mt-5 flex items-center justify-center gap-2"
          aria-label="Điều hướng câu hỏi"
        >
          {attempt.questions.map((item, index) => {
            const itemFeedback = feedbackByQuestionId[item.id];
            const isItemAnswered = answeredQuestionIdSet.has(item.id);
            const itemQuestionNumber = item.questionNumber ?? index + 1;
            return (
              <button
                key={item.id}
                type="button"
                disabled={Boolean(pendingAction)}
                onClick={() => handleQuestionSelect(index)}
                aria-label={
                  itemFeedback?.isSkipped
                    ? `Câu ${itemQuestionNumber}: đã bỏ qua`
                    : itemFeedback
                      ? `Câu ${itemQuestionNumber}: ${
                          itemFeedback.isCorrect ? "đúng" : "sai"
                        }`
                      : isItemAnswered
                        ? `Câu ${itemQuestionNumber}: đã làm, chưa kiểm tra`
                        : `Câu ${itemQuestionNumber}: chưa làm`
                }
                aria-current={index === currentIndex ? "step" : undefined}
                className={cn(
                  "relative h-3 shrink-0 rounded-full transition-[width,background-color,filter,transform] duration-200 before:absolute before:-inset-x-1 before:-inset-y-2 before:rounded-lg before:content-[''] hover:brightness-95 active:scale-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 disabled:opacity-100 motion-reduce:transition-none dark:focus-visible:ring-sky-500/30",
                  index === currentIndex ? "w-8" : "w-3",
                  itemFeedback?.isSkipped
                    ? "bg-amber-400"
                    : itemFeedback?.isCorrect
                      ? "bg-emerald-400"
                      : itemFeedback
                        ? "bg-rose-400"
                        : isItemAnswered
                          ? "bg-blue-400"
                          : "bg-slate-300 dark:bg-slate-600",
                )}
              />
            );
          })}
        </nav>

        {isIncompleteAlertVisible ? (
          <div
            role="alert"
            className="mt-4 flex items-center gap-2 rounded-2xl border border-sky-400 bg-sky-200/80 px-3 py-4 text-sm font-bold leading-5 text-sky-800 shadow-[0_8px_20px_-16px_rgb(2_132_199_/_65%)] dark:border-sky-400/50 dark:bg-sky-500/25 dark:text-sky-100"
          >
            <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              Cần hoàn thành{" "}
              {incompleteQuestionNumbers.length === 1 ? "câu hỏi" : "các câu hỏi"}{" "}
              {incompleteQuestionNumbers.join(", ")} để tiếp tục!
            </p>
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            aria-keyshortcuts="ArrowLeft"
            disabled={currentIndex === 0 || Boolean(pendingAction)}
            onClick={handlePrevious}
            className="student-preserve-mobile-shadow inline-flex min-h-12 items-center justify-center gap-2.5 whitespace-nowrap rounded-2xl border border-sky-200 bg-white px-3 text-base font-black text-sky-700 shadow-[0_4px_0_rgb(186_230_253)] transition hover:bg-sky-50 active:translate-y-[3px] active:shadow-[0_1px_0_rgb(186_230_253)] disabled:cursor-not-allowed disabled:opacity-40 dark:border-sky-400/30 dark:bg-[var(--theme-surface)] dark:text-sky-300 dark:shadow-[0_4px_0_rgb(7_89_133)] dark:active:shadow-[0_1px_0_rgb(7_89_133)]"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            Câu trước
          </button>

          {isLast ? (
            <button
              type="button"
              aria-label="Hoàn thành Quiz"
              disabled={Boolean(pendingAction)}
              onClick={handleSubmit}
              className="student-preserve-mobile-shadow inline-flex min-h-12 items-center justify-center gap-2.5 whitespace-nowrap rounded-2xl bg-emerald-500 px-3 text-base font-black text-white shadow-[0_4px_0_rgb(4_120_87)] transition active:translate-y-[3px] active:shadow-[0_1px_0_rgb(4_120_87)] disabled:opacity-60 enabled:hover:bg-emerald-400"
            >
              {pendingAction === "submit" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              )}
              Hoàn thành
            </button>
          ) : (
            <button
              type="button"
              aria-keyshortcuts="ArrowRight"
              disabled={Boolean(pendingAction)}
              onClick={handleNext}
              className="student-preserve-mobile-shadow inline-flex min-h-12 items-center justify-center gap-2.5 whitespace-nowrap rounded-2xl bg-sky-600 px-3 text-base font-black text-white shadow-[0_4px_0_rgb(3_105_161)] transition active:translate-y-[3px] active:shadow-[0_1px_0_rgb(3_105_161)] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none dark:disabled:bg-slate-700 enabled:hover:bg-sky-500"
            >
              Câu tiếp
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </main>

      <QuizExitConfirmDialog
        isOpen={isExitDialogOpen}
        onCancel={handleCancelExit}
        onConfirm={handleConfirmExit}
      />
    </div>
  );
}

function isQuizAnswerEditingTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;

  return Boolean(
    target.closest(
      'input, textarea, select, math-field, [contenteditable="true"], [role="textbox"]',
    ),
  );
}
