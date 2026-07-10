import type { UseFormReturn } from "react-hook-form";
import { EditorDialogShell } from "@/features/admin-courses/components/editor-dialog-shell";
import { LessonEditor } from "@/features/admin-courses/components/lesson-editor";
import type { LessonFormValues } from "@/features/admin-courses/schemas";
import type { EditorMode } from "@/features/admin-courses/types";

export function LessonEditorDialog({
  disabled,
  form,
  isOpen,
  isSaving,
  mode,
  onClose,
  onCreateMode,
  onSubmit,
}: {
  disabled: boolean;
  form: UseFormReturn<LessonFormValues>;
  isOpen: boolean;
  isSaving: boolean;
  mode: EditorMode;
  onClose: () => void;
  onCreateMode: () => void;
  onSubmit: (values: LessonFormValues) => void | Promise<void>;
}) {
  return (
    <EditorDialogShell
      ariaLabel={mode === "create" ? "Thêm buổi học" : "Sửa buổi học"}
      isOpen={isOpen}
      onClose={onClose}
    >
      <LessonEditor
        mode={mode}
        form={form}
        isSaving={isSaving}
        disabled={disabled}
        onSubmit={onSubmit}
        onCreateMode={onCreateMode}
      />
    </EditorDialogShell>
  );
}
