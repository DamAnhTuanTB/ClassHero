"use client";

import {
  BookOpen,
  FileText,
  GraduationCap,
  Layers3,
  Plus,
  RefreshCw,
} from "lucide-react";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/features/admin-courses/components/states";
import { FilterBar } from "@/features/admin-courses/components/filter-bar";
import { LearningPathRow } from "@/features/admin-courses/components/learning-path-row";
import { LessonEditor } from "@/features/admin-courses/components/lesson-editor";
import { LessonPanel } from "@/features/admin-courses/components/lesson-panel";
import { PathEditor } from "@/features/admin-courses/components/path-editor";
import { StatCard } from "@/features/admin-courses/components/stat-card";
import { useAdminCoursesManager } from "@/features/admin-courses/hooks";
import { cn } from "@/lib/utils";

const adminNavItems = [
  { label: "Lộ trình", icon: Layers3, active: true },
  { label: "Buổi học", icon: BookOpen, active: false },
  { label: "Tài liệu", icon: FileText, active: false },
];

export function AdminCoursesManager() {
  const {
    actions,
    filteredPaths,
    gradeFilter,
    isSavingLesson,
    isSavingPath,
    lessonEditorMode,
    lessonForm,
    pathEditorMode,
    pathForm,
    query,
    selectedLessonId,
    selectedPath,
    selectedPathId,
    stats,
    statusFilter,
    subjectFilter,
    viewState,
  } = useAdminCoursesManager();

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950 [--form-primary:#0284c7] [--form-secondary:#0f766e]">
      <div className="grid min-h-screen lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-white px-4 py-4 lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-sky-600 text-white">
              <GraduationCap className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-slate-950">ClassHero Admin</p>
              <p className="text-xs font-semibold text-slate-500">Quản lý nội dung học</p>
            </div>
          </div>

          <nav className="mt-5 flex gap-2 overflow-x-auto pb-1 lg:grid lg:overflow-visible lg:pb-0">
            {adminNavItems.map((item) => (
              <button
                key={item.label}
                type="button"
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center gap-3 rounded-lg px-3 text-sm font-bold transition",
                  item.active
                    ? "bg-sky-50 text-sky-700 ring-1 ring-sky-100"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                )}
              >
                <item.icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="min-w-0 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
          <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-bold text-sky-700">Quản trị khóa học</p>
              <h1 className="mt-1 text-2xl font-extrabold text-slate-950 md:text-3xl">
                Lộ trình và buổi học
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Tạo lộ trình, sắp xếp buổi học, kiểm tra trạng thái mở và tiêu chí hoàn
                thành.
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
                onClick={actions.startCreatePath}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 text-sm font-extrabold text-white shadow-sm shadow-sky-900/15 transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Thêm lộ trình
              </button>
            </div>
          </header>

          <section className="mt-5 grid gap-3 sm:grid-cols-3">
            <StatCard label="Đang mở" value={stats.published} tone="sky" />
            <StatCard label="Tổng buổi học" value={stats.lessons} tone="emerald" />
            <StatCard label="Có học thử" value={stats.trial} tone="amber" />
          </section>

          <section className="mt-5">
            {viewState === "loading" ? <LoadingState /> : null}
            {viewState === "error" ? <ErrorState onRetry={actions.retryLoad} /> : null}
            {viewState === "ready" ? (
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_26rem]">
                <div className="min-w-0">
                  <FilterBar
                    query={query}
                    subjectFilter={subjectFilter}
                    statusFilter={statusFilter}
                    gradeFilter={gradeFilter}
                    onQueryChange={actions.setQuery}
                    onSubjectChange={actions.setSubjectFilter}
                    onStatusChange={actions.setStatusFilter}
                    onGradeChange={actions.setGradeFilter}
                  />

                  {filteredPaths.length === 0 ? (
                    <EmptyState onCreate={actions.startCreatePath} />
                  ) : (
                    <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <div className="hidden grid-cols-[1.35fr_0.7fr_0.55fr_0.6fr_5rem] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-extrabold uppercase text-slate-500 lg:grid">
                        <span>Lộ trình</span>
                        <span>Môn/Lớp</span>
                        <span>Giá</span>
                        <span>Trạng thái</span>
                        <span className="text-right">Sửa</span>
                      </div>

                      <div className="divide-y divide-slate-100">
                        {filteredPaths.map((path) => (
                          <LearningPathRow
                            key={path.id}
                            path={path}
                            selected={path.id === selectedPathId}
                            onSelect={() => actions.startEditPath(path.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedPath ? (
                    <LessonPanel
                      path={selectedPath}
                      selectedLessonId={selectedLessonId}
                      onCreate={actions.startCreateLesson}
                      onEdit={actions.startEditLesson}
                      onArchive={actions.archiveLesson}
                    />
                  ) : null}
                </div>

                <aside className="grid gap-4 xl:sticky xl:top-5 xl:self-start">
                  <PathEditor
                    mode={pathEditorMode}
                    form={pathForm}
                    isSaving={isSavingPath}
                    selectedPath={selectedPath}
                    onSubmit={actions.savePath}
                    onArchive={actions.archiveSelectedPath}
                  />
                  <LessonEditor
                    mode={lessonEditorMode}
                    form={lessonForm}
                    isSaving={isSavingLesson}
                    disabled={!selectedPath}
                    onSubmit={actions.saveLesson}
                    onCreateMode={actions.startCreateLesson}
                  />
                </aside>
              </div>
            ) : null}
          </section>
        </section>
      </div>
    </main>
  );
}
