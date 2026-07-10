"use client";

import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type SelectedPathsToolbarProps = {
  selectedCount: number;
  isDarkTheme: boolean;
  onClearSelected: () => void;
  onRequestDeleteSelected: () => void;
};

export function SelectedPathsToolbar({
  selectedCount,
  isDarkTheme,
  onClearSelected,
  onRequestDeleteSelected,
}: SelectedPathsToolbarProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "mt-4 flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        isDarkTheme ? "border-sky-500/20 bg-sky-500/10" : "border-sky-100 bg-sky-50",
      )}
    >
      <p
        className={cn(
          "text-sm font-extrabold",
          isDarkTheme ? "text-sky-200" : "text-sky-800",
        )}
      >
        Đã chọn {selectedCount} lộ trình
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onClearSelected}
          className={cn(
            "inline-flex min-h-10 items-center justify-center rounded-lg border px-3 text-sm font-bold transition",
            isDarkTheme
              ? "border-slate-700 bg-slate-900 text-sky-200 hover:bg-slate-800"
              : "border-sky-200 bg-white text-sky-700 hover:bg-sky-50",
          )}
        >
          Bỏ chọn
        </button>
        <button
          type="button"
          onClick={onRequestDeleteSelected}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 text-sm font-bold text-rose-600 transition hover:bg-rose-100"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Xóa vào thùng rác
        </button>
      </div>
    </div>
  );
}
