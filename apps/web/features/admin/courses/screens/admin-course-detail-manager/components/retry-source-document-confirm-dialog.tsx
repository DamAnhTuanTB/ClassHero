"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Loader2, RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";
import { getAdminSourceDocumentCacheStatus } from "@/features/admin/courses/api/admin-course-documents-api";

export function RetrySourceDocumentConfirmDialog({
  isOpen,
  isConfirming = false,
  sourceDocumentId,
  onCancel,
  onConfirm,
}: {
  isOpen: boolean;
  isConfirming?: boolean;
  sourceDocumentId: string | null;
  onCancel: () => void;
  onConfirm: (forceNewOcr: boolean) => void;
}) {
  const session = useAuthSessionStore((state) => state.session);
  const [isCheckingCache, setIsCheckingCache] = useState(false);
  const [hasCache, setHasCache] = useState<boolean | null>(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (isOpen && sourceDocumentId && session?.accessToken) {
      setIsCheckingCache(true);
      setHasCache(null);
      getAdminSourceDocumentCacheStatus(sourceDocumentId, session.accessToken)
        .then((result) => {
          setHasCache(result.hasCache);
        })
        .catch(() => {
          setHasCache(false);
        })
        .finally(() => {
          setIsCheckingCache(false);
        });
    }
  }, [isOpen, sourceDocumentId, session?.accessToken]);

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
            aria-label="Xử lý lại tài liệu"
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
              <span className="theme-button-primary-subtle grid h-10 w-10 shrink-0 place-items-center rounded-lg">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
                  Xử lý lại tài liệu
                </h2>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <div className="min-h-16">
                {isCheckingCache ? (
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--theme-text-muted)]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang kiểm tra dữ liệu cache...
                  </div>
                ) : hasCache === true ? (
                  <p className="text-sm leading-6 text-[var(--theme-text-muted)] font-semibold">
                    Tài liệu này <span className="font-extrabold text-[var(--theme-success-text)]">đã có dữ liệu OCR trong cache</span>. Quá trình xử lý lại sẽ ưu tiên dùng dữ liệu cache để tiết kiệm chi phí và diễn ra rất nhanh.
                  </p>
                ) : hasCache === false ? (
                  <p className="text-sm leading-6 text-[var(--theme-text-muted)] font-semibold">
                    Tài liệu này <span className="font-extrabold text-[var(--theme-danger)]">chưa có dữ liệu OCR trong cache</span>. Hệ thống sẽ bóc tách dữ liệu mới từ đầu và có thể tốn thêm chi phí (nếu dùng Mathpix) cũng như thời gian chờ.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="theme-dialog-footer flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={onCancel}
                disabled={isConfirming || isCheckingCache}
                className="theme-button-neutral inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-extrabold transition disabled:opacity-60"
              >
                Hủy
              </button>
              
              {hasCache === true ? (
                <button
                  type="button"
                  onClick={() => onConfirm(true)}
                  disabled={isConfirming || isCheckingCache}
                  className="theme-button-danger inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-extrabold transition disabled:opacity-60"
                >
                  OCR mới lại
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => onConfirm(false)}
                disabled={isConfirming || isCheckingCache}
                className="theme-button-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-extrabold transition disabled:opacity-60"
              >
                {isConfirming ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                )}
                {isConfirming ? "Đang xử lý" : "Xử lý lại cache"}
              </button>
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
