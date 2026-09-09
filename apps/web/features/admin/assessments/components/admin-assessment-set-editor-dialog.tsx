"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { DEFAULT_TEST_DURATION_SECONDS } from "@learning-path/shared";
import { Clock3, FileQuestion, Loader2, Plus, Save } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import { TextField } from "@/components/common/forms/text-field";
import {
  createAssessmentSetFormSchema,
  type AssessmentSetFormValues,
} from "@/features/admin/assessments/schemas/assessment-set-form-schema";
import type {
  AdminAssessmentKind,
  AdminAssessmentSet,
} from "@/features/admin/assessments/types/admin-assessment.types";

export function AdminAssessmentSetEditorDialog({
  defaultTitle,
  isOpen,
  isSaving,
  kind,
  onClose,
  onSubmit,
  set,
}: {
  defaultTitle: string;
  isOpen: boolean;
  isSaving: boolean;
  kind: AdminAssessmentKind;
  onClose: () => void;
  onSubmit: (values: AssessmentSetFormValues) => Promise<void>;
  set: AdminAssessmentSet | null;
}) {
  const schema = useMemo(() => createAssessmentSetFormSchema(kind), [kind]);
  const form = useForm<AssessmentSetFormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      title: defaultTitle,
      durationMinutes: kind === "test" ? "15" : undefined,
    },
  });
  useEffect(() => {
    if (isOpen)
      form.reset({
        title: set?.title ?? defaultTitle,
        durationMinutes:
          kind === "test"
            ? String(
                Math.max(
                  1,
                  Math.round(
                    (set?.durationSeconds ?? DEFAULT_TEST_DURATION_SECONDS) / 60,
                  ),
                ),
              )
            : undefined,
      });
  }, [defaultTitle, form, isOpen, kind, set]);
  const durationField = form.register("durationMinutes");
  const noun = kind === "test" ? "bộ đề" : "bộ câu hỏi";
  return (
    <EditorDialogShell
      ariaLabel={set ? `Chỉnh sửa ${noun}` : `Thêm ${noun}`}
      isOpen={isOpen}
      onClose={() => !isSaving && onClose()}
      panelClassName="max-w-lg"
    >
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <header className="theme-dialog-header flex min-h-16 shrink-0 items-center px-5 pr-16">
          <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
            {set ? `Chỉnh sửa ${noun}` : `Thêm ${noun}`}
          </h2>
        </header>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <TextField
            id="assessment-set-title"
            label={`Tên ${noun}`}
            placeholder={
              kind === "test"
                ? "Ví dụ: Bài kiểm tra 15 phút"
                : "Ví dụ: Ôn tập kiến thức trọng tâm"
            }
            icon={<FileQuestion className="h-5 w-5" aria-hidden="true" />}
            error={form.formState.errors.title}
            autoFocus
            {...form.register("title")}
          />
          {kind === "test" ? (
            <TextField
              id="assessment-set-duration"
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
          ) : null}
        </div>
        <footer className="theme-dialog-footer grid shrink-0 grid-cols-2 gap-2 p-3 sm:flex sm:justify-end sm:p-4">
          <button
            type="button"
            onClick={() => !isSaving && onClose()}
            disabled={isSaving}
            className="theme-button-neutral min-h-11 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="theme-button-primary inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-5 text-sm font-extrabold disabled:opacity-60"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : set ? (
              <Save className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Plus className="h-4 w-4" aria-hidden="true" />
            )}
            {isSaving ? "Đang lưu" : set ? "Lưu thay đổi" : `Thêm ${noun}`}
          </button>
        </footer>
      </form>
    </EditorDialogShell>
  );
}
