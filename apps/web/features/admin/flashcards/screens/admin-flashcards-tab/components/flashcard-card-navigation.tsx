"use client";

import { CheckCircle2, Layers3, Sparkles } from "lucide-react";
import type { KeyboardEvent } from "react";
import type { AdminFlashcard } from "@/features/admin/flashcards/api/admin-flashcards-api";
import {
  flashcardDifficultyBadgeClassName,
  flashcardDifficultyLabels,
} from "@/features/admin/flashcards/screens/admin-flashcards-tab/utils/flashcard-presentation";
import { useRevealActiveHorizontalItem } from "@/lib/use-reveal-active-horizontal-item";
import { cn } from "@/lib/utils";

export function FlashcardCardNavigation({
  approvedCards,
  onSelect,
  pendingCards,
  selectedCardId,
}: {
  approvedCards: AdminFlashcard[];
  onSelect: (cardId: string) => void;
  pendingCards: AdminFlashcard[];
  selectedCardId: string;
}) {
  const cards = [...pendingCards, ...approvedCards];
  const { focusItem, scrollerRef, setItemRef } =
    useRevealActiveHorizontalItem(selectedCardId);

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % cards.length;
    if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + cards.length) % cards.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = cards.length - 1;
    if (nextIndex === null) return;
    const nextCard = cards[nextIndex];
    if (!nextCard) return;
    event.preventDefault();
    onSelect(nextCard.id);
    focusItem(nextCard.id);
  }

  return (
    <div ref={scrollerRef} className="grid min-w-0 gap-3">
      {pendingCards.length > 0 ? (
        <FlashcardNavigationGroup
          cards={pendingCards}
          globalCards={cards}
          icon={Sparkles}
          isPendingAi
          label="AI chờ duyệt"
          onKeyDown={handleKeyDown}
          onSelect={onSelect}
          selectedCardId={selectedCardId}
          setItemRef={setItemRef}
        />
      ) : null}
      <FlashcardNavigationGroup
        cards={approvedCards}
        globalCards={cards}
        icon={CheckCircle2}
        label="Đã duyệt"
        onKeyDown={handleKeyDown}
        onSelect={onSelect}
        selectedCardId={selectedCardId}
        setItemRef={setItemRef}
      />
    </div>
  );
}

function FlashcardNavigationGroup({
  cards,
  globalCards,
  icon: HeadingIcon,
  isPendingAi = false,
  label,
  onKeyDown,
  onSelect,
  selectedCardId,
  setItemRef,
}: {
  cards: AdminFlashcard[];
  globalCards: AdminFlashcard[];
  icon: typeof CheckCircle2;
  isPendingAi?: boolean;
  label: string;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, index: number) => void;
  onSelect: (cardId: string) => void;
  selectedCardId: string;
  setItemRef: (itemId: string, element: HTMLElement | null) => void;
}) {
  return (
    <section className="grid min-w-0 gap-2" aria-label={label}>
      <div
        className={cn(
          "flex w-fit items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-extrabold",
          isPendingAi
            ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/70 dark:bg-amber-950/35 dark:text-amber-200"
            : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/70 dark:bg-emerald-950/35 dark:text-emerald-200",
        )}
      >
        <HeadingIcon className="size-4" aria-hidden="true" />
        <span>{label}</span>
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-black leading-none tabular-nums",
            isPendingAi
              ? "bg-amber-200/70 text-amber-900 dark:bg-amber-800 dark:text-amber-100"
              : "bg-emerald-200/70 text-emerald-900 dark:bg-emerald-800 dark:text-emerald-100",
          )}
        >
          {cards.length}
        </span>
      </div>
      <div className="grid min-w-0 grid-cols-1 items-start gap-2 sm:grid-cols-[11.5rem_minmax(0,1fr)]">
        <div
          className={cn(
            "relative flex min-h-14 items-center gap-2 overflow-hidden rounded-xl border px-2.5 py-1.5 shadow-sm",
            isPendingAi
              ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/70 dark:bg-amber-950/35 dark:text-amber-200"
              : "border-[var(--theme-border)] bg-white text-[var(--theme-text-strong)] dark:bg-slate-950",
          )}
        >
          <span
            className={cn(
              "absolute inset-y-2 left-0 w-1 rounded-r-full",
              isPendingAi ? "bg-amber-400 dark:bg-amber-500" : "bg-sky-400 dark:bg-sky-500",
            )}
            aria-hidden="true"
          />
          <span
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-lg",
              isPendingAi
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/70 dark:text-amber-200"
                : "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
            )}
          >
            <Layers3 className="size-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1 text-xs font-extrabold leading-snug">
            Thẻ ghi nhớ
          </span>
          <span
            className={cn(
              "grid min-w-6 shrink-0 place-items-center rounded-full px-1.5 py-1 text-[10px] font-black leading-none tabular-nums",
              isPendingAi
                ? "bg-amber-200/70 text-amber-900 dark:bg-amber-800 dark:text-amber-100"
                : "bg-[var(--theme-surface-soft)] text-[var(--theme-text-muted)]",
            )}
          >
            {cards.length}
          </span>
        </div>
        <div
          role="tablist"
          aria-label={`${label}: chọn thẻ Flashcard`}
          className="flex min-h-14 min-w-0 flex-wrap items-center gap-1.5"
        >
          {cards.length === 0 ? (
            <span className="text-xs font-medium italic text-[var(--theme-text-muted)]">
              Chưa có thẻ
            </span>
          ) : (
            cards.map((card, index) => {
              const isSelected = card.id === selectedCardId;
              const globalIndex = globalCards.findIndex((item) => item.id === card.id);
              const isAiGenerated = Boolean(card.sourceMetadataJson?.aiGenerationId);
              return (
                <button
                  key={card.id}
                  ref={(element) => setItemRef(card.id, element)}
                  type="button"
                  role="tab"
                  aria-controls={`flashcard-card-${card.id}`}
                  aria-label={`Xem thẻ ${index + 1}, mức độ ${flashcardDifficultyLabels[card.difficulty]}${isAiGenerated ? ", do AI tạo" : ""}`}
                  aria-selected={isSelected}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => onSelect(card.id)}
                  onKeyDown={(event) => onKeyDown(event, globalIndex)}
                  className={cn(
                    "relative flex min-h-14 w-[5.25rem] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-1.5 font-extrabold transition",
                    isSelected
                      ? "border-[var(--theme-primary)] bg-[var(--theme-primary)] text-white shadow-sm dark:text-[var(--theme-primary-foreground)]"
                      : "border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text-muted)] hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)]",
                  )}
                >
                  {isAiGenerated ? (
                    <span
                      title="Thẻ do AI tạo"
                      className={cn(
                        "absolute right-1 top-1 grid size-[1.125rem] place-items-center rounded-full",
                        isSelected
                          ? "bg-white/20 text-white dark:text-[var(--theme-primary-foreground)]"
                          : "bg-sky-100 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300",
                      )}
                    >
                      <Sparkles className="size-2.5" aria-hidden="true" />
                    </span>
                  ) : null}
                  <span className="text-sm leading-none">{index + 1}</span>
                  <span
                    className={cn(
                      "whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10px] font-black leading-none tracking-wide",
                      flashcardDifficultyBadgeClassName(card.difficulty),
                    )}
                  >
                    {flashcardDifficultyLabels[card.difficulty]}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
