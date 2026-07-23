"use client";

import { Maximize2, Minimize2 } from "lucide-react";
import { useState } from "react";
import { MathpixMarkdownRenderer } from "@/components/shared/mathpix-markdown-renderer";
import { PdfPagePreview } from "@/components/shared/pdf-page-preview";
import { getPrintedPageView } from "@/features/admin/courses/admin-course-documents-utils";
import type {
  AdminSourceDocumentApi,
  AdminSourceDocumentPageApi,
} from "@/features/admin/courses/types/admin-course-document-types";

export function SourceDocumentRangePreview({
  pages,
  sourceDocument,
  warning,
}: {
  pages: AdminSourceDocumentPageApi[];
  sourceDocument: AdminSourceDocumentApi | null;
  warning?: string | null;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [previewMode, setPreviewMode] = useState<"ocr" | "pdf">("pdf");

  return (
    <div className="min-w-0 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-extrabold uppercase text-[var(--theme-text-muted)]">
            Xem nhanh
          </p>
          <p className="mt-1 text-sm font-extrabold text-[var(--theme-primary)]">
            {sourceDocument?.title ??
              sourceDocument?.file.originalName ??
              "Chưa chọn tài liệu nguồn"}
          </p>
        </div>
        {pages.length > 0 ? (
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

      {isExpanded && pages.length > 0 ? (
        <div className="mt-3 max-h-[32rem] overflow-y-auto rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)] p-3">
          {pages.map((page, pageIndex) => {
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
                ) : sourceDocument?.file.publicUrl ? (
                  <div className="overflow-x-auto rounded-md bg-[var(--theme-surface-soft)] text-center">
                    <PdfPagePreview
                      pdfUrl={sourceDocument.file.publicUrl}
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
          {pages.length > 0
            ? "Mở rộng để xem nội dung chi tiết."
            : "Nhập khoảng trang để xem nhanh."}
        </p>
      )}

      {warning ? (
        <p className="mt-2 text-sm font-bold text-[var(--theme-danger)]">{warning}</p>
      ) : null}
    </div>
  );
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
