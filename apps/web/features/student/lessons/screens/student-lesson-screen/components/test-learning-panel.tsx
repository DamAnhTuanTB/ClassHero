"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Brain,
  ClipboardCheck,
  Clock3,
  Eye,
  FileText,
  HelpCircle,
  Loader2,
  LockKeyhole,
  Medal,
  Play,
  RefreshCcw,
  Trophy,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  getTestHistory,
  reviewStudentTest,
  startStudentTest,
  submitStudentTest,
  useStudentTestResult,
} from "@/features/student/lessons/api/student-lessons-api";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";
import { useStudentLearningTransition } from "@/components/student/learning-transition/student-learning-transition-provider";
import { QuizCurtainTransition } from "@/features/student/lessons/screens/student-lesson-screen/components/quiz-curtain-transition";
import {
  LearningHistoryControl,
  type LearningHistoryDisplayItem,
} from "@/features/student/lessons/screens/student-lesson-screen/components/learning-history-control";
import { QuizReviewScreen } from "@/features/student/lessons/screens/student-lesson-screen/components/quiz-review-screen";
import { TestResultScreen } from "@/features/student/lessons/screens/student-lesson-screen/components/test-result-screen";
import { TestRunnerScreen } from "@/features/student/lessons/screens/student-lesson-screen/components/test-runner-screen";
import { QuizRunnerLoadingScreen } from "@/features/student/lessons/screens/student-lesson-screen/components/quiz-runner-screen";
import type {
  AssessmentReview,
  CompletionResult,
  StudentAnswer,
  StudentLearningSurface,
  StudentLesson,
  StudentTestAttempt,
  StudentTestResult,
  StudentTestStatus,
} from "@/features/student/lessons/types/student-lesson-types";
import type { PracticeTabTarget } from "@/features/student/lessons/hooks/use-practice-tab-transition";
import {
  getBrowserStudentLearningSurface,
  getStudentLearningSurfaceHref,
} from "@/features/student/lessons/utils/student-learning-surface-route";
import {
  pickQuizTransitionVariant,
  quizTransitionTimings,
  type QuizTransitionPhase,
  type QuizTransitionVariant,
} from "@/features/student/lessons/utils/quiz-transition-variant";
import {
  formatDuration,
  isStudentAnswerComplete,
} from "@/features/student/lessons/utils/student-answer-utils";
import { cn } from "@/lib/utils";

function syncTestResultUrl(attemptId: string, testSetId: string) {
  // Logic removed at user's request: do not sync result surface to URL
}

function clearTestSurfaceUrl() {
  // Logic removed at user's request: do not sync result surface to URL
}

export function TestLearningPanel({
  hasFlashcardContent,
  hasQuizContent,
  initialSurface,
  lesson,
  onProgressChanged,
  onStartPrerequisite,
  status,
  token,
}: {
  hasFlashcardContent: boolean;
  hasQuizContent: boolean;
  initialSurface?: Extract<
    StudentLearningSurface,
    { kind: "test-runner" | "test-result" }
  > | null;
  lesson: StudentLesson;
  onProgressChanged: () => Promise<void>;
  onStartPrerequisite: (tab: PracticeTabTarget) => Promise<void>;
  status: StudentTestStatus | undefined;
  token: string;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { openLesson } = useStudentLearningTransition();
  const userId = useAuthSessionStore((state) => state.session?.user.id);
  const historyQueryKey = useMemo(
    () => ["student", "lesson", lesson.id, "test-history", userId ?? "guest"] as const,
    [lesson.id, userId],
  );
  const historyQuery = useQuery({
    queryKey: historyQueryKey,
    queryFn: () => getTestHistory(lesson.id, token),
    enabled: Boolean(token) && Boolean(lesson.id),
    staleTime: 15_000,
  });
  const [attempt, setAttempt] = useState<StudentTestAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, StudentAnswer>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [result, setResult] = useState<StudentTestResult | null>(null);
  const [isRestoringSurface, setIsRestoringSurface] = useState(() => {
    if (typeof window === "undefined") return false;
    const surface = initialSurface ?? getBrowserStudentLearningSurface();
    return (
      (surface?.kind === "test-result" || surface?.kind === "test-runner") &&
      Boolean(surface.attemptId)
    );
  });
  const restoredAttemptIdRef = useRef<string | null>(null);
  const [review, setReview] = useState<(AssessmentReview & StudentTestResult) | null>(
    null,
  );
  const [reviewOrigin, setReviewOrigin] = useState<"HISTORY" | "RESULT">("RESULT");
  const [historyReviewTitle, setHistoryReviewTitle] = useState<string | null>(null);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [completion, setCompletion] = useState<CompletionResult | null>(null);
  const [latestSubmittedAttemptId, setLatestSubmittedAttemptId] = useState<string | null>(
    null,
  );
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [shouldCelebrateResult, setShouldCelebrateResult] = useState(false);
  const [curtainPhase, setCurtainPhase] = useState<QuizTransitionPhase>("idle");
  const [transitionVariant, setTransitionVariant] =
    useState<QuizTransitionVariant>("book");
  const lastTransitionVariantRef = useRef<QuizTransitionVariant | null>(null);
  const shouldReduceMotion = Boolean(useReducedMotion());

  const allAnswersComplete = useMemo(
    () =>
      Boolean(
        attempt?.questions.every((question) =>
          isStudentAnswerComplete(question, answers[question.id]),
        ),
      ),
    [answers, attempt],
  );

  function renderWithCurtain(content: ReactNode) {
    return (
      <>
        {content}
        <QuizCurtainTransition
          animateStatusFill={false}
          ariaLabel="Đang mở bài thi"
          countdownFrom={3}
          phase={curtainPhase}
          statusText="Chúc bạn làm bài thi thật tốt!"
          variant={transitionVariant}
        />
      </>
    );
  }

  const handleSubmit = useCallback(
    async (_autoSubmit = false) => {
      if (!attempt || pendingAction) return false;
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
        const testSetId = status?.sets[0]?.id ?? "";
        setResult(nextResult);
        syncTestResultUrl(nextResult.id, testSetId);
        setLatestSubmittedAttemptId(nextResult.id);
        setShouldCelebrateResult(true);
        setAttempt(null);
        await Promise.all([
          queryClient.refetchQueries({ queryKey: historyQueryKey }),
          onProgressChanged(),
        ]);
        return true;
      } catch (error) {
        toast.error("Chưa nộp được bài thi", {
          description: getErrorMessage(error),
        });
        return false;
      } finally {
        setPendingAction(null);
      }
    },
    [
      answers,
      attempt,
      historyQueryKey,
      onProgressChanged,
      pendingAction,
      queryClient,
      status?.sets,
      token,
    ],
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

  useEffect(() => {
    if (!token || result || attempt) return;
    const surface = initialSurface ?? getBrowserStudentLearningSurface();
    if (
      !surface ||
      (surface.kind !== "test-result" && surface.kind !== "test-runner") ||
      !surface.attemptId
    ) {
      setIsRestoringSurface(false);
      return;
    }

    if (restoredAttemptIdRef.current === surface.attemptId) {
      setIsRestoringSurface(false);
      return;
    }

    let isCancelled = false;
    restoredAttemptIdRef.current = surface.attemptId;
    setPendingAction("restore-result");

    void reviewStudentTest(surface.attemptId, "ALL", token)
      .then((restoredResult) => {
        if (!isCancelled && restoredResult) {
          setShouldCelebrateResult(false);
          setResult(restoredResult);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        // ALWAYS clear restoring flags, but only reset pending action if we were the ones who set it
        setIsRestoringSurface(false);
        if (!isCancelled) {
          setPendingAction((prev) => (prev === "restore-result" ? null : prev));
        }
      });

    return () => {
      isCancelled = true;
      setPendingAction((prev) => (prev === "restore-result" ? null : prev));
    };
  }, [attempt, initialSurface, result, token]);

  if (isRestoringSurface && !result && !attempt) {
    return renderWithCurtain(<QuizRunnerLoadingScreen />);
  }

  async function handleStart(pendingKey = "start") {
    if (
      !token ||
      pendingAction ||
      !status?.sets[0] ||
      status.sets[0].questionCount === 0
    ) {
      return;
    }
    setShouldCelebrateResult(false);
    setPendingAction(pendingKey);
    const nextTransitionVariant = pickQuizTransitionVariant(
      lastTransitionVariantRef.current,
    );
    lastTransitionVariantRef.current = nextTransitionVariant;
    setTransitionVariant(nextTransitionVariant);
    setCurtainPhase("closing");

    const closeDelay = waitForTestCurtain(2_200);
    const prepareAttempt = startStudentTest(lesson.id, token);
    const [, prepareResult] = await Promise.allSettled([closeDelay, prepareAttempt]);
    setCurtainPhase("closed");

    try {
      if (prepareResult.status === "rejected") {
        throw prepareResult.reason;
      }

      await waitForTestCurtain(shouldReduceMotion ? 0 : quizTransitionTimings.holdMs);
      const nextAttempt = prepareResult.value;
      setAttempt(nextAttempt);
      setAnswers({});
      setCurrentIndex(0);
      setRemainingSeconds(nextAttempt.testSet.durationSeconds);
      setResult(null);
      setReview(null);
      setCompletion(null);
    } catch (error) {
      toast.error("Chưa bắt đầu được bài thi", {
        description: getErrorMessage(error),
      });
    } finally {
      setCurtainPhase("opening");
      await waitForTestCurtain(
        shouldReduceMotion
          ? quizTransitionTimings.reducedOpenMs
          : quizTransitionTimings.openMs,
      );
      setCurtainPhase("idle");
      setPendingAction(null);
    }
  }

  async function handleReviewAttempt(
    attemptId: string,
    scope: "ALL" | "INCORRECT",
    origin: "HISTORY" | "RESULT" = "RESULT",
    nextHistoryReviewTitle?: string,
    actionKey = origin === "HISTORY" ? `history-review:${attemptId}` : `review-${scope}`,
  ) {
    if (pendingAction) return;
    setPendingAction(actionKey);
    try {
      const nextReview = await reviewStudentTest(attemptId, scope, token);
      setShouldCelebrateResult(false);
      setReviewOrigin(origin);
      setHistoryReviewTitle(
        origin === "HISTORY" ? (nextHistoryReviewTitle ?? null) : null,
      );
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

  async function handleOpenResult(attemptId: string) {
    if (pendingAction) return;
    setPendingAction("open-result");
    try {
      const restoredResult = await reviewStudentTest(attemptId, "ALL", token);
      const testSetId = status?.sets[0]?.id ?? "";
      setShouldCelebrateResult(false);
      setReview(null);
      setResult(restoredResult);
      syncTestResultUrl(restoredResult.id, testSetId);
    } catch (error) {
      toast.error("Chưa tải được kết quả bài thi", {
        description: getErrorMessage(error),
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleReview(scope: "ALL" | "INCORRECT") {
    if (!result) return;
    await handleReviewAttempt(result.id, scope);
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

  function findTestHistoryItem(item: LearningHistoryDisplayItem) {
    return historyQuery.data?.items.find((candidate) => candidate.id === item.id);
  }

  function handleHistoryReview(item: LearningHistoryDisplayItem) {
    const source = findTestHistoryItem(item);
    if (!source?.attemptId) return;
    void handleReviewAttempt(
      source.attemptId,
      "ALL",
      "HISTORY",
      item.displayName,
      `history-review:${item.id}`,
    );
  }

  function handleHistoryStart(item: LearningHistoryDisplayItem) {
    const source = findTestHistoryItem(item);
    if (!source || source.state !== "NOT_STARTED") return;
    void handleStart(`history-start:${item.id}`);
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

  if (review && reviewOrigin === "RESULT") {
    return renderWithCurtain(
      <QuizReviewScreen
        accent="emerald"
        activityLabel="Bài thi"
        backLabel="Quay lại kết quả Bài thi"
        currentIndex={reviewIndex}
        displayScope={review.scope}
        onBack={() => setReview(null)}
        onCurrentIndexChange={setReviewIndex}
        review={review}
        reviewTitle={
          review.scope === "INCORRECT"
            ? "Xem lại các câu trả lời sai"
            : "Xem lại tất cả câu trả lời"
        }
        testId="test-review-screen"
      />,
    );
  }

  if (result) {
    const historyMaxScore = historyQuery.data?.items
      ? Math.max(
          -1,
          ...historyQuery.data.items.map((item) => item.score ?? -1),
        )
      : -1;

    const currentBestScore = Math.max(
      status?.bestAttempt?.score ?? -1,
      historyMaxScore,
      result.score,
    );

    return renderWithCurtain(
      <TestResultScreen
        result={result}
        bestScore={currentBestScore}
        pendingAction={pendingAction}
        shouldCelebrate={shouldCelebrateResult}
        onBack={() => {
          setShouldCelebrateResult(false);
          setResult(null);
          clearTestSurfaceUrl();
        }}
        onReviewAll={() => void handleReview("ALL")}
        onReviewIncorrect={() => void handleReview("INCORRECT")}
        onStartNewTest={() => void handleStart()}
        onUseResult={() => void handleUseResult()}
        onNextLesson={
          lesson.navigation.next
            ? () => void openLesson(lesson.navigation.next!.id)
            : undefined
        }
      />,
    );
  }

  if (attempt) {
    const question = attempt.questions[currentIndex];
    if (!question) return <EmptyPanel copy="Bài thi chưa có câu hỏi phù hợp." />;
    const answer = answers[question.id];
    const answeredQuestionIds = attempt.questions.flatMap((item) =>
      isStudentAnswerComplete(item, answers[item.id]) ? [item.id] : [],
    );

    return renderWithCurtain(
      <TestRunnerScreen
        answer={answer}
        answeredQuestionIds={answeredQuestionIds}
        attempt={attempt}
        currentIndex={currentIndex}
        pendingAction={pendingAction}
        remainingSeconds={remainingSeconds}
        onAnswerChange={(nextAnswer) =>
          setAnswers((current) => ({ ...current, [question.id]: nextAnswer }))
        }
        onBack={() => {
          setAttempt(null);
          setAnswers({});
          setCurrentIndex(0);
          setRemainingSeconds(0);
        }}
        onNext={() =>
          setCurrentIndex((index) => Math.min(attempt.questions.length - 1, index + 1))
        }
        onPrevious={() => setCurrentIndex((index) => Math.max(0, index - 1))}
        onQuestionSelect={(index) =>
          setCurrentIndex(
            Math.min(Math.max(0, index), Math.max(0, attempt.questions.length - 1)),
          )
        }
        onSubmit={handleSubmit}
      />,
    );
  }

  if (!status) {
    return <EmptyPanel copy="Đang tải điều kiện mở bài thi…" />;
  }

  if (
    status.lockReason === "BEFORE_OPEN_TIME" ||
    status.lockReason === "TRIAL_NOT_ALLOWED"
  ) {
    return (
      <section className="rounded-[1.5rem] border border-sky-100 bg-white p-4 shadow-[0_20px_50px_-42px_rgb(2_132_199_/_60%)] dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] sm:p-5">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            <ClipboardCheck className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="min-w-0 text-lg font-black text-slate-950 dark:text-[var(--theme-text-strong)] sm:text-xl">
            Bài thi
          </h2>
          <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-rose-100 px-3 py-2 text-xs font-black text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
            <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
            Đang khóa
          </span>
        </div>
        <p className="mt-3 text-sm font-bold leading-6 text-slate-600 dark:text-[var(--theme-text-muted)] lg:text-base lg:leading-7">
          {status.lockReason === "BEFORE_OPEN_TIME"
            ? `Bài thi sẽ mở lúc ${formatDateTime(status.examOpenAt)}.`
            : "Bài thi không mở trong chế độ học thử."}
        </p>
      </section>
    );
  }

  const prerequisitesComplete = status.quiz.isCompleted && status.flashcard.isCompleted;
  const showQuizPrerequisiteAction = !status.quiz.isCompleted;
  const showFlashcardPrerequisiteAction = !status.flashcard.isCompleted;
  const prerequisiteDescription = prerequisitesComplete
    ? "Bài thi đã được mở khóa. Ôn tập lại Quiz và Flashcard để sẵn sàng thi nhé!"
    : status.quiz.isCompleted
      ? "Cần hoàn thành Flashcard để mở khóa bài thi."
      : status.flashcard.isCompleted
        ? "Cần hoàn thành Quiz để mở khóa bài thi."
        : "Cần hoàn thành Quiz và Flashcard để mở khóa bài thi.";
  const completedAttemptId =
    latestSubmittedAttemptId ??
    status.latestSubmittedAttempt?.id ??
    status.bestAttempt?.id ??
    null;
  const activeTestSet = status.sets[0];
  const hasTestQuestions = Boolean(activeTestSet && activeTestSet.questionCount > 0);
  const canStartTest = status.canStart && prerequisitesComplete && hasTestQuestions;
  const testStatusLabel =
    !activeTestSet || activeTestSet.questionCount === 0
      ? "0 câu"
      : canStartTest && activeTestSet
        ? `${activeTestSet.questionCount} câu`
        : "Đang khóa";
  const testHistoryItems: LearningHistoryDisplayItem[] = (
    historyQuery.data?.items ?? []
  ).map((item) => {
    const isPassed =
      item.state === "COMPLETED" &&
      typeof item.score === "number" &&
      item.score >= lesson.completionMinScore;
    return {
      id: item.id,
      setId: item.setId,
      displayName: item.displayName.replace("Bộ đề", "Bài thi"),
      state: item.state,
      startedAt: item.startedAt,
      completedAt: item.completedAt,
      summary:
        item.state === "NOT_STARTED"
          ? `${item.totalCount} câu`
          : `${item.correctCount}/${item.totalCount} câu đúng`,
      score:
        item.state === "COMPLETED" && item.score !== null
          ? `${formatTestScore(item.score)} điểm`
          : undefined,
      passed: isPassed,
    };
  });

  return renderWithCurtain(
    <>
      <section className="rounded-[1.5rem] border border-sky-100 bg-white p-4 shadow-[0_20px_50px_-42px_rgb(2_132_199_/_60%)] dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] sm:p-5">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            <ClipboardCheck className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="min-w-0 text-lg font-black text-slate-950 dark:text-[var(--theme-text-strong)] sm:text-xl">
            Bài thi
          </h2>
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <span
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-xl px-[11px] text-[13px] font-black",
                testStatusLabel === "Đang khóa"
                  ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
              )}
            >
              {testStatusLabel === "Đang khóa" ? (
                <LockKeyhole className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              )}
              {testStatusLabel}
            </span>
            {activeTestSet && activeTestSet.questionCount > 0 ? (
              <span
                data-testid="test-duration-badge"
                className="inline-flex items-center gap-1 rounded-xl bg-sky-100 px-2.5 py-2 text-xs font-black text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
              >
                <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                {formatDuration(activeTestSet.durationSeconds)}
              </span>
            ) : null}
            <LearningHistoryControl
              accent="test"
              countLabel={testStatusLabel}
              currentItemId={historyQuery.data?.currentItemId ?? undefined}
              errorMessage={
                historyQuery.error
                  ? "Chưa tải được lịch sử Bài thi. Vui lòng thử lại."
                  : null
              }
              isCoveredByChildSurface={Boolean(review && reviewOrigin === "HISTORY")}
              isLoading={historyQuery.isLoading && !historyQuery.data}
              isStartDisabled={!canStartTest}
              items={testHistoryItems}
              onOpenHistory={() => {
                if (!historyQuery.data) {
                  return historyQuery.refetch().then(() => undefined);
                }
              }}
              onReview={handleHistoryReview}
              onStart={handleHistoryStart}
              pendingActionKey={
                pendingAction?.startsWith("history-")
                  ? pendingAction.slice("history-".length)
                  : null
              }
              showCountLabel={false}
            />
          </div>
        </div>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600 dark:text-[var(--theme-text-muted)] sm:mt-4 lg:text-base lg:leading-7">
          {prerequisiteDescription}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-x-2 gap-y-3">
          {showQuizPrerequisiteAction ? (
            <button
              type="button"
              disabled={!hasQuizContent}
              onClick={() => void onStartPrerequisite("quiz")}
              className={cn(
                "student-quiz-cta-3d inline-flex min-h-14 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-2 text-[15px] font-black text-white focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 sm:px-3 sm:text-base",
                !showFlashcardPrerequisiteAction && "col-span-2",
              )}
            >
              <HelpCircle className="h-5 w-5" aria-hidden="true" />
              Làm Quiz
            </button>
          ) : null}
          {showFlashcardPrerequisiteAction ? (
            <button
              type="button"
              disabled={!hasFlashcardContent}
              onClick={() => void onStartPrerequisite("flashcard")}
              className={cn(
                "student-flashcard-cta-3d inline-flex min-h-14 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-violet-500 px-2 text-[15px] font-black text-white hover:bg-violet-400 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 sm:px-3 sm:text-base",
                !showQuizPrerequisiteAction && "col-span-2",
              )}
            >
              <Brain className="h-5 w-5" aria-hidden="true" />
              Làm Flashcard
            </button>
          ) : null}
          {completedAttemptId ? (
            <>
              <button
                type="button"
                aria-busy={pendingAction === "open-result"}
                disabled={pendingAction === "open-result"}
                onClick={() => void handleOpenResult(completedAttemptId)}
                className="student-test-cta-3d col-span-2 inline-flex min-h-14 min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-emerald-500 px-3 text-base font-black text-white hover:bg-emerald-400 focus-visible:outline-none disabled:cursor-wait disabled:opacity-50 sm:text-lg lg:col-span-1"
              >
                {pendingAction === "open-result" ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                ) : (
                  <Eye className="h-6 w-6 shrink-0" aria-hidden="true" />
                )}
                Xem lại bài thi
              </button>
              <button
                type="button"
                aria-busy={pendingAction === "start"}
                disabled={!canStartTest || pendingAction === "start"}
                onClick={() => void handleStart()}
                className="col-span-2 inline-flex min-h-14 min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border-2 border-emerald-500 bg-white px-3 text-base font-black text-emerald-700 transition hover:bg-emerald-50 active:translate-y-[3px] disabled:cursor-not-allowed disabled:opacity-45 dark:border-emerald-400 dark:bg-[var(--theme-surface)] dark:text-emerald-300 sm:text-lg lg:col-span-1"
              >
                <RefreshCcw className="h-5 w-5 shrink-0" aria-hidden="true" />
                Làm bài thi mới
              </button>
            </>
          ) : (
            <button
              type="button"
              aria-busy={pendingAction === "start"}
              disabled={!canStartTest || pendingAction === "start"}
              onClick={() => void handleStart()}
              className="student-test-cta-3d col-span-2 inline-flex min-h-14 w-full items-center justify-center gap-2.5 whitespace-nowrap rounded-2xl bg-emerald-500 px-5 text-lg font-black text-white hover:bg-emerald-400 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Play className="h-6 w-6" aria-hidden="true" />
              Bắt đầu bài thi
            </button>
          )}
        </div>
      </section>
      {review && reviewOrigin === "HISTORY" ? (
        <QuizReviewScreen
          accent="emerald"
          activityLabel="Bài thi"
          backLabel="Quay lại lịch sử Bài thi"
          currentIndex={reviewIndex}
          displayScope={review.scope}
          onBack={() => setReview(null)}
          onCurrentIndexChange={setReviewIndex}
          review={review}
          reviewTitle={historyReviewTitle ?? undefined}
          stackedOverDialog
          testId="test-history-review-screen"
        />
      ) : null}
    </>,
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

function formatTestScore(score: number) {
  return Number.isInteger(score) ? score.toFixed(0) : score.toFixed(2);
}

function waitForTestCurtain(durationMs: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}
