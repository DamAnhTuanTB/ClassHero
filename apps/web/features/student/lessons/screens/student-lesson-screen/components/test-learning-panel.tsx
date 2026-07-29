"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Brain,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  HelpCircle,
  Loader2,
  LockKeyhole,
  Medal,
  Play,
  RefreshCcw,
  Search,
  Trophy,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  reviewStudentTest,
  startStudentTest,
  submitStudentTest,
  useStudentTestResult,
} from "@/features/student/lessons/api/student-lessons-api";
import { AssessmentQuestionCard } from "@/features/student/lessons/screens/student-lesson-screen/components/assessment-question-card";
import type {
  AssessmentReview,
  CompletionResult,
  StudentAnswer,
  StudentLesson,
  StudentLessonTab,
  StudentTestAttempt,
  StudentTestResult,
  StudentTestStatus,
} from "@/features/student/lessons/types/student-lesson-types";
import {
  formatDuration,
  isStudentAnswerComplete,
} from "@/features/student/lessons/utils/student-answer-utils";
import { cn } from "@/lib/utils";

export function TestLearningPanel({
  lesson,
  onProgressChanged,
  onSelectTab,
  status,
  token,
}: {
  lesson: StudentLesson;
  onProgressChanged: () => Promise<void>;
  onSelectTab: (tab: StudentLessonTab) => void;
  status: StudentTestStatus | undefined;
  token: string;
}) {
  const [attempt, setAttempt] = useState<StudentTestAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, StudentAnswer>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [result, setResult] = useState<StudentTestResult | null>(null);
  const [review, setReview] = useState<(AssessmentReview & StudentTestResult) | null>(
    null,
  );
  const [reviewIndex, setReviewIndex] = useState(0);
  const [completion, setCompletion] = useState<CompletionResult | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const allAnswersComplete = useMemo(
    () =>
      Boolean(
        attempt?.questions.every((question) =>
          isStudentAnswerComplete(question, answers[question.id]),
        ),
      ),
    [answers, attempt],
  );

  const handleSubmit = useCallback(
    async (autoSubmit = false) => {
      if (!attempt || pendingAction) return;
      if (!autoSubmit && !allAnswersComplete) return;
      setPendingAction("submit");
      try {
        const submittedAnswers = attempt.questions.map((question) => ({
          questionId: question.id,
          answerJson:
            answers[question.id] ??
            ({
              __unanswered: true,
            } satisfies StudentAnswer),
        }));
        const nextResult = await submitStudentTest(attempt.id, submittedAnswers, token);
        setResult(nextResult);
        setAttempt(null);
      } catch (error) {
        toast.error("Chưa nộp được bài kiểm tra", {
          description: getErrorMessage(error),
        });
      } finally {
        setPendingAction(null);
      }
    },
    [allAnswersComplete, answers, attempt, pendingAction, token],
  );

  useEffect(() => {
    if (!attempt || result) return;
    const interval = window.setInterval(() => {
      setRemainingSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [attempt, result]);

  useEffect(() => {
    if (attempt && !result && remainingSeconds === 0 && pendingAction === null) {
      void handleSubmit(true);
    }
  }, [attempt, handleSubmit, pendingAction, remainingSeconds, result]);

  async function handleStart() {
    if (!token || pendingAction) return;
    setPendingAction("start");
    try {
      const nextAttempt = await startStudentTest(lesson.id, token);
      setAttempt(nextAttempt);
      setAnswers({});
      setCurrentIndex(0);
      setRemainingSeconds(nextAttempt.testSet.durationSeconds);
      setResult(null);
      setReview(null);
      setCompletion(null);
    } catch (error) {
      toast.error("Chưa bắt đầu được bài kiểm tra", {
        description: getErrorMessage(error),
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleReview(scope: "ALL" | "INCORRECT") {
    if (!result || pendingAction) return;
    setPendingAction(`review-${scope}`);
    try {
      const nextReview = await reviewStudentTest(result.id, scope, token);
      setReview(nextReview);
      setReviewIndex(0);
    } catch (error) {
      toast.error("Chưa tải được phần xem lại", {
        description: getErrorMessage(error),
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleUseResult() {
    if (!result?.passed || pendingAction) return;
    setPendingAction("use-result");
    try {
      const nextCompletion = await useStudentTestResult(result.id, token);
      setCompletion(nextCompletion);
      await onProgressChanged();
    } catch (error) {
      toast.error("Chưa dùng được kết quả này", {
        description: getErrorMessage(error),
      });
    } finally {
      setPendingAction(null);
    }
  }

  if (completion) {
    return (
      <section className="rounded-[1.5rem] border border-emerald-100 bg-white p-5 dark:border-emerald-400/20 dark:bg-[var(--theme-surface)] sm:p-7">
        <div className="text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
            <Trophy className="h-9 w-9" aria-hidden="true" />
          </span>
          <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-emerald-600">
            Hoàn thành buổi học
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-[var(--theme-text-strong)]">
            Chúc mừng bạn!
          </h2>
          <p className="mt-2 text-sm font-bold text-slate-500 dark:text-[var(--theme-text-muted)]">
            Điểm tốt nhất: {completion.bestAttempt?.score.toFixed(2) ?? "0.00"}/10
          </p>
        </div>
        <div className="mt-7">
          <div className="mb-3 flex items-center gap-2">
            <Medal className="h-5 w-5 text-amber-500" aria-hidden="true" />
            <h3 className="font-black text-slate-950 dark:text-[var(--theme-text-strong)]">
              Top 5 buổi học
            </h3>
          </div>
          {completion.leaderboard.length > 0 ? (
            <div className="grid gap-2">
              {completion.leaderboard.map((entry) => (
                <div
                  key={entry.attemptId}
                  className={cn(
                    "grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-4 py-3",
                    entry.isCurrentStudent
                      ? "bg-sky-50 text-sky-800 dark:bg-sky-500/10 dark:text-sky-200"
                      : "bg-slate-50 text-slate-700 dark:bg-[var(--theme-surface-muted)] dark:text-[var(--theme-text)]",
                  )}
                >
                  <span className="text-center text-sm font-black">#{entry.rank}</span>
                  <span className="truncate text-sm font-black">{entry.studentName}</span>
                  <span className="text-sm font-black">
                    {entry.score.toFixed(2)} · {formatDuration(entry.durationSeconds)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl bg-slate-50 px-4 py-5 text-sm font-bold text-slate-500 dark:bg-[var(--theme-surface-muted)]">
              Chưa có dữ liệu xếp hạng.
            </p>
          )}
        </div>
      </section>
    );
  }

  if (review) {
    const question = review.questions[reviewIndex];
    return (
      <div className="space-y-4">
        <PanelHeader
          title={review.scope === "INCORRECT" ? "Xem lại câu sai" : "Xem lại tất cả"}
          trailing={`${reviewIndex + 1}/${review.questions.length}`}
        />
        {question ? (
          <AssessmentQuestionCard
            question={question}
            answer={question.answerJson}
            feedback={question}
            onChange={() => undefined}
            readOnly
          />
        ) : (
          <EmptyPanel copy="Không có câu sai để xem lại." />
        )}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setReview(null)}
            className="inline-flex min-h-12 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-2 text-[15px] font-black text-slate-600 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] dark:text-[var(--theme-text)] sm:px-3 sm:text-base"
          >
            <Trophy className="h-5 w-5" aria-hidden="true" />
            Kết quả
          </button>
          <button
            type="button"
            disabled={reviewIndex === 0}
            onClick={() => setReviewIndex((index) => Math.max(0, index - 1))}
            className="inline-flex min-h-12 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-slate-100 px-2 text-[15px] font-black disabled:opacity-40 dark:bg-[var(--theme-surface-muted)] sm:px-3 sm:text-base"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            Câu trước
          </button>
          <button
            type="button"
            disabled={reviewIndex >= review.questions.length - 1}
            onClick={() =>
              setReviewIndex((index) => Math.min(review.questions.length - 1, index + 1))
            }
            className="inline-flex min-h-12 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-sky-600 px-2 text-[15px] font-black text-white disabled:opacity-40 sm:px-3 sm:text-base"
          >
            Câu sau
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <section className="rounded-[1.5rem] border border-sky-100 bg-white p-5 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] sm:p-7">
        <div className="text-center">
          <span
            className={cn(
              "mx-auto grid h-16 w-16 place-items-center rounded-full",
              result.passed
                ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
                : "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
            )}
          >
            {result.passed ? (
              <CheckCircle2 className="h-9 w-9" />
            ) : (
              <AlertTriangle className="h-9 w-9" />
            )}
          </span>
          <h2 className="mt-4 text-2xl font-black text-slate-950 dark:text-[var(--theme-text-strong)]">
            Kết quả bài kiểm tra
          </h2>
          <p className="mt-3 text-4xl font-black text-sky-600 dark:text-sky-300">
            {result.score.toFixed(2)}
            <span className="text-lg text-slate-400">/10</span>
          </p>
          <p className="mt-2 text-sm font-bold text-slate-500 dark:text-[var(--theme-text-muted)]">
            {result.correctCount}/{result.totalCount} câu đúng ·{" "}
            {formatDuration(result.durationSeconds)}
          </p>
        </div>

        {!result.passed ? (
          <div
            role="alert"
            className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-black text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-300"
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            Bạn cần phải làm lại bài kiểm tra mới.
          </div>
        ) : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <ResultAction
            icon={Search}
            label="Xem lại tất cả"
            pending={pendingAction === "review-ALL"}
            onClick={() => void handleReview("ALL")}
          />
          <ResultAction
            icon={Search}
            label="Xem lại câu sai"
            pending={pendingAction === "review-INCORRECT"}
            disabled={result.wrongCount === 0}
            onClick={() => void handleReview("INCORRECT")}
          />
          <ResultAction
            icon={RefreshCcw}
            label="Làm lại bài kiểm tra mới"
            pending={pendingAction === "start"}
            onClick={() => void handleStart()}
          />
          <ResultAction
            icon={CheckCircle2}
            label="Dùng điểm bài này"
            pending={pendingAction === "use-result"}
            disabled={!result.passed}
            primary
            onClick={() => void handleUseResult()}
          />
        </div>
      </section>
    );
  }

  if (attempt) {
    const question = attempt.questions[currentIndex];
    if (!question) return <EmptyPanel copy="Bộ đề chưa có câu hỏi phù hợp." />;
    const answer = answers[question.id];
    const isLast = currentIndex === attempt.questions.length - 1;
    return (
      <div className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <PanelHeader
            title={`Câu ${currentIndex + 1}`}
            trailing={`${currentIndex + 1}/${attempt.questions.length}`}
          />
          <span
            className={cn(
              "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-black",
              remainingSeconds <= 60
                ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                : "bg-slate-100 text-slate-700 dark:bg-[var(--theme-surface-muted)] dark:text-[var(--theme-text)]",
            )}
          >
            <Clock3 className="h-4 w-4" />
            {formatDuration(remainingSeconds)}
          </span>
        </div>
        <AssessmentQuestionCard
          question={question}
          answer={answer}
          onChange={(nextAnswer) =>
            setAnswers((current) => ({ ...current, [question.id]: nextAnswer }))
          }
        />
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
          <button
            type="button"
            disabled={currentIndex === 0 || Boolean(pendingAction)}
            onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
            className="grid h-12 w-12 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600 disabled:opacity-40 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)]"
            aria-label="Câu trước"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          {isLast ? (
            <button
              type="button"
              disabled={!allAnswersComplete || Boolean(pendingAction)}
              onClick={() => void handleSubmit()}
              className="inline-flex min-h-14 items-center justify-center gap-2.5 whitespace-nowrap rounded-2xl bg-emerald-600 px-5 text-lg font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
            >
              {pendingAction === "submit" ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <ClipboardCheck className="h-6 w-6" aria-hidden="true" />
              )}
              Nộp bài kiểm tra
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                setCurrentIndex((index) =>
                  Math.min(attempt.questions.length - 1, index + 1),
                )
              }
              className="inline-flex min-h-14 items-center justify-center gap-2.5 whitespace-nowrap rounded-2xl bg-sky-600 px-5 text-lg font-black text-white"
            >
              Câu tiếp theo
              <ArrowRight className="h-6 w-6" />
            </button>
          )}
        </div>
        {!allAnswersComplete && isLast ? (
          <p className="text-center text-xs font-bold text-slate-500 dark:text-[var(--theme-text-muted)]">
            Hãy trả lời đủ các câu trước khi nộp bài.
          </p>
        ) : null}
      </div>
    );
  }

  if (!status) {
    return <EmptyPanel copy="Đang kiểm tra điều kiện mở bài kiểm tra…" />;
  }

  if (!status.canStart) {
    return (
      <section className="rounded-[1.5rem] border border-sky-100 bg-white p-4 shadow-[0_20px_50px_-42px_rgb(2_132_199_/_60%)] dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] sm:p-5">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            <ClipboardCheck className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="min-w-0 text-base font-black text-slate-950 dark:text-[var(--theme-text-strong)] sm:text-lg">
            Kiểm tra
          </h2>
          <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-100 px-3 py-2 text-xs font-black text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
            Đang khóa
          </span>
        </div>
        <p className="mt-3 text-sm font-bold leading-6 text-slate-600 dark:text-[var(--theme-text-muted)]">
          {status.lockReason === "PREREQUISITES_INCOMPLETE"
            ? "Hoàn thành xong Quiz và Flashcard để mở khóa bài kiểm tra."
            : status.lockReason === "BEFORE_OPEN_TIME"
              ? `Bài kiểm tra sẽ mở lúc ${formatDateTime(status.examOpenAt)}.`
              : "Bài kiểm tra không mở trong chế độ học thử."}
        </p>
        {status.lockReason === "PREREQUISITES_INCOMPLETE" ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <PrerequisiteRow
              label="Quiz"
              completed={status.quiz.isCompleted}
              tone="quiz"
              onClick={() => onSelectTab("quiz")}
            />
            <PrerequisiteRow
              label="Flashcard"
              completed={status.flashcard.isCompleted}
              tone="flashcard"
              onClick={() => onSelectTab("flashcard")}
            />
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="rounded-[1.5rem] border border-sky-100 bg-white p-4 shadow-[0_20px_50px_-42px_rgb(2_132_199_/_60%)] dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] sm:p-5">
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
          <ClipboardCheck className="h-6 w-6" aria-hidden="true" />
        </span>
        <h2 className="min-w-0 text-base font-black text-slate-950 dark:text-[var(--theme-text-strong)] sm:text-lg">
          Kiểm tra
        </h2>
        <span className="ml-auto shrink-0 rounded-xl bg-emerald-100 px-3 py-2 text-xs font-black text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
          {status.sets[0] ? `${status.sets[0].questionCount} câu` : "Sẵn sàng"}
        </span>
      </div>
      <p className="mt-3 text-sm font-bold leading-6 text-slate-600 dark:text-[var(--theme-text-muted)]">
        Ôn lại Quiz và Flashcard để sẵn sàng hơn.
      </p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onSelectTab("quiz")}
          className="inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-sky-200 bg-sky-50 px-2 text-[15px] font-black text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-300 sm:px-3 sm:text-base"
        >
          <HelpCircle className="h-5 w-5" aria-hidden="true" />
          Ôn lại QuizBN
        </button>
        <button
          type="button"
          onClick={() => onSelectTab("flashcard")}
          className="inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-violet-200 bg-violet-50 px-2 text-[15px] font-black text-violet-700 dark:border-violet-400/30 dark:bg-violet-500/10 dark:text-violet-300 sm:px-3 sm:text-base"
        >
          <Brain className="h-5 w-5" aria-hidden="true" />
          Ôn lại Flashcard
        </button>
      </div>
      <button
        type="button"
        disabled={Boolean(pendingAction)}
        onClick={() => void handleStart()}
        className="student-test-cta-3d mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2.5 whitespace-nowrap rounded-2xl bg-emerald-500 px-5 text-lg font-black text-white hover:bg-emerald-400 focus-visible:outline-none disabled:cursor-wait disabled:opacity-70"
      >
        {pendingAction === "start" ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <Play className="h-6 w-6" aria-hidden="true" />
        )}
        Bắt đầu bài kiểm tra
      </button>
    </section>
  );
}

function PanelHeader({ title, trailing }: { title: string; trailing: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-black uppercase tracking-[0.15em] text-sky-600 dark:text-sky-300">
        Bài kiểm tra
      </p>
      <div className="mt-1 flex items-center gap-3">
        <h2 className="truncate text-xl font-black text-slate-950 dark:text-[var(--theme-text-strong)]">
          {title}
        </h2>
        <span className="shrink-0 rounded-xl bg-sky-100 px-3 py-2 text-xs font-black text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
          {trailing}
        </span>
      </div>
    </div>
  );
}

function PrerequisiteRow({
  completed,
  label,
  onClick,
  tone,
}: {
  completed: boolean;
  label: string;
  onClick: () => void;
  tone: "flashcard" | "quiz";
}) {
  const Icon = tone === "quiz" ? HelpCircle : Brain;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-12 items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 text-left dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface-muted)]"
    >
      <span className="inline-flex items-center gap-2.5 text-base font-black text-slate-700 dark:text-[var(--theme-text)]">
        <Icon
          className={cn(
            "h-5 w-5 shrink-0",
            tone === "quiz"
              ? "text-amber-600 dark:text-amber-300"
              : "text-violet-600 dark:text-violet-300",
          )}
          aria-hidden="true"
        />
        {label}
      </span>
      <span
        className={cn(
          "rounded-lg px-2 py-1 text-xs font-black",
          completed
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
            : tone === "quiz"
              ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
              : "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
        )}
      >
        {completed ? "Đã xong" : "Chưa xong"}
      </span>
    </button>
  );
}

function ResultAction({
  disabled = false,
  icon: Icon,
  label,
  onClick,
  pending,
  primary = false,
}: {
  disabled?: boolean;
  icon: typeof Search;
  label: string;
  onClick: () => void;
  pending: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled || pending}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2.5 whitespace-nowrap rounded-2xl px-4 text-base font-black transition disabled:cursor-not-allowed disabled:opacity-45",
        primary
          ? "bg-emerald-600 text-white"
          : "border border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-300",
      )}
    >
      {pending ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <Icon className="h-5 w-5" aria-hidden="true" />
      )}
      {label}
    </button>
  );
}

function EmptyPanel({ copy }: { copy: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-sm font-bold text-slate-500 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] dark:text-[var(--theme-text-muted)]">
      {copy}
    </div>
  );
}

function formatDateTime(value: string | null) {
  if (!value) return "thời gian được thông báo";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Vui lòng thử lại.";
}
