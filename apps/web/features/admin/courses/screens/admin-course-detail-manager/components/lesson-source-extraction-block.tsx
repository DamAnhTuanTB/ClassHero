"use client";

import { Trash2 } from "lucide-react";
import { useMemo } from "react";
import type { UseFormReturn } from "react-hook-form";
import { SourceDocumentRangePreview } from "@/components/admin/courses/source-document-range-preview";
import { OptionField } from "@/components/common/forms/option-field";
import { TextField } from "@/components/common/forms/text-field";
import {
  getPdfPageFromPrintedPage,
  getSourceDocumentPageLimit,
  getSourceDocumentRangeReadiness,
} from "@/features/admin/courses/admin-course-documents-utils";
import type { LessonFormValues } from "@/features/admin/courses/admin-courses-schemas";
import type {
  AdminSourceDocumentApi,
  AdminSourceDocumentPageApi,
} from "@/features/admin/courses/types/admin-course-document-types";
import { suggestLessonPageRange } from "@/features/admin/courses/utils/suggest-lesson-page-range";

export function LessonSourceExtractionBlock({
  disabled,
  form,
  index,
  sourceDocuments,
  sourcePagesByDocumentId,
  onRemove,
}: {
  disabled: boolean;
  form: UseFormReturn<LessonFormValues>;
  index: number;
  sourceDocuments: AdminSourceDocumentApi[];
  sourcePagesByDocumentId: Record<string, AdminSourceDocumentPageApi[]>;
  onRemove: () => void;
}) {
  const sourceDocumentId =
    form.watch(`sourceDocumentExtractions.${index}.sourceDocumentId`) ?? "";
  const pageStart = form.watch(`sourceDocumentExtractions.${index}.pageStart`) ?? "";
  const pageEnd = form.watch(`sourceDocumentExtractions.${index}.pageEnd`) ?? "";
  const lessonTitle = form.watch("title") ?? "";
  const selectedSourceDocument =
    sourceDocuments.find((document) => document.id === sourceDocumentId) ?? null;
  const pages = sourcePagesByDocumentId[sourceDocumentId] ?? [];
  const readiness = getSourceDocumentRangeReadiness(selectedSourceDocument, pages);
  const pageLimit = getSourceDocumentPageLimit(selectedSourceDocument, pages);
  const pageStartNumber = getPdfPageFromPrintedPage(pageStart, pages);
  const pageEndNumber = getPdfPageFromPrintedPage(pageEnd, pages);
  const previewPages =
    pageStartNumber !== null && pageEndNumber !== null && pageStartNumber <= pageEndNumber
      ? pages.filter(
          (page) =>
            page.pageNumber >= pageStartNumber && page.pageNumber <= pageEndNumber,
        )
      : pageStartNumber !== null
        ? pages.filter((page) => page.pageNumber === pageStartNumber)
        : [];
  const rangeWarning =
    pageLimit && pageEndNumber !== null && pageEndNumber > pageLimit
      ? `Tài liệu chỉ có ${pageLimit} trang.`
      : null;
  const suggestedRange = useMemo(
    () => suggestLessonPageRange(lessonTitle, pages),
    [lessonTitle, pages],
  );
  const startField = form.register(`sourceDocumentExtractions.${index}.pageStart`, {
    onChange: () => markInteractedAndValidate(form, index),
  });
  const endField = form.register(`sourceDocumentExtractions.${index}.pageEnd`, {
    onChange: () => markInteractedAndValidate(form, index),
  });
  const errors = form.formState.errors.sourceDocumentExtractions?.[index];
  const isRangeInputDisabled = disabled || !readiness.isReady;

  return (
    <div className="grid gap-3 sm:rounded-lg sm:border sm:border-[var(--theme-border)] sm:bg-[var(--theme-surface)] sm:p-3">
      <div className="flex items-center justify-between gap-3 sm:hidden">
        <p className="text-sm font-extrabold text-[var(--theme-text-strong)]">
          Khoảng trích xuất {index + 1}
        </p>
        <button
          type="button"
          aria-label={`Xóa khối trích xuất ${index + 1}`}
          disabled={disabled}
          onClick={onRemove}
          className="theme-button-danger-subtle inline-flex min-h-11 w-11 shrink-0 items-center justify-center rounded-xl transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Trash2 className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <OptionField
        id={`admin-lesson-extraction-source-${index}`}
        label="Tài liệu trích xuất"
        value={sourceDocumentId}
        options={sourceDocuments.map((document) => ({
          value: document.id,
          label: `${document.title ?? document.file.originalName} (${
            document.pageCount ?? sourcePagesByDocumentId[document.id]?.length ?? 0
          } trang)`,
        }))}
        error={errors?.sourceDocumentId}
        onChange={(value) => {
          const nextSourceDocumentId = String(value);
          if (nextSourceDocumentId === sourceDocumentId) {
            return;
          }

          form.setValue(
            `sourceDocumentExtractions.${index}.sourceDocumentId`,
            nextSourceDocumentId,
            {
              shouldDirty: true,
              shouldTouch: true,
              shouldValidate: false,
            },
          );
          form.setValue(`sourceDocumentExtractions.${index}.pageStart`, "", {
            shouldDirty: true,
            shouldTouch: false,
            shouldValidate: false,
          });
          form.setValue(`sourceDocumentExtractions.${index}.pageEnd`, "", {
            shouldDirty: true,
            shouldTouch: false,
            shouldValidate: false,
          });
          form.setValue(`sourceDocumentExtractions.${index}.hasInteracted`, false, {
            shouldDirty: true,
            shouldTouch: false,
            shouldValidate: false,
          });
          form.clearErrors(`sourceDocumentExtractions.${index}`);
        }}
        disabled={disabled || sourceDocuments.length === 0}
        icon={null}
      />

      {!readiness.isReady ? (
        <p className="rounded-lg border border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] px-3 py-2 text-sm font-bold text-[var(--theme-warning-text)]">
          {readiness.reason}
        </p>
      ) : null}

      {suggestedRange ? (
        <p className="text-xs font-semibold text-[var(--theme-text-muted)]">
          Gợi ý:{" "}
          <button
            type="button"
            className="font-extrabold text-[var(--theme-primary)] hover:underline"
            onClick={() => {
              form.setValue(
                `sourceDocumentExtractions.${index}.pageStart`,
                suggestedRange.start,
                { shouldDirty: true, shouldValidate: true },
              );
              form.setValue(
                `sourceDocumentExtractions.${index}.pageEnd`,
                suggestedRange.end,
                { shouldDirty: true, shouldValidate: true },
              );
              markInteractedAndValidate(form, index);
            }}
          >
            {suggestedRange.label}
          </button>
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:gap-3">
        <div className="min-w-0">
          <TextField
            id={`admin-lesson-page-start-${index}`}
            label="Từ trang in"
            inputMode="numeric"
            disabled={isRangeInputDisabled}
            icon={null}
            error={errors?.pageStart}
            {...startField}
          />
        </div>
        <TextField
          id={`admin-lesson-page-end-${index}`}
          label="Đến trang in"
          inputMode="numeric"
          disabled={isRangeInputDisabled}
          icon={null}
          error={errors?.pageEnd}
          {...endField}
        />
        <div className="mt-7 hidden min-h-[3.35rem] self-start items-center justify-start sm:flex">
          <button
            type="button"
            aria-label={`Xóa khối trích xuất ${index + 1}`}
            disabled={disabled}
            onClick={onRemove}
            className="theme-button-danger-subtle inline-flex min-h-11 w-11 shrink-0 items-center justify-center rounded-xl transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <SourceDocumentRangePreview
        pages={previewPages}
        sourceDocument={selectedSourceDocument}
        warning={rangeWarning}
      />
    </div>
  );
}

function markInteractedAndValidate(form: UseFormReturn<LessonFormValues>, index: number) {
  form.setValue(`sourceDocumentExtractions.${index}.hasInteracted`, true, {
    shouldDirty: true,
    shouldValidate: false,
  });
  requestAnimationFrame(() => {
    void form.trigger("sourceDocumentExtractions");
  });
}
