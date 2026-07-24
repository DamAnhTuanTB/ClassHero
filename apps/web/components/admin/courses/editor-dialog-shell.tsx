"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EditorDialogShell({
  ariaLabel,
  children,
  isOpen,
  leadingAction,
  onClose,
  panelClassName,
}: {
  ariaLabel: string;
  children: ReactNode;
  isOpen: boolean;
  leadingAction?: ReactNode;
  onClose: () => void;
  panelClassName?: string;
}) {
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="theme-dialog-overlay fixed inset-0 z-50 flex items-center justify-center overflow-hidden px-4 py-4 backdrop-blur-sm sm:py-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: "easeOut" }}
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 cursor-pointer"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            className={cn(
              "theme-dialog-panel relative z-10 flex max-h-[calc(100dvh-2rem)] w-full min-w-0 max-w-2xl flex-col overflow-hidden rounded-lg",
              panelClassName,
            )}
            initial={
              shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.98 }
            }
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={
              shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.985 }
            }
            transition={{
              duration: shouldReduceMotion ? 0 : 0.2,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <div className="absolute right-4 top-0 z-20 flex h-16 items-center gap-2 sm:right-5">
              {leadingAction}
              <button
                type="button"
                onClick={onClose}
                className="theme-button-primary-subtle grid h-9 w-9 place-items-center rounded-lg transition"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="flex w-full min-w-0 min-h-0 flex-1 flex-col">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
