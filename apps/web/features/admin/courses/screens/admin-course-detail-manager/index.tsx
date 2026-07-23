"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, BookOpen, FileText, Layers3, Pencil, Trash2 } from "lucide-react";
import {
  AdminCoursesSidebar,
  type AdminCoursesSidebarItem,
} from "@/components/admin/courses/admin-courses-sidebar";
import { ChapterLessonPanel } from "@/features/admin/courses/screens/admin-course-detail-manager/components/chapter-lesson-panel";
import { LearningPathSummaryPanel } from "@/features/admin/courses/screens/admin-course-detail-manager/components/learning-path-summary-panel";
import { AdminCourseDocumentPanel } from "@/features/admin/courses/screens/admin-course-detail-manager/components/admin-course-document-panel";
import { ErrorState } from "@/components/admin/courses/error-state";
import { LoadingState } from "@/components/admin/courses/loading-state";
import { StatCard } from "@/components/admin/courses/stat-card";
import type { AdminLearningPath } from "@/features/admin/courses/admin-courses-data";
import { useAdminCourseDetailManager } from "@/features/admin/courses/hooks/use-admin-course-detail-manager";
import type { AppThemeMode } from "@/lib/theme-store";
import { cn } from "@/lib/utils";

const ChapterEditorDialog = dynamic(() =>
  import("@/features/admin/courses/screens/admin-course-detail-manager/components/chapter-editor-dialog").then(
    (module) => module.ChapterEditorDialog,
  ),
);
const DeleteConfirmDialog = dynamic(() =>
  import("@/components/admin/courses/delete-confirm-dialog").then(
    (module) => module.DeleteConfirmDialog,
  ),
);
const LessonEditorDialog = dynamic(() =>
  import("@/features/admin/courses/screens/admin-course-detail-manager/components/lesson-editor-dialog").then(
    (module) => module.LessonEditorDialog,
  ),
);
const PathEditorDialog = dynamic(() =>
  import("@/features/admin/courses/screens/admin-courses-manager/components/path-editor-dialog").then(
    (module) => module.PathEditorDialog,
  ),
);

const adminNavItems: AdminCoursesSidebarItem[] = [
  { label: "Khóa học", icon: Layers3, active: true },
  { label: "Buổi học", icon: BookOpen, active: false },
  { label: "Tài liệu", icon: FileText, active: false },
];

export function AdminCourseDetailManager({
  pathId,
  initialLearningPath,
  initialThemeMode = "light",
}: {
  pathId: string;
  initialLearningPath?: AdminLearningPath | null;
  initialThemeMode?: AppThemeMode;
}) {
  const {
    actions,
    chapterEditorMode,
    courseStats,
    deletingPath,
    deletingChapter,
    deletingLesson,
    isChapterEditorOpen,
    isDeletingPath,
    isDeletingChapter,
    isDeletingLesson,
    isDarkTheme,
    isLessonEditorOpen,
    isPathEditorOpen,
    isSavingChapter,
    isSavingLesson,
    isSavingPath,
    isSidebarCollapsed,
    lessonEditorMode,
    path,
    pathEditorMode,
    selectedChapter,
    selectedChapterId,
    selectedLesson,
    selectedLessonId,
    uploadCover,
    viewState,
  } = useAdminCourseDetailManager(pathId, initialLearningPath, initialThemeMode);

  return (
    <main data-admin-theme="true" className="theme-page">
      <div
        className={cn(
          "admin-course-shell-grid grid min-h-screen transition-[grid-template-columns] duration-200",
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
          <header className="flex flex-col gap-4 border-b border-[var(--theme-border)] pb-5 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <Link
                href="/admin/courses"
                className="theme-button-neutral inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-bold transition"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Danh sách khóa học
              </Link>
              <p className="mt-4 text-sm font-bold text-[var(--theme-primary)]">
                Chi tiết khóa học
              </p>
              <h1 className="mt-1 text-2xl font-extrabold text-[var(--theme-text-strong)] md:text-3xl">
                {path?.title ?? "Không tìm thấy khóa học"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--theme-text)]">
                Xem thông tin khóa học, quản lý chương học, buổi học và tài liệu dùng
                trong từng buổi.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={actions.startEditPath}
                disabled={viewState !== "ready" || !path}
                className="theme-button-primary-subtle inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edit
              </button>
              <button
                type="button"
                onClick={actions.requestDeletePath}
                disabled={viewState !== "ready" || !path || isDeletingPath}
                aria-label={path ? `Xóa khóa học ${path.title}` : "Xóa khóa học"}
                className="theme-button-danger-subtle inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Xóa
              </button>
            </div>
          </header>

          <section className="mt-5">
            {viewState === "loading" ? (
              <LoadingState
                title="Đang tải chi tiết khóa học"
                description="ClassHero đang lấy thông tin chương học và buổi học mới nhất."
              />
            ) : null}
            {viewState === "error" ? <ErrorState onRetry={actions.retryLoad} /> : null}
            {viewState === "ready" && path ? (
              <div className="grid gap-5">
                <section className="max-w-sm">
                  <StatCard
                    isDarkTheme={isDarkTheme}
                    label="Học sinh đang học"
                    value={courseStats.enrolledStudents}
                    tone="sky"
                  />
                </section>

                <LearningPathSummaryPanel path={path} isDarkTheme={isDarkTheme} />

                <AdminCourseDocumentPanel path={path} />

                <ChapterLessonPanel
                  isDarkTheme={isDarkTheme}
                  path={path}
                  selectedChapterId={selectedChapterId}
                  selectedLessonId={selectedLessonId}
                  onCreateChapter={actions.startCreateChapter}
                  onEditChapter={actions.startEditChapter}
                  onArchiveChapter={actions.requestDeleteChapter}
                  onCreateLesson={actions.startCreateLesson}
                  onEditLesson={actions.startEditLesson}
                  onArchiveLesson={actions.requestDeleteLesson}
                  onReorderChapter={actions.reorderChapters}
                  onReorderLesson={actions.reorderLessons}
                />
              </div>
            ) : null}
          </section>
        </section>
      </div>

      {isChapterEditorOpen ? (
        <ChapterEditorDialog
          mode={chapterEditorMode}
          defaultOrderIndex={(path?.chapters.length ?? 0) + 1}
          isOpen={isChapterEditorOpen}
          isSaving={isSavingChapter}
          selectedChapter={selectedChapter}
          disabled={!path}
          onSubmit={actions.saveChapter}
          onClose={actions.closeChapterEditor}
        />
      ) : null}
      {isLessonEditorOpen ? (
        <LessonEditorDialog
          mode={lessonEditorMode}
          defaultOrderIndex={(selectedChapter?.lessons.length ?? 0) + 1}
          isOpen={isLessonEditorOpen}
          isSaving={isSavingLesson}
          learningPath={path}
          selectedLesson={selectedLesson}
          disabled={!path}
          onSubmit={actions.saveLesson}
          onClose={actions.closeLessonEditor}
        />
      ) : null}
      {isPathEditorOpen ? (
        <PathEditorDialog
          mode={pathEditorMode}
          isOpen={isPathEditorOpen}
          isSaving={isSavingPath}
          selectedPath={path}
          onSubmit={actions.savePath}
          onUploadCover={uploadCover}
          onClose={actions.closePathEditor}
        />
      ) : null}
      {deletingPath ? (
        <DeleteConfirmDialog
          title="Xóa khóa học"
          confirmLabel="Xóa khóa học"
          description={`Bạn có thực sự muốn xóa ${deletingPath.title} không? Khóa học sẽ được chuyển vào thùng rác.`}
          isOpen={Boolean(deletingPath)}
          isConfirming={isDeletingPath}
          itemName={deletingPath.title}
          onCancel={actions.closeDeletePathConfirm}
          onConfirm={actions.confirmDeletePath}
        />
      ) : null}
      {deletingChapter ? (
        <DeleteConfirmDialog
          title="Xóa chương học"
          confirmLabel="Xóa chương"
          isOpen={Boolean(deletingChapter)}
          isConfirming={isDeletingChapter}
          itemName={deletingChapter.title}
          onCancel={actions.closeDeleteChapterConfirm}
          onConfirm={actions.confirmDeleteChapter}
        />
      ) : null}
      {deletingLesson ? (
        <DeleteConfirmDialog
          title="Xóa buổi học"
          confirmLabel="Xóa buổi học"
          isOpen={Boolean(deletingLesson)}
          isConfirming={isDeletingLesson}
          itemName={deletingLesson.title}
          onCancel={actions.closeDeleteLessonConfirm}
          onConfirm={actions.confirmDeleteLesson}
        />
      ) : null}
    </main>
  );
}
