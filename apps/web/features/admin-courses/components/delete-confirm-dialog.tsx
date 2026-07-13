"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";

export function DeleteConfirmDialog({
  confirmLabel = "Xóa",
  description,
  isConfirming = false,
  isOpen,
  itemName,
  title = "Xóa mục này",
  onCancel,
  onConfirm,
}: {
  confirmLabel?: string;
  description?: string;
  isConfirming?: boolean;
  isOpen: boolean;
  itemName: string;
  title?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="theme-dialog-overlay fixed inset-0 z-[60] flex items-center justify-center px-4 py-6 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: "easeOut" }}
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 cursor-pointer"
            onClick={onCancel}
          />
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="theme-dialog-panel relative z-10 flex max-h-[calc(100dvh-3rem)] w-full max-w-md flex-col overflow-hidden rounded-lg"
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
                className="theme-button-primary-subtle grid h-10 w-10 place-items-center rounded-lg transition"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="theme-dialog-header flex min-h-[4.5rem] shrink-0 items-center gap-3 p-4 pr-16">
              <span className="theme-button-danger-subtle grid h-10 w-10 shrink-0 place-items-center rounded-lg">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
                  {title}
                </h2>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <p className="text-sm leading-6 text-[var(--theme-text)]">
                {description ?? `Bạn có thực sự muốn xóa ${itemName} không?`}
              </p>
            </div>

            <div className="theme-dialog-footer grid shrink-0 grid-cols-2 gap-2 p-3 sm:flex sm:justify-end sm:p-4">
              <button
                type="button"
                onClick={onCancel}
                disabled={isConfirming}
                className="theme-button-neutral inline-flex min-h-11 min-w-0 items-center justify-center whitespace-nowrap rounded-lg px-4 text-center text-sm font-extrabold transition sm:w-auto"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isConfirming}
                className="theme-button-danger inline-flex min-h-11 min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-center text-sm font-extrabold transition sm:w-auto"
              >
                {isConfirming ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                )}
                {isConfirming ? "Đang xử lý" : confirmLabel}
              </button>
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
