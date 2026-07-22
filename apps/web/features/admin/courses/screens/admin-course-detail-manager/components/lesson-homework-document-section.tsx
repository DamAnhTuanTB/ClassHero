"use client";

import { FilePlus2, Trash2, Upload, Eye } from "lucide-react";
import { DocumentStatusBadge } from "@/features/admin/courses/screens/admin-course-detail-manager/components/document-status-badge";
import { useFieldArray, type UseFormReturn } from "react-hook-form";
import { FieldLabel } from "@/components/common/forms/field-label";
import { TextField } from "@/components/common/forms/text-field";
import type { LessonFormValues } from "@/features/admin/courses/admin-courses-schemas";
import { cn } from "@/lib/utils";

export function LessonHomeworkDocumentSection({
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
  const homeworkCount = form
    .watch("referenceDocuments")
    .filter((d) => d.type === "HOMEWORK").length;
  const canAddMore = homeworkCount < 1;

  return (
    <section
      data-testid="lesson-reference-documents-section"
      className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-3"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="theme-button-primary-subtle grid h-9 w-9 shrink-0 place-items-center rounded-lg">
            <FilePlus2 className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <FieldLabel
              id="admin-lesson-reference-documents"
              label="Bài tập về nhà"
              isOptional
            />
          </div>
        </div>
        <button
          type="button"
          disabled={isDisabled || !canAddMore}
          onClick={() => {
            append({ file: null, title: "", type: "HOMEWORK" });
            setTimeout(() => form.trigger(`referenceDocuments`), 0);
          }}
          className="theme-button-neutral inline-flex min-h-10 w-full shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-sm font-extrabold transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          <FilePlus2 className="h-4 w-4" aria-hidden="true" />
          Thêm tài liệu
        </button>
      </div>

      {homeworkCount === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-[var(--theme-border-strong)] bg-[var(--theme-surface)] px-3 py-4 text-sm font-semibold text-[var(--theme-text-muted)]">
          Chưa thêm bài tập về nhà.
        </div>
      ) : (
        <div className="mt-3 grid gap-3">
          {fields.map((field, index) => {
            if (form.getValues(`referenceDocuments.${index}.type`) !== "HOMEWORK") {
              return null;
            }
            const displayIndex = index + 1;
            const fileInputId = `admin-lesson-reference-file-${field.id}`;
            const selectedFile = form.watch(`referenceDocuments.${index}.file`) ?? null;
            const fileError = form.formState.errors.referenceDocuments?.[index]?.file;

            const isExisting = Boolean(form.watch(`referenceDocuments.${index}.id`));
            const originalName = form.watch(
              `referenceDocuments.${index}.originalName`,
            ) as string | undefined;
            const docStatus = form.watch(`referenceDocuments.${index}.status`) as
              string | undefined;
            const docProgress = form.watch(`referenceDocuments.${index}.progress`) as
              number | undefined;

            return (
              <div
                key={field.id}
                className="grid gap-3 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-3 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,0.85fr)_auto]"
              >
                <TextField
                  id={`admin-lesson-reference-title-${field.id}`}
                  label="Tên tài liệu"
                  icon={null}
                  disabled={isDisabled}
                  readOnly={isExisting}
                  title={form.watch(`referenceDocuments.${index}.title`)}
                  error={form.formState.errors.referenceDocuments?.[index]?.title}
                  placeholder="Ví dụ: Bài tập trắc nghiệm chương 1"
                  {...form.register(`referenceDocuments.${index}.title`)}
                />

                <div className="min-w-0">
                  <FieldLabel id={fileInputId} label="File tài liệu" />
                  {isExisting ? (
                    <div className="mt-2 flex min-h-[3.35rem] flex-1 items-center gap-3 rounded-xl border border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] px-4 text-sm font-semibold text-[var(--theme-text-strong)] hover:border-[var(--theme-input-hover-border)] transition">
                      <FilePlus2 className="h-5 w-5 shrink-0 text-[var(--theme-text-muted)]" />
                      <span
                        className="min-w-0 truncate"
                        title={originalName ?? "Tài liệu gốc"}
                      >
                        {originalName ?? "Tài liệu gốc"}
                      </span>
                      {docStatus && (
                        <div className="ml-auto flex shrink-0 items-center">
                          <DocumentStatusBadge
                            status={docStatus as any}
                            progress={docProgress}
                          />
                        </div>
                      )}
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
                        aria-label="File tài liệu"
                        disabled={isDisabled}
                        className="hidden"
                        name={form.register(`referenceDocuments.${index}.file`).name}
                        ref={form.register(`referenceDocuments.${index}.file`).ref}
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

                <div className="flex items-center gap-2 lg:mt-[34px]">
                  <button
                    type="button"
                    aria-label="Xem tài liệu"
                    disabled={!field.url && !selectedFile}
                    onClick={() => {
                      if (field.url) {
                        window.open(field.url as string, "_blank");
                      } else if (selectedFile) {
                        const objectUrl = URL.createObjectURL(selectedFile as File);
                        window.open(objectUrl, "_blank");
                      }
                    }}
                    className="theme-button-neutral inline-flex h-10 w-10 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label="Xóa tài liệu"
                    disabled={isDisabled}
                    onClick={() => remove(index)}
                    className="theme-button-danger-subtle inline-flex h-10 w-10 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
