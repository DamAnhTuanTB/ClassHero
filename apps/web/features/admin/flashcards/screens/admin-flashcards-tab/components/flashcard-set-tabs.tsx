"use client";

import type { KeyboardEvent } from "react";
import type { AdminFlashcardSet } from "@/features/admin/flashcards/api/admin-flashcards-api";
import { useRevealActiveHorizontalItem } from "@/lib/use-reveal-active-horizontal-item";
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
  const {
    focusItem: focusSetTab,
    scrollerRef,
    setItemRef,
  } = useRevealActiveHorizontalItem(activeSetId);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % sets.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + sets.length) % sets.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = sets.length - 1;
    }

    if (nextIndex === null) {
      return;
    }
    const nextSet = sets[nextIndex];
    if (!nextSet) {
      return;
    }

    event.preventDefault();
    onSelect(nextSet.id);
    focusSetTab(nextSet.id);
  }

  return (
    <div
      ref={scrollerRef}
      role="tablist"
      aria-label="Các bộ flashcard"
      className="flex gap-2 overflow-x-auto overflow-y-hidden border-b border-[var(--theme-border)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {sets.map((set, setIndex) => {
        const isActive = set.id === activeSetId;
        return (
          <button
            key={set.id}
            ref={(element) => setItemRef(set.id, element)}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`flashcard-set-panel-${set.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSelect(set.id)}
            onKeyDown={(event) => handleKeyDown(event, setIndex)}
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
                  ? "bg-[var(--theme-primary)] text-white dark:text-[var(--theme-primary-foreground)]"
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
