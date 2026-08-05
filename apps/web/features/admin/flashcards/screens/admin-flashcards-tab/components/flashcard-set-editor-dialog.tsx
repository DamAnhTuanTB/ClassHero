"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Layers, Loader2, Save } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import { OptionField } from "@/components/common/forms/option-field";
import { TextField } from "@/components/common/forms/text-field";
import type { AdminFlashcardSet } from "@/features/admin/flashcards/api/admin-flashcards-api";
import { useAdminFlashcardSetMutations } from "@/features/admin/flashcards/hooks/use-admin-flashcards";
import {
  flashcardSetFormSchema,
  type FlashcardSetFormValues,
} from "@/features/admin/flashcards/schemas/flashcard-form-schemas";

const difficultyOptions = [
  { value: "MIXED", label: "Hỗn hợp" },
  { value: "EASY", label: "Dễ" },
  { value: "MEDIUM", label: "Trung bình" },
  { value: "HARD", label: "Khó" },
];

export function FlashcardSetEditorDialog({
  defaultTitle,
  isOpen,
  lessonId,
  set,
  onClose,
  onSaved,
}: {
  defaultTitle: string;
  isOpen: boolean;
  lessonId: string;
  set: AdminFlashcardSet | null;
  onClose: () => void;
  onSaved: (set: AdminFlashcardSet) => void;
}) {
  const { createSet, updateSet } = useAdminFlashcardSetMutations(lessonId);
  const isSaving = createSet.isPending || updateSet.isPending;
  const form = useForm<FlashcardSetFormValues>({
    resolver: zodResolver(flashcardSetFormSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: { title: "", difficulty: "MIXED" },
  });

  useEffect(() => {
    if (!isOpen) return;
    form.reset({
      title: set?.title ?? defaultTitle,
      difficulty: set?.difficulty ?? "MIXED",
    });
  }, [defaultTitle, form, isOpen, set]);

  const submit = form.handleSubmit(async (values) => {
    try {
      const saved = set
        ? await updateSet.mutateAsync({ setId: set.id, payload: values })
        : await createSet.mutateAsync(values);
      toast.success(set ? "Đã cập nhật bộ flashcard" : "Đã tạo bộ flashcard");
      onSaved(saved);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chưa lưu được bộ flashcard");
    }
  });

  return (
    <EditorDialogShell
      ariaLabel={set ? "Chỉnh sửa bộ flashcard" : "Tạo bộ flashcard"}
      isOpen={isOpen}
      onClose={onClose}
    >
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <header className="theme-dialog-header flex min-h-16 shrink-0 items-center px-5 pr-16">
          <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
            {set ? "Chỉnh sửa bộ flashcard" : "Tạo bộ flashcard"}
          </h2>
        </header>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <TextField
            id="flashcard-set-title"
            label="Tên bộ flashcard"
            placeholder="Ví dụ: Công thức cần nhớ"
            icon={<Layers className="h-5 w-5" aria-hidden="true" />}
            error={form.formState.errors.title}
            {...form.register("title")}
          />
          <OptionField
            id="flashcard-set-difficulty"
            label="Mức độ"
            value={form.watch("difficulty")}
            options={difficultyOptions}
            icon={null}
            error={form.formState.errors.difficulty}
            onChange={(value) =>
              form.setValue("difficulty", value as FlashcardSetFormValues["difficulty"], {
                shouldDirty: true,
                shouldTouch: true,
                shouldValidate: true,
              })
            }
          />
        </div>
        <footer className="theme-dialog-footer grid shrink-0 grid-cols-2 gap-2 p-3 sm:flex sm:justify-end sm:p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="theme-button-neutral min-h-11 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold sm:w-auto"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="theme-button-primary inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-5 text-sm font-extrabold disabled:opacity-60 sm:w-auto"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="h-4 w-4" aria-hidden="true" />
            )}
            {isSaving ? "Đang lưu" : "Lưu"}
          </button>
        </footer>
      </form>
    </EditorDialogShell>
  );
}
