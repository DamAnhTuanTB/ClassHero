"use client";

import { SkeletonBlock } from "@/components/common/ui/skeleton-block";
import { AdminDataErrorState } from "@/components/admin/admin-data-error-state";
import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import { findLessonMatch } from "@/features/admin/courses/admin-courses-utils";
import { useAdminCourseDetailManager } from "@/features/admin/courses/hooks/use-admin-course-detail-manager";
import { LessonEditorDialog } from "@/features/admin/courses/screens/admin-course-detail-manager/components/lesson-editor-dialog";

export function LessonDetailEditorDialog({
  isOpen,
  lessonId,
  learningPathId,
  onClose,
  onSaved,
}: {
  isOpen: boolean;
  lessonId: string;
  learningPathId: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { actions, isSavingLesson, path, viewState } =
    useAdminCourseDetailManager(learningPathId);
  const selectedLesson = findLessonMatch(path, lessonId)?.lesson ?? null;
  const isLessonMissingFromPath = viewState === "ready" && path && !selectedLesson;

  if (viewState === "ready" && path && selectedLesson) {
    return (
      <LessonEditorDialog
        mode="edit"
        isOpen={isOpen}
        isSaving={isSavingLesson}
        learningPath={path}
        selectedLesson={selectedLesson}
        disabled={false}
        onSubmit={async (values, documentsManager) => {
          const didSave = await actions.saveLesson(values, documentsManager, {
            closeEditor: false,
            lessonId,
          });

          if (didSave) {
            await onSaved();
            onClose();
          }
        }}
        onClose={onClose}
      />
    );
  }

  return (
    <EditorDialogShell
      ariaLabel="Sửa buổi học"
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="max-w-4xl"
    >
      <div className="flex min-h-64 min-w-0 flex-1 flex-col">
        <header className="theme-dialog-header flex min-h-16 shrink-0 items-center px-4 py-3 pr-16 sm:px-5">
          <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
            Sửa buổi học
          </h2>
        </header>

        <div className="flex min-h-48 flex-1 items-center justify-center p-5">
          {viewState === "error" || isLessonMissingFromPath ? (
            <AdminDataErrorState
              description={
                isLessonMissingFromPath
                  ? "Buổi học này không còn trong dữ liệu khóa học. Vui lòng tải lại để thử lại."
                  : "Vui lòng thử lại để mở đầy đủ nội dung chỉnh sửa."
              }
              headingLevel={3}
              onRetry={actions.retryLoad}
              title={
                isLessonMissingFromPath
                  ? "Không tìm thấy buổi học trong khóa học"
                  : "Không tải được thông tin khóa học"
              }
              variant="compact"
            />
          ) : (
            <LessonEditorSkeleton />
          )}
        </div>
      </div>
    </EditorDialogShell>
  );
}

function LessonEditorSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Đang tải biểu mẫu sửa buổi học"
      className="w-full animate-pulse space-y-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} className="space-y-2">
            <SkeletonBlock className="h-4 w-28 rounded-full" />
            <SkeletonBlock className="h-11 rounded-lg" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <SkeletonBlock className="h-4 w-36 rounded-full" />
        <SkeletonBlock className="h-28 rounded-lg" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <SkeletonBlock key={index} className="h-11 rounded-lg" />
        ))}
      </div>
      <div className="flex justify-end">
        <SkeletonBlock className="h-11 w-32 rounded-lg" />
      </div>
    </div>
  );
}
