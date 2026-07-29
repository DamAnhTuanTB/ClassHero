"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useReducedMotion } from "framer-motion";
import { Eye, HelpCircle, Loader2, Play, RefreshCcw, RotateCcw } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type SetStateAction,
} from "react";
import { toast } from "sonner";
import {
  getCurrentQuizAttempt,
  getQuizAttemptStatus,
  reviewQuizAttempt,
  startQuizAttempt,
  submitQuizAttempt,
} from "@/features/student/lessons/api/student-lessons-api";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";
import { studentQuizAttemptStatusQueryKey } from "@/features/student/lessons/hooks/use-student-lesson-queries";
import { QuizCurtainTransition } from "@/features/student/lessons/screens/student-lesson-screen/components/quiz-curtain-transition";
import { QuizResultScreen } from "@/features/student/lessons/screens/student-lesson-screen/components/quiz-result-screen";
import { QuizReviewScreen } from "@/features/student/lessons/screens/student-lesson-screen/components/quiz-review-screen";
import {
  QuizRunnerLoadingScreen,
  QuizRunnerScreen,
} from "@/features/student/lessons/screens/student-lesson-screen/components/quiz-runner-screen";
import { useStableLoadingVisibility } from "@/lib/use-stable-loading-visibility";
import type {
  AssessmentReview,
  AttemptSummary,
  CheckedAnswer,
  QuizAttempt,
  QuizAttemptStatus,
  ResumableQuizAttempt,
  StudentAnswer,
  StudentLesson,
} from "@/features/student/lessons/types/student-lesson-types";
import {
  clearQuizResultHistoryMarker,
  clearQuizRunnerHistoryMarker,
  getQuizResultHistoryAttemptId,
  getQuizResultHistorySetId,
  getQuizRunnerHistoryAttemptId,
  getQuizRunnerHistorySetId,
  setQuizResultHistoryMarker,
} from "@/features/student/lessons/utils/quiz-runner-history";
import { getQuizEntryActionLabel } from "@/features/student/lessons/utils/quiz-entry-state";
import { getNextLearningSet } from "@/features/student/lessons/utils/learning-set-selection";
import {
  gradeStudentQuizAnswer,
  isStudentAnswerComplete,
} from "@/features/student/lessons/utils/student-answer-utils";
import {
  pickQuizTransitionVariant,
  quizTransitionTimings,
  type QuizTransitionPhase,
  type QuizTransitionVariant,
} from "@/features/student/lessons/utils/quiz-transition-variant";

type PreparedQuizAttempt = {
  answers: Record<string, StudentAnswer>;
  attempt: QuizAttempt;
  checkedCount: number;
  currentIndex: number;
  feedbackByQuestionId: Record<string, CheckedAnswer>;
};

type StudentQuizSet = StudentLesson["quizSets"][number];

export function QuizLearningPanel({
  lesson,
  onProgressChanged,
  token,
}: {
  lesson: StudentLesson;
  onProgressChanged: () => Promise<void>;
  token: string;
}) {
  const queryClient = useQueryClient();
  const userId = useAuthSessionStore((state) => state.session?.user.id);
  const [activeQuizSetId, setActiveQuizSetId] = useState(
    () =>
      getQuizRunnerHistorySetId() ??
      getQuizResultHistorySetId() ??
      lesson.quizSets[0]?.id ??
      "",
  );
  const quizSet =
    lesson.quizSets.find((candidate) => candidate.id === activeQuizSetId) ??
    lesson.quizSets[0];
  const quizSetId = quizSet?.id ?? "";
  const attemptStatusQuery = useQuery({
    queryKey: studentQuizAttemptStatusQueryKey(quizSetId, userId),
    queryFn: () => getQuizAttemptStatus(quizSetId, token),
    enabled: Boolean(token && quizSetId),
    staleTime: 30_000,
  });
  const attemptStatus = attemptStatusQuery.data ?? null;
  const isAttemptStatusPending = attemptStatusQuery.isLoading;
  const attemptStatusError = attemptStatusQuery.error;
  const shouldShowAttemptStatusLoading =
    useStableLoadingVisibility(isAttemptStatusPending);
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, StudentAnswer>>({});
  const [feedbackByQuestionId, setFeedbackByQuestionId] = useState<
    Record<string, CheckedAnswer>
  >({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHintOpen, setIsHintOpen] = useState(false);
  const [isExplanationOpen, setIsExplanationOpen] = useState(false);
  const [result, setResult] = useState<AttemptSummary | null>(null);
  const [shouldCelebrateResult, setShouldCelebrateResult] = useState(false);
  const [review, setReview] = useState<AssessmentReview | null>(null);
  const [reviewDisplayScope, setReviewDisplayScope] = useState<"ALL" | "INCORRECT">(
    "ALL",
  );
  const [reviewIndex, setReviewIndex] = useState(0);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [isResumePending, setIsResumePending] = useState(() =>
    Boolean(getQuizRunnerHistoryAttemptId() || getQuizResultHistoryAttemptId()),
  );
  const [isFullscreenResumePending, setIsFullscreenResumePending] =
    useState(isResumePending);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [resumeVersion, setResumeVersion] = useState(0);
  const [curtainPhase, setCurtainPhase] = useState<QuizTransitionPhase>("idle");
  const [transitionVariant, setTransitionVariant] =
    useState<QuizTransitionVariant>("book");
  const lastTransitionVariantRef = useRef<QuizTransitionVariant | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const setAttemptStatusForQuizSet = useCallback(
    (targetQuizSetId: string, nextStatus: SetStateAction<QuizAttemptStatus | null>) => {
      queryClient.setQueryData<QuizAttemptStatus | null>(
        studentQuizAttemptStatusQueryKey(targetQuizSetId, userId),
        (currentStatus) =>
          typeof nextStatus === "function"
            ? nextStatus(currentStatus ?? null)
            : nextStatus,
      );
    },
    [queryClient, userId],
  );

  useEffect(() => {
    if (!quizSetId || !token) {
      setIsResumePending(false);
      return;
    }

    const runnerAttemptId = getQuizRunnerHistoryAttemptId();
    const resultAttemptId = getQuizResultHistoryAttemptId();
    if (!runnerAttemptId && !resultAttemptId) {
      setIsFullscreenResumePending(false);
      setIsResumePending(false);
      setResumeError(null);
      return;
    }
    if (isAttemptStatusPending || !attemptStatus) {
      setIsFullscreenResumePending(true);
      setIsResumePending(true);
      return;
    }

    let isCancelled = false;
    setIsFullscreenResumePending(true);
    setIsResumePending(true);
    setResumeError(null);

    const currentAttemptRequest = runnerAttemptId
      ? getCurrentQuizAttempt(quizSetId, token)
      : Promise.resolve(null);

    void currentAttemptRequest
      .then((currentAttempt) => {
        if (isCancelled) return;
        const storedProgress = readStoredQuizPosition(quizSetId);
        const localCheckedCount =
          storedProgress?.attemptId === attemptStatus.currentAttemptId
            ? Object.keys(storedProgress.checkedAnswers ?? {}).length
            : 0;
        if (localCheckedCount > attemptStatus.checkedCount) {
          setAttemptStatusForQuizSet(quizSetId, {
            ...attemptStatus,
            checkedCount: localCheckedCount,
          });
        }
        if (resultAttemptId) {
          const latestResult = attemptStatus.latestSubmittedAttempt;
          if (latestResult?.id === resultAttemptId) {
            if (result?.id !== resultAttemptId) {
              setShouldCelebrateResult(false);
              setResult(latestResult);
            }
            return;
          }
          clearQuizResultHistoryMarker();
        }
        if (!runnerAttemptId) return;
        if (!currentAttempt) {
          clearStoredQuizPosition(quizSetId);
          clearQuizRunnerHistoryMarker();
          return;
        }
        if (currentAttempt.id !== runnerAttemptId) {
          clearQuizRunnerHistoryMarker();
          return;
        }

        const resumedState = createResumedQuizState(currentAttempt, quizSetId);

        setAttempt(currentAttempt);
        setAnswers(resumedState.answers);
        setFeedbackByQuestionId(resumedState.feedbackByQuestionId);
        setCurrentIndex(resumedState.currentIndex);
      })
      .catch((error: unknown) => {
        if (isCancelled) return;
        setResumeError(getErrorMessage(error));
      })
      .finally(() => {
        if (!isCancelled) {
          setIsFullscreenResumePending(false);
          setIsResumePending(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [
    attemptStatus,
    isAttemptStatusPending,
    quizSetId,
    result,
    resumeVersion,
    setAttemptStatusForQuizSet,
    token,
  ]);

  useEffect(() => {
    if (!quizSetId || !attempt) return;
    const checkedAnswers = Object.fromEntries(
      Object.keys(feedbackByQuestionId).flatMap((questionId) => {
        const answer = answers[questionId];
        return answer === undefined ? [] : [[questionId, answer]];
      }),
    );
    writeStoredQuizPosition(quizSetId, {
      attemptId: attempt.id,
      currentIndex,
      checkedAnswers,
    });
  }, [answers, attempt, currentIndex, feedbackByQuestionId, quizSetId]);

  if (!quizSet) {
    return <EmptyPanel copy="Bài học này chưa có bộ Quiz được duyệt." />;
  }
  const activeQuizSet = quizSet;

  function renderWithCurtain(content: ReactNode) {
    return (
      <>
        {content}
        <QuizCurtainTransition phase={curtainPhase} variant={transitionVariant} />
      </>
    );
  }

  async function handleStart(
    scope: "ALL" | "INCORRECT",
    sourceAttemptId?: string,
    targetQuizSet: StudentQuizSet = activeQuizSet,
  ) {
    if (!token || pendingAction) return;
    clearQuizResultHistoryMarker();
    setShouldCelebrateResult(false);
    setPendingAction(`start-${scope}`);
    // const nextTransitionVariant: QuizTransitionVariant = "paper-tear";
    const nextTransitionVariant = pickQuizTransitionVariant(
      lastTransitionVariantRef.current,
    );
    lastTransitionVariantRef.current = nextTransitionVariant;
    setTransitionVariant(nextTransitionVariant);
    setCurtainPhase("closing");

    const closeDelay = waitForCurtain(
      shouldReduceMotion
        ? quizTransitionTimings.reducedCloseMs
        : quizTransitionTimings.closeMs,
    );
    const prepareAttempt = prepareQuizAttempt(targetQuizSet, scope, sourceAttemptId);
    const [, prepareResult] = await Promise.allSettled([closeDelay, prepareAttempt]);
    setCurtainPhase("closed");

    try {
      if (prepareResult.status === "rejected") {
        throw prepareResult.reason;
      }

      await waitForCurtain(shouldReduceMotion ? 0 : quizTransitionTimings.holdMs);
      applyPreparedQuizAttempt(prepareResult.value, targetQuizSet.id);
    } catch (error) {
      toast.error("Chưa bắt đầu được Quiz", { description: getErrorMessage(error) });
    } finally {
      setCurtainPhase("opening");
      await waitForCurtain(
        shouldReduceMotion
          ? quizTransitionTimings.reducedOpenMs
          : quizTransitionTimings.openMs,
      );
      setCurtainPhase("idle");
      setPendingAction(null);
    }
  }

  async function prepareQuizAttempt(
    targetQuizSet: StudentQuizSet,
    scope: "ALL" | "INCORRECT",
    sourceAttemptId?: string,
  ): Promise<PreparedQuizAttempt> {
    if (scope === "ALL" && !sourceAttemptId) {
      const currentAttempt = await getCurrentQuizAttempt(targetQuizSet.id, token);
      if (currentAttempt && !currentAttempt.sourceAttemptId) {
        const resumedState = createResumedQuizState(currentAttempt, targetQuizSet.id);
        const checkedCount = Object.keys(resumedState.feedbackByQuestionId).length;
        return {
          answers: resumedState.answers,
          attempt: currentAttempt,
          checkedCount,
          currentIndex: checkedCount === 0 ? 0 : resumedState.currentIndex,
          feedbackByQuestionId: resumedState.feedbackByQuestionId,
        };
      }
    }

    const nextAttempt = await startQuizAttempt(targetQuizSet.id, token, {
      scope,
      sourceAttemptId,
    });

    return {
      answers: {},
      attempt: nextAttempt,
      checkedCount: 0,
      currentIndex: 0,
      feedbackByQuestionId: {},
    };
  }

  function applyPreparedQuizAttempt(
    preparedAttempt: PreparedQuizAttempt,
    targetQuizSetId: string,
  ) {
    setAttemptStatusForQuizSet(targetQuizSetId, (current) => ({
      state: "IN_PROGRESS",
      currentAttemptId: preparedAttempt.attempt.id,
      checkedCount: preparedAttempt.checkedCount,
      latestSubmittedAttempt: current?.latestSubmittedAttempt ?? null,
    }));
    setActiveQuizSetId(targetQuizSetId);
    setAttempt(preparedAttempt.attempt);
    setAnswers(preparedAttempt.answers);
    setFeedbackByQuestionId(preparedAttempt.feedbackByQuestionId);
    setCurrentIndex(preparedAttempt.currentIndex);
    setIsHintOpen(false);
    setIsExplanationOpen(false);
    setResult(null);
    setReview(null);
  }

  function handleCheck() {
    const question = attempt?.questions[currentIndex];
    const answer = question ? answers[question.id] : undefined;
    if (
      !attempt ||
      !question ||
      answer === undefined ||
      !isStudentAnswerComplete(question, answer) ||
      pendingAction
    ) {
      return;
    }
    try {
      const feedback = gradeStudentQuizAnswer(question, answer);
      setFeedbackByQuestionId((current) => ({
        ...current,
        [question.id]: feedback,
      }));
      setIsExplanationOpen(false);
    } catch (error) {
      toast.error("Chưa kiểm tra được đáp án", {
        description: getErrorMessage(error),
      });
    }
  }

  async function handleSubmit() {
    if (!attempt || pendingAction) return false;
    setPendingAction("submit");
    try {
      const submittedAnswers = attempt.questions.flatMap((question) => {
        const answer = answers[question.id];
        if (answer === undefined || !isStudentAnswerComplete(question, answer)) {
          return [];
        }
        return [{ answerJson: answer, questionId: question.id }];
      });
      if (submittedAnswers.length !== attempt.questions.length) {
        return false;
      }

      const nextResult = await submitQuizAttempt(attempt.id, submittedAnswers, token);
      const aggregateResult = nextResult.aggregateResult;
      clearStoredQuizPosition(activeQuizSet.id);
      setQuizResultHistoryMarker(aggregateResult.id, activeQuizSet.id);
      setShouldCelebrateResult(true);
      setResult(aggregateResult);
      setAttempt(null);
      setAttemptStatusForQuizSet(activeQuizSet.id, {
        state: "COMPLETED",
        currentAttemptId: null,
        checkedCount: aggregateResult.totalCount,
        latestSubmittedAttempt: aggregateResult,
      });
      await onProgressChanged();
      return true;
    } catch (error) {
      toast.error("Chưa hoàn thành được Quiz", {
        description: getErrorMessage(error),
      });
      return false;
    } finally {
      setPendingAction(null);
    }
  }

  async function handleReview(
    scope: "ALL" | "INCORRECT",
    sourceResult: AttemptSummary | null = result,
  ) {
    if (!sourceResult || pendingAction) return;
    setShouldCelebrateResult(false);
    setPendingAction(`review-${scope}`);
    try {
      const nextReview = await reviewQuizAttempt(sourceResult.id, "ALL", token);
      setResult(sourceResult);
      setReview(nextReview);
      setReviewDisplayScope(scope);
      setReviewIndex(0);
    } catch (error) {
      toast.error("Chưa tải được phần xem lại", {
        description: getErrorMessage(error),
      });
    } finally {
      setPendingAction(null);
    }
  }

  if (review) {
    return renderWithCurtain(
      <QuizReviewScreen
        review={review}
        displayScope={reviewDisplayScope}
        currentIndex={reviewIndex}
        onBack={() => setReview(null)}
        onCurrentIndexChange={setReviewIndex}
      />,
    );
  }

  if (result) {
    return renderWithCurtain(
      <QuizResultScreen
        result={result}
        pendingAction={pendingAction}
        shouldCelebrate={shouldCelebrateResult}
        onBack={() => {
          clearQuizResultHistoryMarker();
          setShouldCelebrateResult(false);
          setResult(null);
        }}
        onReviewAll={() => void handleReview("ALL")}
        onReviewIncorrect={() => void handleReview("INCORRECT")}
        onRestartAll={() => void handleStart("ALL")}
        onRestartIncorrect={() => void handleStart("INCORRECT", result.id)}
      />,
    );
  }

  if (isResumePending && isFullscreenResumePending) {
    return renderWithCurtain(<QuizRunnerLoadingScreen />);
  }

  if (isAttemptStatusPending || shouldShowAttemptStatusLoading) {
    return renderWithCurtain(
      shouldShowAttemptStatusLoading ? (
        <QuizPanelSkeleton />
      ) : (
        <div aria-busy="true" className="min-h-56" />
      ),
    );
  }

  if (!attemptStatus && attemptStatusError) {
    return renderWithCurtain(
      <PanelState
        copy="Chưa thể tải trạng thái Quiz."
        actionLabel="Thử lại"
        onAction={() => void attemptStatusQuery.refetch()}
      />,
    );
  }

  if (resumeError) {
    return renderWithCurtain(
      <PanelState
        copy="Chưa thể mở lại lượt Quiz đang làm."
        actionLabel="Thử lại"
        onAction={() => setResumeVersion((version) => version + 1)}
      />,
    );
  }

  if (!attempt) {
    const completedAttempt =
      attemptStatus?.state === "COMPLETED" ? attemptStatus.latestSubmittedAttempt : null;
    const isCompleted = completedAttempt !== null;
    const entryActionLabel = getQuizEntryActionLabel(attemptStatus);
    const EntryActionIcon = isCompleted ? Eye : Play;

    return renderWithCurtain(
      <section className="rounded-[1.5rem] border border-sky-100 bg-white p-4 shadow-[0_20px_50px_-42px_rgb(2_132_199_/_60%)] dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] sm:p-5">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
            <HelpCircle className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="min-w-0 text-base font-black text-slate-950 dark:text-[var(--theme-text-strong)] sm:text-lg">
            Quiz
          </h2>
          <span className="ml-auto shrink-0 rounded-xl bg-sky-100 px-3 py-2 text-xs font-black text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
            {activeQuizSet.questionCount} câu
          </span>
        </div>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600 dark:text-[var(--theme-text-muted)] sm:mt-4">
          Cùng luyện tập kiến thức vừa học xong nhé.
        </p>
        <button
          type="button"
          onClick={() => {
            if (completedAttempt) {
              setQuizResultHistoryMarker(completedAttempt.id, activeQuizSet.id);
              setShouldCelebrateResult(false);
              setResult(completedAttempt);
              return;
            }
            void handleStart("ALL");
          }}
          disabled={Boolean(pendingAction)}
          className="student-quiz-cta-3d mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2.5 whitespace-nowrap rounded-2xl px-5 text-lg font-black text-white focus-visible:outline-none disabled:cursor-wait disabled:opacity-70"
        >
          {!isCompleted && pendingAction ? (
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
          ) : (
            <EntryActionIcon className="h-6 w-6" aria-hidden="true" />
          )}
          {entryActionLabel}
        </button>
        {isCompleted ? (
          <button
            type="button"
            onClick={() =>
              void handleStart(
                "ALL",
                undefined,
                getNextLearningSet(lesson.quizSets, activeQuizSet.id),
              )
            }
            disabled={Boolean(pendingAction)}
            className="mt-3 inline-flex min-h-14 w-full items-center justify-center gap-2.5 whitespace-nowrap rounded-2xl border-2 border-sky-300 bg-white px-5 text-lg font-black text-sky-700 transition hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100 disabled:cursor-wait disabled:opacity-70 dark:border-sky-400/50 dark:bg-[var(--theme-surface)] dark:text-sky-300 dark:hover:bg-sky-500/10"
          >
            {pendingAction === "start-ALL" ? (
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
            ) : (
              <RotateCcw className="h-6 w-6" aria-hidden="true" />
            )}
            Làm bộ Quiz mới
          </button>
        ) : null}
      </section>,
    );
  }

  const question = attempt.questions[currentIndex];
  if (!question) {
    return renderWithCurtain(<EmptyPanel copy="Bộ Quiz chưa có câu hỏi phù hợp." />);
  }
  const answer = answers[question.id];
  const feedback = feedbackByQuestionId[question.id];
  const answeredQuestionIds = attempt.questions.flatMap((item) =>
    isStudentAnswerComplete(item, answers[item.id]) ? [item.id] : [],
  );

  return renderWithCurtain(
    <QuizRunnerScreen
      attempt={attempt}
      currentIndex={currentIndex}
      answer={answer}
      feedback={feedback}
      feedbackByQuestionId={feedbackByQuestionId}
      answeredQuestionIds={answeredQuestionIds}
      lessonTitle={lesson.title}
      pendingAction={pendingAction}
      isHintOpen={isHintOpen}
      isExplanationOpen={isExplanationOpen}
      onAnswerChange={(nextAnswer) =>
        setAnswers((current) => ({ ...current, [question.id]: nextAnswer }))
      }
      onBack={() => {
        clearQuizRunnerHistoryMarker();
        const sourceResult = attemptStatus?.latestSubmittedAttempt ?? null;
        if (attempt.sourceAttemptId && sourceResult) {
          setQuizResultHistoryMarker(sourceResult.id, activeQuizSet.id);
          setShouldCelebrateResult(false);
          setAttemptStatusForQuizSet(activeQuizSet.id, {
            state: "COMPLETED",
            currentAttemptId: null,
            checkedCount: sourceResult.totalCount,
            latestSubmittedAttempt: sourceResult,
          });
          setResult(sourceResult);
        } else {
          setAttemptStatusForQuizSet(activeQuizSet.id, (current) => ({
            state: "IN_PROGRESS",
            currentAttemptId: attempt.id,
            checkedCount: Object.keys(feedbackByQuestionId).length,
            latestSubmittedAttempt: current?.latestSubmittedAttempt ?? null,
          }));
        }
        setAttempt(null);
        setAnswers({});
        setFeedbackByQuestionId({});
        setCurrentIndex(0);
        setIsHintOpen(false);
        setIsExplanationOpen(false);
      }}
      onToggleHint={() => setIsHintOpen((open) => !open)}
      onToggleExplanation={() => setIsExplanationOpen((open) => !open)}
      onPrevious={() => {
        setCurrentIndex((index) => Math.max(0, index - 1));
        setIsHintOpen(false);
        setIsExplanationOpen(false);
      }}
      onQuestionSelect={(index) => {
        setCurrentIndex(
          Math.min(Math.max(0, index), Math.max(0, attempt.questions.length - 1)),
        );
        setIsHintOpen(false);
        setIsExplanationOpen(false);
      }}
      onCheck={handleCheck}
      onSubmit={handleSubmit}
      onNext={() => {
        setCurrentIndex((index) => Math.min(attempt.questions.length - 1, index + 1));
        setIsHintOpen(false);
        setIsExplanationOpen(false);
      }}
    />,
  );
}

function EmptyPanel({ copy }: { copy: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-sm font-bold text-slate-500 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] dark:text-[var(--theme-text-muted)]">
      {copy}
    </div>
  );
}

function QuizPanelSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Đang tải nội dung Quiz"
      className="min-h-56 animate-pulse rounded-[1.5rem] border border-sky-100 bg-white p-4 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] sm:p-5"
    >
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-sky-100 dark:bg-sky-500/15" />
        <div className="h-5 w-20 rounded-full bg-slate-200 dark:bg-slate-700" />
        <div className="ml-auto h-9 w-16 rounded-xl bg-sky-100 dark:bg-sky-500/15" />
      </div>
      <div className="mt-5 h-4 w-3/4 rounded-full bg-slate-200 dark:bg-slate-700" />
      <div className="mt-3 h-4 w-1/2 rounded-full bg-slate-100 dark:bg-slate-800" />
      <div className="mt-6 h-14 w-full rounded-2xl bg-sky-100 dark:bg-sky-500/15" />
    </section>
  );
}

function PanelState({
  actionLabel,
  copy,
  onAction,
}: {
  actionLabel?: string;
  copy: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-white px-5 py-8 text-center dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)]">
      <div className="flex items-center justify-center gap-2 text-sm font-bold text-slate-600 dark:text-[var(--theme-text-muted)]">
        <span>{copy}</span>
      </div>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-sky-500 px-4 text-base font-black text-white transition hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100"
        >
          <RefreshCcw className="h-5 w-5" aria-hidden="true" />
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function getQuizProgressStorageKey(quizSetId: string) {
  return `student-quiz-progress:${quizSetId}`;
}

type StoredQuizPosition = {
  attemptId: string;
  currentIndex: number;
  checkedAnswers?: Record<string, StudentAnswer>;
};

function createResumedQuizState(currentAttempt: ResumableQuizAttempt, quizSetId: string) {
  const storedProgress = readStoredQuizPosition(quizSetId);
  const answers: Record<string, StudentAnswer> = Object.fromEntries(
    currentAttempt.checkedAnswers.map((checkedAnswer) => [
      checkedAnswer.questionId,
      checkedAnswer.answerJson,
    ]),
  );
  const feedbackByQuestionId: Record<string, CheckedAnswer> = Object.fromEntries(
    currentAttempt.checkedAnswers.map((checkedAnswer) => [
      checkedAnswer.questionId,
      checkedAnswer.feedback,
    ]),
  );
  if (storedProgress?.attemptId === currentAttempt.id) {
    Object.entries(storedProgress.checkedAnswers ?? {}).forEach(
      ([questionId, storedAnswer]) => {
        const question = currentAttempt.questions.find((item) => item.id === questionId);
        if (
          !question ||
          feedbackByQuestionId[questionId] !== undefined ||
          !isStudentAnswerComplete(question, storedAnswer)
        ) {
          return;
        }
        try {
          answers[questionId] = storedAnswer;
          feedbackByQuestionId[questionId] = gradeStudentQuizAnswer(
            question,
            storedAnswer,
          );
        } catch {
          delete answers[questionId];
        }
      },
    );
  }
  const firstUncheckedIndex = currentAttempt.questions.findIndex(
    (question) => feedbackByQuestionId[question.id] === undefined,
  );
  const preferredIndex =
    storedProgress?.attemptId === currentAttempt.id
      ? storedProgress.currentIndex
      : firstUncheckedIndex >= 0
        ? firstUncheckedIndex
        : Math.max(0, currentAttempt.questions.length - 1);

  return {
    answers,
    feedbackByQuestionId,
    currentIndex: Math.min(
      Math.max(0, preferredIndex),
      Math.max(0, currentAttempt.questions.length - 1),
    ),
  };
}

function readStoredQuizPosition(quizSetId: string): StoredQuizPosition | null {
  if (typeof window === "undefined") return null;

  try {
    const rawValue = window.localStorage.getItem(getQuizProgressStorageKey(quizSetId));
    if (!rawValue) return null;
    const parsed = JSON.parse(rawValue) as unknown;
    if (!isStoredQuizPosition(parsed)) {
      clearStoredQuizPosition(quizSetId);
      return null;
    }
    return parsed;
  } catch {
    clearStoredQuizPosition(quizSetId);
    return null;
  }
}

function writeStoredQuizPosition(quizSetId: string, position: StoredQuizPosition) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      getQuizProgressStorageKey(quizSetId),
      JSON.stringify(position),
    );
  } catch {
    // Local progress persistence must not block the server-side attempt flow.
  }
}

function clearStoredQuizPosition(quizSetId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(getQuizProgressStorageKey(quizSetId));
  } catch {
    // Storage cleanup must not block the server-side attempt flow.
  }
}

function isStoredQuizPosition(value: unknown): value is StoredQuizPosition {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.attemptId === "string" &&
    Number.isInteger(candidate.currentIndex) &&
    (candidate.checkedAnswers === undefined ||
      (typeof candidate.checkedAnswers === "object" &&
        candidate.checkedAnswers !== null &&
        !Array.isArray(candidate.checkedAnswers)))
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Vui lòng thử lại.";
}

function waitForCurtain(durationMs: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}
