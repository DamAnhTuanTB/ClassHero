"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CheckCircle2,
  ChevronRight,
  Clock3,
  Eye,
  History,
  ListChecks,
  ListOrdered,
  Loader2,
  Play,
  RefreshCcw,
  RotateCcw,
  Settings,
  Star,
  Tag,
  X,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useDocumentScrollLock } from "@/features/student/lessons/hooks/use-document-scroll-lock";

export type LearningHistoryDisplayItem = {
  id: string;
  setId: string;
  displayName: string;
  state: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  startedAt: string | null;
  completedAt: string | null;
  summary: string;
  score?: string;
};

export function LearningHistoryControl({
  accent,
  countLabel,
  currentItemId,
  currentSetId,
  errorMessage,
  isCoveredByChildSurface = false,
  isLoading,
  isStartDisabled = false,
  items,
  onContinue,
  onHistoryClose,
  onOpenHistory,
  onRestart,
  onReview,
  onStart,
  pendingActionKey,
  showCountLabel = true,
}: {
  accent: "flashcard" | "quiz" | "test";
  countLabel: string;
  currentItemId?: string;
  currentSetId?: string;
  errorMessage?: string | null;
  isCoveredByChildSurface?: boolean;
  isLoading: boolean;
  isStartDisabled?: boolean;
  items: LearningHistoryDisplayItem[];
  onContinue?: (item: LearningHistoryDisplayItem) => void;
  onHistoryClose?: () => void;
  onOpenHistory: () => void | Promise<void>;
  onRestart?: (item: LearningHistoryDisplayItem) => void;
  onReview: (item: LearningHistoryDisplayItem) => void;
  onStart?: (item: LearningHistoryDisplayItem) => void;
  pendingActionKey?: string | null;
  showCountLabel?: boolean;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isOpeningHistory, setIsOpeningHistory] = useState(false);
  useDocumentScrollLock(isHistoryOpen);
  const shouldReduceMotion = useReducedMotion();
  const isQuiz = accent === "quiz";
  const isTest = accent === "test";
  const isFlashcard = accent === "flashcard";
  const label = isQuiz ? "Quiz" : isTest ? "Bài thi" : "Flashcard";
  const historyLabel = isTest
    ? "Lịch sử Bài thi"
    : `Các bộ ${label} đã ${isQuiz ? "làm" : "học"}`;
  const areAllItemsCompleted =
    items.length > 0 && items.every((item) => item.state === "COMPLETED");
  const currentBadgeItemId = isTest
    ? items[0]?.id
    : (currentItemId ??
      (currentSetId ? items.find((item) => item.setId === currentSetId)?.id : undefined));
  const accentClasses = isQuiz
    ? {
        badge: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
        border: "border-sky-100 dark:border-sky-400/25",
        button:
          "border-sky-300 text-sky-700 hover:bg-sky-50 dark:border-sky-400/50 dark:text-sky-300 dark:hover:bg-sky-500/10",
        primary:
          "bg-sky-500 text-white hover:bg-sky-400 focus-visible:ring-sky-200 dark:focus-visible:ring-sky-500/25",
        icon: "border border-sky-300 bg-sky-200 text-sky-800 dark:border-sky-400/40 dark:bg-sky-500/25 dark:text-sky-200",
        menu: "bg-white outline-sky-200 dark:bg-slate-900 dark:outline-sky-400/40",
      }
    : isTest
      ? {
          badge:
            "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
          border: "border-emerald-100 dark:border-emerald-400/25",
          button:
            "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-400/50 dark:text-emerald-300 dark:hover:bg-emerald-500/10",
          primary:
            "bg-emerald-500 text-white hover:bg-emerald-400 focus-visible:ring-emerald-200 dark:focus-visible:ring-emerald-500/25",
          icon: "border border-emerald-300 bg-emerald-200 text-emerald-800 dark:border-emerald-400/40 dark:bg-emerald-500/25 dark:text-emerald-200",
          menu: "bg-white outline-emerald-200 dark:bg-slate-900 dark:outline-emerald-400/40",
        }
      : {
          badge:
            "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
          border: "border-violet-100 dark:border-violet-400/25",
          button:
            "border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-400/50 dark:text-violet-300 dark:hover:bg-violet-500/10",
          primary:
            "bg-violet-500 text-white hover:bg-violet-400 focus-visible:ring-violet-200 dark:focus-visible:ring-violet-500/25",
          icon: "border border-violet-300 bg-violet-200 text-violet-800 dark:border-violet-400/40 dark:bg-violet-500/25 dark:text-violet-200",
          menu: "bg-white outline-violet-200 dark:bg-slate-900 dark:outline-violet-400/40",
        };
  const menuRootRef = useRef<HTMLDivElement>(null);
  const historyOverlayRef = useRef<HTMLDivElement>(null);
  const historyScrollRegionRef = useRef<HTMLDivElement>(null);
  const coveredHistoryScrollTopRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isCoveredByChildSurface) return;

    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLElement &&
      historyOverlayRef.current?.contains(activeElement)
    ) {
      activeElement.blur();
    }
  }, [isCoveredByChildSurface]);

  useLayoutEffect(() => {
    if (
      isCoveredByChildSurface ||
      coveredHistoryScrollTopRef.current === null ||
      !historyScrollRegionRef.current
    ) {
      return;
    }

    historyScrollRegionRef.current.scrollTop = coveredHistoryScrollTopRef.current;
    coveredHistoryScrollTopRef.current = null;
  }, [isCoveredByChildSurface]);

  useEffect(() => {
    if (!isMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !menuRootRef.current?.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isHistoryOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isCoveredByChildSurface) {
        setIsHistoryOpen(false);
        onHistoryClose?.();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCoveredByChildSurface, isHistoryOpen, onHistoryClose]);

  async function openHistory() {
    if (isOpeningHistory) return;
    setIsOpeningHistory(true);
    try {
      await onOpenHistory();
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
      setIsMenuOpen(false);
      setIsHistoryOpen(true);
    } finally {
      setIsOpeningHistory(false);
    }
  }

  return (
    <>
      <div
        ref={menuRootRef}
        className="relative ml-auto flex shrink-0 items-center gap-1.5"
      >
        {showCountLabel ? (
          <span
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-xl px-[11px] text-[13px] font-black",
              accentClasses.badge,
            )}
          >
            {isQuiz ? (
              <ListOrdered className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : isFlashcard ? (
              <Tag className="h-3.5 w-3.5 shrink-0 rotate-45" aria-hidden="true" />
            ) : null}
            {countLabel}
          </span>
        ) : null}
        <button
          type="button"
          aria-label={`Mở cài đặt ${label}`}
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((open) => !open)}
          className="relative grid h-8 w-8 cursor-pointer place-items-center rounded-xl bg-slate-100 text-slate-500 transition after:absolute after:-inset-1.5 after:content-[''] hover:bg-slate-200 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 dark:hover:text-white dark:focus-visible:ring-slate-500/30"
        >
          <Settings className="h-[21px] w-[21px]" aria-hidden="true" />
        </button>

        {isMenuOpen ? (
          <div
            role="menu"
            className={cn(
              "student-preserve-mobile-shadow absolute right-0 top-[calc(100%+0.5rem)] z-40 w-max max-w-[calc(100vw-2rem)] rounded-xl p-1.5 shadow-[0_12px_28px_-10px_rgba(15,23,42,0.28)] outline outline-1 dark:shadow-[0_16px_32px_-12px_rgba(0,0,0,0.58)]",
              accentClasses.menu,
            )}
          >
            <button
              type="button"
              role="menuitem"
              disabled={isOpeningHistory}
              onClick={() => void openHistory()}
              className={cn(
                "relative z-10 flex h-11 w-max max-w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-black text-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-4 disabled:pointer-events-none dark:text-[var(--theme-text-strong)] dark:focus-visible:ring-slate-700",
                isQuiz
                  ? "hover:text-sky-700 focus-visible:ring-sky-100 dark:hover:text-sky-300"
                  : isTest
                    ? "hover:text-emerald-700 focus-visible:ring-emerald-100 dark:hover:text-emerald-300"
                    : "hover:text-violet-700 focus-visible:ring-violet-100 dark:hover:text-violet-300",
              )}
            >
              <History className="h-[18px] w-[18px]" aria-hidden="true" />
              <span className="whitespace-nowrap">{historyLabel}</span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>

      <AnimatePresence>
        {isHistoryOpen ? (
          <motion.div
            ref={historyOverlayRef}
            className={cn(
              "theme-dialog-overlay fixed inset-0 z-[110] flex items-end justify-center backdrop-blur-sm sm:items-center sm:px-4 sm:py-6",
              isCoveredByChildSurface && "pointer-events-none",
            )}
            data-covered-by-child-surface={isCoveredByChildSurface ? "true" : undefined}
            data-testid="learning-history-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0.08 : 0.16 }}
          >
            <button
              type="button"
              aria-label="Đóng danh sách lịch sử"
              className="absolute inset-0 cursor-default"
              onClick={() => {
                setIsHistoryOpen(false);
                onHistoryClose?.();
              }}
            />
            <motion.section
              role="dialog"
              aria-hidden={isCoveredByChildSurface || undefined}
              aria-modal="true"
              aria-labelledby={`${accent}-history-title`}
              className="theme-dialog-panel relative z-10 flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-[1.75rem] sm:max-w-xl sm:rounded-[1.75rem]"
              initial={
                shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 14 }
              }
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={
                shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.99, y: 8 }
              }
              transition={{
                duration: shouldReduceMotion ? 0.08 : 0.2,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <header
                className={cn(
                  "flex min-h-[4.75rem] shrink-0 items-center gap-2 border-b-2 p-4 pr-3",
                  isQuiz
                    ? "border-sky-200 bg-sky-100/80 dark:border-sky-400/40 dark:bg-sky-900/35"
                    : isTest
                      ? "border-emerald-200 bg-emerald-100/80 dark:border-emerald-400/40 dark:bg-emerald-900/35"
                      : "border-violet-200 bg-violet-100/80 dark:border-violet-400/40 dark:bg-violet-900/35",
                )}
              >
                <span
                  className={cn(
                    "grid h-11 w-11 shrink-0 place-items-center rounded-2xl",
                    accentClasses.icon,
                  )}
                >
                  <History className="h-6 w-6" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2
                    id={`${accent}-history-title`}
                    className={cn(
                      "truncate text-lg font-black",
                      isQuiz
                        ? "text-sky-800 dark:text-sky-200"
                        : isTest
                          ? "text-emerald-800 dark:text-emerald-200"
                          : "text-violet-800 dark:text-violet-200",
                    )}
                  >
                    {historyLabel}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsHistoryOpen(false);
                    onHistoryClose?.();
                  }}
                  className="grid h-11 w-11 place-items-center rounded-xl text-[var(--theme-text)] transition hover:bg-[var(--theme-surface-soft)]"
                  aria-label="Đóng"
                >
                  <X className="h-6 w-6" aria-hidden="true" />
                </button>
              </header>

              <div
                ref={historyScrollRegionRef}
                data-testid="learning-history-scroll-region"
                className="min-h-0 flex-1 overflow-y-auto p-4"
              >
                {isLoading ? (
                  <div
                    aria-busy="true"
                    className="grid min-h-48 place-items-center text-sm font-bold text-[var(--theme-text-muted)]"
                  >
                    <Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" />
                    <span className="sr-only">Đang tải lịch sử</span>
                  </div>
                ) : errorMessage ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-8 text-center text-sm font-bold text-rose-700 dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-200">
                    {errorMessage}
                  </div>
                ) : items.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center dark:border-[var(--theme-border)]">
                    <Clock3
                      className="mx-auto h-8 w-8 text-[var(--theme-text-muted)]"
                      aria-hidden="true"
                    />
                    <p className="mt-3 text-sm font-black text-[var(--theme-text-strong)]">
                      Chưa có lịch sử {label}
                    </p>
                  </div>
                ) : (
                  <div>
                    {items.map((item, index) => {
                      const isStartPending = pendingActionKey === `start:${item.id}`;
                      const isContinuePending =
                        pendingActionKey === `continue:${item.id}`;
                      const isReviewPending = pendingActionKey === `review:${item.id}`;
                      const isRestartPending = pendingActionKey === `restart:${item.id}`;

                      return (
                        <div key={item.id}>
                          <article
                            className={cn(
                              "rounded-2xl border bg-white px-4 py-2.5 dark:bg-[var(--theme-surface)]",
                              accentClasses.border,
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-base font-black text-[var(--theme-text-strong)]">
                                    {item.displayName}
                                  </h3>
                                  <span
                                    className={cn(
                                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black",
                                      item.state === "NOT_STARTED"
                                        ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                                        : item.state === "IN_PROGRESS"
                                          ? accentClasses.badge
                                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
                                    )}
                                  >
                                    {item.state === "NOT_STARTED" ? (
                                      <Clock3
                                        className="h-3.5 w-3.5"
                                        aria-hidden="true"
                                      />
                                    ) : item.state === "IN_PROGRESS" ? (
                                      <Clock3
                                        className="h-3.5 w-3.5"
                                        aria-hidden="true"
                                      />
                                    ) : (
                                      <CheckCircle2
                                        className="h-3.5 w-3.5"
                                        aria-hidden="true"
                                      />
                                    )}
                                    {item.state === "NOT_STARTED"
                                      ? "Chưa làm"
                                      : item.state === "IN_PROGRESS"
                                        ? isFlashcard
                                          ? "Đang học"
                                          : "Đang làm"
                                        : "Đã hoàn thành"}
                                  </span>
                                  {(isTest || areAllItemsCompleted) &&
                                  currentBadgeItemId === item.id ? (
                                    <span
                                      className={cn(
                                        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black",
                                        isTest
                                          ? "border border-emerald-400 bg-emerald-200 text-emerald-900 dark:border-emerald-300/60 dark:bg-emerald-400/25 dark:text-emerald-100"
                                          : isQuiz
                                            ? "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
                                            : "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
                                      )}
                                    >
                                      {isTest ? "Bài thi hiện tại" : "Bộ hiện tại"}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm font-bold">
                                  <span
                                    className={cn(
                                      "inline-flex items-center gap-1.5",
                                      item.state === "COMPLETED"
                                        ? "text-emerald-700 dark:text-emerald-300"
                                        : isQuiz
                                          ? "text-sky-700 dark:text-sky-300"
                                          : isTest
                                            ? "text-emerald-700 dark:text-emerald-300"
                                            : "text-violet-700 dark:text-violet-300",
                                    )}
                                  >
                                    <ListChecks
                                      className="h-4 w-4 shrink-0"
                                      aria-hidden="true"
                                    />
                                    {item.summary}
                                  </span>
                                  {item.score ? (
                                    <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-300">
                                      <Star
                                        className="h-4 w-4 shrink-0"
                                        aria-hidden="true"
                                      />
                                      {item.score}
                                    </span>
                                  ) : null}
                                </div>
                                {item.completedAt || item.startedAt ? (
                                  <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--theme-text-muted)]">
                                    <Clock3
                                      className="h-4 w-4 shrink-0"
                                      aria-hidden="true"
                                    />
                                    {formatHistoryDateTime(
                                      item.completedAt ?? item.startedAt ?? "",
                                    )}
                                  </p>
                                ) : null}
                              </div>
                            </div>

                            {item.state === "NOT_STARTED" && onStart ? (
                              <button
                                type="button"
                                aria-busy={isStartPending}
                                disabled={isStartDisabled || isStartPending}
                                onClick={() => onStart(item)}
                                className={cn(
                                  "mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-base font-black transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-wait disabled:opacity-60",
                                  accentClasses.primary,
                                )}
                              >
                                <Play className="h-5 w-5" aria-hidden="true" />
                                Bắt đầu bài thi
                              </button>
                            ) : item.state === "IN_PROGRESS" && onContinue ? (
                              <button
                                type="button"
                                aria-busy={isContinuePending}
                                disabled={isContinuePending}
                                onClick={() => onContinue(item)}
                                className={cn(
                                  "mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-base font-black transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-wait disabled:opacity-60",
                                  accentClasses.primary,
                                )}
                              >
                                <Play className="h-5 w-5" aria-hidden="true" />
                                {isQuiz || isTest ? "Tiếp tục làm" : "Tiếp tục học"}
                              </button>
                            ) : onRestart ? (
                              <div className="mt-4 grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  aria-busy={isReviewPending}
                                  disabled={isReviewPending}
                                  onClick={() => {
                                    coveredHistoryScrollTopRef.current =
                                      historyScrollRegionRef.current?.scrollTop ?? 0;
                                    onReview(item);
                                  }}
                                  className={cn(
                                    "inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border-2 px-2 text-sm font-black transition disabled:cursor-wait disabled:opacity-60",
                                    accentClasses.button,
                                  )}
                                >
                                  <Eye className="h-4.5 w-4.5" aria-hidden="true" />
                                  Xem lại
                                </button>
                                <button
                                  type="button"
                                  aria-busy={isRestartPending}
                                  disabled={isRestartPending}
                                  onClick={() => onRestart(item)}
                                  className={cn(
                                    "inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-wait disabled:opacity-60",
                                    accentClasses.primary,
                                  )}
                                >
                                  {isQuiz || isTest ? (
                                    <RefreshCcw
                                      className="h-4.5 w-4.5"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <RotateCcw
                                      className="h-4.5 w-4.5"
                                      aria-hidden="true"
                                    />
                                  )}
                                  {isQuiz || isTest ? "Làm lại" : "Học lại"}
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                aria-busy={isReviewPending}
                                disabled={isReviewPending}
                                onClick={() => {
                                  coveredHistoryScrollTopRef.current =
                                    historyScrollRegionRef.current?.scrollTop ?? 0;
                                  onReview(item);
                                }}
                                className={cn(
                                  "mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 px-4 text-base font-black transition disabled:cursor-wait disabled:opacity-60",
                                  accentClasses.button,
                                )}
                              >
                                <Eye className="h-5 w-5" aria-hidden="true" />
                                Xem lại bài thi
                              </button>
                            )}
                          </article>
                          {index < items.length - 1 ? (
                            <div
                              aria-hidden="true"
                              className="mx-1 my-4 h-px bg-slate-200 dark:bg-slate-700"
                            />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function formatHistoryDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Ho_Chi_Minh",
  }).formatToParts(parsed);
  const datePart = (type: "day" | "month" | "year" | "hour" | "minute") =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${datePart("hour")}:${datePart("minute")} ${datePart("day")}-${datePart("month")}-${datePart("year")}`;
}
