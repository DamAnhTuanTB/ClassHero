"use client";

import { Eye, FilePlus2, Trash2, Upload } from "lucide-react";
import type {
  FieldArrayWithId,
  UseFormReturn,
} from "react-hook-form";
import { FieldLabel } from "@/components/common/forms/field-label";
import { TextField } from "@/components/common/forms/text-field";
import type { LessonFormValues } from "@/features/admin/courses/admin-courses-schemas";
import { DocumentStatusBadge } from "@/features/admin/courses/screens/admin-course-detail-manager/components/document-status-badge";
import type { AdminDocumentStatus } from "@/features/admin/courses/types/admin-course-document-types";
import { cn } from "@/lib/utils";

export function LessonDocumentUploadRow({
  disabled,
  field,
  form,
  index,
  onRemove,
  placeholder,
}: {
  disabled: boolean;
  field: FieldArrayWithId<LessonFormValues, "referenceDocuments", "id">;
  form: UseFormReturn<LessonFormValues>;
  index: number;
  onRemove: () => void;
  placeholder: string;
}) {
  const fileInputId = `admin-lesson-reference-file-${field.id}`;
  const selectedFile = form.watch(`referenceDocuments.${index}.file`) ?? null;
  const fileError = form.formState.errors.referenceDocuments?.[index]?.file;
  const isExisting = Boolean(form.watch(`referenceDocuments.${index}.id`));
  const originalName = form.watch(
    `referenceDocuments.${index}.originalName`,
  ) as string | undefined;
  const documentUrl = form.watch(`referenceDocuments.${index}.url`);
  const documentStatus = form.watch(
    `referenceDocuments.${index}.status`,
  ) as AdminDocumentStatus | undefined;
  const documentProgress = form.watch(
    `referenceDocuments.${index}.progress`,
  ) as number | undefined;

  return (
    <div className="grid gap-3 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-3 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,0.85fr)_auto]">
      <TextField
        id={`admin-lesson-reference-title-${field.id}`}
        label="Tên tài liệu"
        icon={null}
        disabled={disabled}
        readOnly={isExisting}
        title={form.watch(`referenceDocuments.${index}.title`)}
        error={form.formState.errors.referenceDocuments?.[index]?.title}
        placeholder={placeholder}
        {...form.register(`referenceDocuments.${index}.title`)}
      />

      <div className="min-w-0">
        <FieldLabel id={fileInputId} label="File tài liệu" />
        {isExisting ? (
          <div className="mt-2 flex min-h-[3.35rem] items-center gap-3 rounded-xl border border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] px-4 text-sm font-semibold text-[var(--theme-text-strong)] transition hover:border-[var(--theme-input-hover-border)]">
            <FilePlus2 className="h-5 w-5 shrink-0 text-[var(--theme-text-muted)]" />
            <span className="min-w-0 truncate" title={originalName ?? "Tài liệu gốc"}>
              {originalName ?? "Tài liệu gốc"}
            </span>
            {documentStatus ? (
              <div className="ml-auto flex shrink-0 items-center">
                <DocumentStatusBadge
                  status={documentStatus}
                  progress={documentProgress}
                />
              </div>
            ) : null}
          </div>
        ) : (
          <label
            htmlFor={fileInputId}
            data-testid={`lesson-reference-file-control-${field.id}`}
            className={cn(
              "mt-2 flex min-h-[3.35rem] cursor-pointer items-center gap-3 rounded-xl border border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] px-4 text-sm font-extrabold text-[var(--theme-text-strong)] transition hover:border-[var(--theme-input-hover-border)]",
              disabled &&
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
              disabled={disabled}
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
                    shouldTouch: true,
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

      <div className="flex min-h-[3.35rem] items-center justify-end gap-2 lg:mt-7 lg:justify-start">
        <button
          type="button"
          aria-label="Xem tài liệu"
          disabled={!documentUrl && !selectedFile}
          onClick={() => {
            if (documentUrl) {
              window.open(documentUrl, "_blank");
              return;
            }

            if (selectedFile) {
              window.open(URL.createObjectURL(selectedFile), "_blank");
            }
          }}
          className="theme-button-neutral inline-flex h-10 w-10 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Eye className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Xóa tài liệu"
          disabled={disabled}
          onClick={onRemove}
          className="theme-button-danger-subtle inline-flex h-10 w-10 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
