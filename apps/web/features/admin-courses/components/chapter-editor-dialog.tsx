import type { UseFormReturn } from "react-hook-form";
import { ChapterEditor } from "@/features/admin-courses/components/chapter-editor";
import { EditorDialogShell } from "@/features/admin-courses/components/editor-dialog-shell";
import type { ChapterFormValues } from "@/features/admin-courses/schemas";
import type { EditorMode } from "@/features/admin-courses/types";

export function ChapterEditorDialog({
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
  form: UseFormReturn<ChapterFormValues>;
  isOpen: boolean;
  isSaving: boolean;
  mode: EditorMode;
  onClose: () => void;
  onCreateMode: () => void;
  onSubmit: (values: ChapterFormValues) => void | Promise<void>;
}) {
  return (
    <EditorDialogShell
      ariaLabel={mode === "create" ? "Thêm chương học" : "Sửa chương học"}
      isOpen={isOpen}
      onClose={onClose}
    >
      <ChapterEditor
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
