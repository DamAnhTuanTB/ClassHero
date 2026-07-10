"use client";

import { BookOpen, FileText, Layers3 } from "lucide-react";
import { AdminCoursesContent } from "@/features/admin-courses/components/admin-courses-content";
import { AdminCoursesHeader } from "@/features/admin-courses/components/admin-courses-header";
import {
  AdminCoursesSidebar,
  type AdminCoursesSidebarItem,
} from "@/features/admin-courses/components/admin-courses-sidebar";
import { AdminCoursesStatsRow } from "@/features/admin-courses/components/admin-courses-stats-row";
import { ArchivedPathsDialog } from "@/features/admin-courses/components/archived-paths-dialog";
import { DeleteConfirmDialog } from "@/features/admin-courses/components/delete-confirm-dialog";
import { PathEditorDialog } from "@/features/admin-courses/components/path-editor-dialog";
import { useAdminCoursesManager } from "@/features/admin-courses/hooks";
import { cn } from "@/lib/utils";

const adminNavItems: AdminCoursesSidebarItem[] = [
  { label: "Lộ trình", icon: Layers3, active: true },
  { label: "Buổi học", icon: BookOpen, active: false },
  { label: "Tài liệu", icon: FileText, active: false },
];

export function AdminCoursesManager() {
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
    isPathEditorOpen,
    isSidebarCollapsed,
    isSavingPath,
    pathEditorMode,
    pathForm,
    permanentDeletingPaths,
    query,
    selectedPathIds,
    sortDirection,
    sortKey,
    stats,
    statusFilter,
    subjectFilter,
    viewState,
  } = useAdminCoursesManager();
  const deleteTargetLabel =
    deletingPaths.length === 1
      ? (deletingPaths[0]?.title ?? "lộ trình này")
      : `${deletingPaths.length} lộ trình đã chọn`;

  return (
    <main
      className={cn(
        "min-h-screen [--form-primary:#0284c7] [--form-secondary:#0f766e]",
        isDarkTheme ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-950",
      )}
    >
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
      <PathEditorDialog
        mode={pathEditorMode}
        form={pathForm}
        isOpen={isPathEditorOpen}
        isSaving={isSavingPath}
        selectedPath={editingPath}
        onSubmit={actions.savePath}
        onArchive={() => {
          if (editingPath) {
            actions.requestDeletePath(editingPath.id);
          }
        }}
        onClose={actions.closePathEditor}
      />
      <DeleteConfirmDialog
        title="Xóa lộ trình"
        confirmLabel={deletingPaths.length > 1 ? "Xóa các lộ trình" : "Xóa lộ trình"}
        description={`Bạn có thực sự muốn xóa ${deleteTargetLabel} không? Lộ trình sẽ được chuyển vào thùng rác.`}
        isOpen={deletingPaths.length > 0}
        itemName={deleteTargetLabel}
        onCancel={actions.closeDeleteConfirm}
        onConfirm={actions.confirmDeletePath}
      />
      <ArchivedPathsDialog
        isOpen={isArchiveDialogOpen}
        paths={archivedPaths}
        onClose={actions.closeArchiveDialog}
        onPermanentDelete={actions.requestPermanentDeletePaths}
        onRestore={actions.restorePaths}
      />
      <DeleteConfirmDialog
        title="Xóa vĩnh viễn"
        confirmLabel="Xóa vĩnh viễn"
        description={`Bạn có thực sự muốn xóa vĩnh viễn ${
          permanentDeletingPaths.length === 1
            ? permanentDeletingPaths[0]?.title
            : `${permanentDeletingPaths.length} lộ trình đã chọn`
        } không? Hành động này không thể khôi phục.`}
        isOpen={permanentDeletingPaths.length > 0}
        itemName={
          permanentDeletingPaths.length === 1
            ? (permanentDeletingPaths[0]?.title ?? "lộ trình này")
            : `${permanentDeletingPaths.length} lộ trình đã chọn`
        }
        onCancel={actions.closePermanentDeleteConfirm}
        onConfirm={actions.confirmPermanentDeletePaths}
      />
    </main>
  );
}
