"use client";

import { Plus, RefreshCw, Trash2 } from "lucide-react";
import type { AdminCourseStats } from "@/features/admin/courses/admin-courses-utils";

type AdminCoursesHeaderProps = {
  stats: AdminCourseStats;
  isDarkTheme: boolean;
  onCreatePath: () => void;
  onOpenArchiveDialog: () => void;
  onRetryLoad: () => void;
};

export function AdminCoursesHeader({
  stats,
  onCreatePath,
  onOpenArchiveDialog,
  onRetryLoad,
}: AdminCoursesHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-[var(--theme-border)] pb-5 md:flex-row md:items-center md:justify-between">
      <div className="order-2 md:order-1">
        <h1 className="mt-1 text-2xl font-extrabold text-[var(--theme-text-strong)] md:text-3xl">
          Danh sách khóa học
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--theme-text)]">
          Theo dõi khóa học theo môn, lớp, giá và trạng thái hiển thị.
        </p>
      </div>
      <div className="order-1 grid grid-cols-[0.8fr_1fr_1.15fr] gap-2 md:order-2 md:flex md:flex-wrap">
        <button
          type="button"
          onClick={onRetryLoad}
          className="theme-button-neutral inline-flex min-h-10 items-center justify-center gap-1 rounded-lg px-1.5 text-center text-[0.72rem] font-bold leading-tight transition sm:text-sm md:min-h-11 md:gap-2 md:px-3"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Tải lại
        </button>
        <button
          type="button"
          onClick={onOpenArchiveDialog}
          className="theme-button-danger-subtle inline-flex min-h-10 items-center justify-center gap-1 rounded-lg px-1.5 text-center text-[0.72rem] font-bold leading-tight transition sm:text-sm md:min-h-11 md:gap-2 md:px-3"
          aria-label="Mở khóa học lưu trữ"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          <span>Thùng rác</span>
          {stats.archived > 0 ? (
            <span className="grid min-w-5 place-items-center rounded-full bg-[var(--theme-danger)] px-1.5 py-0.5 text-xs font-extrabold text-[var(--theme-danger-foreground)]">
              {stats.archived}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={onCreatePath}
          className="theme-button-primary inline-flex min-h-10 items-center justify-center gap-1 rounded-lg px-1.5 text-center text-[0.72rem] font-extrabold leading-tight transition disabled:cursor-not-allowed sm:text-sm md:min-h-11 md:gap-2 md:px-4"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Thêm khóa học
        </button>
      </div>
    </header>
  );
}
