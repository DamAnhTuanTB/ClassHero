"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Loader2, UserPlus, X } from "lucide-react";

export function CreatePersonalPathConfirmDialog({
  isOpen,
  isSubmitting,
  studentName,
  basePathTitle,
  onCancel,
  onConfirm,
}: {
  isOpen: boolean;
  isSubmitting?: boolean;
  studentName: string;
  basePathTitle: string;
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
            aria-label="Tạo bản lộ trình cá nhân"
            className="theme-dialog-panel relative z-10 flex max-h-[calc(100dvh-3rem)] w-full max-w-lg flex-col overflow-hidden rounded-lg"
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
            {/* Close button */}
            <div className="absolute right-4 top-0 z-20 flex h-[4.5rem] items-center">
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="theme-button-primary-subtle grid h-10 w-10 place-items-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Header */}
            <div className="flex min-h-[4.5rem] items-center gap-3 border-b border-[var(--theme-border)] px-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-950">
                <UserPlus
                  className="h-5 w-5 text-purple-600 dark:text-purple-400"
                  aria-hidden="true"
                />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-base font-bold text-[var(--theme-text-strong)]">
                  Tạo bản lộ trình cá nhân
                </h2>
                <p className="truncate text-sm text-[var(--theme-text-muted)]">
                  Cho học sinh:{" "}
                  <span className="font-semibold text-[var(--theme-text)]">
                    {studentName}
                  </span>
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="overflow-y-auto px-6 py-5">
              <div className="rounded-lg border border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] p-4">
                <div className="flex gap-3">
                  <AlertTriangle
                    className="mt-0.5 h-5 w-5 shrink-0 text-[var(--theme-warning-text)]"
                    aria-hidden="true"
                  />
                  <div className="space-y-1.5 text-sm text-[var(--theme-warning-text)]">
                    <p className="font-bold">Lưu ý quan trọng</p>
                    <ul className="list-inside list-disc space-y-1 text-[var(--theme-warning-text)]">
                      <li>
                        Bản cá nhân được sao chép từ khóa{" "}
                        <span className="font-semibold">
                          &ldquo;{basePathTitle}&rdquo;
                        </span>{" "}
                        tại thời điểm này.
                      </li>
                      <li>
                        Bản cá nhân <strong>không tự nhận</strong> các thay đổi từ khóa
                        gốc trong tương lai.
                      </li>
                      <li>
                        Sau khi tạo, không thể quay lại khóa gốc cho enrollment này.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <p className="mt-4 text-sm text-[var(--theme-text)]">
                Quá trình sao chép chạy nền và có thể mất vài phút. Admin có thể theo dõi
                tiến trình trong danh sách học sinh.
              </p>
            </div>

            {/* Footer */}
            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[var(--theme-border)] px-6 py-4">
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="theme-button-neutral inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                Hủy
              </button>
              <button
                type="button"
                id="confirm-create-personal-path-btn"
                onClick={onConfirm}
                disabled={isSubmitting}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-purple-600 px-4 text-sm font-bold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-purple-700 dark:hover:bg-purple-600"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                )}
                {isSubmitting ? "Đang tạo..." : "Tạo bản cá nhân"}
              </button>
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
