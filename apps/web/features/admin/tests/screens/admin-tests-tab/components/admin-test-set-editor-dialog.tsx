"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Clock3, FileCheck2, Loader2, Plus, Save } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import { OptionField } from "@/components/common/forms/option-field";
import { TextField } from "@/components/common/forms/text-field";
import type { AdminTestSet } from "@/features/admin/tests/api/admin-tests-api";
import {
  testSetFormSchema,
  type TestSetFormValues,
} from "@/features/admin/tests/schemas/test-set-form-schema";

const difficultyOptions = [
  { value: "MIXED", label: "Hỗn hợp" },
  { value: "EASY", label: "Dễ" },
  { value: "MEDIUM", label: "Trung bình" },
  { value: "HARD", label: "Khó" },
];
const defaultDurationMinutes = "15";

export function AdminTestSetEditorDialog({
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
  onSubmit: (values: TestSetFormValues) => Promise<void>;
  set: AdminTestSet | null;
}) {
  const form = useForm<TestSetFormValues>({
    resolver: zodResolver(testSetFormSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      title: defaultTitle,
      difficulty: "MIXED",
      durationMinutes: defaultDurationMinutes,
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    form.reset({
      title: set?.title ?? defaultTitle,
      difficulty: set?.difficulty ?? "MIXED",
      durationMinutes: set
        ? String(Math.max(1, Math.round(set.durationSeconds / 60)))
        : defaultDurationMinutes,
    });
  }, [defaultTitle, form, isOpen, set]);

  const durationField = form.register("durationMinutes");
  const handleClose = () => {
    if (!isSaving) onClose();
  };

  return (
    <EditorDialogShell
      ariaLabel={set ? "Chỉnh sửa bộ đề" : "Thêm bộ đề"}
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
            {set ? "Chỉnh sửa bộ đề" : "Thêm bộ đề"}
          </h2>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <TextField
            id="test-set-title"
            label="Tên bộ đề"
            placeholder="Ví dụ: Bài kiểm tra 15 phút"
            icon={<FileCheck2 className="h-5 w-5" aria-hidden="true" />}
            error={form.formState.errors.title}
            autoFocus
            {...form.register("title")}
          />
          <TextField
            id="test-set-duration"
            label="Thời gian làm bài (phút)"
            placeholder="15"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            icon={<Clock3 className="h-5 w-5" aria-hidden="true" />}
            error={form.formState.errors.durationMinutes}
            {...durationField}
            onChange={(event) => {
              event.currentTarget.value = event.currentTarget.value.replace(/\D/gu, "");
              durationField.onChange(event);
            }}
          />
          <OptionField
            id="test-set-difficulty"
            label="Mức độ"
            value={form.watch("difficulty")}
            options={difficultyOptions}
            icon={null}
            error={form.formState.errors.difficulty}
            onChange={(value) =>
              form.setValue("difficulty", value as TestSetFormValues["difficulty"], {
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
            className="theme-button-primary inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-5 text-sm font-extrabold disabled:opacity-60 sm:w-auto"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : set ? (
              <Save className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Plus className="h-4 w-4" aria-hidden="true" />
            )}
            {isSaving ? "Đang lưu" : set ? "Lưu thay đổi" : "Thêm bộ đề"}
          </button>
        </footer>
      </form>
    </EditorDialogShell>
  );
}
