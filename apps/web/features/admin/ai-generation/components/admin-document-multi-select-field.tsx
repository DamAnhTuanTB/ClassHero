"use client";

import { Check, ChevronDown, Files } from "lucide-react";
import { useState } from "react";
import { FieldLabel } from "@/components/common/forms/field-label";
import { formFocusClass } from "@/components/common/forms/form-styles";
import type { AdminAiPanelDocument } from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import { cn } from "@/lib/utils";

export function AdminDocumentMultiSelectField({
  documents,
  error,
  onChange,
  value,
}: {
  documents: AdminAiPanelDocument[];
  error?: { message?: string };
  onChange: (value: string[]) => void;
  value: string[];
}) {
  const id = "ai-summary-documents";
  const [isOpen, setIsOpen] = useState(false);
  const selectedLabels = documents
    .filter((document) => value.includes(document.id))
    .map((document) => getSelectedDocumentLabel(document));

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsOpen(false);
        }
      }}
    >
      <FieldLabel id={id} label="Tài liệu dùng để tạo" />
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? `${id}-error` : undefined}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setIsOpen(false);
          }
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
        className={cn(
          "mt-2 flex min-h-[3.35rem] w-full touch-manipulation items-center justify-between gap-3 rounded-xl border border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] px-4 text-left text-base font-semibold text-[var(--theme-text-strong)] outline-none transition hover:border-[var(--theme-input-hover-border)] lg:text-sm",
          formFocusClass,
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <Files className="h-5 w-5 shrink-0 text-[var(--theme-text-muted)]" />
          <span
            className={cn(
              "min-w-0 flex-1 truncate",
              selectedLabels.length === 0 && "text-[var(--theme-text-placeholder)]",
            )}
          >
            {selectedLabels.length > 0
              ? selectedLabels.join(", ")
              : "Chọn một hoặc nhiều tài liệu"}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-[var(--theme-text-muted)] transition-transform duration-200",
            isOpen && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {isOpen ? (
        <div
          role="listbox"
          aria-label="Tài liệu dùng để tạo"
          aria-multiselectable="true"
          className="absolute z-50 mt-2 max-h-64 w-full space-y-1 overflow-y-auto rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-1.5 shadow-[var(--theme-shadow-lg)]"
        >
          {documents.length === 0 ? (
            <p className="px-3 py-3 text-sm font-semibold text-[var(--theme-text-muted)]">
              Buổi học chưa có tài liệu.
            </p>
          ) : (
            documents.map((document) => {
              const isSelected = value.includes(document.id);
              return (
                <button
                  key={document.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={!document.canUseForSummary}
                  disabled={!document.canUseForSummary}
                  onClick={() =>
                    onChange(
                      isSelected
                        ? value.filter((id) => id !== document.id)
                        : [...value, document.id],
                    )
                  }
                  className={cn(
                    "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left outline-none transition",
                    isSelected
                      ? "bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]"
                      : "text-[var(--theme-text)] hover:bg-[var(--theme-surface-soft)] focus:bg-[var(--theme-surface-soft)]",
                    !document.canUseForSummary &&
                      "cursor-not-allowed text-[var(--theme-text-disabled)] opacity-70",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-5 w-5 shrink-0 place-items-center rounded-md border",
                      isSelected
                        ? "border-[var(--theme-primary)] bg-[var(--theme-primary)] text-[var(--theme-primary-foreground)]"
                        : "border-[var(--theme-input-border)] bg-[var(--theme-input-bg)]",
                    )}
                  >
                    {isSelected ? (
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-extrabold">
                      {document.title}
                    </span>
                    {document.pageRange ? (
                      <span className="mt-0.5 block text-xs font-semibold text-[var(--theme-text-muted)]">
                        Trích xuất trang {document.pageRange.pageStart}–
                        {document.pageRange.pageEnd}
                      </span>
                    ) : null}
                    {document.unavailableReason ? (
                      <span className="mt-0.5 block text-xs font-semibold text-[var(--theme-text-muted)]">
                        {document.unavailableReason}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })
          )}
        </div>
      ) : null}

      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-[var(--theme-error-text)]">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}

function getSelectedDocumentLabel(document: AdminAiPanelDocument) {
  if (!document.pageRange) {
    return document.title;
  }

  return `${document.title} (trang ${document.pageRange.pageStart}–${document.pageRange.pageEnd})`;
}
