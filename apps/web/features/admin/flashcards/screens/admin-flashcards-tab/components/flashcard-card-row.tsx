"use client";

import { Gauge, Pencil, Trash2 } from "lucide-react";
import type { AdminFlashcard } from "@/features/admin/flashcards/api/admin-flashcards-api";
import { getTiptapDocumentText } from "@/lib/tiptap-rich-content";
import { cn } from "@/lib/utils";

const difficultyLabels = {
  EASY: "Dễ",
  MEDIUM: "Trung bình",
  HARD: "Khó",
} as const;

export function FlashcardCardRow({
  card,
  index,
  onDelete,
  onEdit,
}: {
  card: AdminFlashcard;
  index: number;
  onDelete: (card: AdminFlashcard) => void;
  onEdit: (card: AdminFlashcard) => void;
}) {
  const front = getTiptapDocumentText(card.frontJson) || "Nội dung rich text";
  const back = getTiptapDocumentText(card.backJson) || "Nội dung rich text";
  const explanation = getTiptapDocumentText(card.explanation?.contentJson);

  return (
    <article className="space-y-4 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-xs font-extrabold uppercase tracking-wide text-[var(--theme-primary)]">
            Flashcard {index + 1}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-extrabold",
              card.difficulty === "MEDIUM"
                ? "border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] text-[var(--theme-warning-text)]"
                : "border-transparent bg-[var(--theme-surface-soft)] text-[var(--theme-text-muted)]",
            )}
          >
            {card.difficulty === "MEDIUM" ? (
              <Gauge className="size-3.5" aria-hidden="true" />
            ) : null}
            {difficultyLabels[card.difficulty]}
          </span>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            aria-label={`Sửa flashcard ${index + 1}`}
            onClick={() => onEdit(card)}
            className="theme-button-primary-subtle grid h-10 w-10 place-items-center rounded-lg"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Xóa flashcard ${index + 1}`}
            onClick={() => onDelete(card)}
            className="theme-button-danger-subtle grid h-10 w-10 place-items-center rounded-lg"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--theme-border)] bg-transparent p-3">
        <p className="text-xs font-bold text-[var(--theme-text-muted)]">Mặt trước</p>
        <h5 className="mt-1 whitespace-pre-wrap text-base font-extrabold leading-6 text-[var(--theme-text-strong)]">
          {front}
        </h5>
      </div>

      <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-3">
        <p className="text-xs font-bold text-[var(--theme-text-muted)]">Mặt sau</p>
        <p className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-6 text-[var(--theme-text-strong)]">
          {back}
        </p>
      </div>

      {explanation ? (
        <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-3">
          <p className="text-xs font-extrabold text-[var(--theme-text-muted)]">
            Lời giải chi tiết
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--theme-text)]">
            {explanation}
          </p>
        </div>
      ) : null}
    </article>
  );
}
