"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FileQuestion, Loader2, Plus, Save } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import { OptionField } from "@/components/common/forms/option-field";
import { TextField } from "@/components/common/forms/text-field";
import type { AdminQuizSet } from "@/features/admin/quiz/api/admin-quiz-api";
import {
  quizSetFormSchema,
  type QuizSetFormValues,
} from "@/features/admin/quiz/schemas/quiz-set-form-schema";

const difficultyOptions = [
  { value: "MIXED", label: "Hỗn hợp" },
  { value: "EASY", label: "Dễ" },
  { value: "MEDIUM", label: "Trung bình" },
  { value: "HARD", label: "Khó" },
];

export function AdminQuizSetEditorDialog({
  defaultTitle,
  isOpen,
  isSaving,
  onClose,
  onSubmit,
  set,
}: {
  defaultTitle: string;
  isOpen: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (values: QuizSetFormValues) => Promise<void>;
  set: AdminQuizSet | null;
}) {
  const form = useForm<QuizSetFormValues>({
    resolver: zodResolver(quizSetFormSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: { title: defaultTitle, difficulty: "MIXED" },
  });

  useEffect(() => {
    if (!isOpen) return;
    form.reset({
      title: set?.title ?? defaultTitle,
      difficulty: set?.difficulty ?? "MIXED",
    });
  }, [defaultTitle, form, isOpen, set]);

  const handleClose = () => {
    if (!isSaving) {
      onClose();
    }
  };

  return (
    <EditorDialogShell
      ariaLabel={set ? "Chỉnh sửa bộ câu hỏi" : "Thêm bộ câu hỏi"}
      isOpen={isOpen}
      onClose={handleClose}
      panelClassName="max-w-lg"
    >
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <header className="theme-dialog-header flex min-h-16 shrink-0 items-center px-5 pr-16">
          <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
            {set ? "Chỉnh sửa bộ câu hỏi" : "Thêm bộ câu hỏi"}
          </h2>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <TextField
            id="quiz-set-title"
            label="Tên bộ câu hỏi"
            placeholder="Ví dụ: Ôn tập kiến thức trọng tâm"
            icon={<FileQuestion className="h-5 w-5" aria-hidden="true" />}
            error={form.formState.errors.title}
            autoFocus
            {...form.register("title")}
          />
          <OptionField
            id="quiz-set-difficulty"
            label="Mức độ"
            value={form.watch("difficulty")}
            options={difficultyOptions}
            icon={null}
            error={form.formState.errors.difficulty}
            onChange={(value) =>
              form.setValue("difficulty", value as QuizSetFormValues["difficulty"], {
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
            onClick={handleClose}
            disabled={isSaving}
            className="theme-button-neutral min-h-11 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold sm:w-auto"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="theme-button-primary inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-5 text-sm font-extrabold disabled:cursor-wait disabled:opacity-60 sm:w-auto"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : set ? (
              <Save className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Plus className="h-4 w-4" aria-hidden="true" />
            )}
            {isSaving ? "Đang lưu" : set ? "Lưu thay đổi" : "Thêm bộ câu hỏi"}
          </button>
        </footer>
      </form>
    </EditorDialogShell>
  );
}
