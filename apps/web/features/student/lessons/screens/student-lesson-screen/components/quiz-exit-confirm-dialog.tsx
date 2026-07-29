"use client";

import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, LogOut, TriangleAlert, X } from "lucide-react";

export function QuizExitConfirmDialog({
  accent = "quiz",
  activityLabel = "bài Quiz",
  isOpen,
  onCancel,
  onConfirm,
}: {
  accent?: "flashcard" | "quiz";
  activityLabel?: string;
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const alertIconColorClassName =
    accent === "flashcard"
      ? "border-violet-300 bg-violet-100 text-violet-700 dark:border-violet-300/40 dark:bg-violet-400/20 dark:text-violet-200"
      : "border-sky-300 bg-sky-100 text-sky-700 dark:border-sky-300/40 dark:bg-sky-400/20 dark:text-sky-200";
  const closeButtonColorClassName =
    accent === "flashcard"
      ? "border border-violet-300 bg-violet-100 text-violet-700 hover:bg-violet-200 dark:border-violet-300/40 dark:bg-violet-400/20 dark:text-violet-200 dark:hover:bg-violet-400/30"
      : "theme-button-primary-subtle";
  const confirmButtonColorClassName =
    accent === "flashcard"
      ? "bg-violet-500 text-white shadow-[var(--theme-shadow-sm)] hover:bg-violet-400 dark:bg-violet-500 dark:hover:bg-violet-400"
      : "theme-button-primary";

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="theme-dialog-overlay fixed inset-0 z-[100] flex items-center justify-center px-4 py-6 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: "easeOut" }}
        >
          <button
            type="button"
            aria-label={`Ở lại ${activityLabel}`}
            className="absolute inset-0 cursor-default"
            onClick={onCancel}
          />

          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="quiz-exit-dialog-title"
            aria-describedby="quiz-exit-dialog-description"
            className="theme-dialog-panel relative z-10 flex max-h-[calc(100dvh-3rem)] w-full max-w-sm flex-col overflow-hidden rounded-2xl"
            initial={
              shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }
            }
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={
              shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.985 }
            }
            transition={{
              duration: shouldReduceMotion ? 0 : 0.2,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <div className="absolute right-4 top-0 z-20 flex h-[4.5rem] items-center">
              <button
                type="button"
                onClick={onCancel}
                className={`grid h-10 w-10 place-items-center rounded-xl transition ${closeButtonColorClassName}`}
                aria-label="Đóng"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <header className="theme-dialog-header flex min-h-[4.5rem] shrink-0 items-center gap-3 p-4 pr-16">
              <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border shadow-sm ${alertIconColorClassName}`}
              >
                <TriangleAlert className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2
                id="quiz-exit-dialog-title"
                className="text-base font-extrabold text-[var(--theme-text-strong)] sm:text-lg"
              >
                Thoát {activityLabel}?
              </h2>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <p
                id="quiz-exit-dialog-description"
                className="text-sm font-semibold leading-6 text-[var(--theme-text)]"
              >
                Bạn chưa hoàn thành xong {activityLabel}. Vẫn thoát chứ?
              </p>
            </div>

            <footer className="theme-dialog-footer grid shrink-0 grid-cols-2 gap-2 p-3 sm:flex sm:justify-end sm:p-4">
              <button
                type="button"
                autoFocus
                onClick={onCancel}
                className="theme-button-neutral inline-flex min-h-12 min-w-0 items-center justify-center gap-2.5 whitespace-nowrap rounded-xl px-4 text-base font-extrabold transition sm:w-auto"
              >
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />Ở lại
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={`inline-flex min-h-12 min-w-0 items-center justify-center gap-2.5 whitespace-nowrap rounded-xl px-4 text-base font-extrabold transition sm:w-auto ${confirmButtonColorClassName}`}
              >
                <LogOut className="h-5 w-5" aria-hidden="true" />
                Vẫn thoát
              </button>
            </footer>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
