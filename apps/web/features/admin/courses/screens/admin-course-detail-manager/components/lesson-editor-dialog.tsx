import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import { LessonEditor } from "@/features/admin/courses/screens/admin-course-detail-manager/components/lesson-editor";
import type { AdminLesson } from "@/features/admin/courses/admin-courses-data";
import {
  emptyLessonValues,
  lessonSchema,
  type LessonFormValues,
} from "@/features/admin/courses/admin-courses-schemas";
import type { EditorMode } from "@/features/admin/courses/admin-courses-types";
import { toLessonFormValues } from "@/features/admin/courses/admin-courses-utils";

export function LessonEditorDialog({
  defaultOrderIndex,
  disabled,
  isOpen,
  isSaving,
  mode,
  selectedLesson,
  onClose,
  onSubmit,
}: {
  defaultOrderIndex: number;
  disabled: boolean;
  isOpen: boolean;
  isSaving: boolean;
  mode: EditorMode;
  selectedLesson: AdminLesson | null;
  onClose: () => void;
  onSubmit: (values: LessonFormValues) => void | Promise<void>;
}) {
  const form = useForm<LessonFormValues>({
    resolver: zodResolver(lessonSchema) as Resolver<LessonFormValues>,
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: emptyLessonValues,
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    form.reset(
      mode === "edit" && selectedLesson
        ? toLessonFormValues(selectedLesson)
        : {
            ...emptyLessonValues,
            orderIndex: defaultOrderIndex,
          },
    );
  }, [defaultOrderIndex, form, isOpen, mode, selectedLesson]);

  async function submit(values: LessonFormValues) {
    try {
      await onSubmit(values);
    } catch (error) {
      if (error instanceof Error && error.message === "DUPLICATED_LESSON_ORDER") {
        form.setError("orderIndex", {
          type: "manual",
          message: "Thứ tự này đã có trong chương",
        });
        return;
      }

      throw error;
    }
  }

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
        onClose={onClose}
        onSubmit={submit}
      />
    </EditorDialogShell>
  );
}
