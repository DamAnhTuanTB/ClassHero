import { Trash2 } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { EditorDialogShell } from "@/features/admin-courses/components/editor-dialog-shell";
import { PathEditor } from "@/features/admin-courses/components/path-editor";
import type { AdminLearningPath } from "@/features/admin-courses/data";
import type { LearningPathFormValues } from "@/features/admin-courses/schemas";
import type { EditorMode } from "@/features/admin-courses/types";

export function PathEditorDialog({
  form,
  isOpen,
  isSaving,
  mode,
  selectedPath,
  onArchive,
  onClose,
  onSubmit,
}: {
  form: UseFormReturn<LearningPathFormValues>;
  isOpen: boolean;
  isSaving: boolean;
  mode: EditorMode;
  selectedPath: AdminLearningPath | null;
  onArchive: () => void;
  onClose: () => void;
  onSubmit: (values: LearningPathFormValues) => void | Promise<void>;
}) {
  return (
    <EditorDialogShell
      ariaLabel={mode === "create" ? "Tạo lộ trình" : "Sửa lộ trình"}
      isOpen={isOpen}
      leadingAction={
        mode === "edit" && selectedPath ? (
          <button
            type="button"
            onClick={onArchive}
            className="grid h-11 w-11 place-items-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 transition hover:border-rose-300 hover:bg-rose-100"
            aria-label="Xóa lộ trình"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null
      }
      onClose={onClose}
    >
      <PathEditor
        mode={mode}
        form={form}
        isSaving={isSaving}
        onSubmit={onSubmit}
      />
    </EditorDialogShell>
  );
}
