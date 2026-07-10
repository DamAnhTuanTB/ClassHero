"use client";

import { Plus, RefreshCw, Trash2 } from "lucide-react";
import type { AdminCourseStats } from "@/features/admin-courses/utils";
import { cn } from "@/lib/utils";

type AdminCoursesHeaderProps = {
  stats: AdminCourseStats;
  isDarkTheme: boolean;
  onCreatePath: () => void;
  onOpenArchiveDialog: () => void;
  onRetryLoad: () => void;
};

export function AdminCoursesHeader({
  stats,
  isDarkTheme,
  onCreatePath,
  onOpenArchiveDialog,
  onRetryLoad,
}: AdminCoursesHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 border-b pb-5 md:flex-row md:items-center md:justify-between",
        isDarkTheme ? "border-slate-800" : "border-slate-200",
      )}
    >
      <div>
        <h1
          className={cn(
            "mt-1 text-2xl font-extrabold md:text-3xl",
            isDarkTheme ? "text-white" : "text-slate-950",
          )}
        >
          Danh sách lộ trình
        </h1>
        <p
          className={cn(
            "mt-2 max-w-2xl text-sm leading-6",
            isDarkTheme ? "text-slate-400" : "text-slate-600",
          )}
        >
          Theo dõi lộ trình theo môn, lớp, giá và trạng thái hiển thị.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRetryLoad}
          className={cn(
            "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-bold transition",
            isDarkTheme
              ? "border-slate-700 bg-slate-900 text-slate-200 hover:border-sky-500/50 hover:text-sky-300"
              : "border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:text-sky-700",
          )}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Tải lại
        </button>
        <button
          type="button"
          onClick={onOpenArchiveDialog}
          className={cn(
            "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-bold transition",
            isDarkTheme
              ? "border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/15"
              : "border-rose-200 bg-white text-rose-600 hover:bg-rose-50",
          )}
          aria-label="Mở lộ trình lưu trữ"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Thùng rác</span>
          {stats.archived > 0 ? (
            <span className="grid min-w-5 place-items-center rounded-full bg-rose-600 px-1.5 py-0.5 text-xs font-extrabold text-white">
              {stats.archived}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={onCreatePath}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 text-sm font-extrabold text-white shadow-sm shadow-sky-900/15 transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Thêm lộ trình
        </button>
      </div>
    </header>
  );
}
