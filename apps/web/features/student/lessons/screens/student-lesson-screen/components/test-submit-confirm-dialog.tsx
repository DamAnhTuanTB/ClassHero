"use client";

import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Eye, Loader2, TriangleAlert, X } from "lucide-react";

export function TestSubmitConfirmDialog({
  incompleteQuestionNumbers,
  isPending,
  isOpen,
  onCancel,
  onConfirm,
}: {
  incompleteQuestionNumbers: ReadonlyArray<number>;
  isPending?: boolean;
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const hasIncomplete = incompleteQuestionNumbers.length > 0;

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isPending) {
        onCancel();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isPending, onCancel]);

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
            disabled={isPending}
            aria-label="Đóng bảng xác nhận"
            className="absolute inset-0 cursor-default"
            onClick={onCancel}
          />

          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="test-submit-dialog-title"
            aria-describedby="test-submit-dialog-description"
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
                disabled={isPending}
                onClick={onCancel}
                className="grid h-10 w-10 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:text-[var(--theme-text-muted)] dark:hover:bg-[var(--theme-surface-muted)] dark:hover:text-[var(--theme-text-strong)]"
                aria-label="Đóng"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <header className="theme-dialog-header student-mobile-border flex min-h-[4.5rem] shrink-0 items-center gap-2.5 p-4 pr-12 border-b border-slate-200 dark:border-[var(--theme-border)]">
              <span
                className={`student-mobile-border grid h-10 w-10 shrink-0 place-items-center rounded-xl border shadow-sm ${
                  hasIncomplete
                    ? "border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-300/40 dark:bg-amber-400/20 dark:text-amber-200"
                    : "border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-300/40 dark:bg-emerald-400/20 dark:text-emerald-200"
                }`}
              >
                {hasIncomplete ? (
                  <TriangleAlert className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                )}
              </span>
              <h2
                id="test-submit-dialog-title"
                className="text-[15px] font-extrabold leading-tight text-[var(--theme-text-strong)] sm:text-base"
              >
                {hasIncomplete ? "Cảnh báo bài thi chưa làm xong" : "Xác nhận nộp bài thi"}
              </h2>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-1.5">
              {hasIncomplete ? (
                <>
                  <p className="text-sm font-semibold leading-6 text-[var(--theme-text)]">
                    Bạn chưa hoàn thành{" "}
                    {incompleteQuestionNumbers.length === 1 ? "câu " : "các câu: "}
                    <span className="font-extrabold text-amber-600 dark:text-amber-400">
                      {incompleteQuestionNumbers.join(", ")}
                    </span>
                    .
                  </p>
                  <p className="text-xs font-semibold leading-5 text-[var(--theme-text-muted)]">
                    Những câu chưa làm sẽ không được tính điểm. Bạn vẫn muốn nộp bài thi chứ?
                  </p>
                </>
              ) : (
                <p
                  id="test-submit-dialog-description"
                  className="text-sm font-semibold leading-6 text-[var(--theme-text)]"
                >
                  Bạn chắc chắn muốn nộp bài chứ?
                </p>
              )}
            </div>

            <footer className="theme-dialog-footer student-mobile-border grid shrink-0 grid-cols-2 gap-2 p-3 border-t border-slate-200 dark:border-[var(--theme-border)] sm:flex sm:justify-end sm:p-4">
              <button
                type="button"
                disabled={isPending}
                onClick={onCancel}
                className="theme-button-neutral student-mobile-border inline-flex min-h-12 min-w-0 items-center justify-center gap-2.5 whitespace-nowrap rounded-xl px-4 text-base font-extrabold transition sm:w-auto"
              >
                {hasIncomplete ? (
                  <>
                    <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                    Làm tiếp
                  </>
                ) : (
                  <>
                    <Eye className="h-5 w-5" aria-hidden="true" />
                    Xem lại
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={onConfirm}
                className={`inline-flex min-h-12 min-w-0 items-center justify-center gap-2.5 whitespace-nowrap rounded-xl px-4 text-base font-extrabold text-white shadow-sm transition focus-visible:outline-none disabled:opacity-60 sm:w-auto ${
                  hasIncomplete
                    ? "bg-amber-600 hover:bg-amber-500 active:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500"
                    : "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                }`}
              >
                {isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                )}
                {hasIncomplete ? "Vẫn nộp bài" : "Nộp bài"}
              </button>
            </footer>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
