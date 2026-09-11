"use client";

import type { KeyboardEvent } from "react";
import type { AdminFlashcardSet } from "@/features/admin/flashcards/api/admin-flashcards-api";
import type { FlashcardSetCounts } from "@/features/admin/flashcards/screens/admin-flashcards-tab/components/flashcard-set-panel";
import { useRevealActiveHorizontalItem } from "@/lib/use-reveal-active-horizontal-item";
import { cn } from "@/lib/utils";

export function FlashcardSetTabs({
  activeSetId,
  countsBySetId,
  sets,
  onSelect,
}: {
  activeSetId: string;
  countsBySetId: Record<string, FlashcardSetCounts | undefined>;
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
        const loadedCounts = countsBySetId[set.id];
        const totalCardCount = loadedCounts?.total ?? set.cardCount;
        const isPublished = set.reviewStatus === "APPROVED";
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
              "relative inline-flex min-h-16 shrink-0 flex-col items-center justify-center gap-1 whitespace-nowrap rounded-t-xl border border-b-0 px-4 text-center text-sm font-extrabold transition",
              isActive
                ? "border-[var(--theme-primary)] bg-[var(--theme-bg)] text-[var(--theme-primary)]"
                : "border-transparent text-[var(--theme-text-muted)] hover:bg-[var(--theme-surface-soft)] hover:text-[var(--theme-text-strong)]",
            )}
          >
            <span>{set.title}</span>
            <span
              className={cn(
                "rounded-full px-2 py-1 text-[10px] font-black leading-none",
                isPublished
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-[var(--theme-surface-soft)] text-[var(--theme-text-muted)]",
              )}
            >
              {isPublished
                ? `Đã phát hành - ${totalCardCount} flashcard`
                : "Chưa phát hành"}
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
