"use client";

import { LearningPathRow } from "@/features/admin-courses/components/learning-path-row";
import { SelectedPathsToolbar } from "@/features/admin-courses/components/selected-paths-toolbar";
import { SortHeaderButton } from "@/features/admin-courses/components/sort-header-button";
import type { AdminLearningPath } from "@/features/admin-courses/data";
import type { LearningPathSortKey, SortDirection } from "@/features/admin-courses/types";
import { cn } from "@/lib/utils";

type LearningPathsTableProps = {
  allFilteredPathsSelected: boolean;
  isDarkTheme: boolean;
  paths: AdminLearningPath[];
  selectedPathIds: string[];
  sortDirection: SortDirection;
  sortKey: LearningPathSortKey;
  onArchivePath: (pathId: string) => void;
  onClearSelected: () => void;
  onEditPath: (pathId: string) => void;
  onRequestDeleteSelected: () => void;
  onSelectPath: (pathId: string) => void;
  onToggleSelectAll: () => void;
  onToggleSort: (sortKey: LearningPathSortKey) => void;
};

export function LearningPathsTable({
  allFilteredPathsSelected,
  isDarkTheme,
  paths,
  selectedPathIds,
  sortDirection,
  sortKey,
  onArchivePath,
  onClearSelected,
  onEditPath,
  onRequestDeleteSelected,
  onSelectPath,
  onToggleSelectAll,
  onToggleSort,
}: LearningPathsTableProps) {
  return (
    <>
      <SelectedPathsToolbar
        selectedCount={selectedPathIds.length}
        isDarkTheme={isDarkTheme}
        onClearSelected={onClearSelected}
        onRequestDeleteSelected={onRequestDeleteSelected}
      />
      <div
        className={cn(
          "overflow-hidden rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)]",
          selectedPathIds.length > 0 ? "mt-3" : "mt-4",
        )}
      >
        <div className="hidden grid-cols-[2.75rem_1.2fr_0.42fr_0.42fr_0.75fr_0.55fr_7rem] items-center gap-3 border-b border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-4 py-3 text-xs font-extrabold uppercase text-[var(--theme-text-muted)] lg:grid">
          <label className="flex h-6 w-6 items-center justify-center rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-primary)] transition hover:border-[var(--theme-primary-border)]">
            <input
              type="checkbox"
              checked={allFilteredPathsSelected}
              onChange={onToggleSelectAll}
              aria-label="Chọn tất cả lộ trình đang hiển thị"
              aria-checked={
                selectedPathIds.length > 0 && !allFilteredPathsSelected
                  ? "mixed"
                  : allFilteredPathsSelected
              }
              className="admin-theme-checkbox"
            />
          </label>
          <SortHeaderButton
            label="Lộ trình"
            isActive={sortKey === "title"}
            direction={sortDirection}
            isDarkTheme={isDarkTheme}
            onClick={() => onToggleSort("title")}
          />
          <SortHeaderButton
            label="Môn"
            isActive={sortKey === "subject"}
            direction={sortDirection}
            isDarkTheme={isDarkTheme}
            onClick={() => onToggleSort("subject")}
          />
          <SortHeaderButton
            label="Lớp"
            isActive={sortKey === "grade"}
            direction={sortDirection}
            isDarkTheme={isDarkTheme}
            onClick={() => onToggleSort("grade")}
          />
          <SortHeaderButton
            label="Giá"
            isActive={sortKey === "price"}
            direction={sortDirection}
            isDarkTheme={isDarkTheme}
            onClick={() => onToggleSort("price")}
          />
          <SortHeaderButton
            label="Trạng thái"
            isActive={sortKey === "status"}
            direction={sortDirection}
            isDarkTheme={isDarkTheme}
            onClick={() => onToggleSort("status")}
          />
          <span className="text-right">Thao tác</span>
        </div>

        <div>
          {paths.map((path) => (
            <LearningPathRow
              key={path.id}
              path={path}
              isDarkTheme={isDarkTheme}
              isSelected={selectedPathIds.includes(path.id)}
              onEdit={() => onEditPath(path.id)}
              onArchive={() => onArchivePath(path.id)}
              onSelect={() => onSelectPath(path.id)}
            />
          ))}
        </div>
      </div>
    </>
  );
}
