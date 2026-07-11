"use client";

import {
  Check,
  FileText,
  ListOrdered,
  Loader2,
  SlidersHorizontal,
} from "lucide-react";
import type { ChangeEvent } from "react";
import type { UseFormReturn } from "react-hook-form";
import { FieldLabel } from "@/components/forms/field-label";
import { OptionField, TextField } from "@/components/forms/form-primitives";
import { adminStatuses, statusLabels } from "@/features/admin-courses/data";
import type { ChapterFormValues } from "@/features/admin-courses/schemas";
import type { EditorMode } from "@/features/admin-courses/types";
import { cn } from "@/lib/utils";

export function ChapterEditor({
  disabled,
  form,
  isSaving,
  mode,
  onClose,
  onSubmit,
}: {
  disabled: boolean;
  form: UseFormReturn<ChapterFormValues>;
  isSaving: boolean;
  mode: EditorMode;
  onClose: () => void;
  onSubmit: (values: ChapterFormValues) => void | Promise<void>;
}) {
  const orderIndexField = form.register("orderIndex");
  const { errors } = form.formState;
  const isSubmitDisabled = disabled || isSaving;

  function handleOrderIndexChange(event: ChangeEvent<HTMLInputElement>) {
    event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "");
    orderIndexField.onChange(event);
  }

  return (
    <form
      className={cn("flex min-h-0 flex-1 flex-col", disabled && "opacity-65")}
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
    >
      <div className="theme-dialog-header flex min-h-16 shrink-0 items-center px-4 py-3 pr-16 sm:px-5 sm:py-3 sm:pr-16">
        <div>
          <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
            {mode === "create" ? "Thêm chương học" : "Sửa chương học"}
          </h2>
        </div>
      </div>

      <fieldset
        disabled={disabled || isSaving}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5"
      >
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
          <FieldLabel
            id="admin-chapter-overview"
            label="Tổng quan chương"
            isOptional
          />
          <textarea
            id="admin-chapter-overview"
            rows={4}
            placeholder="Ví dụ: Tổng quan các kiến thức nền của chương này."
            className={cn(
              "theme-form-control mt-2 min-h-28 w-full resize-y rounded-xl px-4 py-3 text-base font-semibold leading-6 outline-none transition disabled:cursor-not-allowed lg:text-sm",
            )}
            aria-invalid={errors.overview ? "true" : "false"}
            aria-describedby={errors.overview ? "admin-chapter-overview-error" : undefined}
            {...form.register("overview")}
          />
          {errors.overview ? (
            <p
              id="admin-chapter-overview-error"
              className="mt-1.5 text-sm leading-5 text-[var(--theme-error-text)]"
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
          disabled={isSubmitDisabled}
          className="theme-button-primary inline-flex min-h-11 min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-center text-sm font-extrabold transition disabled:cursor-not-allowed sm:w-auto"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="h-4 w-4" aria-hidden="true" />
          )}
          {isSaving ? "Đang lưu" : "Lưu chương học"}
        </button>
      </div>
    </form>
  );
}
