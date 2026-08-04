"use client";

import { EmptyState } from "@/components/admin/courses/empty-state";
import { LoadingState } from "@/components/admin/courses/loading-state";
import { AdminDataErrorState } from "@/components/admin/admin-data-error-state";
import { FilterBar } from "@/features/admin/courses/screens/admin-courses-manager/components/filter-bar";
import { LearningPathsTable } from "@/features/admin/courses/screens/admin-courses-manager/components/learning-paths-table";
import type {
  AdminLearningPath,
  AdminPublishStatus,
} from "@/features/admin/courses/admin-courses-data";
import type { AdminCatalogOptions } from "@/features/admin/domains/api/admin-domains-api";
import type {
  LearningPathSortKey,
  SortDirection,
  ViewState,
} from "@/features/admin/courses/admin-courses-types";

type AdminCoursesContentProps = {
  allFilteredPathsSelected: boolean;
  catalogOptions: AdminCatalogOptions;
  domainFilter: string | "ALL";
  filteredPaths: AdminLearningPath[];
  isDarkTheme: boolean;
  query: string;
  selectedPathIds: string[];
  sortDirection: SortDirection;
  sortKey: LearningPathSortKey;
  statusFilter: AdminPublishStatus | "ALL";
  targetAudienceFilter: string | "ALL";
  viewState: ViewState;
  onArchivePath: (pathId: string) => void;
  onClearSelected: () => void;
  onCreatePath: () => void;
  onEditPath: (pathId: string) => void;
  onPrefetchPath: (pathId: string) => void;
  onDomainChange: (value: string | "ALL") => void;
  onQueryChange: (value: string) => void;
  onRequestDeleteSelected: () => void;
  onRetryLoad: () => void;
  onSelectPath: (pathId: string) => void;
  onStatusChange: (value: AdminPublishStatus | "ALL") => void;
  onTargetAudienceChange: (value: string | "ALL") => void;
  onToggleSelectAll: () => void;
  onToggleSort: (sortKey: LearningPathSortKey) => void;
};

export function AdminCoursesContent({
  allFilteredPathsSelected,
  catalogOptions,
  domainFilter,
  filteredPaths,
  isDarkTheme,
  query,
  selectedPathIds,
  sortDirection,
  sortKey,
  statusFilter,
  targetAudienceFilter,
  viewState,
  onArchivePath,
  onClearSelected,
  onCreatePath,
  onEditPath,
  onPrefetchPath,
  onDomainChange,
  onQueryChange,
  onRequestDeleteSelected,
  onRetryLoad,
  onSelectPath,
  onStatusChange,
  onTargetAudienceChange,
  onToggleSelectAll,
  onToggleSort,
}: AdminCoursesContentProps) {
  const isInitialPending = viewState === "loading";

  return (
    <section className="mt-5">
      {isInitialPending ? (
        <LoadingState title="Đang tải danh sách khóa học" variant="list" />
      ) : null}
      {viewState === "error" ? (
        <AdminDataErrorState
          description="Vui lòng thử lại để tiếp tục quản lý khóa học và buổi học."
          onRetry={onRetryLoad}
          title="Không tải được danh sách khóa học"
          variant="section"
        />
      ) : null}
      {viewState === "ready" ? (
        <div className="min-w-0">
          <FilterBar
            isDarkTheme={isDarkTheme}
            domains={catalogOptions.domains}
            domainFilter={domainFilter}
            query={query}
            statusFilter={statusFilter}
            targetAudiences={catalogOptions.targetAudiences}
            targetAudienceFilter={targetAudienceFilter}
            onDomainChange={onDomainChange}
            onQueryChange={onQueryChange}
            onStatusChange={onStatusChange}
            onTargetAudienceChange={onTargetAudienceChange}
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
              onPrefetchPath={onPrefetchPath}
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
