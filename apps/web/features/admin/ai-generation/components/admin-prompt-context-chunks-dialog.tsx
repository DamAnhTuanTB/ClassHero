"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { FileText, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { MathpixMarkdownRenderer } from "@/components/shared/mathpix-markdown-renderer";
import type { AdminLessonSummaryPromptPreview } from "@/features/admin/ai-generation/types/admin-ai-generation.types";

type PromptPreviewChunk = NonNullable<
  AdminLessonSummaryPromptPreview["context"]["chunks"]
>[number];

export function AdminPromptContextChunksDialog({
  chunks,
  isOpen,
  lessonTitle,
  onClose,
}: {
  chunks: PromptPreviewChunk[];
  isOpen: boolean;
  lessonTitle: string;
  onClose: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => setIsMounted(true), []);

  if (!isMounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="theme-dialog-overlay fixed inset-0 z-[70] flex items-center justify-center px-4 py-4 backdrop-blur-sm sm:py-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: "easeOut" }}
        >
          <button
            type="button"
            aria-label="Đóng xem trước phần nội dung"
            className="absolute inset-0 cursor-pointer"
            onClick={onClose}
          />
          <motion.section
            aria-label="Xem trước phần nội dung gửi AI"
            aria-modal="true"
            role="dialog"
            className="theme-dialog-panel relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-lg"
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
            <header className="theme-dialog-header flex min-h-16 shrink-0 items-center px-5 pr-16">
              <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
                {chunks.length} phần nội dung gửi AI
              </h2>
              <button
                type="button"
                aria-label="Đóng"
                className="theme-button-primary-subtle absolute right-4 top-3 grid h-9 w-9 place-items-center rounded-lg sm:right-5"
                onClick={onClose}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="space-y-3">
                {chunks.map((chunk, index) => (
                  <article
                    className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-subtle)]"
                    key={chunk.id}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--theme-border)] px-4 py-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <FileText
                          className="h-4 w-4 shrink-0 text-[var(--theme-primary)]"
                          aria-hidden="true"
                        />
                        <p className="truncate text-sm font-extrabold text-[var(--theme-text-strong)]">
                          Phần {index + 1} · {lessonTitle}
                        </p>
                      </div>
                      <span className="whitespace-nowrap text-xs font-bold text-[var(--theme-text-muted)]">
                        {formatChunkLocation(chunk)} ·{" "}
                        {chunk.tokenCount.toLocaleString("vi-VN")} token
                      </span>
                    </div>
                    <div className="p-4">
                      <MathpixMarkdownRenderer content={chunk.content} />
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <footer className="theme-dialog-footer shrink-0 p-3 sm:flex sm:justify-end sm:p-4">
              <button
                type="button"
                className="theme-button-neutral inline-flex min-h-11 w-full items-center justify-center whitespace-nowrap rounded-lg px-4 text-sm font-extrabold sm:w-auto"
                onClick={onClose}
              >
                Đóng
              </button>
            </footer>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

function formatChunkLocation(chunk: PromptPreviewChunk) {
  if (!chunk.pageRange) return `Đoạn ${chunk.chunkIndex + 1}`;
  const { pageStart, pageEnd } = chunk.pageRange;
  return pageStart === pageEnd ? `Trang ${pageStart}` : `Trang ${pageStart}–${pageEnd}`;
}
