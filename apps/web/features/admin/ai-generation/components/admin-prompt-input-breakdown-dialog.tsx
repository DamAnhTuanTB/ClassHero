"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Braces, FileText, MessageSquareText, ScrollText, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";

export function AdminPromptInputBreakdownDialog({
  breakdown,
  isOpen,
  onClose,
}: {
  breakdown: {
    contextTokens: number;
    estimatedTokens: number;
    pdfInputTokens: number;
    schemaTokens: number;
    systemInstructionsTokens: number;
    textInputTokens: number;
    userPromptTokens: number;
  };
  isOpen: boolean;
  onClose: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const [isMounted, setIsMounted] = useState(false);
  const otherTextTokens = Math.max(
    0,
    breakdown.textInputTokens -
      breakdown.systemInstructionsTokens -
      breakdown.userPromptTokens -
      breakdown.contextTokens -
      breakdown.schemaTokens,
  );
  const items = useMemo(
    () =>
      [
        {
          label: "Quy tắc hệ thống",
          description: "Hướng dẫn, ràng buộc và profile môn học gửi kèm model.",
          icon: ScrollText,
          tokens: breakdown.systemInstructionsTokens,
        },
        {
          label: "Câu lệnh người dùng",
          description: "Yêu cầu tạo nội dung theo các lựa chọn hiện tại.",
          icon: MessageSquareText,
          tokens: breakdown.userPromptTokens,
        },
        {
          label: "Nội dung tài liệu dạng text",
          description: "Các đoạn OCR hoặc context dạng text gửi kèm model.",
          icon: FileText,
          tokens: breakdown.contextTokens,
        },
        {
          label: "JSON Schema",
          description: "Cấu trúc đầu ra bắt buộc để AI trả dữ liệu đúng định dạng.",
          icon: Braces,
          tokens: breakdown.schemaTokens,
        },
        {
          label: "Manifest và text kỹ thuật khác",
          description: "Thông tin ánh xạ trang và lớp bọc request dạng text.",
          icon: Braces,
          tokens: otherTextTokens,
        },
      ].filter((item) => item.tokens > 0),
    [breakdown, otherTextTokens],
  );

  useEffect(() => setIsMounted(true), []);
  if (!isMounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="theme-dialog-overlay fixed inset-0 z-[110] flex items-center justify-center px-4 py-4 backdrop-blur-sm sm:py-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: "easeOut" }}
        >
          <button
            type="button"
            aria-label="Đóng chi tiết input"
            className="absolute inset-0 cursor-pointer"
            onClick={onClose}
          />
          <motion.section
            aria-label="Chi tiết token input ước tính"
            aria-modal="true"
            role="dialog"
            className="theme-dialog-panel relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-lg"
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
                Chi tiết token input ước tính
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
              <div className="grid gap-3 sm:grid-cols-3">
                <TokenTotalCard label="Text input" tokens={breakdown.textInputTokens} />
                <TokenTotalCard label="PDF input" tokens={breakdown.pdfInputTokens} />
                <TokenTotalCard
                  label="Tổng input"
                  tokens={breakdown.estimatedTokens}
                  emphasized
                />
              </div>
              <div className="mt-4 divide-y divide-[var(--theme-border)] rounded-xl border border-[var(--theme-border)]">
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div className="flex items-start gap-3 p-4" key={item.label}>
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-extrabold text-[var(--theme-text-strong)]">
                          {item.label}
                        </p>
                        <p className="mt-0.5 text-xs leading-5 text-[var(--theme-text-muted)]">
                          {item.description}
                        </p>
                      </div>
                      <span className="whitespace-nowrap text-sm font-extrabold text-[var(--theme-text-strong)]">
                        {item.tokens.toLocaleString("vi-VN")}
                      </span>
                    </div>
                  );
                })}
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

function TokenTotalCard({
  emphasized = false,
  label,
  tokens,
}: {
  emphasized?: boolean;
  label: string;
  tokens: number;
}) {
  return (
    <div
      className={
        emphasized
          ? "rounded-xl border border-[var(--theme-primary-border)] bg-[var(--theme-primary-soft)] p-3"
          : "rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-subtle)] p-3"
      }
    >
      <p className="text-xs font-bold text-[var(--theme-text-muted)]">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-[var(--theme-text-strong)]">
        {tokens.toLocaleString("vi-VN")}
      </p>
      <p className="text-xs font-bold text-[var(--theme-text-muted)]">token ước tính</p>
    </div>
  );
}
