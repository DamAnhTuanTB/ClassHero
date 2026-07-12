"use client";

import dynamic from "next/dynamic";
import { BookOpen, FileText, Layers3 } from "lucide-react";
import { AdminCoursesContent } from "@/features/admin-courses/components/admin-courses-content";
import { AdminCoursesHeader } from "@/features/admin-courses/components/admin-courses-header";
import {
  AdminCoursesSidebar,
  type AdminCoursesSidebarItem,
} from "@/features/admin-courses/components/admin-courses-sidebar";
import { AdminCoursesStatsRow } from "@/features/admin-courses/components/admin-courses-stats-row";
import type { AdminLearningPath } from "@/features/admin-courses/data";
import { useAdminCoursesManager } from "@/features/admin-courses/hooks";
import type { AppThemeMode } from "@/lib/theme-store";
import { cn } from "@/lib/utils";

const ArchivedPathsDialog = dynamic(() =>
  import("@/features/admin-courses/components/archived-paths-dialog").then(
    (module) => module.ArchivedPathsDialog,
  ),
);
const DeleteConfirmDialog = dynamic(() =>
  import("@/features/admin-courses/components/delete-confirm-dialog").then(
    (module) => module.DeleteConfirmDialog,
  ),
);
const PathEditorDialog = dynamic(() =>
  import("@/features/admin-courses/components/path-editor-dialog").then(
    (module) => module.PathEditorDialog,
  ),
);

const adminNavItems: AdminCoursesSidebarItem[] = [
  { label: "Lộ trình", icon: Layers3, active: true },
  { label: "Buổi học", icon: BookOpen, active: false },
  { label: "Tài liệu", icon: FileText, active: false },
];

export function AdminCoursesManager({
  initialLearningPaths,
  initialThemeMode = "light",
}: {
  initialLearningPaths?: AdminLearningPath[];
  initialThemeMode?: AppThemeMode;
}) {
  const {
    actions,
    allFilteredPathsSelected,
    archivedPaths,
    deletingPaths,
    editingPath,
    filteredPaths,
    gradeFilter,
    isArchiveDialogOpen,
    isDarkTheme,
    isDeletingPath,
    isPermanentDeletingPath,
    isPathEditorOpen,
    isRestoringPath,
    isSidebarCollapsed,
    isSavingPath,
    pathEditorMode,
    permanentDeletingPaths,
    query,
    selectedPathIds,
    sortDirection,
    sortKey,
    stats,
    statusFilter,
    subjectFilter,
    viewState,
    uploadCover,
  } = useAdminCoursesManager(initialLearningPaths, initialThemeMode);
  const deleteTargetLabel =
    deletingPaths.length === 1
      ? (deletingPaths[0]?.title ?? "lộ trình này")
      : `${deletingPaths.length} lộ trình đã chọn`;

  return (
    <main data-admin-theme="true" className="theme-page">
      <div
        className={cn(
          "grid min-h-screen transition-[grid-template-columns] duration-200",
          isSidebarCollapsed
            ? "lg:grid-cols-[5.5rem_minmax(0,1fr)]"
            : "lg:grid-cols-[17rem_minmax(0,1fr)]",
        )}
      >
        <AdminCoursesSidebar
          subtitle="Quản lý nội dung học"
          items={adminNavItems}
          isDarkTheme={isDarkTheme}
          isCollapsed={isSidebarCollapsed}
          showAdminProfileTools
          onToggleCollapsed={actions.toggleSidebarCollapsed}
          onToggleDarkTheme={actions.toggleDarkTheme}
        />

        <section className="min-w-0 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
          <AdminCoursesHeader
            stats={stats}
            isDarkTheme={isDarkTheme}
            onCreatePath={actions.startCreatePath}
            onOpenArchiveDialog={actions.openArchiveDialog}
            onRetryLoad={actions.retryLoad}
          />
          <AdminCoursesStatsRow isDarkTheme={isDarkTheme} stats={stats} />
          <AdminCoursesContent
            allFilteredPathsSelected={allFilteredPathsSelected}
            filteredPaths={filteredPaths}
            gradeFilter={gradeFilter}
            isDarkTheme={isDarkTheme}
            query={query}
            selectedPathIds={selectedPathIds}
            sortDirection={sortDirection}
            sortKey={sortKey}
            statusFilter={statusFilter}
            subjectFilter={subjectFilter}
            viewState={viewState}
            onArchivePath={actions.requestDeletePath}
            onClearSelected={actions.clearSelectedPaths}
            onCreatePath={actions.startCreatePath}
            onEditPath={actions.startEditPath}
            onGradeChange={actions.setGradeFilter}
            onQueryChange={actions.setQuery}
            onRequestDeleteSelected={actions.requestDeleteSelectedPaths}
            onRetryLoad={actions.retryLoad}
            onSelectPath={actions.toggleSelectPath}
            onStatusChange={actions.setStatusFilter}
            onSubjectChange={actions.setSubjectFilter}
            onToggleSelectAll={actions.toggleSelectAllPaths}
            onToggleSort={actions.toggleSort}
          />
        </section>
      </div>
      {isPathEditorOpen ? (
        <PathEditorDialog
          mode={pathEditorMode}
          isOpen={isPathEditorOpen}
          isSaving={isSavingPath}
          selectedPath={editingPath}
          onSubmit={actions.savePath}
          onUploadCover={uploadCover}
          onClose={actions.closePathEditor}
        />
      ) : null}
      {deletingPaths.length > 0 ? (
        <DeleteConfirmDialog
          title="Xóa lộ trình"
          confirmLabel={deletingPaths.length > 1 ? "Xóa các lộ trình" : "Xóa lộ trình"}
          description={`Bạn có thực sự muốn xóa ${deleteTargetLabel} không? Lộ trình sẽ được chuyển vào thùng rác.`}
          isOpen={deletingPaths.length > 0}
          isConfirming={isDeletingPath}
          itemName={deleteTargetLabel}
          onCancel={actions.closeDeleteConfirm}
          onConfirm={actions.confirmDeletePath}
        />
      ) : null}
      {isArchiveDialogOpen ? (
        <ArchivedPathsDialog
          isOpen={isArchiveDialogOpen}
          isRestoring={isRestoringPath}
          paths={archivedPaths}
          onClose={actions.closeArchiveDialog}
          onPermanentDelete={actions.requestPermanentDeletePaths}
          onRestore={actions.restorePaths}
        />
      ) : null}
      {permanentDeletingPaths.length > 0 ? (
        <DeleteConfirmDialog
          title="Xóa vĩnh viễn"
          confirmLabel="Xóa vĩnh viễn"
          description={`Bạn có thực sự muốn xóa vĩnh viễn ${
            permanentDeletingPaths.length === 1
              ? permanentDeletingPaths[0]?.title
              : `${permanentDeletingPaths.length} lộ trình đã chọn`
          } không? Hành động này không thể khôi phục.`}
          isOpen={permanentDeletingPaths.length > 0}
          isConfirming={isPermanentDeletingPath}
          itemName={
            permanentDeletingPaths.length === 1
              ? (permanentDeletingPaths[0]?.title ?? "lộ trình này")
              : `${permanentDeletingPaths.length} lộ trình đã chọn`
          }
          onCancel={actions.closePermanentDeleteConfirm}
          onConfirm={actions.confirmPermanentDeletePaths}
        />
      ) : null}
    </main>
  );
}
