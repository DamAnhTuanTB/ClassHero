"use client";

import { Layers, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import type { Ref } from "react";
import type {
  AdminFlashcard,
  AdminFlashcardSet,
} from "@/features/admin/flashcards/api/admin-flashcards-api";
import { useAdminFlashcards } from "@/features/admin/flashcards/hooks/use-admin-flashcards";
import { FlashcardCardRow } from "@/features/admin/flashcards/screens/admin-flashcards-tab/components/flashcard-card-row";

const difficultyLabels = {
  EASY: "Dễ",
  MEDIUM: "Trung bình",
  HARD: "Khó",
  MIXED: "Hỗn hợp",
} as const;

export function FlashcardSetPanel({
  minHeight,
  panelRef,
  set,
  onAddCard,
  onDeleteCard,
  onDeleteSet,
  onEditCard,
  onEditSet,
}: {
  minHeight: number;
  panelRef: Ref<HTMLElement>;
  set: AdminFlashcardSet;
  onAddCard: () => void;
  onDeleteCard: (card: AdminFlashcard) => void;
  onDeleteSet: () => void;
  onEditCard: (card: AdminFlashcard) => void;
  onEditSet: () => void;
}) {
  const { data: cards, isError, isLoading, refetch } = useAdminFlashcards(set.id);

  return (
    <section
      ref={panelRef}
      id={`flashcard-set-panel-${set.id}`}
      role="tabpanel"
      className="overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] shadow-sm"
      style={{ minHeight: minHeight || undefined }}
    >
      <div className="flex flex-col gap-4 border-b border-[var(--theme-border)] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
              {set.title}
            </h4>
            <span className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-2.5 py-1 text-xs font-extrabold text-[var(--theme-text-muted)]">
              {difficultyLabels[set.difficulty]}
            </span>
          </div>
          <p className="mt-1 text-sm font-medium text-[var(--theme-text-muted)]">
            {cards?.length ?? set.cardCount} flashcard
          </p>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_2.5rem_2.5rem] gap-2 sm:flex">
          <button
            type="button"
            onClick={onAddCard}
            className="theme-button-primary inline-flex min-h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-extrabold sm:flex-none sm:px-4"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Thêm flashcard
          </button>
          <button
            type="button"
            onClick={onEditSet}
            className="theme-button-primary-subtle grid h-10 w-10 place-items-center rounded-lg"
            aria-label={`Sửa ${set.title}`}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onDeleteSet}
            className="theme-button-danger-subtle grid h-10 w-10 place-items-center rounded-lg"
            aria-label={`Xóa ${set.title}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-32 items-center justify-center p-8">
          <Loader2
            className="h-6 w-6 animate-spin text-[var(--theme-primary)]"
            aria-label="Đang tải"
          />
        </div>
      ) : isError ? (
        <div className="p-6 text-center">
          <p className="text-sm font-semibold text-[var(--theme-error-text)]">
            Không tải được flashcard của bộ này.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="theme-button-neutral mt-3 min-h-10 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold"
          >
            Thử lại
          </button>
        </div>
      ) : !cards?.length ? (
        <div className="m-5 flex flex-col items-center rounded-xl border-2 border-dashed border-[var(--theme-border)] px-4 py-10 text-center">
          <Layers className="h-9 w-9 text-[var(--theme-text-muted)]" aria-hidden="true" />
          <p className="mt-3 text-sm font-extrabold text-[var(--theme-text-strong)]">
            Bộ này chưa có flashcard
          </p>
          <p className="mt-1 text-sm text-[var(--theme-text-muted)]">
            Thêm thẻ đầu tiên với mặt trước, mặt sau và lời giải chi tiết.
          </p>
          <button
            type="button"
            onClick={onAddCard}
            className="theme-button-primary-subtle mt-4 inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Thêm flashcard
          </button>
        </div>
      ) : (
        <div className="divide-y divide-[var(--theme-border)]">
          {cards.map((card, index) => (
            <FlashcardCardRow
              key={card.id}
              card={card}
              index={index}
              onDelete={onDeleteCard}
              onEdit={onEditCard}
            />
          ))}
        </div>
      )}
    </section>
  );
}
