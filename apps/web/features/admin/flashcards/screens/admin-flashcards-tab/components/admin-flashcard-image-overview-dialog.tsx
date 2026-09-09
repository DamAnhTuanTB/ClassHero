"use client";

import { ImageIcon } from "lucide-react";
import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import type { FlashcardContentImage } from "@/features/admin/flashcards/screens/admin-flashcards-tab/utils/flashcard-presentation";

export function AdminFlashcardImageOverviewDialog({
  images,
  isOpen,
  onClose,
  onSelectCard,
}: {
  images: FlashcardContentImage[];
  isOpen: boolean;
  onClose: () => void;
  onSelectCard: (cardId: string) => void;
}) {
  return (
    <EditorDialogShell
      ariaLabel="Toàn bộ ảnh trong bộ Flashcard"
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="max-w-4xl"
    >
      <header className="theme-dialog-header flex min-h-16 shrink-0 items-center px-4 py-3 pr-16 sm:px-5">
        <h2 className="truncate text-lg font-extrabold text-[var(--theme-text-strong)]">
          Toàn bộ ảnh Flashcard
        </h2>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        {images.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((image, index) => (
              <button
                key={`${image.cardId}-${image.side}-${image.src}-${index}`}
                type="button"
                onClick={() => {
                  onSelectCard(image.cardId);
                  onClose();
                }}
                className="overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] text-left transition hover:border-[var(--theme-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)]"
              >
                <span className="grid aspect-[4/3] place-items-center bg-[var(--theme-surface-soft)] p-3">
                  <img
                    src={image.src}
                    alt={image.alt || `Ảnh ${image.side.toLowerCase()} của Flashcard ${image.cardNumber}`}
                    className="max-h-full max-w-full object-contain"
                  />
                </span>
                <span className="block px-3 py-2.5">
                  <strong className="block text-sm font-extrabold text-[var(--theme-text-strong)]">
                    Flashcard {image.cardNumber}
                  </strong>
                  <span className="mt-0.5 block text-xs font-semibold text-[var(--theme-text-muted)]">
                    {image.side}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="grid min-h-52 place-items-center text-center">
            <div>
              <span className="mx-auto grid size-11 place-items-center rounded-lg bg-[var(--theme-surface-soft)] text-[var(--theme-text-muted)]">
                <ImageIcon className="size-5" aria-hidden="true" />
              </span>
              <p className="mt-3 font-extrabold text-[var(--theme-text-strong)]">
                Chưa có ảnh trong bộ Flashcard
              </p>
            </div>
          </div>
        )}
      </div>
      <footer className="theme-dialog-footer flex shrink-0 justify-end p-3 sm:p-4">
        <button
          type="button"
          onClick={onClose}
          className="theme-button-primary min-h-11 whitespace-nowrap rounded-lg px-6 font-extrabold"
        >
          Đóng
        </button>
      </footer>
    </EditorDialogShell>
  );
}
