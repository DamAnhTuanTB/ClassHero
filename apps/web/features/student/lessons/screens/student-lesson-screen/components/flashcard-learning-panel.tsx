"use client";

import { useQuery } from "@tanstack/react-query";
import { useReducedMotion } from "framer-motion";
import { Brain, Eye, Play, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  getFlashcardHistory,
  getFlashcardStudySession,
  startFlashcardStudySession,
  toggleFlashcardFavorite,
  updateFlashcardProgress,
} from "@/features/student/lessons/api/student-lessons-api";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import { FlashcardResultScreen } from "@/features/student/lessons/screens/student-lesson-screen/components/flashcard-result-screen";
import { FlashcardRunnerScreen } from "@/features/student/lessons/screens/student-lesson-screen/components/flashcard-runner-screen";
import {
  LearningHistoryControl,
  type LearningHistoryDisplayItem,
} from "@/features/student/lessons/screens/student-lesson-screen/components/learning-history-control";
import { QuizCurtainTransition } from "@/features/student/lessons/screens/student-lesson-screen/components/quiz-curtain-transition";
import type {
  FlashcardProgressSummary,
  FlashcardStudySession,
  StudentFlashcard,
  StudentFlashcardSet,
  StudentLearningSurface,
  StudentLesson,
} from "@/features/student/lessons/types/student-lesson-types";
import {
  clearFlashcardRunnerHistoryMarker,
  clearFlashcardResultHistoryMarker,
  clearStoredFlashcardSession,
  getFlashcardRunnerHistorySetId,
  getFlashcardResultHistorySetId,
  pushFlashcardResultHistoryEntry,
  readStoredFlashcardActiveSetId,
  readStoredFlashcardSession,
  setFlashcardResultHistoryMarker,
  writeStoredFlashcardActiveSetId,
  writeStoredFlashcardSession,
} from "@/features/student/lessons/utils/flashcard-runner-history";
import { getNextLearningSet } from "@/features/student/lessons/utils/learning-set-selection";
import {
  pickQuizTransitionVariant,
  quizTransitionTimings,
  type QuizTransitionPhase,
  type QuizTransitionVariant,
} from "@/features/student/lessons/utils/quiz-transition-variant";

type SessionMode = "ALL" | "FAVORITE" | "REVIEW_ALL" | "UNKNOWN" | "UNREVIEWED";
type FlashcardScreen = "PANEL" | "RUNNER" | "RESULT";

export function FlashcardLearningPanel({
  autoStart,
  initialSurface,
  lesson,
  onAutoStartHandled,
  onProgressChanged,
  sets,
  token,
}: {
  autoStart: boolean;
  initialSurface: Extract<
    StudentLearningSurface,
    { kind: "flashcard-runner" | "flashcard-result" }
  > | null;
  lesson: StudentLesson;
  onAutoStartHandled: (target: "flashcard" | "quiz") => void;
  onProgressChanged: () => Promise<void>;
  sets: StudentFlashcardSet[];
  token: string;
}) {
  const userId = useAuthSessionStore((state) => state.session?.user.id);
  const [activeSetId, setActiveSetId] = useState(() => {
    const candidateId =
      initialSurface?.setId ?? readStoredFlashcardActiveSetId(lesson.id, userId);

    return (
      sets.find((candidate) => candidate.id === candidateId)?.id ?? sets[0]?.id ?? ""
    );
  });
  const set = sets.find((candidate) => candidate.id === activeSetId) ?? sets[0];
  const [initialSession] = useState(() =>
    set
      ? readStoredFlashcardSession(set.id, new Set(set.flashcards.map((card) => card.id)))
      : null,
  );
  const historyQuery = useQuery({
    queryKey: ["student", "lesson", lesson.id, "flashcard-history"],
    queryFn: () => getFlashcardHistory(lesson.id, token),
    enabled: false,
    staleTime: 15_000,
  });
  const [screen, setScreen] = useState<FlashcardScreen>(() =>
    initialSurface?.kind === "flashcard-result" &&
    set?.progress.isCompleted &&
    initialSurface.setId === set.id
      ? "RESULT"
      : initialSurface?.kind === "flashcard-runner" &&
          set &&
          initialSession &&
          initialSurface.setId === set.id
        ? "RUNNER"
        : "PANEL",
  );
  const [historyReviewTitle, setHistoryReviewTitle] = useState<string | null>(null);
  const [runnerBackDestination, setRunnerBackDestination] = useState<
    Exclude<FlashcardScreen, "RUNNER">
  >(initialSession?.backDestination ?? "PANEL");
  const [sessionCardIds, setSessionCardIds] = useState<string[]>(
    initialSession?.cardIds ?? [],
  );
  const [sessionReviewedIds, setSessionReviewedIds] = useState<Set<string>>(
    () => new Set(initialSession?.reviewedCardIds),
  );
  const sessionReviewedIdsRef = useRef(sessionReviewedIds);
  const [sessionResumesSavedProgress, setSessionResumesSavedProgress] = useState(
    initialSession?.resumesSavedProgress ?? false,
  );
  const [
    shouldCollapseResultHistoryOnComplete,
    setShouldCollapseResultHistoryOnComplete,
  ] = useState(initialSession?.shouldCollapseResultHistoryOnComplete ?? false);
  const [studySessionId, setStudySessionId] = useState<string | null>(
    initialSession?.sessionId ?? null,
  );
  const [currentIndex, setCurrentIndex] = useState(initialSession?.currentIndex ?? 0);
  const [isBackVisible, setIsBackVisible] = useState(
    initialSession?.isBackVisible ?? false,
  );
  const [knownOverrides, setKnownOverrides] = useState<Record<string, boolean>>({});
  const [favoriteOverrides, setFavoriteOverrides] = useState<Record<string, boolean>>({});
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [shouldCelebrateResult, setShouldCelebrateResult] = useState(false);
  const [curtainPhase, setCurtainPhase] = useState<QuizTransitionPhase>("idle");
  const [transitionVariant, setTransitionVariant] =
    useState<QuizTransitionVariant>("book");
  const didValidateInitialSurfaceRef = useRef(false);
  const autoStartTriggeredRef = useRef(false);
  const autoStartWasPendingRef = useRef(false);
  const entryActionButtonRef = useRef<HTMLButtonElement>(null);
  const lastTransitionVariantRef = useRef<QuizTransitionVariant | null>(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!set) return;
    writeStoredFlashcardActiveSetId(lesson.id, set.id, userId);
  }, [lesson.id, set, userId]);

  useEffect(() => {
    if (didValidateInitialSurfaceRef.current || !set) return;
    didValidateInitialSurfaceRef.current = true;

    const runnerMarkerSetId = getFlashcardRunnerHistorySetId();
    const resultMarkerSetId = getFlashcardResultHistorySetId();
    if (
      initialSurface?.kind !== "flashcard-runner" ||
      initialSurface.setId !== runnerMarkerSetId ||
      !initialSession
    ) {
      clearFlashcardRunnerHistoryMarker();
    }
    if (
      initialSurface?.kind !== "flashcard-result" ||
      initialSurface.setId !== resultMarkerSetId
    ) {
      clearFlashcardResultHistoryMarker();
    }
  }, [initialSession, initialSurface, set]);

  useEffect(() => {
    sessionReviewedIdsRef.current = sessionReviewedIds;
  }, [sessionReviewedIds]);

  useEffect(() => {
    if (screen !== "RESULT" || shouldCollapseResultHistoryOnComplete) return;

    function handleResultPopState() {
      clearFlashcardResultHistoryMarker();
      setShouldCelebrateResult(false);
      setScreen("PANEL");
    }

    window.addEventListener("popstate", handleResultPopState);
    return () => window.removeEventListener("popstate", handleResultPopState);
  }, [screen, shouldCollapseResultHistoryOnComplete]);

  useEffect(() => {
    if (!set || sessionCardIds.length === 0 || screen === "RESULT") return;

    writeStoredFlashcardSession(set.id, {
      backDestination: runnerBackDestination,
      cardIds: sessionCardIds,
      currentIndex,
      isBackVisible,
      resumesSavedProgress: sessionResumesSavedProgress,
      shouldCollapseResultHistoryOnComplete,
      reviewedCardIds: Array.from(sessionReviewedIds),
      sessionId: studySessionId ?? undefined,
    });
  }, [
    currentIndex,
    isBackVisible,
    runnerBackDestination,
    screen,
    sessionCardIds,
    sessionResumesSavedProgress,
    sessionReviewedIds,
    set,
    shouldCollapseResultHistoryOnComplete,
    studySessionId,
  ]);

  const cardById = useMemo(
    () => new Map(set?.flashcards.map((card) => [card.id, card]) ?? []),
    [set],
  );
  const sessionCards = useMemo(
    () =>
      sessionCardIds.flatMap((cardId) => {
        const card = cardById.get(cardId);
        return card ? [card] : [];
      }),
    [cardById, sessionCardIds],
  );

  const activeSet =
    set ??
    ({
      id: "",
      lessonId: lesson.id,
      title: "Flashcard",
      cardCount: 0,
      flashcards: [],
      progress: {
        totalCount: 0,
        reviewedCount: 0,
        knownCount: 0,
        unknownCount: 0,
        unreviewedCount: 0,
        isCompleted: false,
      },
    } satisfies StudentFlashcardSet);
  const hasFlashcards = activeSet.flashcards.length > 0;

  const progress = buildProgress(activeSet, knownOverrides);
  const favoriteCardCount = activeSet.flashcards.filter(
    (card) => favoriteOverrides[card.id] ?? card.isFavorite,
  ).length;
  const currentCard = sessionCards[currentIndex];
  const sessionReviewStatuses = sessionCards.map((card) =>
    sessionReviewedIds.has(card.id)
      ? (knownOverrides[card.id] ?? card.progress?.isKnown ?? null)
      : null,
  );
  const sessionKnownCount = sessionReviewStatuses.filter(
    (status) => status === true,
  ).length;
  const hasPendingSession =
    sessionCards.length > 0 && sessionReviewedIds.size < sessionCards.length;
  const entryActionLabel = hasPendingSession
    ? "Tiếp tục học"
    : progress.isCompleted
      ? "Xem lại"
      : progress.reviewedCount > 0
        ? "Tiếp tục học"
        : "Bắt đầu";
  const EntryActionIcon = progress.isCompleted && !hasPendingSession ? Eye : Play;

  useEffect(() => {
    if (!autoStart) {
      autoStartTriggeredRef.current = false;
      autoStartWasPendingRef.current = false;
      return;
    }
    if (!hasFlashcards) {
      void onAutoStartHandled("flashcard");
      return;
    }
    if (autoStartTriggeredRef.current || screen !== "PANEL" || pendingAction) {
      return;
    }

    const entryActionButton = entryActionButtonRef.current;
    if (!entryActionButton || entryActionButton.disabled) return;

    autoStartTriggeredRef.current = true;
    entryActionButton.click();
  }, [autoStart, hasFlashcards, onAutoStartHandled, pendingAction, screen]);

  useEffect(() => {
    if (!autoStart || !autoStartTriggeredRef.current) return;
    if (pendingAction) autoStartWasPendingRef.current = true;

    const didFinishStarting =
      screen === "RUNNER" ||
      screen === "RESULT" ||
      (autoStartWasPendingRef.current &&
        pendingAction === null &&
        curtainPhase === "idle");
    if (!didFinishStarting) return;

    autoStartTriggeredRef.current = false;
    autoStartWasPendingRef.current = false;
    void onAutoStartHandled("flashcard");
  }, [autoStart, curtainPhase, onAutoStartHandled, pendingAction, screen]);

  function renderWithCurtain(content: ReactNode) {
    return (
      <>
        {content}
        <QuizCurtainTransition
          ariaLabel="Đang chuẩn bị Flashcard"
          phase={curtainPhase}
          statusText="Đang chuẩn bị Flashcard..."
          variant={transitionVariant}
        />
      </>
    );
  }

  async function transitionTo(action: () => void | Promise<void>, actionKey = "start") {
    if (pendingAction) return;
    setPendingAction(actionKey);
    const nextVariant = pickQuizTransitionVariant(lastTransitionVariantRef.current);
    lastTransitionVariantRef.current = nextVariant;
    setTransitionVariant(nextVariant);
    setCurtainPhase("closing");

    await waitForCurtain(
      shouldReduceMotion
        ? quizTransitionTimings.reducedCloseMs
        : quizTransitionTimings.closeMs,
    );
    setCurtainPhase("closed");
    try {
      await action();
      await waitForCurtain(shouldReduceMotion ? 0 : quizTransitionTimings.holdMs);
    } catch (error) {
      toast.error("Chưa mở được bộ thẻ ghi nhớ", {
        description: getErrorMessage(error),
      });
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

  function getCardsForMode(
    nextMode: SessionMode,
    targetSet: StudentFlashcardSet = activeSet,
  ) {
    if (nextMode === "ALL" || nextMode === "REVIEW_ALL") return targetSet.flashcards;
    if (nextMode === "FAVORITE") {
      return targetSet.flashcards.filter(
        (card) => favoriteOverrides[card.id] ?? card.isFavorite,
      );
    }
    if (nextMode === "UNKNOWN") {
      return targetSet.flashcards.filter(
        (card) => (knownOverrides[card.id] ?? card.progress?.isKnown) !== true,
      );
    }
    return targetSet.flashcards.filter(
      (card) => !Object.hasOwn(knownOverrides, card.id) && card.progress === null,
    );
  }

  function startSession(
    nextMode: SessionMode,
    backDestination: Exclude<FlashcardScreen, "RUNNER"> = "PANEL",
    targetSet: StudentFlashcardSet = activeSet,
    trackedSession: FlashcardStudySession | null = null,
    nextHistoryReviewTitle: string | null = null,
    reviewSessionId: string | null = null,
  ) {
    const nextShouldCollapseResultHistoryOnComplete = screen === "RESULT";
    setShouldCelebrateResult(false);
    setHistoryReviewTitle(nextHistoryReviewTitle);
    setRunnerBackDestination(backDestination);
    setShouldCollapseResultHistoryOnComplete(nextShouldCollapseResultHistoryOnComplete);
    writeStoredFlashcardActiveSetId(lesson.id, targetSet.id, userId);
    setActiveSetId(targetSet.id);
    setStudySessionId(trackedSession?.id ?? reviewSessionId ?? null);
    const trackedCardIds = new Set(
      trackedSession?.items.map((item) => item.flashcardId) ?? [],
    );
    const nextCards = trackedSession
      ? targetSet.flashcards.filter((card) => trackedCardIds.has(card.id))
      : getCardsForMode(nextMode, targetSet);
    if (nextCards.length === 0) {
      setHistoryReviewTitle(null);
      clearStoredFlashcardSession(targetSet.id);
      setFlashcardResultHistoryMarker(targetSet.id);
      setScreen("RESULT");
      return;
    }
    const nextCardIds = nextCards.map((card) => card.id);
    const targetProgress = buildProgress(targetSet, knownOverrides);
    const nextResumesSavedProgress = trackedSession
      ? trackedSession.reviewedCount > 0
      : nextMode === "UNREVIEWED" && targetProgress.reviewedCount > 0;
    const nextReviewedIds = trackedSession
      ? trackedSession.items.flatMap((item) =>
          item.isKnown === null ? [] : [item.flashcardId],
        )
      : nextMode === "FAVORITE" || nextMode === "REVIEW_ALL"
        ? nextCards.flatMap((card) =>
            Object.hasOwn(knownOverrides, card.id) || card.progress !== null
              ? [card.id]
              : [],
          )
        : [];
    writeStoredFlashcardSession(targetSet.id, {
      backDestination,
      cardIds: nextCardIds,
      currentIndex: 0,
      isBackVisible: false,
      resumesSavedProgress: nextResumesSavedProgress,
      shouldCollapseResultHistoryOnComplete: nextShouldCollapseResultHistoryOnComplete,
      reviewedCardIds: nextReviewedIds,
      sessionId: trackedSession?.id,
    });
    setSessionCardIds(nextCardIds);
    setSessionResumesSavedProgress(nextResumesSavedProgress);
    const nextReviewedIdSet = new Set(nextReviewedIds);
    sessionReviewedIdsRef.current = nextReviewedIdSet;
    setSessionReviewedIds(nextReviewedIdSet);
    const firstUnreviewedIndex = nextCards.findIndex(
      (card) => !nextReviewedIds.includes(card.id),
    );
    setCurrentIndex(firstUnreviewedIndex >= 0 ? firstUnreviewedIndex : 0);
    setIsBackVisible(false);
    if (trackedSession) {
      setKnownOverrides((current) => ({
        ...current,
        ...Object.fromEntries(
          trackedSession.items.flatMap((item) =>
            item.isKnown === null ? [] : [[item.flashcardId, item.isKnown]],
          ),
        ),
      }));
    }
    setScreen("RUNNER");
  }

  async function startTrackedSession(
    targetSet: StudentFlashcardSet,
    resumeExistingProgress = false,
    backDestination: Exclude<FlashcardScreen, "RUNNER"> = "PANEL",
    restartSessionId?: string,
  ) {
    const trackedSession = await startFlashcardStudySession(
      targetSet.id,
      token,
      resumeExistingProgress,
      restartSessionId,
    );
    startSession("ALL", backDestination, targetSet, trackedSession);
    if (historyQuery.data) void historyQuery.refetch();
  }

  function persistSessionPatch({
    nextCurrentIndex = currentIndex,
    nextIsBackVisible = isBackVisible,
    nextReviewedIds = sessionReviewedIdsRef.current,
  }: {
    nextCurrentIndex?: number;
    nextIsBackVisible?: boolean;
    nextReviewedIds?: ReadonlySet<string>;
  }) {
    if (sessionCardIds.length === 0) return;
    writeStoredFlashcardSession(activeSet.id, {
      backDestination: runnerBackDestination,
      cardIds: sessionCardIds,
      currentIndex: nextCurrentIndex,
      isBackVisible: nextIsBackVisible,
      resumesSavedProgress: sessionResumesSavedProgress,
      shouldCollapseResultHistoryOnComplete,
      reviewedCardIds: Array.from(nextReviewedIds),
      sessionId: studySessionId ?? undefined,
    });
  }

  function updateCurrentCard(nextIndex: number, nextIsBackVisible = false) {
    const boundedIndex = Math.min(
      Math.max(0, nextIndex),
      Math.max(0, sessionCards.length - 1),
    );
    persistSessionPatch({
      nextCurrentIndex: boundedIndex,
      nextIsBackVisible,
    });
    setCurrentIndex(boundedIndex);
    setIsBackVisible(nextIsBackVisible);
  }

  async function handleEntryAction() {
    if (!hasFlashcards) return;
    if (hasPendingSession) {
      await transitionTo(() => {
        setScreen("RUNNER");
      });
      return;
    }
    if (progress.isCompleted) {
      pushFlashcardResultHistoryEntry(activeSet.id);
      setShouldCelebrateResult(false);
      setScreen("RESULT");
      return;
    }
    await transitionTo(() => startTrackedSession(activeSet, progress.reviewedCount > 0));
  }

  async function handleMark(isKnown: boolean) {
    if (!currentCard || pendingAction) return false;
    const progressAction = `progress-${isKnown ? "known" : "unknown"}-${currentCard.id}`;
    setPendingAction(progressAction);
    try {
      await updateFlashcardProgress(
        currentCard.id,
        isKnown,
        token,
        studySessionId ?? undefined,
      );
      setKnownOverrides((current) => ({ ...current, [currentCard.id]: isKnown }));
      const nextReviewedIds = new Set(sessionReviewedIdsRef.current);
      nextReviewedIds.add(currentCard.id);
      sessionReviewedIdsRef.current = nextReviewedIds;
      persistSessionPatch({
        nextIsBackVisible: false,
        nextReviewedIds,
      });
      setSessionReviewedIds(nextReviewedIds);
      setIsBackVisible(false);
      void onProgressChanged().catch((error: unknown) => {
        toast.error("Đã lưu thẻ nhưng chưa làm mới được tiến độ", {
          description: getErrorMessage(error),
        });
      });
      if (historyQuery.data) void historyQuery.refetch();
      return true;
    } catch (error) {
      toast.error("Chưa lưu được tiến độ thẻ", {
        description: getErrorMessage(error),
      });
      return false;
    } finally {
      setPendingAction(null);
    }
  }

  async function handleFavorite(card: StudentFlashcard) {
    if (pendingAction) return;
    const favoriteAction = `favorite-${card.id}`;
    setPendingAction(favoriteAction);
    try {
      const result = await toggleFlashcardFavorite(lesson.id, card.id, token);
      setFavoriteOverrides((current) => ({
        ...current,
        [card.id]: result.isFavorite,
      }));
    } catch (error) {
      toast.error("Chưa lưu được thẻ yêu thích", {
        description: getErrorMessage(error),
      });
    } finally {
      setPendingAction(null);
    }
  }

  const serverHistoryItems = historyQuery.data?.items ?? [];
  const historySetIds = new Set(serverHistoryItems.map((item) => item.setId));
  const legacyHistoryItems = sets
    .filter(
      (candidate) =>
        !historySetIds.has(candidate.id) &&
        candidate.progress.reviewedCount > 0 &&
        (candidate.progress.isCompleted || candidate.id === activeSet.id),
    )
    .map((candidate, index) => ({
      id: `legacy:${candidate.id}`,
      setId: candidate.id,
      displayName: `Bộ ${serverHistoryItems.length + index + 1}`,
      state: candidate.progress.isCompleted
        ? ("COMPLETED" as const)
        : ("IN_PROGRESS" as const),
      startedAt:
        candidate.flashcards
          .flatMap((card) => (card.progress ? [card.progress.lastReviewedAt] : []))
          .sort()[0] ?? new Date(0).toISOString(),
      completedAt: candidate.progress.isCompleted
        ? (candidate.flashcards
            .flatMap((card) => (card.progress ? [card.progress.lastReviewedAt] : []))
            .sort()
            .at(-1) ?? null)
        : null,
      reviewedCount: candidate.progress.reviewedCount,
      knownCount: candidate.progress.knownCount,
      unknownCount: candidate.progress.unknownCount,
      totalCount: candidate.progress.totalCount,
    }));
  const flashcardHistoryItems = [...serverHistoryItems, ...legacyHistoryItems];

  function findHistorySet(item: LearningHistoryDisplayItem) {
    return sets.find((candidate) => candidate.id === item.setId);
  }

  function handleHistoryContinue(item: LearningHistoryDisplayItem) {
    const targetSet = findHistorySet(item);
    if (!targetSet) return;
    void transitionTo(async () => {
      if (item.id.startsWith("legacy:")) {
        await startTrackedSession(targetSet, true);
        return;
      }
      const cardIdSet = new Set(targetSet.flashcards.map((c) => c.id));
      const storedSession = readStoredFlashcardSession(targetSet.id, cardIdSet);
      const trackedSession = await getFlashcardStudySession(item.id, token);
      startSession("ALL", "PANEL", targetSet, trackedSession);
      if (
        storedSession &&
        storedSession.sessionId === item.id &&
        storedSession.currentIndex > 0
      ) {
        const safeIndex = Math.min(
          storedSession.currentIndex,
          targetSet.flashcards.length - 1,
        );
        setCurrentIndex(safeIndex);
        persistSessionPatch({ nextCurrentIndex: safeIndex });
      }
    }, `history-continue:${item.id}`);
  }

  function handleHistoryReview(item: LearningHistoryDisplayItem) {
    const targetSet = findHistorySet(item);
    if (!targetSet) return;
    const sessionId = item.id.startsWith("legacy:") ? null : item.id;
    void transitionTo(
      () =>
        startSession("REVIEW_ALL", "PANEL", targetSet, null, item.displayName, sessionId),
      `history-review:${item.id}`,
    );
  }

  function handleHistoryRestart(item: LearningHistoryDisplayItem) {
    const targetSet = findHistorySet(item);
    if (!targetSet) return;
    void transitionTo(() => startTrackedSession(targetSet), `history-restart:${item.id}`);
  }

  if (screen === "RESULT") {
    return renderWithCurtain(
      <FlashcardResultScreen
        favoriteCount={favoriteCardCount}
        progress={progress}
        pendingAction={pendingAction}
        shouldCelebrate={shouldCelebrateResult}
        onBack={() => {
          clearFlashcardResultHistoryMarker();
          setShouldCelebrateResult(false);
          setScreen("PANEL");
        }}
        onReviewFavorites={() =>
          void transitionTo(
            () =>
              startSession("FAVORITE", "RESULT", activeSet, null, null, studySessionId),
            "review-favorites",
          )
        }
        onRestartAll={() =>
          void transitionTo(
            () =>
              startTrackedSession(activeSet, false, "PANEL", studySessionId ?? undefined),
            "restart-all",
          )
        }
        onRestartUnknown={() =>
          void transitionTo(
            () =>
              startSession("UNKNOWN", "RESULT", activeSet, null, null, studySessionId),
            "restart-unknown",
          )
        }
        onStartNewSet={() =>
          void transitionTo(
            () =>
              startTrackedSession(getNextLearningSet(sets, activeSet.id), false, "PANEL"),
            "start-new-set",
          )
        }
      />,
    );
  }

  if (screen === "RUNNER" && currentCard && historyReviewTitle === null) {
    const isFavorite = favoriteOverrides[currentCard.id] ?? currentCard.isFavorite;
    return renderWithCurtain(
      <FlashcardRunnerScreen
        card={currentCard}
        currentIndex={currentIndex}
        isBackVisible={isBackVisible}
        isFavorite={isFavorite}
        lessonTitle={lesson.title}
        onBack={() => {
          clearFlashcardRunnerHistoryMarker();
          setShouldCelebrateResult(false);
          setShouldCollapseResultHistoryOnComplete(false);
          if (runnerBackDestination === "RESULT") {
            setFlashcardResultHistoryMarker(activeSet.id);
            setScreen("RESULT");
            return;
          }
          setScreen("PANEL");
        }}
        onComplete={() => {
          clearStoredFlashcardSession(activeSet.id);
          setFlashcardResultHistoryMarker(activeSet.id);
          setShouldCelebrateResult(true);
          setScreen("RESULT");
        }}
        onFavorite={() => handleFavorite(currentCard)}
        onFlip={() => {
          const nextIsBackVisible = !isBackVisible;
          persistSessionPatch({ nextIsBackVisible });
          setIsBackVisible(nextIsBackVisible);
        }}
        onMark={handleMark}
        onCardSelect={(index) => updateCurrentCard(index)}
        onNext={() => updateCurrentCard(currentIndex + 1)}
        onPrevious={() => updateCurrentCard(currentIndex - 1)}
        knownCount={sessionKnownCount}
        pendingAction={pendingAction}
        reviewStatuses={sessionReviewStatuses}
        setId={activeSet.id}
        onResultHistoryCollapsed={() => setShouldCollapseResultHistoryOnComplete(false)}
        shouldCollapseResultHistoryOnComplete={shouldCollapseResultHistoryOnComplete}
        totalCount={sessionCards.length}
      />,
    );
  }

  return renderWithCurtain(
    <>
      <section className="rounded-[1.5rem] border border-sky-100 bg-white p-4 shadow-[0_20px_50px_-42px_rgb(2_132_199_/_60%)] dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] sm:p-5">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
            <Brain className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="min-w-0 text-lg font-black text-slate-950 dark:text-[var(--theme-text-strong)] sm:text-xl">
            Flashcard
          </h2>
          <LearningHistoryControl
            accent="flashcard"
            countLabel={`${activeSet.flashcards.length} thẻ`}
            currentSetId={activeSet.id}
            errorMessage={
              historyQuery.error
                ? "Chưa tải được lịch sử Flashcard. Vui lòng thử lại."
                : null
            }
            isCoveredByChildSurface={screen === "RUNNER" && historyReviewTitle !== null}
            isLoading={historyQuery.isLoading && !historyQuery.data}
            isRetrying={historyQuery.isFetching}
            items={flashcardHistoryItems.map((item) => ({
              id: item.id,
              setId: item.setId,
              displayName: item.displayName,
              state: item.state,
              startedAt: item.startedAt,
              completedAt: item.completedAt,
              summary:
                item.state === "IN_PROGRESS"
                  ? `${item.reviewedCount}/${item.totalCount} thẻ đã học`
                  : `${item.knownCount}/${item.totalCount} thẻ đã thuộc`,
              passed: item.knownCount >= item.totalCount,
            }))}
            onContinue={handleHistoryContinue}
            onOpenHistory={() => {
              if (!historyQuery.data) {
                return historyQuery.refetch().then(() => undefined);
              }
            }}
            onReview={handleHistoryReview}
            onRetry={() => void historyQuery.refetch()}
            pendingActionKey={
              pendingAction?.startsWith("history-")
                ? pendingAction.slice("history-".length)
                : null
            }
          />
        </div>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600 dark:text-[var(--theme-text-muted)] sm:mt-4 lg:text-base lg:leading-7">
          {progress.isCompleted && !hasPendingSession
            ? "Bộ Flashcard đã được hoàn thành. Cùng ôn tập lại nhé."
            : "Cùng ghi nhớ các kiến thức đã học nhé."}
        </p>
        <div
          className={
            progress.isCompleted && !hasPendingSession
              ? "mt-4 grid gap-3 lg:grid-cols-2"
              : "mt-4 grid gap-3"
          }
        >
          <button
            ref={entryActionButtonRef}
            type="button"
            onClick={() => void handleEntryAction()}
            aria-busy={pendingAction === "start"}
            disabled={!hasFlashcards || pendingAction === "start"}
            className="student-flashcard-cta-3d inline-flex min-h-14 w-full min-w-0 items-center justify-center gap-2.5 whitespace-nowrap rounded-2xl bg-violet-500 px-3 text-base font-black text-white hover:bg-violet-400 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:px-5 sm:text-lg"
          >
            <EntryActionIcon className="h-6 w-6 shrink-0" aria-hidden="true" />
            {entryActionLabel}
          </button>
          {progress.isCompleted && !hasPendingSession ? (
            <button
              type="button"
              onClick={() =>
                void transitionTo(
                  () => startTrackedSession(getNextLearningSet(sets, activeSet.id)),
                  "start-new-set",
                )
              }
              aria-busy={pendingAction === "start-new-set"}
              disabled={pendingAction === "start-new-set"}
              className="student-preserve-mobile-shadow inline-flex min-h-14 w-full min-w-0 items-center justify-center gap-2.5 whitespace-nowrap rounded-2xl border-2 border-violet-300 bg-white px-3 text-base font-black text-violet-700 shadow-[0_3px_0_rgb(221_214_254),0_10px_16px_-13px_rgb(139_92_246_/_30%)] transition hover:bg-violet-50 active:translate-y-[2px] active:shadow-[0_1px_0_rgb(221_214_254),0_5px_10px_-12px_rgb(139_92_246_/_24%)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100 disabled:opacity-70 dark:border-violet-400/50 dark:bg-[var(--theme-surface)] dark:text-violet-300 dark:shadow-[0_3px_0_rgb(76_29_149_/_55%),0_10px_16px_-14px_rgb(139_92_246_/_20%)] dark:hover:bg-violet-500/10 sm:px-5 sm:text-lg"
            >
              <RotateCcw className="h-6 w-6 shrink-0" aria-hidden="true" />
              Học bộ Flashcard mới
            </button>
          ) : null}
        </div>
      </section>
      {screen === "RUNNER" && currentCard && historyReviewTitle !== null ? (
        <FlashcardRunnerScreen
          card={currentCard}
          currentIndex={currentIndex}
          isBackVisible={isBackVisible}
          isFavorite={favoriteOverrides[currentCard.id] ?? currentCard.isFavorite}
          lessonTitle={lesson.title}
          onBack={() => {
            clearFlashcardRunnerHistoryMarker();
            clearStoredFlashcardSession(activeSet.id);
            setHistoryReviewTitle(null);
            setScreen("PANEL");
          }}
          onComplete={() => undefined}
          onFavorite={() => handleFavorite(currentCard)}
          onFlip={() => {
            const nextIsBackVisible = !isBackVisible;
            persistSessionPatch({ nextIsBackVisible });
            setIsBackVisible(nextIsBackVisible);
          }}
          onMark={handleMark}
          onCardSelect={(index) => updateCurrentCard(index)}
          onNext={() => updateCurrentCard(currentIndex + 1)}
          onPrevious={() => updateCurrentCard(currentIndex - 1)}
          knownCount={sessionKnownCount}
          pendingAction={pendingAction}
          reviewMode
          reviewStatuses={sessionReviewStatuses}
          reviewTitle={historyReviewTitle}
          setId={activeSet.id}
          onResultHistoryCollapsed={() => undefined}
          shouldCollapseResultHistoryOnComplete={false}
          stackedOverDialog
          totalCount={sessionCards.length}
        />
      ) : null}
    </>,
  );
}

function buildProgress(
  set: StudentFlashcardSet,
  knownOverrides: Record<string, boolean>,
): FlashcardProgressSummary {
  const summary = set.flashcards.reduce(
    (current, card) => {
      const wasReviewed =
        Object.hasOwn(knownOverrides, card.id) || card.progress !== null;
      const isKnown = knownOverrides[card.id] ?? card.progress?.isKnown;
      if (wasReviewed) current.reviewedCount += 1;
      if (isKnown === true) current.knownCount += 1;
      if (wasReviewed && isKnown === false) current.unknownCount += 1;
      return current;
    },
    { knownCount: 0, reviewedCount: 0, unknownCount: 0 },
  );

  return {
    ...summary,
    totalCount: set.flashcards.length,
    unreviewedCount: Math.max(0, set.flashcards.length - summary.reviewedCount),
    isCompleted:
      set.flashcards.length > 0 && summary.reviewedCount === set.flashcards.length,
  };
}

function getErrorMessage(error: unknown) {
  return getUserFacingErrorMessage(error, "Vui lòng thử lại.");
}

function waitForCurtain(durationMs: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}
