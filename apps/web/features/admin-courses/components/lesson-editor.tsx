"use client";

import {
  Check,
  FileText,
  ListOrdered,
  Loader2,
  Plus,
  SlidersHorizontal,
  Trophy,
  Video,
} from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { FieldLabel } from "@/components/forms/field-label";
import { OptionField, TextField } from "@/components/forms/form-primitives";
import { adminStatuses, statusLabels } from "@/features/admin-courses/data";
import type { LessonFormValues } from "@/features/admin-courses/schemas";
import type { EditorMode } from "@/features/admin-courses/types";
import { cn } from "@/lib/utils";

export function LessonEditor({
  mode,
  form,
  isSaving,
  disabled,
  onClose,
  onSubmit,
  onCreateMode,
}: {
  mode: EditorMode;
  form: UseFormReturn<LessonFormValues>;
  isSaving: boolean;
  disabled: boolean;
  onClose: () => void;
  onSubmit: (values: LessonFormValues) => void | Promise<void>;
  onCreateMode: () => void;
}) {
  return (
    <form
      className={cn("flex min-h-0 flex-1 flex-col", disabled && "opacity-65")}
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
    >
      <div className="theme-dialog-header flex shrink-0 items-center justify-between gap-3 px-4 py-3 pr-16 sm:px-5 sm:py-3 sm:pr-16">
        <div>
          <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
            {mode === "create" ? "Thêm buổi học" : "Sửa buổi học"}
          </h2>
        </div>
        {mode === "edit" ? (
          <button
            type="button"
            onClick={onCreateMode}
            className="theme-button-neutral inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Mới
          </button>
        ) : null}
      </div>

      <fieldset
        disabled={disabled || isSaving}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5"
      >
        <div className="grid gap-3 sm:grid-cols-[6rem_minmax(0,1fr)]">
          <TextField
            id="admin-lesson-order"
            label="Thứ tự"
            inputMode="numeric"
            icon={<ListOrdered className="h-5 w-5" aria-hidden="true" />}
            error={form.formState.errors.orderIndex}
            {...form.register("orderIndex", { setValueAs: toNumericFormValue })}
          />
          <TextField
            id="admin-lesson-title"
            label="Tên buổi học"
            icon={<FileText className="h-5 w-5" aria-hidden="true" />}
            error={form.formState.errors.title}
            {...form.register("title")}
          />
        </div>
        <div>
          <FieldLabel
            id="admin-lesson-description"
            label="Tổng quan buổi học"
            isOptional
          />
          <textarea
            id="admin-lesson-description"
            rows={4}
            placeholder="Ví dụ: Nội dung chính, dạng bài trọng tâm hoặc ghi chú cho buổi học."
            className={cn(
              "theme-form-control mt-2 min-h-28 w-full resize-y rounded-xl px-4 py-3 text-base font-semibold leading-6 outline-none transition disabled:cursor-not-allowed lg:text-sm",
            )}
            aria-invalid={form.formState.errors.shortDescription ? "true" : "false"}
            aria-describedby={
              form.formState.errors.shortDescription
                ? "admin-lesson-description-error"
                : undefined
            }
            {...form.register("shortDescription")}
          />
          {form.formState.errors.shortDescription ? (
            <p
              id="admin-lesson-description-error"
              className="mt-1.5 text-sm leading-5 text-[var(--theme-error-text)]"
            >
              {form.formState.errors.shortDescription.message}
            </p>
          ) : null}
        </div>
        <TextField
          id="admin-lesson-video-url"
          label="Video URL"
          isOptional
          icon={<Video className="h-5 w-5" aria-hidden="true" />}
          error={form.formState.errors.videoUrl}
          {...form.register("videoUrl")}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            id="admin-lesson-completion-score"
            label="Điểm hoàn thành"
            inputMode="decimal"
            step="0.5"
            icon={<Trophy className="h-5 w-5" aria-hidden="true" />}
            error={form.formState.errors.completionMinScore}
            {...form.register("completionMinScore", { setValueAs: toNumericFormValue })}
          />
          <OptionField
            id="admin-lesson-status"
            label="Trạng thái"
            value={form.watch("status")}
            icon={<SlidersHorizontal className="h-5 w-5" aria-hidden="true" />}
            options={adminStatuses.map((status) => ({
              value: status,
              label: statusLabels[status],
            }))}
            onChange={(value) =>
              form.setValue("status", value as LessonFormValues["status"], {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
          />
        </div>
      </fieldset>

      <div className="theme-dialog-footer grid shrink-0 grid-cols-2 gap-2 p-3 sm:flex sm:justify-end sm:p-4">
        <button
          type="button"
          onClick={onClose}
          disabled={disabled || isSaving}
          className="theme-button-neutral inline-flex min-h-11 min-w-0 items-center justify-center whitespace-nowrap rounded-lg px-4 text-center text-sm font-extrabold transition disabled:cursor-not-allowed sm:w-auto"
        >
          Hủy
        </button>
        <button
          type="submit"
          disabled={disabled || isSaving}
          className="theme-button-primary inline-flex min-h-11 min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-center text-sm font-extrabold transition disabled:cursor-not-allowed sm:w-auto"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="h-4 w-4" aria-hidden="true" />
          )}
          {isSaving ? "Đang lưu" : "Lưu buổi học"}
        </button>
      </div>
    </form>
  );
}

function toNumericFormValue(value: unknown) {
  return value === "" ? "" : Number(value);
}
