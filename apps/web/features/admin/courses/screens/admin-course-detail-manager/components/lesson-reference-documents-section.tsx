"use client";

import { FilePlus2, Trash2, Upload } from "lucide-react";
import { useFieldArray, type UseFormReturn } from "react-hook-form";
import { FieldLabel } from "@/components/common/forms/field-label";
import { TextField } from "@/components/common/forms/text-field";
import type { LessonFormValues } from "@/features/admin/courses/admin-courses-schemas";
import { cn } from "@/lib/utils";

export function LessonReferenceDocumentsSection({
  disabled,
  form,
  isSaving,
}: {
  disabled: boolean;
  form: UseFormReturn<LessonFormValues>;
  isSaving: boolean;
}) {
  const { append, fields, remove } = useFieldArray({
    control: form.control,
    name: "referenceDocuments",
  });
  const isDisabled = disabled || isSaving;

  return (
    <section
      data-testid="lesson-reference-documents-section"
      className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-3"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="theme-button-primary-subtle mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg">
            <FilePlus2 className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <FieldLabel
              id="admin-lesson-reference-documents"
              label="Tài liệu tham khảo"
              isOptional
            />
            <p className="mt-1 text-sm font-semibold leading-5 text-[var(--theme-text-muted)]">
              Lưu kèm buổi học khi cần.
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={isDisabled}
          onClick={() => append({ file: null, title: "" })}
          className="theme-button-neutral inline-flex min-h-10 w-full shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-sm font-extrabold transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          <FilePlus2 className="h-4 w-4" aria-hidden="true" />
          Thêm tài liệu
        </button>
      </div>

      {fields.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-[var(--theme-border-strong)] bg-[var(--theme-surface)] px-3 py-4 text-sm font-semibold text-[var(--theme-text-muted)]">
          Chưa thêm tài liệu tham khảo.
        </div>
      ) : (
        <div className="mt-3 grid gap-3">
          {fields.map((field, index) => {
            const displayIndex = index + 1;
            const fileInputId = `admin-lesson-reference-file-${field.id}`;
            const selectedFile =
              form.watch(`referenceDocuments.${index}.file`) ?? null;
            const fileError = form.formState.errors.referenceDocuments?.[index]?.file;

            const isExisting = Boolean(form.watch(`referenceDocuments.${index}.id`));
            const originalName = form.watch(`referenceDocuments.${index}.originalName`) as string | undefined;

            return (
              <div
                key={field.id}
                className="grid gap-3 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-3 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,0.85fr)_2.5rem]"
              >
                <TextField
                  id={`admin-lesson-reference-title-${field.id}`}
                  label={`Tên tài liệu ${displayIndex}`}
                  isOptional
                  icon={null}
                  disabled={isDisabled || isExisting}
                  error={
                    form.formState.errors.referenceDocuments?.[index]?.title
                  }
                  placeholder="Ví dụ: Phiếu đọc thêm"
                  {...form.register(`referenceDocuments.${index}.title`)}
                />

                <div>
                  <FieldLabel id={fileInputId} label={`File tài liệu ${displayIndex}`} />
                  {isExisting ? (
                    <div className="mt-2 flex min-h-[3.35rem] items-center gap-3 rounded-xl border border-[var(--theme-input-border)] bg-[var(--theme-input-bg-disabled)] px-4 text-sm font-semibold text-[var(--theme-input-text-disabled)] opacity-70">
                      <FilePlus2 className="h-5 w-5 shrink-0 text-[var(--theme-text-muted)]" />
                      <span className="min-w-0 truncate">{originalName ?? "Tài liệu gốc"}</span>
                    </div>
                  ) : (
                    <label
                      htmlFor={fileInputId}
                      data-testid={`lesson-reference-file-control-${displayIndex}`}
                      className={cn(
                        "mt-2 flex min-h-[3.35rem] cursor-pointer items-center gap-3 rounded-xl border border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] px-4 text-sm font-extrabold text-[var(--theme-text-strong)] transition hover:border-[var(--theme-input-hover-border)]",
                        isDisabled &&
                          "cursor-not-allowed bg-[var(--theme-input-bg-disabled)] text-[var(--theme-input-text-disabled)] opacity-70",
                      )}
                    >
                      <Upload className="h-5 w-5 shrink-0 text-[var(--theme-text-muted)]" />
                      <span className="min-w-0 truncate">
                        {selectedFile?.name ?? "Chọn file PDF"}
                      </span>
                      <input
                        id={fileInputId}
                        type="file"
                        accept="application/pdf"
                        aria-label={`File tài liệu ${displayIndex}`}
                        disabled={isDisabled}
                        className="hidden"
                        onChange={(event) => {
                          form.setValue(
                            `referenceDocuments.${index}.file`,
                            event.target.files?.[0] ?? null,
                            {
                              shouldDirty: true,
                              shouldValidate: true,
                            },
                          );
                        }}
                      />
                    </label>
                  )}
                  {fileError ? (
                    <p className="mt-1.5 text-sm leading-5 text-[var(--theme-error-text)]">
                      {fileError.message}
                    </p>
                  ) : null}
                </div>

                <button
                  type="button"
                  aria-label={`Xóa tài liệu ${displayIndex}`}
                  disabled={isDisabled}
                  onClick={() => remove(index)}
                  className="theme-button-danger-subtle inline-flex h-10 w-10 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-60 lg:mt-[34px]"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
