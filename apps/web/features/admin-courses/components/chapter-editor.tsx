"use client";

import {
  Check,
  FileText,
  ListOrdered,
  Loader2,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import type { ChangeEvent } from "react";
import type { UseFormReturn } from "react-hook-form";
import { FieldLabel } from "@/components/forms/field-label";
import { OptionField, TextField } from "@/components/forms/form-primitives";
import { formFocusClass } from "@/components/forms/form-styles";
import { adminStatuses, statusLabels } from "@/features/admin-courses/data";
import type { ChapterFormValues } from "@/features/admin-courses/schemas";
import type { EditorMode } from "@/features/admin-courses/types";
import { cn } from "@/lib/utils";

export function ChapterEditor({
  disabled,
  form,
  isSaving,
  mode,
  onCreateMode,
  onSubmit,
}: {
  disabled: boolean;
  form: UseFormReturn<ChapterFormValues>;
  isSaving: boolean;
  mode: EditorMode;
  onCreateMode: () => void;
  onSubmit: (values: ChapterFormValues) => void | Promise<void>;
}) {
  const orderIndexField = form.register("orderIndex");
  const { errors } = form.formState;
  const titleValue = form.watch("title");
  const isTitleMissing = titleValue.trim().length === 0;
  const isSubmitDisabled =
    disabled ||
    isSaving ||
    isTitleMissing ||
    Boolean(errors.orderIndex || errors.title || errors.overview || errors.status);

  function handleOrderIndexChange(event: ChangeEvent<HTMLInputElement>) {
    event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "");
    orderIndexField.onChange(event);
  }

  return (
    <form
      className={cn("grid gap-4", disabled && "opacity-65")}
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
    >
      <div className="flex items-start justify-between gap-3 pr-12">
        <div>
          <h2 className="text-lg font-extrabold text-slate-950">
            {mode === "create" ? "Thêm chương học" : "Sửa chương học"}
          </h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Chương chỉ chứa thông tin tổng quan để nhóm các buổi học.
          </p>
        </div>
        {mode === "edit" ? (
          <button
            type="button"
            onClick={onCreateMode}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:border-sky-200 hover:text-sky-700"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Mới
          </button>
        ) : null}
      </div>

      <fieldset disabled={disabled || isSaving} className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-[6rem_minmax(0,1fr)]">
          <TextField
            id="admin-chapter-order"
            label="Thứ tự"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            icon={<ListOrdered className="h-5 w-5" aria-hidden="true" />}
            error={errors.orderIndex}
            {...orderIndexField}
            onChange={handleOrderIndexChange}
          />
          <TextField
            id="admin-chapter-title"
            label="Tên chương học"
            icon={<FileText className="h-5 w-5" aria-hidden="true" />}
            error={errors.title}
            {...form.register("title")}
          />
        </div>

        <div>
          <FieldLabel id="admin-chapter-overview" label="Tổng quan chương" isOptional />
          <textarea
            id="admin-chapter-overview"
            rows={4}
            placeholder="Ví dụ: Tổng quan các kiến thức nền của chương này."
            className={cn(
              "mt-2 min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-indigo-200 focus:bg-white focus:ring-4 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 lg:text-sm",
              formFocusClass,
            )}
            aria-invalid={errors.overview ? "true" : "false"}
            aria-describedby={errors.overview ? "admin-chapter-overview-error" : undefined}
            {...form.register("overview")}
          />
          {errors.overview ? (
            <p
              id="admin-chapter-overview-error"
              className="mt-1.5 text-sm leading-5 text-red-600"
            >
              {errors.overview.message}
            </p>
          ) : null}
        </div>

        <OptionField
          id="admin-chapter-status"
          label="Trạng thái"
          value={form.watch("status")}
          icon={<SlidersHorizontal className="h-5 w-5" aria-hidden="true" />}
          error={errors.status}
          options={adminStatuses.map((status) => ({
            value: status,
            label: statusLabels[status],
          }))}
          onChange={(value) =>
            form.setValue("status", value as ChapterFormValues["status"], {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
        />
      </fieldset>

      <button
        type="submit"
        disabled={isSubmitDisabled}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 text-sm font-extrabold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {isSaving ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Check className="h-4 w-4" aria-hidden="true" />
        )}
        {isSaving ? "Đang lưu" : "Lưu chương học"}
      </button>
    </form>
  );
}
