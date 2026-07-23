"use client";

import { Maximize2, Minimize2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { OptionField } from "@/components/common/forms/option-field";
import { TextField } from "@/components/common/forms/text-field";
import { MathpixMarkdownRenderer } from "@/components/shared/mathpix-markdown-renderer";
import { PdfPagePreview } from "@/components/shared/pdf-page-preview";
import {
  getPdfPageFromPrintedPage,
  getPrintedPageView,
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [previewMode, setPreviewMode] = useState<"ocr" | "pdf">("pdf");
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
    <div className="grid gap-3 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-3">
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
          setIsExpanded(false);
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

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <div className="min-w-0 max-sm:col-span-2">
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
        <div className="mt-7 flex min-h-[3.35rem] self-start items-center justify-end sm:justify-start">
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

      <div className="min-w-0 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-extrabold uppercase text-[var(--theme-text-muted)]">
              Xem nhanh
            </p>
            <p className="mt-1 text-sm font-extrabold text-[var(--theme-primary)]">
              {selectedSourceDocument?.title ??
                selectedSourceDocument?.file.originalName ??
                "Chưa chọn tài liệu nguồn"}
            </p>
          </div>
          {previewPages.length > 0 ? (
            <div className="flex items-center gap-2">
              <div className="flex rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)]">
                <button
                  type="button"
                  onClick={() => setPreviewMode("ocr")}
                  className={previewButtonClass(previewMode === "ocr", true)}
                >
                  Nội dung OCR
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("pdf")}
                  className={previewButtonClass(previewMode === "pdf", false)}
                >
                  PDF gốc
                </button>
              </div>
              <button
                type="button"
                onClick={() => setIsExpanded((current) => !current)}
                className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-xs font-bold text-[var(--theme-primary)] hover:bg-[var(--theme-surface-hover)]"
              >
                {isExpanded ? (
                  <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {isExpanded ? "Thu gọn" : "Mở rộng"}
              </button>
            </div>
          ) : null}
        </div>

        {isExpanded && previewPages.length > 0 ? (
          <div className="mt-3 max-h-[32rem] overflow-y-auto rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)] p-3">
            {previewPages.map((page, pageIndex) => {
              const printed = getPrintedPageView(page);
              const content = page.mathpixMarkdown ?? page.fullText ?? page.textPreview;
              return (
                <div
                  key={page.id}
                  className={
                    pageIndex > 0 ? "mt-4 border-t border-[var(--theme-border)] pt-4" : ""
                  }
                >
                  <p className="mb-2 text-xs font-bold text-[var(--theme-text-muted)]">
                    Trang PDF {page.pageNumber}
                    {printed.printedPageLabel
                      ? ` (Trang in: ${printed.printedPageLabel})`
                      : ""}
                  </p>
                  {previewMode === "ocr" ? (
                    content ? (
                      <MathpixMarkdownRenderer content={content} />
                    ) : (
                      <p className="italic text-[var(--theme-text-muted)]">
                        Không có nội dung OCR.
                      </p>
                    )
                  ) : selectedSourceDocument?.file.publicUrl ? (
                    <div className="overflow-x-auto rounded-md bg-[var(--theme-surface-soft)] text-center">
                      <PdfPagePreview
                        pdfUrl={selectedSourceDocument.file.publicUrl}
                        pageNumber={page.pageNumber}
                        width={650}
                      />
                    </div>
                  ) : (
                    <p className="italic text-[var(--theme-text-muted)]">
                      Không tìm thấy file PDF.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-2 text-sm font-semibold text-[var(--theme-text-muted)]">
            {previewPages.length > 0
              ? "Mở rộng để xem nội dung chi tiết."
              : "Nhập khoảng trang để xem nhanh."}
          </p>
        )}

        {rangeWarning ? (
          <p className="mt-2 text-sm font-bold text-[var(--theme-danger)]">
            {rangeWarning}
          </p>
        ) : null}
      </div>
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

function previewButtonClass(active: boolean, isFirst: boolean) {
  return [
    "px-2.5 py-1 text-xs font-bold transition-colors",
    isFirst ? "rounded-l-md" : "rounded-r-md",
    active
      ? "bg-[var(--theme-primary)] text-white"
      : "text-[var(--theme-text-muted)] hover:bg-[var(--theme-surface-soft)]",
  ].join(" ");
}
