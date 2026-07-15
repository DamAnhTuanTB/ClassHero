"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, BookOpen, FileText, Layers3, RefreshCw } from "lucide-react";
import {
  AdminCoursesSidebar,
  type AdminCoursesSidebarItem,
} from "@/features/admin-courses/components/admin-courses-sidebar";
import { ChapterLessonPanel } from "@/features/admin-courses/components/chapter-lesson-panel";
import { LearningPathSummaryPanel } from "@/features/admin-courses/components/learning-path-summary-panel";
import { ErrorState, LoadingState } from "@/features/admin-courses/components/states";
import { StatCard } from "@/features/admin-courses/components/stat-card";
import type { AdminLearningPath } from "@/features/admin-courses/data";
import { useAdminCourseDetailManager } from "@/features/admin-courses/hooks";
import type { AppThemeMode } from "@/lib/theme-store";
import { cn } from "@/lib/utils";

const ChapterEditorDialog = dynamic(() =>
  import("@/features/admin-courses/components/chapter-editor-dialog").then(
    (module) => module.ChapterEditorDialog,
  ),
);
const DeleteConfirmDialog = dynamic(() =>
  import("@/features/admin-courses/components/delete-confirm-dialog").then(
    (module) => module.DeleteConfirmDialog,
  ),
);
const LessonEditorDialog = dynamic(() =>
  import("@/features/admin-courses/components/lesson-editor-dialog").then(
    (module) => module.LessonEditorDialog,
  ),
);

const adminNavItems: AdminCoursesSidebarItem[] = [
  { label: "Lộ trình", icon: Layers3, active: true },
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
    deletingChapter,
    deletingLesson,
    isChapterEditorOpen,
    isDeletingChapter,
    isDeletingLesson,
    isDarkTheme,
    isLessonEditorOpen,
    isSavingChapter,
    isSavingLesson,
    isSidebarCollapsed,
    lessonEditorMode,
    path,
    selectedChapter,
    selectedChapterId,
    selectedLesson,
    selectedLessonId,
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
                Danh sách lộ trình
              </Link>
              <p className="mt-4 text-sm font-bold text-[var(--theme-primary)]">
                Chi tiết lộ trình
              </p>
              <h1 className="mt-1 text-2xl font-extrabold text-[var(--theme-text-strong)] md:text-3xl">
                {path?.title ?? "Không tìm thấy lộ trình"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--theme-text)]">
                Xem thông tin lộ trình, quản lý chương học tổng quan và các buổi học trong
                từng chương.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={actions.retryLoad}
                className="theme-button-neutral inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Tải lại
              </button>
            </div>
          </header>

          <section className="mt-5">
            {viewState === "loading" ? <LoadingState /> : null}
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
          selectedLesson={selectedLesson}
          disabled={!path}
          onSubmit={actions.saveLesson}
          onClose={actions.closeLessonEditor}
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
