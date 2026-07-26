"use client";

import { useEffect, useRef } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
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
  const {
    actions,
    isLessonEditorOpen,
    isSavingLesson,
    path,
    selectedChapter,
    selectedLesson,
    viewState,
  } = useAdminCourseDetailManager(learningPathId);
  const openingLessonIdRef = useRef<string | null>(null);
  const wasEditorOpenRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      openingLessonIdRef.current = null;
      wasEditorOpenRef.current = false;
      return;
    }

    if (viewState !== "ready" || !path || openingLessonIdRef.current === lessonId) {
      return;
    }

    openingLessonIdRef.current = lessonId;
    actions.startEditLesson(lessonId);
  }, [actions, isOpen, lessonId, path, viewState]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (isLessonEditorOpen) {
      wasEditorOpenRef.current = true;
      return;
    }

    if (wasEditorOpenRef.current && !isSavingLesson) {
      wasEditorOpenRef.current = false;
      void onSaved();
      onClose();
    }
  }, [isLessonEditorOpen, isOpen, isSavingLesson, onClose, onSaved]);

  function closeEditor() {
    wasEditorOpenRef.current = false;
    actions.closeLessonEditor();
    onClose();
  }

  if (
    viewState === "ready" &&
    path &&
    selectedChapter &&
    selectedLesson &&
    isLessonEditorOpen
  ) {
    return (
      <LessonEditorDialog
        mode="edit"
        defaultOrderIndex={selectedChapter.lessons.length + 1}
        isOpen={isOpen}
        isSaving={isSavingLesson}
        learningPath={path}
        selectedLesson={selectedLesson}
        disabled={false}
        onSubmit={actions.saveLesson}
        onClose={closeEditor}
      />
    );
  }

  return (
    <EditorDialogShell
      ariaLabel="Sửa buổi học"
      isOpen={isOpen}
      onClose={closeEditor}
      panelClassName="max-w-4xl"
    >
      <div className="flex min-h-64 min-w-0 flex-1 flex-col">
        <header className="theme-dialog-header flex min-h-16 shrink-0 items-center px-4 py-3 pr-16 sm:px-5">
          <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
            Sửa buổi học
          </h2>
        </header>

        <div className="flex min-h-48 flex-1 items-center justify-center p-5">
          {viewState === "error" ? (
            <div className="max-w-md text-center">
              <p className="text-sm font-bold text-[var(--theme-text-strong)]">
                Chưa tải được thông tin khóa học
              </p>
              <p className="mt-1 text-sm leading-6 text-[var(--theme-text-muted)]">
                Thử tải lại để mở đầy đủ nội dung chỉnh sửa của buổi học.
              </p>
              <button
                type="button"
                onClick={actions.retryLoad}
                className="theme-button-primary-subtle mt-4 inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-bold transition"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Thử lại
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm font-bold text-[var(--theme-text-muted)]">
              <Loader2
                className="h-5 w-5 animate-spin text-[var(--theme-primary)]"
                aria-hidden="true"
              />
              Đang tải thông tin buổi học
            </div>
          )}
        </div>
      </div>
    </EditorDialogShell>
  );
}
