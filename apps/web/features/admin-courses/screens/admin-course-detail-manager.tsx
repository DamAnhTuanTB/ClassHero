"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, FileText, Layers3, Plus, RefreshCw } from "lucide-react";
import {
  AdminCoursesSidebar,
  type AdminCoursesSidebarItem,
} from "@/features/admin-courses/components/admin-courses-sidebar";
import { ChapterEditorDialog } from "@/features/admin-courses/components/chapter-editor-dialog";
import { ChapterLessonPanel } from "@/features/admin-courses/components/chapter-lesson-panel";
import { DeleteConfirmDialog } from "@/features/admin-courses/components/delete-confirm-dialog";
import { LearningPathSummaryPanel } from "@/features/admin-courses/components/learning-path-summary-panel";
import { LessonEditorDialog } from "@/features/admin-courses/components/lesson-editor-dialog";
import { ErrorState, LoadingState } from "@/features/admin-courses/components/states";
import { StatCard } from "@/features/admin-courses/components/stat-card";
import { useAdminCourseDetailManager } from "@/features/admin-courses/hooks";

const adminNavItems: AdminCoursesSidebarItem[] = [
  { label: "Lộ trình", icon: Layers3, active: true },
  { label: "Chương học", icon: Layers3, active: true },
  { label: "Buổi học", icon: BookOpen, active: true },
  { label: "Tài liệu", icon: FileText, active: false },
];

export function AdminCourseDetailManager({ pathId }: { pathId: string }) {
  const {
    actions,
    chapterEditorMode,
    chapterForm,
    courseStats,
    deletingChapter,
    deletingLesson,
    isChapterEditorOpen,
    isLessonEditorOpen,
    isSavingChapter,
    isSavingLesson,
    lessonEditorMode,
    lessonForm,
    path,
    selectedChapterId,
    selectedLessonId,
    viewState,
  } = useAdminCourseDetailManager(pathId);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950 [--form-primary:#0284c7] [--form-secondary:#0f766e]">
      <div className="grid min-h-screen lg:grid-cols-[17rem_minmax(0,1fr)]">
        <AdminCoursesSidebar subtitle="Chi tiết lộ trình" items={adminNavItems} />

        <section className="min-w-0 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
          <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <Link
                href="/admin/courses"
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:border-sky-200 hover:text-sky-700"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Danh sách lộ trình
              </Link>
              <p className="mt-4 text-sm font-bold text-sky-700">Chi tiết lộ trình</p>
              <h1 className="mt-1 text-2xl font-extrabold text-slate-950 md:text-3xl">
                {path?.title ?? "Không tìm thấy lộ trình"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Xem thông tin lộ trình, quản lý chương học tổng quan và các buổi học trong
                từng chương.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={actions.retryLoad}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:border-sky-200 hover:text-sky-700"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Tải lại
              </button>
              <button
                type="button"
                onClick={actions.startCreateChapter}
                disabled={!path}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 text-sm font-extrabold text-white shadow-sm shadow-sky-900/15 transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Thêm chương
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
                    label="Học sinh đang học"
                    value={courseStats.enrolledStudents}
                    tone="sky"
                  />
                </section>

                <LearningPathSummaryPanel path={path} />

                <ChapterLessonPanel
                  path={path}
                  selectedChapterId={selectedChapterId}
                  selectedLessonId={selectedLessonId}
                  onCreateChapter={actions.startCreateChapter}
                  onEditChapter={actions.startEditChapter}
                  onArchiveChapter={actions.requestDeleteChapter}
                  onCreateLesson={actions.startCreateLesson}
                  onEditLesson={actions.startEditLesson}
                  onArchiveLesson={actions.requestDeleteLesson}
                />
              </div>
            ) : null}
          </section>
        </section>
      </div>

      <ChapterEditorDialog
        mode={chapterEditorMode}
        form={chapterForm}
        isOpen={isChapterEditorOpen}
        isSaving={isSavingChapter}
        disabled={!path}
        onSubmit={actions.saveChapter}
        onCreateMode={actions.startCreateChapter}
        onClose={actions.closeChapterEditor}
      />
      <LessonEditorDialog
        mode={lessonEditorMode}
        form={lessonForm}
        isOpen={isLessonEditorOpen}
        isSaving={isSavingLesson}
        disabled={!path}
        onSubmit={actions.saveLesson}
        onCreateMode={actions.startCreateLesson}
        onClose={actions.closeLessonEditor}
      />
      <DeleteConfirmDialog
        title="Xóa chương học"
        confirmLabel="Xóa chương"
        isOpen={Boolean(deletingChapter)}
        itemName={deletingChapter?.title ?? "chương học này"}
        onCancel={actions.closeDeleteChapterConfirm}
        onConfirm={actions.confirmDeleteChapter}
      />
      <DeleteConfirmDialog
        title="Xóa buổi học"
        confirmLabel="Xóa buổi học"
        isOpen={Boolean(deletingLesson)}
        itemName={deletingLesson?.title ?? "buổi học này"}
        onCancel={actions.closeDeleteLessonConfirm}
        onConfirm={actions.confirmDeleteLesson}
      />
    </main>
  );
}
