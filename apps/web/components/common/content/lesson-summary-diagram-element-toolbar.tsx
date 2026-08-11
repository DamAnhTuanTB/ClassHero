"use client";

import { Check, Pencil, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function LessonSummaryDiagramElementToolbar({
  canDelete,
  canEdit,
  description,
  initialText,
  left,
  maxWidth,
  side,
  top,
  onDelete,
  onEdit,
}: {
  canDelete: boolean;
  canEdit: boolean;
  description: string;
  initialText?: string;
  left: number;
  maxWidth: number;
  side: "LEFT" | "RIGHT";
  top: number;
  onDelete?: () => void;
  onEdit?: (nextText: string) => boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [nextText, setNextText] = useState(initialText ?? "");

  useEffect(() => {
    setIsEditing(false);
    setNextText(initialText ?? "");
  }, [description, initialText]);

  useEffect(() => {
    if (!isEditing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isEditing]);

  const cancelEditing = () => {
    setNextText(initialText ?? "");
    setIsEditing(false);
  };
  const submitEditing = () => {
    if (!onEdit?.(nextText)) return;
    setIsEditing(false);
  };

  return (
    <div
      aria-label={`Công cụ cho ${description}`}
      className="absolute z-20 inline-flex min-h-12 items-center gap-1 rounded-lg border border-[var(--theme-border)] bg-white/95 p-1 shadow-lg backdrop-blur-sm dark:bg-slate-900/95"
      data-testid="diagram-element-toolbar"
      role="toolbar"
      style={{
        left,
        maxWidth,
        top,
        transform: side === "LEFT" ? "translateX(-100%)" : undefined,
      }}
      onClick={(event) => event.stopPropagation()}
    >
      {isEditing ? (
        <form
          className="flex min-w-0 items-center gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            submitEditing();
          }}
        >
          <label className="sr-only" htmlFor="diagram-element-text-input">
            Nội dung mới cho {description}
          </label>
          <input
            ref={inputRef}
            id="diagram-element-text-input"
            aria-label={`Nội dung mới cho ${description}`}
            className="h-10 min-w-0 w-32 rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)] px-2.5 text-sm font-semibold text-[var(--theme-text)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/25 sm:w-40"
            data-testid="diagram-edit-input"
            maxLength={description.startsWith("tên điểm") ? 8 : 160}
            value={nextText}
            onChange={(event) => setNextText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                cancelEditing();
              }
            }}
          />
          <button
            type="submit"
            aria-label={`Lưu ${description}`}
            className="theme-button-primary-subtle grid h-10 w-10 shrink-0 place-items-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
            data-testid="diagram-save-edit"
            title="Áp dụng trong bản nháp"
            onPointerDown={(event) => event.preventDefault()}
          >
            <Check className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Hủy sửa"
            className="theme-button-neutral grid h-10 w-10 shrink-0 place-items-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
            data-testid="diagram-cancel-edit"
            title="Hủy sửa"
            onPointerDown={(event) => event.preventDefault()}
            onClick={cancelEditing}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>
      ) : (
        <>
          {canEdit ? (
            <button
              type="button"
              aria-label={`Sửa ${description}`}
              className="theme-button-primary-subtle grid h-10 w-10 place-items-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
              data-testid="diagram-edit-target"
              title="Sửa nội dung"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              aria-label={`Xóa ${description}`}
              className="theme-button-danger-subtle grid h-10 w-10 place-items-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
              data-testid="diagram-delete-target"
              title="Xóa khỏi bản nháp"
              onPointerDown={(event) => event.preventDefault()}
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
