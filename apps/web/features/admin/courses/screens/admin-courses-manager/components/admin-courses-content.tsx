"use client";

import { EmptyState } from "@/components/admin/courses/empty-state";
import { ErrorState } from "@/components/admin/courses/error-state";
import { LoadingState } from "@/components/admin/courses/loading-state";
import { FilterBar } from "@/features/admin/courses/screens/admin-courses-manager/components/filter-bar";
import { LearningPathsTable } from "@/features/admin/courses/screens/admin-courses-manager/components/learning-paths-table";
import type {
  AdminLearningPath,
  AdminPublishStatus,
  AdminSubject,
} from "@/features/admin/courses/admin-courses-data";
import type {
  LearningPathSortKey,
  SortDirection,
  ViewState,
} from "@/features/admin/courses/admin-courses-types";

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
      {viewState === "loading" ? (
        <LoadingState
          title="Đang tải danh sách khóa học"
          description="ClassHero đang lấy dữ liệu khóa học mới nhất."
        />
      ) : null}
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
