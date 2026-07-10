"use client";

import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/features/admin-courses/components/states";
import { FilterBar } from "@/features/admin-courses/components/filter-bar";
import { LearningPathsTable } from "@/features/admin-courses/components/learning-paths-table";
import type {
  AdminLearningPath,
  AdminPublishStatus,
  AdminSubject,
} from "@/features/admin-courses/data";
import type {
  LearningPathSortKey,
  SortDirection,
  ViewState,
} from "@/features/admin-courses/types";

type AdminCoursesContentProps = {
  allFilteredPathsSelected: boolean;
  filteredPaths: AdminLearningPath[];
  gradeFilter: number | "ALL";
  isDarkTheme: boolean;
  query: string;
  selectedPathIds: string[];
  sortDirection: SortDirection;
  sortKey: LearningPathSortKey;
  statusFilter: AdminPublishStatus | "ALL";
  subjectFilter: AdminSubject | "ALL";
  viewState: ViewState;
  onArchivePath: (pathId: string) => void;
  onClearSelected: () => void;
  onCreatePath: () => void;
  onEditPath: (pathId: string) => void;
  onGradeChange: (value: number | "ALL") => void;
  onQueryChange: (value: string) => void;
  onRequestDeleteSelected: () => void;
  onRetryLoad: () => void;
  onSelectPath: (pathId: string) => void;
  onStatusChange: (value: AdminPublishStatus | "ALL") => void;
  onSubjectChange: (value: AdminSubject | "ALL") => void;
  onToggleSelectAll: () => void;
  onToggleSort: (sortKey: LearningPathSortKey) => void;
};

export function AdminCoursesContent({
  allFilteredPathsSelected,
  filteredPaths,
  gradeFilter,
  isDarkTheme,
  query,
  selectedPathIds,
  sortDirection,
  sortKey,
  statusFilter,
  subjectFilter,
  viewState,
  onArchivePath,
  onClearSelected,
  onCreatePath,
  onEditPath,
  onGradeChange,
  onQueryChange,
  onRequestDeleteSelected,
  onRetryLoad,
  onSelectPath,
  onStatusChange,
  onSubjectChange,
  onToggleSelectAll,
  onToggleSort,
}: AdminCoursesContentProps) {
  return (
    <section className="mt-5">
      {viewState === "loading" ? <LoadingState /> : null}
      {viewState === "error" ? <ErrorState onRetry={onRetryLoad} /> : null}
      {viewState === "ready" ? (
        <div className="min-w-0">
          <FilterBar
            isDarkTheme={isDarkTheme}
            query={query}
            subjectFilter={subjectFilter}
            statusFilter={statusFilter}
            gradeFilter={gradeFilter}
            onQueryChange={onQueryChange}
            onSubjectChange={onSubjectChange}
            onStatusChange={onStatusChange}
            onGradeChange={onGradeChange}
          />

          {filteredPaths.length === 0 ? (
            <EmptyState onCreate={onCreatePath} />
          ) : (
            <LearningPathsTable
              allFilteredPathsSelected={allFilteredPathsSelected}
              isDarkTheme={isDarkTheme}
              paths={filteredPaths}
              selectedPathIds={selectedPathIds}
              sortDirection={sortDirection}
              sortKey={sortKey}
              onArchivePath={onArchivePath}
              onClearSelected={onClearSelected}
              onEditPath={onEditPath}
              onRequestDeleteSelected={onRequestDeleteSelected}
              onSelectPath={onSelectPath}
              onToggleSelectAll={onToggleSelectAll}
              onToggleSort={onToggleSort}
            />
          )}
        </div>
      ) : null}
    </section>
  );
}
