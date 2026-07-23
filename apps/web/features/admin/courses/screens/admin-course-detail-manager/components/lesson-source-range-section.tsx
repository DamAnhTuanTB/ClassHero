"use client";

import { BookOpenText, FilePlus2, ScanText } from "lucide-react";
import type { UseFieldArrayReturn, UseFormReturn } from "react-hook-form";
import { FieldLabel } from "@/components/common/forms/field-label";
import type { LessonFormValues } from "@/features/admin/courses/admin-courses-schemas";
import { LessonDocumentUploadRow } from "@/features/admin/courses/screens/admin-course-detail-manager/components/lesson-document-upload-row";
import { LessonSourceExtractionBlock } from "@/features/admin/courses/screens/admin-course-detail-manager/components/lesson-source-extraction-block";
import type {
  AdminSourceDocumentApi,
  AdminSourceDocumentPageApi,
} from "@/features/admin/courses/types/admin-course-document-types";

export function LessonSourceRangeSection({
  disabled,
  form,
  isSaving,
  sourceDocuments,
  sourcePagesByDocumentId,
  extractionFieldArray,
  documentFieldArray,
}: {
  disabled: boolean;
  form: UseFormReturn<LessonFormValues>;
  isSaving: boolean;
  sourceDocuments: AdminSourceDocumentApi[];
  sourcePagesByDocumentId: Record<string, AdminSourceDocumentPageApi[]>;
  extractionFieldArray: UseFieldArrayReturn<
    LessonFormValues,
    "sourceDocumentExtractions",
    "id"
  >;
  documentFieldArray: UseFieldArrayReturn<
    LessonFormValues,
    "referenceDocuments",
    "id"
  >;
}) {
  const { append, fields, remove } = documentFieldArray;
  const {
    append: appendExtraction,
    fields: extractionFields,
    remove: removeExtraction,
  } = extractionFieldArray;
  const foundationDocumentOrder = form.watch("foundationDocumentOrder") ?? [];
  const referenceDocuments = form.watch("referenceDocuments");
  const extractions = form.watch("sourceDocumentExtractions");
  const isDisabled = disabled || isSaving;
  const primaryUploadFields = fields.flatMap((field, index) => {
    const document = referenceDocuments[index];
    if (document?.type !== "PRIMARY_FROM_SOURCE") {
      return [];
    }

    const clientKey = document.clientKey ?? document.id ?? field.id;
    return [{ clientKey, field, index }];
  });
  const foundationDocumentCount =
    extractionFields.length + primaryUploadFields.length;

  function setFoundationOrder(order: string[]) {
    form.setValue("foundationDocumentOrder", order, {
      shouldDirty: true,
      shouldValidate: false,
    });
  }

  function addExtraction() {
    const clientKey = crypto.randomUUID();
    const index = extractionFields.length;
    appendExtraction(
      {
        clientKey,
        sourceDocumentId: sourceDocuments[0]?.id ?? "",
        pageStart: "",
        pageEnd: "",
        hasInteracted: false,
      },
      { shouldFocus: false },
    );
    setFoundationOrder([
      ...foundationDocumentOrder,
      `EXTRACTION:${clientKey}`,
    ]);
    requestAnimationFrame(() => {
      form.clearErrors(`sourceDocumentExtractions.${index}`);
    });
  }

  function addFoundationDocument() {
    const clientKey = crypto.randomUUID();
    const newIndex = referenceDocuments.length;
    append(
      {
        clientKey,
        file: null,
        title: "",
        type: "PRIMARY_FROM_SOURCE",
      },
      { shouldFocus: false },
    );
    setFoundationOrder([...foundationDocumentOrder, `UPLOAD:${clientKey}`]);
    requestAnimationFrame(() => {
      form.clearErrors([
        `referenceDocuments.${newIndex}.title`,
        `referenceDocuments.${newIndex}.file`,
      ]);
    });
  }

  return (
    <section
      data-testid="lesson-foundation-documents-section"
      className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-3"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="theme-button-primary-subtle grid h-9 w-9 shrink-0 place-items-center rounded-lg">
            <BookOpenText className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="flex min-w-0 items-center gap-2">
            <FieldLabel
              id="admin-lesson-source-range"
              label="Tài liệu nền tảng"
              isOptional
            />
            <span
              data-testid="foundation-document-count"
              aria-label={`${foundationDocumentCount} tài liệu nền tảng`}
              className="inline-flex min-w-6 shrink-0 items-center justify-center rounded-full bg-[var(--theme-surface)] px-2 py-0.5 text-xs font-extrabold tabular-nums text-[var(--theme-text-muted)]"
            >
              {foundationDocumentCount}
            </span>
          </div>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          <button
            type="button"
            data-testid="add-foundation-extraction"
            disabled={isDisabled}
            onClick={addExtraction}
            className="theme-button-neutral inline-flex min-h-10 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-xs font-extrabold transition disabled:cursor-not-allowed disabled:opacity-60 sm:px-3 sm:text-sm"
          >
            <ScanText className="h-4 w-4 shrink-0" aria-hidden="true" />
            Thêm trích xuất
          </button>
          <button
            type="button"
            data-testid="add-foundation-document"
            disabled={isDisabled}
            onClick={addFoundationDocument}
            className="theme-button-neutral inline-flex min-h-10 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-xs font-extrabold transition disabled:cursor-not-allowed disabled:opacity-60 sm:px-3 sm:text-sm"
          >
            <FilePlus2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            Thêm tài liệu
          </button>
        </div>
      </div>

      {sourceDocuments.length === 0 && extractionFields.length > 0 ? (
        <p className="mt-3 rounded-lg border border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] px-3 py-2 text-sm font-bold text-[var(--theme-warning-text)]">
          Chưa có tài liệu nguồn sẵn sàng. Hãy hoàn tất xử lý và xác nhận tất cả
          số trang in ở trang chi tiết khóa học trước khi nhập khoảng trang.
        </p>
      ) : null}

      <div className="mt-3 flex flex-col gap-3">
        {extractionFields.map((field, index) => {
          const extraction = extractions[index];
          const clientKey = extraction?.clientKey ?? field.clientKey ?? field.id;
          const explicitOrder = foundationDocumentOrder.indexOf(
            `EXTRACTION:${clientKey}`,
          );

          return (
            <div
              key={field.id}
              data-testid="foundation-extraction-item"
              style={{
                order:
                  explicitOrder >= 0
                    ? explicitOrder
                    : foundationDocumentOrder.length + index,
              }}
            >
              <LessonSourceExtractionBlock
                disabled={isDisabled}
                form={form}
                index={index}
                sourceDocuments={sourceDocuments}
                sourcePagesByDocumentId={sourcePagesByDocumentId}
                onRemove={() => {
                  removeExtraction(index);
                  setFoundationOrder(
                    foundationDocumentOrder.filter(
                      (item) => item !== `EXTRACTION:${clientKey}`,
                    ),
                  );
                }}
              />
            </div>
          );
        })}

        {primaryUploadFields.map(({ clientKey, field, index }, fallbackIndex) => {
          const explicitOrder = foundationDocumentOrder.indexOf(
            `UPLOAD:${clientKey}`,
          );
          return (
            <div
              key={field.id}
              data-testid="foundation-upload-item"
              style={{
                order:
                  explicitOrder >= 0
                    ? explicitOrder
                    : foundationDocumentOrder.length + fallbackIndex,
              }}
            >
              <LessonDocumentUploadRow
                disabled={isDisabled}
                field={field}
                form={form}
                index={index}
                onRemove={() => {
                  remove(index);
                  setFoundationOrder(
                    foundationDocumentOrder.filter(
                      (item) => item !== `UPLOAD:${clientKey}`,
                    ),
                  );
                }}
                placeholder="Ví dụ: Tài liệu nền tảng mở rộng"
              />
            </div>
          );
        })}

        {extractionFields.length === 0 && primaryUploadFields.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--theme-border-strong)] bg-[var(--theme-surface)] px-3 py-4 text-sm font-semibold text-[var(--theme-text-muted)]">
            Chưa thêm tài liệu nền tảng.
          </div>
        ) : null}
      </div>
    </section>
  );
}
