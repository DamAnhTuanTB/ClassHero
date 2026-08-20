"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BookImage, Loader2, Sparkles, X } from "lucide-react";

import type { TextbookImageBulkReplacePlan } from "@/features/admin/ai-generation/hooks/use-admin-replace-all-textbook-images";

export function AdminReplaceAllTextbookImagesDialog({
  completedCount,
  isOpen,
  isPending,
  onCancel,
  onConfirm,
  plan,
}: {
  completedCount: number;
  isOpen: boolean;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  plan: TextbookImageBulkReplacePlan;
}) {
  const shouldReduceMotion = useReducedMotion();
  const eligibleCount = plan.eligibleItems.length;
  const skippedCount = plan.initialAiImageCount - eligibleCount;

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          animate={{ opacity: 1 }}
          className="theme-dialog-overlay fixed inset-0 z-[70] flex items-center justify-center px-4 py-6 backdrop-blur-sm"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: "easeOut" }}
        >
          <div
            aria-hidden="true"
            className={`absolute inset-0 ${isPending ? "cursor-wait" : "cursor-pointer"}`}
            onClick={isPending ? undefined : onCancel}
          />

          <motion.section
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            aria-describedby="replace-all-textbook-images-description"
            aria-labelledby="replace-all-textbook-images-title"
            aria-modal="true"
            className="theme-dialog-panel relative z-10 flex max-h-[calc(100dvh-3rem)] w-full max-w-md flex-col overflow-hidden rounded-xl"
            exit={
              shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985, y: 8 }
            }
            initial={
              shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 12 }
            }
            role="dialog"
            transition={{
              duration: shouldReduceMotion ? 0 : 0.2,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <div className="absolute right-4 top-0 z-20 flex h-[4.5rem] items-center">
              <button
                aria-label="Đóng"
                className="theme-button-primary-subtle grid h-10 w-10 place-items-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isPending}
                onClick={onCancel}
                type="button"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <header className="theme-dialog-header flex min-h-[4.5rem] shrink-0 items-center gap-3 p-4 pr-16">
              <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
                <BookImage className="h-5 w-5" aria-hidden="true" />
                <Sparkles
                  className="absolute -right-1 -top-1 h-3.5 w-3.5"
                  aria-hidden="true"
                />
              </span>
              <h2
                className="text-base font-extrabold text-[var(--theme-text-strong)] sm:text-lg"
                id="replace-all-textbook-images-title"
              >
                Thay các hình AI ban đầu bằng ảnh SGK?
              </h2>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <div
                className="space-y-3 text-sm leading-6 text-[var(--theme-text)]"
                id="replace-all-textbook-images-description"
              >
                <p>
                  <strong>{eligibleCount} hình từ lượt AI sinh ban đầu</strong> sẽ được
                  thay bằng crop gốc sách giáo khoa, sau đó tự động giảm nhiễu và làm nét
                  bằng xử lý local. Ảnh admin tạo mới bằng AI, tạo bằng mã code, tải lên
                  và ảnh SGK hiện có đều được giữ nguyên. Thao tác này không gọi AI trả
                  phí.
                </p>
                {skippedCount > 0 ? (
                  <p className="rounded-lg border border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] p-3 text-[var(--theme-warning-text)]">
                    Giữ nguyên {skippedCount} hình AI ban đầu: {plan.skippedMissingCount}{" "}
                    thiếu crop chính xác, {plan.skippedAmbiguousCount} có nhiều crop cần
                    chọn thủ công, {plan.skippedBusyCount} đang xử lý.
                  </p>
                ) : null}
                {isPending ? (
                  <p
                    aria-live="polite"
                    className="font-bold text-sky-700 dark:text-sky-300"
                  >
                    Đang thay và làm nét {completedCount}/{eligibleCount} hình…
                  </p>
                ) : null}
              </div>
            </div>

            <footer className="theme-dialog-footer grid shrink-0 grid-cols-2 gap-2 p-3 sm:flex sm:justify-end sm:p-4">
              <button
                className="theme-button-neutral inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-lg px-4 text-sm font-extrabold transition disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isPending}
                onClick={onCancel}
                type="button"
              >
                Hủy
              </button>
              <button
                className="theme-button-primary inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold transition disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isPending || eligibleCount === 0}
                onClick={onConfirm}
                type="button"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <BookImage className="h-4 w-4" aria-hidden="true" />
                )}
                {isPending ? "Đang thay ảnh" : "Thay và làm nét"}
              </button>
            </footer>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
