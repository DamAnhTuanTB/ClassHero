"use client";

import { Trash2 } from "lucide-react";

type SelectedPathsToolbarProps = {
  selectedCount: number;
  isDarkTheme: boolean;
  onClearSelected: () => void;
  onRequestDeleteSelected: () => void;
};

export function SelectedPathsToolbar({
  selectedCount,
  onClearSelected,
  onRequestDeleteSelected,
}: SelectedPathsToolbarProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-lg border border-[var(--theme-primary-border)] bg-[var(--theme-primary-soft)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-extrabold text-[var(--theme-primary)]">
        Đã chọn {selectedCount} lộ trình
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onClearSelected}
          className="theme-button-neutral inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-sm font-bold transition"
        >
          Bỏ chọn
        </button>
        <button
          type="button"
          onClick={onRequestDeleteSelected}
          className="theme-button-danger-subtle inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Xóa vào thùng rác
        </button>
      </div>
    </div>
  );
}
