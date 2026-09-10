"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  Flag,
  Heart,
  Loader2,
  RotateCw,
  TriangleAlert,
  X,
} from "lucide-react";
import { ClassHeroLogo } from "@/components/common/brand/classhero-logo";
import { TiptapContentView } from "@/components/common/content/tiptap-content-view";
import { useDocumentScrollLock } from "@/features/student/lessons/hooks/use-document-scroll-lock";
import { QuizExitConfirmDialog } from "@/features/student/lessons/screens/student-lesson-screen/components/quiz-exit-confirm-dialog";
import type { StudentFlashcard } from "@/features/student/lessons/types/student-lesson-types";
import {
  popFlashcardRunnerHistoryEntryPreservingResult,
  pushFlashcardRunnerHistoryEntry,
} from "@/features/student/lessons/utils/flashcard-runner-history";
import { cn } from "@/lib/utils";

const FLASHCARD_MARK_FEEDBACK_DURATION_MS = 700;
const FLASHCARD_MARK_FEEDBACK_REDUCED_MOTION_DURATION_MS = 420;

export function FlashcardRunnerLoadingScreen() {
  useDocumentScrollLock();

  return (
    <div
      aria-busy="true"
      aria-label="Đang mở lại lượt Flashcard"
      className="fixed inset-0 z-[80] overflow-hidden bg-[linear-gradient(180deg,#f5f3ff_0%,#faf5ff_100%)] text-slate-950 dark:bg-none dark:bg-[var(--theme-bg)] dark:text-[var(--theme-text-strong)]"
      data-testid="flashcard-runner-loading-screen"
    >
      <header className="border-b border-violet-100 bg-white/95 py-2 pl-1 pr-2 dark:border-[var(--theme-border)] dark:bg-[color-mix(in_srgb,var(--theme-surface)_95%,transparent)] sm:pl-2 sm:pr-4">
        <div className="mx-auto flex min-h-14 max-w-2xl items-center gap-1.5">
          <span
            aria-hidden="true"
            className="grid h-11 w-10 shrink-0 place-items-center rounded-xl text-slate-300 dark:text-slate-600"
          >
            <ChevronLeft className="h-8 w-8" strokeWidth={2.8} />
          </span>
          <ClassHeroLogo className="h-10 max-w-[9rem]" priority />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl animate-pulse px-4 py-6 motion-reduce:animate-none sm:px-6">
        <div className="h-5 w-48 rounded-lg bg-[var(--theme-skeleton)]" />
        <div className="mt-3 h-9 w-28 rounded-xl bg-[var(--theme-skeleton)]" />
        <div className="mt-4 h-3 rounded-full bg-[var(--theme-skeleton)]" />
        <div className="mt-7 h-[min(31rem,58vh)] rounded-[2rem] bg-white shadow-[0_24px_55px_-42px_rgb(15_23_42_/_16%)] dark:bg-[var(--theme-surface)]">
          <div className="mx-auto mt-[20%] h-4 w-28 rounded-full bg-[var(--theme-skeleton)]" />
          <div className="mx-auto mt-12 h-10 w-24 rounded-xl bg-[var(--theme-skeleton)]" />
          <div className="mx-auto mt-20 h-5 w-32 rounded-lg bg-[var(--theme-skeleton)]" />
        </div>
      </main>
    </div>
  );
}

export function FlashcardRunnerScreen({
  card,
  currentIndex,
  isBackVisible,
  isFavorite,
  lessonTitle,
  onBack,
  onCardSelect,
  onComplete,
  onFavorite,
  onFlip,
  onMark,
  onNext,
  onPrevious,
  onResultHistoryCollapsed,
  pendingAction,
  knownCount,
  reviewMode = false,
  reviewTitle,
  reviewStatuses,
  setId,
  shouldCollapseResultHistoryOnComplete,
  stackedOverDialog = false,
  totalCount,
}: {
  card: StudentFlashcard;
  currentIndex: number;
  isBackVisible: boolean;
  isFavorite: boolean;
  lessonTitle: string;
  onBack: () => void;
  onCardSelect: (index: number) => void;
  onComplete: () => void;
  onFavorite: () => Promise<void>;
  onFlip: () => void;
  onMark: (isKnown: boolean) => Promise<boolean>;
  onNext: () => void;
  onPrevious: () => void;
  onResultHistoryCollapsed: () => void;
  pendingAction: string | null;
  knownCount: number;
  reviewMode?: boolean;
  reviewTitle?: string;
  reviewStatuses: Array<boolean | null>;
  setId: string;
  shouldCollapseResultHistoryOnComplete: boolean;
  stackedOverDialog?: boolean;
  totalCount: number;
}) {
  useDocumentScrollLock();

  const shouldReduceMotion = useReducedMotion();
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);
  const [isIncompleteAlertRequested, setIsIncompleteAlertRequested] = useState(false);
  const [isSolutionVisible, setIsSolutionVisible] = useState(false);
  const [markFeedback, setMarkFeedback] = useState<boolean | null>(null);

  useEffect(() => {
    setIsSolutionVisible(false);
  }, [card.id]);
  const isConfirmedHistoryExitRef = useRef(false);
  const isMountedRef = useRef(true);
  const isRunnerHistoryEntryActiveRef = useRef(false);
  const onBackRef = useRef(onBack);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    pushFlashcardRunnerHistoryEntry(setId);
    isRunnerHistoryEntryActiveRef.current = true;

    function handlePopState() {
      isRunnerHistoryEntryActiveRef.current = false;
      if (reviewMode) {
        onBackRef.current();
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
  }, [reviewMode, setId]);

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
      pushFlashcardRunnerHistoryEntry(setId);
      isRunnerHistoryEntryActiveRef.current = true;
    }
    setIsExitDialogOpen(false);
  }

  function dismissIncompleteAlert() {
    setIsIncompleteAlertRequested(false);
  }

  function handleOpenExitDialog() {
    dismissIncompleteAlert();
    if (reviewMode) {
      finishReview();
      return;
    }
    setIsExitDialogOpen(true);
  }

  function handleFlip() {
    dismissIncompleteAlert();
    onFlip();
  }

  function handleFavorite() {
    dismissIncompleteAlert();
    void onFavorite();
  }

  async function handleMark(isKnown: boolean) {
    dismissIncompleteAlert();
    setMarkFeedback(isKnown);
    const minimumFeedbackDelay = waitFor(
      shouldReduceMotion
        ? FLASHCARD_MARK_FEEDBACK_REDUCED_MOTION_DURATION_MS
        : FLASHCARD_MARK_FEEDBACK_DURATION_MS,
    );
    const didSave = await onMark(isKnown);
    if (!didSave) {
      if (isMountedRef.current) setMarkFeedback(null);
      return;
    }

    await minimumFeedbackDelay;
    if (!isMountedRef.current) return;
    setMarkFeedback(null);

    if (reviewMode) {
      if (currentIndex < totalCount - 1) onNext();
      return;
    }

    if (currentIndex < totalCount - 1) {
      onNext();
    }
  }

  function handleComplete() {
    if (incompleteCardNumbers.length > 0) {
      setIsIncompleteAlertRequested(true);
      return;
    }

    setIsIncompleteAlertRequested(false);
    finishSession();
  }

  function finishSession() {
    onComplete();
    if (shouldCollapseResultHistoryOnComplete) {
      window.setTimeout(
        () => popFlashcardRunnerHistoryEntryPreservingResult(onResultHistoryCollapsed),
        0,
      );
    }
  }

  function finishReview() {
    onBack();
    window.setTimeout(popFlashcardRunnerHistoryEntryPreservingResult, 0);
  }

  function handlePrevious() {
    dismissIncompleteAlert();
    onPrevious();
  }

  function handleNext() {
    dismissIncompleteAlert();
    onNext();
  }

  function handleCardSelect(index: number) {
    dismissIncompleteAlert();
    onCardSelect(index);
  }

  const progressPercent = ((currentIndex + 1) / Math.max(totalCount, 1)) * 100;
  const unknownProgressAction = `progress-unknown-${card.id}`;
  const knownProgressAction = `progress-known-${card.id}`;
  const favoriteAction = `favorite-${card.id}`;
  const isLastCard = currentIndex >= totalCount - 1;
  const isFirstCard = currentIndex === 0;
  const reviewStatus = reviewStatuses[currentIndex] ?? null;
  const visibleReviewStatus = markFeedback ?? reviewStatus;
  const unknownCount = reviewStatuses.filter((status) => status === false).length;
  const incompleteCardNumbers = reviewStatuses.flatMap((status, index) =>
    status === null ? [index + 1] : [],
  );
  const isIncompleteAlertVisible =
    isIncompleteAlertRequested && incompleteCardNumbers.length > 0;
  const isInteractionLocked = Boolean(pendingAction);
  const keyboardShortcutStateRef = useRef({
    currentIndex,
    isExitDialogOpen,
    isInteractionLocked,
    onNext: handleNext,
    onPrevious: handlePrevious,
    totalCount,
  });
  keyboardShortcutStateRef.current = {
    currentIndex,
    isExitDialogOpen,
    isInteractionLocked,
    onNext: handleNext,
    onPrevious: handlePrevious,
    totalCount,
  };

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
        shortcutState.isInteractionLocked
      ) {
        return;
      }

      if (event.key === "ArrowLeft" && shortcutState.currentIndex > 0) {
        event.preventDefault();
        shortcutState.onPrevious();
        return;
      }

      if (
        event.key === "ArrowRight" &&
        shortcutState.currentIndex < shortcutState.totalCount - 1
      ) {
        event.preventDefault();
        shortcutState.onNext();
      }
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  return (
    <div
      className={cn(
        "fixed inset-0 overflow-y-auto bg-[linear-gradient(180deg,#ede9fe_0%,#faf5ff_100%)] text-slate-950 dark:bg-none dark:bg-[var(--theme-bg)] dark:text-[var(--theme-text-strong)]",
        stackedOverDialog ? "z-[115]" : "z-[80]",
      )}
      data-testid="flashcard-runner-screen"
    >
      <header className="sticky top-0 z-20 border-b border-violet-100 bg-white/95 py-2 pl-1 pr-2 backdrop-blur dark:border-[var(--theme-border)] dark:bg-[color-mix(in_srgb,var(--theme-surface)_95%,transparent)] sm:pl-2 sm:pr-4">
        <div className="mx-auto flex min-h-14 max-w-2xl items-center gap-1.5">
          <button
            type="button"
            onClick={handleOpenExitDialog}
            className="grid h-11 w-10 shrink-0 place-items-center rounded-xl text-slate-700 transition hover:bg-violet-50 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100 dark:text-[var(--theme-text)] dark:hover:bg-[var(--theme-surface-soft)]"
            aria-label="Quay lại màn Flashcard"
          >
            <ChevronLeft className="h-8 w-8" strokeWidth={2.8} aria-hidden="true" />
          </button>
          <ClassHeroLogo className="h-10 max-w-[9rem]" priority />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-5 pb-10 [perspective:1200px] sm:px-6 sm:py-7">
        <section aria-labelledby="flashcard-runner-title">
          <p className="text-base font-black leading-tight text-violet-600 dark:text-violet-300 lg:text-lg">
            {reviewMode && reviewTitle ? reviewTitle : lessonTitle}
          </p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <h1
              id="flashcard-runner-title"
              className="shrink-0 whitespace-nowrap text-2xl font-black leading-tight text-slate-950 dark:text-[var(--theme-text-strong)] sm:text-3xl"
            >
              Thẻ {currentIndex + 1}
            </h1>
            <div
              className="ml-auto flex shrink-0 items-center gap-2"
              aria-label={`Thống kê Flashcard: ${unknownCount} chưa thuộc, ${knownCount} đã thuộc`}
            >
              <span className="student-preserve-mobile-shadow inline-flex items-center gap-1.5 whitespace-nowrap rounded-2xl border border-rose-300 bg-white px-3 py-2 text-xs font-black text-rose-700 shadow-[0_3px_0_rgb(254_205_211)] dark:border-rose-400/40 dark:bg-[var(--theme-surface)] dark:text-rose-300 dark:shadow-[0_3px_0_rgb(136_19_55)]">
                <X className="h-4 w-4" aria-hidden="true" />
                {unknownCount}
              </span>
              <span className="student-preserve-mobile-shadow inline-flex items-center gap-1.5 whitespace-nowrap rounded-2xl border border-emerald-400/60 bg-emerald-500 px-3 py-2 text-xs font-black text-white shadow-[0_3px_0_rgb(4_120_87)]">
                <Check className="h-4 w-4" aria-hidden="true" />
                {knownCount}
              </span>
              <span className="student-preserve-mobile-shadow inline-flex items-center whitespace-nowrap rounded-2xl border border-violet-300 bg-violet-200 px-3 py-2 text-xs font-black text-violet-800 shadow-[0_3px_0_rgb(196_181_253)] dark:border-violet-400/30 dark:bg-violet-500/25 dark:text-violet-200 dark:shadow-[0_3px_0_rgb(76_29_149)]">
                {totalCount} thẻ
              </span>
            </div>
          </div>

          <div
            className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-[var(--theme-surface-muted)]"
            role="progressbar"
            aria-label="Tiến độ học Flashcard"
            aria-valuemin={0}
            aria-valuemax={totalCount}
            aria-valuenow={currentIndex + 1}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-400 transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </section>

        <motion.section
          key={`${card.id}-${isBackVisible ? "back" : "front"}`}
          initial={
            shouldReduceMotion
              ? false
              : {
                  opacity: 0.58,
                  rotateY: isBackVisible ? 88 : -88,
                  scale: 0.97,
                }
          }
          animate={{ opacity: 1, rotateY: 0, scale: 1 }}
          transition={{
            duration: shouldReduceMotion ? 0.08 : 0.36,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="relative mt-5 flex min-h-[23rem] flex-col justify-between overflow-hidden rounded-[1.6rem] border border-violet-100 bg-white p-5 shadow-[0_24px_55px_-42px_rgb(124_58_237_/_65%)] [backface-visibility:hidden] [transform-style:preserve-3d] dark:border-violet-400/20 dark:bg-[var(--theme-surface)] sm:p-8"
        >
          <button
            type="button"
            onClick={handleFlip}
            disabled={isInteractionLocked}
            aria-label={isBackVisible ? "Lật thẻ xem mặt trước" : "Lật thẻ xem mặt sau"}
            className="absolute inset-0 z-0 rounded-[1.6rem] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-violet-300 dark:focus-visible:ring-violet-500/40"
          />
          {visibleReviewStatus !== null ? (
            <motion.span
              key={`${card.id}-${markFeedback !== null ? "feedback" : "saved"}-${String(
                visibleReviewStatus,
              )}`}
              initial={
                shouldReduceMotion || markFeedback === null
                  ? false
                  : {
                      opacity: 0.25,
                      scale: 1.58,
                      y: -16,
                      rotate: visibleReviewStatus ? -10 : 10,
                    }
              }
              animate={
                shouldReduceMotion || markFeedback === null
                  ? { opacity: 1, scale: 1, y: 0, rotate: 0 }
                  : {
                      opacity: [0.25, 1, 1, 1],
                      scale: [1.58, 0.9, 1.04, 1],
                      y: [-16, 2, -1, 0],
                      rotate: [visibleReviewStatus ? -10 : 10, 2, -1, 0],
                    }
              }
              transition={
                shouldReduceMotion
                  ? { duration: 0.08 }
                  : {
                      duration: 0.48,
                      times: [0, 0.56, 0.78, 1],
                      ease: [0.2, 0.9, 0.25, 1],
                    }
              }
              role={markFeedback !== null ? "status" : undefined}
              aria-live={markFeedback !== null ? "polite" : undefined}
              aria-label={`Trạng thái thẻ: ${
                visibleReviewStatus ? "Đã thuộc" : "Chưa thuộc"
              }`}
              className={cn(
                "pointer-events-none absolute left-4 top-4 z-20 inline-flex min-h-9 origin-center items-center gap-1.5 rounded-full border px-3 text-sm font-black",
                visibleReviewStatus
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 shadow-[0_8px_22px_-12px_rgb(5_150_105_/_85%)] dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-300"
                  : "border-rose-200 bg-rose-50 text-rose-700 shadow-[0_8px_22px_-12px_rgb(225_29_72_/_85%)] dark:border-rose-400/30 dark:bg-rose-500/15 dark:text-rose-300",
              )}
            >
              {markFeedback !== null && !shouldReduceMotion ? (
                <motion.span
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{
                    opacity: [0, 0, 0.48, 0],
                    scale: [0.88, 0.88, 1, 1.24],
                  }}
                  transition={{
                    duration: 0.5,
                    times: [0, 0.46, 0.6, 1],
                    ease: "easeOut",
                  }}
                  className="absolute -inset-1.5 rounded-full border-[3px] border-current"
                  aria-hidden="true"
                />
              ) : null}
              {visibleReviewStatus ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <X className="h-4 w-4" aria-hidden="true" />
              )}
              {visibleReviewStatus ? "Đã thuộc" : "Chưa thuộc"}
            </motion.span>
          ) : null}
          <button
            type="button"
            onClick={handleFavorite}
            disabled={isInteractionLocked}
            aria-label={isFavorite ? "Bỏ yêu thích thẻ" : "Yêu thích thẻ"}
            className={cn(
              "absolute right-4 top-4 z-20 grid h-12 w-12 place-items-center rounded-full border shadow-sm transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100 disabled:opacity-60 dark:focus-visible:ring-violet-500/30",
              isFavorite
                ? "border-rose-200 bg-rose-50 text-rose-500 dark:border-rose-400/30 dark:bg-rose-500/10"
                : "border-slate-200 bg-white text-slate-400 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)]",
            )}
          >
            {pendingAction === favoriteAction ? (
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
            ) : (
              <Heart
                className={cn("h-6 w-6", isFavorite && "fill-current")}
                aria-hidden="true"
              />
            )}
          </button>

          <div className="pointer-events-none relative z-10 flex flex-1 flex-col items-center justify-center px-3 pt-10 pb-2 text-center sm:pt-12">
            <p className="mb-5 text-sm font-black uppercase tracking-[0.17em] text-violet-500 dark:text-violet-300">
              {isBackVisible ? "Mặt sau" : "Mặt trước"}
            </p>
            <TiptapContentView
              content={isBackVisible ? card.backJson : card.frontJson}
              className={cn(
                "text-2xl leading-9 text-slate-950 dark:text-[var(--theme-text-strong)] sm:text-3xl sm:leading-10",
                isBackVisible ? "font-bold" : "font-normal",
              )}
            />
            {isBackVisible && (card.solutionJson || card.solutionFigure?.url) ? (
              <div className="mt-4 flex w-full flex-col items-center">
                <button
                  type="button"
                  disabled={isInteractionLocked}
                  aria-expanded={isSolutionVisible}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSolutionVisible((prev) => !prev);
                  }}
                  className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50/90 px-3.5 py-1.5 text-xs font-black text-violet-700 shadow-sm transition hover:bg-violet-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:opacity-50 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300 dark:hover:bg-violet-500/25"
                >
                  <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{isSolutionVisible ? "Ẩn lời giải" : "Xem lời giải"}</span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform duration-200",
                      isSolutionVisible && "rotate-180",
                    )}
                    aria-hidden="true"
                  />
                </button>
                {isSolutionVisible ? (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="pointer-events-auto mt-4 w-full rounded-2xl bg-violet-50 p-4 text-left dark:bg-violet-500/10"
                  >
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-violet-600 dark:text-violet-300">
                      <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      Lời giải
                    </p>
                    {card.solutionFigure?.url ? (
                      <figure className="mx-auto mt-4 overflow-hidden rounded-2xl border border-violet-200 bg-white p-3 dark:border-violet-400/30 dark:bg-[var(--theme-surface)]">
                        <img
                          src={card.solutionFigure.url}
                          alt={card.solutionFigure.altText}
                          className="mx-auto max-h-[28rem] max-w-full object-contain"
                        />
                        {card.solutionFigure.caption ? (
                          <figcaption className="mt-2 text-center text-sm font-bold text-slate-500 dark:text-[var(--theme-text-muted)]">
                            {card.solutionFigure.caption}
                          </figcaption>
                        ) : null}
                      </figure>
                    ) : null}
                    {card.solutionJson ? (
                      <TiptapContentView
                        ariaLabel="Lời giải Flashcard"
                        content={card.solutionJson}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="relative z-10 mt-6 flex justify-center pb-1">
            <button
              type="button"
              onClick={handleFlip}
              disabled={isInteractionLocked}
              className="group/flip inline-flex items-center gap-1.5 rounded-full border border-violet-200/90 bg-white/95 px-3.5 py-1.5 text-xs font-black uppercase tracking-wider text-violet-700 transition-all duration-200 hover:scale-105 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:opacity-50 dark:border-violet-400/30 dark:bg-[var(--theme-surface)]/95 dark:text-violet-300 dark:hover:bg-violet-500/15 sm:gap-2 sm:px-4 sm:py-2 sm:text-xs"
            >
              <RotateCw
                className="h-3.5 w-3.5 shrink-0 text-violet-500 transition-transform duration-500 group-hover/flip:rotate-180 dark:text-violet-400"
                aria-hidden="true"
              />
              <span>Lật thẻ</span>
            </button>
          </div>
        </motion.section>

        <nav
          className="mt-5 flex items-center justify-center gap-2"
          aria-label="Điều hướng thẻ Flashcard"
        >
          {reviewStatuses.map((status, index) => (
            <button
              key={index}
              type="button"
              disabled={isInteractionLocked}
              onClick={() => handleCardSelect(index)}
              aria-label={`Thẻ ${index + 1}: ${
                status === true
                  ? "đã thuộc"
                  : status === false
                    ? "chưa thuộc"
                    : "chưa đánh dấu"
              }`}
              aria-current={index === currentIndex ? "step" : undefined}
              className={cn(
                "relative h-3 shrink-0 rounded-full transition-[width,background-color,filter,transform] duration-200 before:absolute before:-inset-x-1 before:-inset-y-2 before:rounded-lg before:content-[''] hover:brightness-95 active:scale-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 disabled:opacity-100 motion-reduce:transition-none dark:focus-visible:ring-violet-500/30",
                index === currentIndex ? "w-8" : "w-3",
                status === true
                  ? "bg-emerald-400"
                  : status === false
                    ? "bg-rose-400"
                    : "bg-slate-300 dark:bg-slate-600",
              )}
            />
          ))}
        </nav>

        {isIncompleteAlertVisible ? (
          <div
            role="alert"
            className="mt-4 flex items-center gap-2 rounded-2xl border border-violet-400 bg-violet-200/80 px-3 py-4 text-sm font-bold leading-5 text-violet-800 shadow-[0_8px_20px_-16px_rgb(124_58_237_/_65%)] dark:border-violet-400/50 dark:bg-violet-500/25 dark:text-violet-100"
          >
            <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              Cần đánh dấu {incompleteCardNumbers.length === 1 ? "thẻ" : "các thẻ"}{" "}
              {incompleteCardNumbers.join(", ")} là Đã thuộc hoặc Chưa thuộc để tiếp tục!
            </p>
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={isInteractionLocked}
            aria-busy={markFeedback === false || pendingAction === unknownProgressAction}
            onClick={() => void handleMark(false)}
            className="student-preserve-mobile-shadow inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-rose-300 bg-white px-2 text-[15px] font-black text-rose-700 shadow-[0_4px_0_rgb(254_205_211)] transition active:translate-y-[3px] active:shadow-[0_1px_0_rgb(254_205_211)] disabled:opacity-60 dark:border-rose-400/40 dark:bg-[var(--theme-surface)] dark:text-rose-300 dark:shadow-[0_4px_0_rgb(136_19_55)] sm:text-base"
          >
            <X className="h-5 w-5" aria-hidden="true" />
            Chưa thuộc
          </button>
          <button
            type="button"
            disabled={isInteractionLocked}
            aria-busy={markFeedback === true || pendingAction === knownProgressAction}
            onClick={() => void handleMark(true)}
            className="student-preserve-mobile-shadow inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-emerald-500 px-2 text-[15px] font-black text-white shadow-[0_4px_0_rgb(4_120_87)] transition enabled:hover:bg-emerald-400 active:translate-y-[3px] active:shadow-[0_1px_0_rgb(4_120_87)] disabled:opacity-60 sm:text-base"
          >
            <Check className="h-5 w-5" aria-hidden="true" />
            Đã thuộc
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={(!reviewMode && isFirstCard) || isInteractionLocked}
            onClick={reviewMode && isFirstCard ? finishReview : handlePrevious}
            className="student-preserve-mobile-shadow inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-violet-200 bg-white px-2 text-sm font-black text-violet-700 shadow-[0_4px_0_rgb(221_214_254)] transition hover:bg-violet-50 active:translate-y-[3px] active:shadow-[0_1px_0_rgb(221_214_254)] disabled:cursor-not-allowed disabled:opacity-40 dark:border-violet-400/30 dark:bg-[var(--theme-surface)] dark:text-violet-300 dark:shadow-[0_4px_0_rgb(76_29_149)] dark:active:shadow-[0_1px_0_rgb(76_29_149)] sm:gap-2.5 sm:px-3 sm:text-base"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            {reviewMode && isFirstCard ? "Trở về" : "Thẻ trước"}
          </button>
          {reviewMode && isLastCard ? (
            <button
              type="button"
              disabled={isInteractionLocked}
              onClick={finishReview}
              className="student-preserve-mobile-shadow inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-violet-400/60 bg-violet-500 px-2 text-sm font-black text-white shadow-[0_5px_0_rgb(109_40_217),0_12px_22px_-10px_rgb(76_29_149_/_70%)] transition enabled:hover:bg-violet-400 active:translate-y-[3px] active:shadow-[0_2px_0_rgb(109_40_217),0_6px_12px_-10px_rgb(76_29_149_/_55%)] disabled:opacity-60 sm:gap-2.5 sm:px-3 sm:text-base"
            >
              <Flag className="h-5 w-5" aria-hidden="true" />
              Kết thúc xem lại
            </button>
          ) : isLastCard ? (
            <button
              type="button"
              disabled={isInteractionLocked}
              onClick={handleComplete}
              className="student-preserve-mobile-shadow inline-flex min-h-12 items-center justify-center gap-2.5 whitespace-nowrap rounded-2xl border border-sky-400/60 bg-sky-500 px-3 text-base font-black text-white shadow-[0_5px_0_rgb(3_105_161),0_12px_22px_-10px_rgb(14_165_233_/_70%)] transition enabled:hover:bg-sky-400 active:translate-y-[3px] active:shadow-[0_2px_0_rgb(3_105_161),0_6px_12px_-10px_rgb(14_165_233_/_55%)] disabled:opacity-60"
            >
              <Flag className="h-5 w-5" aria-hidden="true" />
              Hoàn thành
            </button>
          ) : (
            <button
              type="button"
              disabled={isInteractionLocked}
              onClick={handleNext}
              className="student-preserve-mobile-shadow inline-flex min-h-12 items-center justify-center gap-2.5 whitespace-nowrap rounded-2xl border border-violet-400/60 bg-violet-500 px-3 text-base font-black text-white shadow-[0_5px_0_rgb(109_40_217),0_12px_22px_-10px_rgb(76_29_149_/_70%)] transition enabled:hover:bg-violet-400 active:translate-y-[3px] active:shadow-[0_2px_0_rgb(109_40_217),0_6px_12px_-10px_rgb(76_29_149_/_55%)] disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300 disabled:shadow-none dark:disabled:border-slate-700 dark:disabled:bg-slate-700"
            >
              Thẻ sau
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </main>

      <QuizExitConfirmDialog
        accent="flashcard"
        activityLabel="lượt học Flashcard"
        isOpen={isExitDialogOpen}
        onCancel={handleCancelExit}
        onConfirm={handleConfirmExit}
      />
    </div>
  );
}

function waitFor(durationMs: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}
