"use client";

import { ImagePlus, ImageUp, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import type { AdminFlashcard } from "@/features/admin/flashcards/api/admin-flashcards-api";

const FigureDialog = dynamic(
  () =>
    import("@/features/admin/flashcards/screens/admin-flashcards-tab/components/flashcard-figure-ai-dialog").then(
      (module) => module.FlashcardFigureAiDialog,
    ),
  { ssr: false },
);

export function FlashcardFigureAiMenu({
  card,
  cardIndex,
  isUploadingSolutionFigure,
  onUploadSolutionFigure,
}: {
  card: AdminFlashcard;
  cardIndex: number;
  isUploadingSolutionFigure: boolean;
  onUploadSolutionFigure: (file: File) => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const anchorRef = useRef<HTMLButtonElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition({
        left: Math.max(12, Math.min(rect.right - 248, window.innerWidth - 260)),
        top: rect.bottom + 8,
      });
    };
    const closeOnPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!anchorRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    document.addEventListener("pointerdown", closeOnPointerDown);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      document.removeEventListener("pointerdown", closeOnPointerDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Tạo ảnh cho flashcard ${cardIndex + 1}`}
        onClick={() => setOpen((value) => !value)}
        className="theme-button-primary-subtle grid h-10 w-10 place-items-center rounded-lg"
      >
        <ImagePlus className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-label="Chọn loại ảnh Flashcard cần tạo"
              className="fixed z-[100] w-[248px] overflow-hidden rounded-xl border border-[var(--theme-border)] bg-white p-1.5 shadow-xl dark:bg-slate-950"
              style={position}
            >
              <div className="flex items-center justify-between px-2 py-1.5 text-xs font-extrabold text-[var(--theme-text-muted)]">
                Ảnh lời giải
                <button
                  type="button"
                  aria-label="Đóng menu tạo ảnh"
                  onClick={() => setOpen(false)}
                  className="grid size-7 place-items-center rounded-md hover:bg-[var(--theme-surface-soft)]"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  setIsDialogOpen(true);
                }}
                className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-bold text-[var(--theme-text-strong)] hover:bg-[var(--theme-primary-soft)] hover:text-[var(--theme-primary)]"
              >
                <ImagePlus className="size-4" aria-hidden="true" />
                Tạo ảnh cho lời giải
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={isUploadingSolutionFigure}
                onClick={() => {
                  setOpen(false);
                  uploadInputRef.current?.click();
                }}
                className="flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-lg px-3 text-left text-sm font-bold text-[var(--theme-text-strong)] hover:bg-[var(--theme-primary-soft)] hover:text-[var(--theme-primary)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isUploadingSolutionFigure ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ImageUp className="size-4" aria-hidden="true" />
                )}
                <span className="whitespace-nowrap">Tải ảnh lời giải</span>
              </button>
            </div>,
            document.body,
          )
        : null}
      <input
        ref={uploadInputRef}
        accept="image/jpeg,image/png,image/webp"
        aria-label={`Tải ảnh lời giải cho flashcard ${cardIndex + 1}`}
        className="sr-only"
        type="file"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) onUploadSolutionFigure(file);
        }}
      />
      {isDialogOpen ? (
        <FigureDialog card={card} onClose={() => setIsDialogOpen(false)} />
      ) : null}
    </>
  );
}
