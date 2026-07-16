import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { ChapterEditor } from "@/features/admin/courses/screens/admin-course-detail-manager/components/chapter-editor";
import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import type { AdminChapter } from "@/features/admin/courses/admin-courses-data";
import {
  chapterSchema,
  emptyChapterValues,
  type ChapterFormValues,
} from "@/features/admin/courses/admin-courses-schemas";
import type { EditorMode } from "@/features/admin/courses/admin-courses-types";
import { toChapterFormValues } from "@/features/admin/courses/admin-courses-utils";

export function ChapterEditorDialog({
  disabled,
  defaultOrderIndex,
  isOpen,
  isSaving,
  mode,
  selectedChapter,
  onClose,
  onSubmit,
}: {
  disabled: boolean;
  defaultOrderIndex: number;
  isOpen: boolean;
  isSaving: boolean;
  mode: EditorMode;
  selectedChapter: AdminChapter | null;
  onClose: () => void;
  onSubmit: (values: ChapterFormValues) => void | Promise<void>;
}) {
  const form = useForm<ChapterFormValues>({
    resolver: zodResolver(chapterSchema) as Resolver<ChapterFormValues>,
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: emptyChapterValues,
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    form.reset(
      mode === "edit" && selectedChapter
        ? toChapterFormValues(selectedChapter)
        : {
            ...emptyChapterValues,
            orderIndex: defaultOrderIndex,
            status: "PUBLISHED",
          },
    );
  }, [defaultOrderIndex, form, isOpen, mode, selectedChapter]);

  async function submit(values: ChapterFormValues) {
    try {
      await onSubmit(values);
    } catch (error) {
      if (error instanceof Error && error.message === "DUPLICATED_CHAPTER_ORDER") {
        form.setError("orderIndex", {
          type: "manual",
          message: "Thứ tự này đã có trong lộ trình",
        });
        return;
      }

      throw error;
    }
  }

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
        onClose={onClose}
        onSubmit={submit}
      />
    </EditorDialogShell>
  );
}
