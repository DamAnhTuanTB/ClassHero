"use client";

import { FileText, Layers3 } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { FieldLabel } from "@/components/common/forms/field-label";
import { OptionField } from "@/components/common/forms/option-field";
import { TextField } from "@/components/common/forms/text-field";
import type { LessonFormValues } from "@/features/admin/courses/admin-courses-schemas";
import { getPrintedPageView } from "@/features/admin/courses/admin-course-documents-utils";
import type {
  AdminSourceDocumentApi,
  AdminSourceDocumentPageApi,
} from "@/features/admin/courses/types/admin-course-document-types";

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
  const sourceDocumentId = form.watch("sourceDocumentPageRange.sourceDocumentId") ?? "";
  const pageStart = form.watch("sourceDocumentPageRange.pageStart") ?? "";
  const pageEnd = form.watch("sourceDocumentPageRange.pageEnd") ?? "";
  const pageStartNumber = Number(pageStart);
  const previewPage = Number.isInteger(pageStartNumber)
    ? pages.find((page) => page.pageNumber === pageStartNumber)
    : null;
  const printedPage = previewPage ? getPrintedPageView(previewPage) : null;
  const selectedTitle =
    selectedSourceDocument?.title ??
    selectedSourceDocument?.file.originalName ??
    "Tài liệu nguồn";
  const rangeWarning =
    pageLimit && Number(pageEnd) > pageLimit
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
              inputMode="numeric"
              disabled={isRangeInputDisabled}
              icon={null}
              error={form.formState.errors.sourceDocumentPageRange?.pageStart}
              {...form.register("sourceDocumentPageRange.pageStart")}
            />
            <TextField
              id="admin-lesson-page-end"
              label="Đến trang"
              inputMode="numeric"
              disabled={isRangeInputDisabled}
              icon={null}
              error={form.formState.errors.sourceDocumentPageRange?.pageEnd}
              {...form.register("sourceDocumentPageRange.pageEnd")}
            />
          </div>

          <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-3">
            <p className="text-xs font-extrabold uppercase text-[var(--theme-text-muted)]">
              Xem nhanh
            </p>
            <p className="mt-1 text-sm font-extrabold text-[var(--theme-text-strong)]">
              {selectedTitle}
            </p>
            <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-[var(--theme-text)]">
              {previewPage?.textPreview ??
                (printedPage
                  ? `Trang in ${printedPage.printedPageLabel ?? printedPage.printedPageNumber ?? "chưa rõ"}`
                  : "Nhập trang bắt đầu để xem nhanh.")}
            </p>
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
