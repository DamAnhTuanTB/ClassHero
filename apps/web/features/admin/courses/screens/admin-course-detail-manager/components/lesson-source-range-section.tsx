"use client";

import { useState } from "react";
import { FileText, Layers3, Maximize2, Minimize2 } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { FieldLabel } from "@/components/common/forms/field-label";
import { OptionField } from "@/components/common/forms/option-field";
import { TextField } from "@/components/common/forms/text-field";
import type { LessonFormValues } from "@/features/admin/courses/admin-courses-schemas";
import { getPrintedPageView } from "@/features/admin/courses/admin-course-documents-utils";
import {
  AdminSourceDocumentApi,
  AdminSourceDocumentPageApi,
} from "@/features/admin/courses/types/admin-course-document-types";
import { getPdfPageFromPrintedPage } from "@/features/admin/courses/admin-course-documents-utils";
import { MathpixMarkdownRenderer } from "@/components/shared/mathpix-markdown-renderer";

export function LessonSourceRangeSection({
  disabled,
  form,
  isSaving,
  isRangeReady,
  pageLimit,
  pages,
  rangeDisabledReason,
  selectedSourceDocument,
  sourceDocuments,
  onSelectSourceDocument,
}: {
  disabled: boolean;
  form: UseFormReturn<LessonFormValues>;
  isSaving: boolean;
  isRangeReady: boolean;
  pageLimit: number | null;
  pages: AdminSourceDocumentPageApi[];
  rangeDisabledReason: string;
  selectedSourceDocument: AdminSourceDocumentApi | null;
  sourceDocuments: AdminSourceDocumentApi[];
  onSelectSourceDocument: (sourceDocumentId: string | null) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const sourceDocumentId = form.watch("sourceDocumentPageRange.sourceDocumentId") ?? "";
  const pageStart = form.watch("sourceDocumentPageRange.pageStart") ?? "";
  const pageEnd = form.watch("sourceDocumentPageRange.pageEnd") ?? "";
  const pageStartNumber = getPdfPageFromPrintedPage(pageStart, pages);
  const pageEndNumber = getPdfPageFromPrintedPage(pageEnd, pages);
  const previewPage = pageStartNumber !== null
    ? pages.find((page) => page.pageNumber === pageStartNumber)
    : null;
    
  const previewPages =
    pageStartNumber !== null && pageEndNumber !== null && pageStartNumber <= pageEndNumber
      ? pages.filter(
          (page) =>
            page.pageNumber >= pageStartNumber && page.pageNumber <= pageEndNumber,
        )
      : previewPage
        ? [previewPage]
        : [];
  const fullText = previewPages
    .map((page) => page.mathpixMarkdown ?? page.fullText ?? page.textPreview)
    .filter(Boolean)
    .join("\n\n");
  const hasMultiplePages = previewPages.length > 1 || (fullText && fullText.length > 200);
  const printedPage = previewPage ? getPrintedPageView(previewPage) : null;
  const selectedTitle =
    selectedSourceDocument?.title ??
    selectedSourceDocument?.file.originalName ??
    "Tài liệu nguồn";
  const rangeWarning =
    pageLimit && pageEndNumber !== null && pageEndNumber > pageLimit
      ? `Tài liệu chỉ có ${pageLimit} trang.`
      : null;
  const isRangeInputDisabled = disabled || isSaving || !isRangeReady;
  const isSourceSelectDisabled = disabled || isSaving;

  return (
    <section className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-3">
      <div className="flex items-start gap-3">
        <span className="theme-button-primary-subtle mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg">
          <FileText className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <FieldLabel id="admin-lesson-source-range" label="Khoảng trang" isOptional />
          <p className="mt-1 text-sm font-semibold leading-5 text-[var(--theme-text-muted)]">
            Bỏ trống nếu chỉ tạo thông tin buổi học.
          </p>
        </div>
      </div>

      {sourceDocuments.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-[var(--theme-border-strong)] bg-[var(--theme-surface)] px-3 py-4 text-sm font-semibold text-[var(--theme-text-muted)]">
          Chưa có tài liệu nguồn.
        </div>
      ) : (
        <div className="mt-3 grid gap-3">
          {!isRangeReady ? (
            <p className="rounded-lg border border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] px-3 py-2 text-sm font-bold text-[var(--theme-warning-text)]">
              {rangeDisabledReason}
            </p>
          ) : null}
          <OptionField
            id="admin-lesson-source-document"
            label="Tài liệu nguồn"
            value={sourceDocumentId || selectedSourceDocument?.id || ""}
            disabled={isSourceSelectDisabled}
            icon={<Layers3 className="h-5 w-5" aria-hidden="true" />}
            options={sourceDocuments.map((document) => ({
              value: document.id,
              label: document.title ?? document.file.originalName,
            }))}
            error={form.formState.errors.sourceDocumentPageRange?.sourceDocumentId}
            onChange={(value) => {
              form.setValue("sourceDocumentPageRange.sourceDocumentId", value, {
                shouldDirty: true,
                shouldValidate: true,
              });
              onSelectSourceDocument(value || null);
            }}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              id="admin-lesson-page-start"
              label="Từ trang"
              inputMode="text"
              disabled={isRangeInputDisabled}
              icon={null}
              error={form.formState.errors.sourceDocumentPageRange?.pageStart}
              {...form.register("sourceDocumentPageRange.pageStart")}
            />
            <TextField
              id="admin-lesson-page-end"
              label="Đến trang"
              inputMode="text"
              disabled={isRangeInputDisabled}
              icon={null}
              error={form.formState.errors.sourceDocumentPageRange?.pageEnd}
              {...form.register("sourceDocumentPageRange.pageEnd")}
            />
          </div>

          <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-3 transition-all">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-extrabold uppercase text-[var(--theme-text-muted)]">
                Xem nhanh
              </p>
              {hasMultiplePages && (
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-bold text-[var(--theme-primary)] hover:bg-[var(--theme-surface-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]"
                >
                  {isExpanded ? (
                    <>
                      <Minimize2 className="h-3.5 w-3.5" />
                      Thu gọn
                    </>
                  ) : (
                    <>
                      <Maximize2 className="h-3.5 w-3.5" />
                      Mở rộng
                    </>
                  )}
                </button>
              )}
            </div>
            <p className="mt-1 text-sm font-extrabold text-[var(--theme-primary)]">
              {selectedTitle}
            </p>
            <div
              className={`mt-2 w-full max-w-3xl text-sm font-semibold leading-5 text-[var(--theme-text)] transition-all ${
                isExpanded
                  ? "max-h-[500px] overflow-y-auto whitespace-normal rounded-md border border-[var(--theme-border)] bg-white p-3 sm:p-6 lg:p-8 shadow-sm"
                  : "max-h-[60px] overflow-hidden relative"
              }`}
            >
              {previewPages.length > 0 ? (
                isExpanded ? (
                  <div className="flex flex-col gap-4">
                    {previewPages.map((page, index) => {
                      const text = page.mathpixMarkdown ?? page.fullText ?? page.textPreview;
                      const printed = getPrintedPageView(page);
                      return (
                        <div key={page.id} className={index > 0 ? "border-t border-[var(--theme-border-strong)] pt-4" : ""}>
                          <div className="mb-2 text-xs font-bold text-[var(--theme-text-muted)]">
                            Trang PDF {page.pageNumber} {printed.printedPageLabel ? `(Trang in: ${printed.printedPageLabel})` : ""}
                          </div>
                          {text ? <MathpixMarkdownRenderer content={text} /> : <p className="italic text-[var(--theme-text-muted)]">Không có nội dung</p>}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <MathpixMarkdownRenderer content={fullText} />
                )
              ) : (
                <p>
                  {printedPage
                    ? `Trang in ${printedPage.printedPageLabel ?? printedPage.printedPageNumber ?? "chưa rõ"}`
                    : "Nhập trang bắt đầu để xem nhanh."}
                </p>
              )}
              {!isExpanded && fullText && (
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white to-transparent" />
              )}
            </div>
            {rangeWarning ? (
              <p className="mt-2 text-sm font-bold text-[var(--theme-danger)]">
                {rangeWarning}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
