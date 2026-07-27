"use client";

import type { AdminFlashcardSet } from "@/features/admin/flashcards/api/admin-flashcards-api";
import { cn } from "@/lib/utils";

export function FlashcardSetTabs({
  activeSetId,
  sets,
  onSelect,
}: {
  activeSetId: string;
  sets: AdminFlashcardSet[];
  onSelect: (setId: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Các bộ flashcard"
      className="flex gap-2 overflow-x-auto border-b border-[var(--theme-border)]"
    >
      {sets.map((set) => {
        const isActive = set.id === activeSetId;
        return (
          <button
            key={set.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`flashcard-set-panel-${set.id}`}
            onClick={() => onSelect(set.id)}
            className={cn(
              "relative inline-flex min-h-12 shrink-0 items-center gap-2 whitespace-nowrap rounded-t-xl border border-b-0 px-4 text-sm font-extrabold transition",
              isActive
                ? "border-[var(--theme-primary)] bg-[var(--theme-bg)] text-[var(--theme-primary)]"
                : "border-transparent text-[var(--theme-text-muted)] hover:bg-[var(--theme-surface-soft)] hover:text-[var(--theme-text-strong)]",
            )}
          >
            {set.title}
            <span
              className={cn(
                "min-w-6 rounded-full px-2 py-0.5 text-center text-xs font-extrabold",
                isActive
                  ? "bg-[var(--theme-primary)] text-white"
                  : "bg-[var(--theme-primary-subtle)] text-[var(--theme-primary)]",
              )}
            >
              {set.cardCount}
            </span>
            {isActive ? (
              <span className="absolute inset-x-0 -bottom-px h-0.5 bg-[var(--theme-primary)]" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
