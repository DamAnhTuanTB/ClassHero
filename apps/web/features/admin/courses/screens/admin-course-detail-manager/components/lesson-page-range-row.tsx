import { useState } from "react";
import { FilePlus2, FileText, Trash2, Upload, Maximize2, Minimize2 } from "lucide-react";
import {
  formatDocumentKind,
  formatFileSize,
  getLessonDocumentRange,
  getPdfPageFromPrintedPage,
  getPrimaryLessonDocument,
  getPrintedPageView,
  getSupplementLessonDocuments,
  type AdminLessonWithChapter,
  type LessonRangeDraft,
  type LessonRangeValidationIssue,
} from "@/features/admin/courses/admin-course-documents-utils";
import { DocumentStatusBadge } from "@/features/admin/courses/screens/admin-course-detail-manager/components/document-status-badge";
import type {
  AdminLessonDocumentApi,
  AdminSourceDocumentApi,
  AdminSourceDocumentPageApi,
} from "@/features/admin/courses/types/admin-course-document-types";
import { MathpixMarkdownRenderer } from "@/components/shared/mathpix-markdown-renderer";
import { PdfPagePreview } from "@/components/shared/pdf-page-preview";

export function LessonPageRangeRow({
  documents,
  draft,
  isDeletingSupplement,
  isSaving,
  issue,
  item,
  pages,
  sourceDocument,
  rangeSubmitAttempted,
  onDeleteSupplement,
  onOpenPrimaryUpload,
  onOpenSupplementUpload,
  onUpdateRange,
}: {
  documents: AdminLessonDocumentApi[];
  draft: LessonRangeDraft[string];
  isDeletingSupplement: boolean;
  isSaving: boolean;
  issue: LessonRangeValidationIssue | undefined;
  item: AdminLessonWithChapter;
  pages: AdminSourceDocumentPageApi[];
  sourceDocument: AdminSourceDocumentApi | null;
  rangeSubmitAttempted: boolean;
  onDeleteSupplement: (lessonId: string, documentId: string) => void;
  onOpenPrimaryUpload: (lessonId: string) => void;
  onOpenSupplementUpload: (lessonId: string) => void;
  onUpdateRange: (
    lessonId: string,
    field: "pageEnd" | "pageStart",
    value: string,
  ) => void;
}) {
  const primaryDocument = getPrimaryLessonDocument(documents);
  const supplements = getSupplementLessonDocuments(documents);
  const [isExpanded, setIsExpanded] = useState(false);
  const [previewMode, setPreviewMode] = useState<"ocr" | "pdf">("pdf");
  const savedRange = getLessonDocumentRange(primaryDocument);
  const pdfPageStart = getPdfPageFromPrintedPage(draft.pageStart, pages);
  const pdfPageEnd = getPdfPageFromPrintedPage(draft.pageEnd, pages);
  const previewPage = pdfPageStart !== null ? pages.find((page) => page.pageNumber === pdfPageStart) : null;
  const printedPage = previewPage ? getPrintedPageView(previewPage) : null;
  
  const previewPages =
    pdfPageStart !== null && pdfPageEnd !== null && pdfPageStart <= pdfPageEnd
      ? pages.filter(
          (page) =>
            page.pageNumber >= pdfPageStart && page.pageNumber <= pdfPageEnd,
        )
      : previewPage
        ? [previewPage]
        : [];
  const fullText = previewPages
    .map((page) => page.mathpixMarkdown ?? page.fullText ?? page.textPreview)
    .filter(Boolean)
    .join("\n\n");
  const hasMultiplePages = previewPages.length > 1 || (fullText && fullText.length > 200);

  return (
    <article
      data-testid={`lesson-document-row-${item.lesson.id}`}
      className="grid gap-3 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-3"
    >
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_7rem_7rem] xl:items-start">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase text-[var(--theme-text-muted)]">
            Chương {item.chapterOrder}
          </p>
          <h3 className="mt-1 text-sm font-extrabold leading-6 text-[var(--theme-text-strong)]">
            {item.lesson.title}
          </h3>
        </div>

        <label className="block">
          <span className="text-xs font-extrabold uppercase text-[var(--theme-text-muted)]">
            Từ trang
          </span>
          <input
            value={draft.pageStart}
            inputMode="text"
            disabled={isSaving}
            aria-label={`Trang bắt đầu ${item.lesson.title}`}
            onChange={(event) =>
              onUpdateRange(item.lesson.id, "pageStart", event.target.value)
            }
            className="mt-1 min-h-11 w-full rounded-lg border border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] px-3 text-sm font-extrabold text-[var(--theme-text-strong)] outline-none transition focus:border-[var(--theme-primary)] focus:ring-4 focus:ring-[var(--theme-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>

        <label className="block">
          <span className="text-xs font-extrabold uppercase text-[var(--theme-text-muted)]">
            Đến trang
          </span>
          <input
            value={draft.pageEnd}
            inputMode="text"
            disabled={isSaving}
            aria-label={`Trang kết thúc ${item.lesson.title}`}
            onChange={(event) =>
              onUpdateRange(item.lesson.id, "pageEnd", event.target.value)
            }
            className="mt-1 min-h-11 w-full rounded-lg border border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] px-3 text-sm font-extrabold text-[var(--theme-text-strong)] outline-none transition focus:border-[var(--theme-primary)] focus:ring-4 focus:ring-[var(--theme-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
      </div>

      <div className="min-w-0 rounded-lg bg-[var(--theme-surface-soft)] px-3 py-2 transition-all">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-extrabold uppercase text-[var(--theme-text-muted)]">
            Xem nhanh
          </p>
          <div className="flex items-center gap-3">
            {previewPages.length > 0 && (
              <div className="flex rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)]">
                <button
                  type="button"
                  onClick={() => setPreviewMode("ocr")}
                  className={`px-2.5 py-1 text-xs font-bold rounded-l-md transition-colors ${
                    previewMode === "ocr"
                      ? "bg-[var(--theme-primary)] text-white"
                      : "text-[var(--theme-text-muted)] hover:bg-[var(--theme-surface-soft)]"
                  }`}
                >
                  Nội dung OCR
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("pdf")}
                  className={`px-2.5 py-1 text-xs font-bold rounded-r-md transition-colors ${
                    previewMode === "pdf"
                      ? "bg-[var(--theme-primary)] text-white"
                      : "text-[var(--theme-text-muted)] hover:bg-[var(--theme-surface-soft)]"
                  }`}
                >
                  PDF gốc
                </button>
              </div>
            )}
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
        </div>
        <div
          className={`mx-auto mt-2 w-full max-w-3xl text-sm font-semibold leading-5 text-[var(--theme-text)] transition-all ${
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
                      {previewMode === "ocr" ? (
                        text ? <MathpixMarkdownRenderer content={text} /> : <p className="italic text-[var(--theme-text-muted)]">Không có nội dung</p>
                      ) : (
                        <div className="flex justify-center border border-[var(--theme-border)] rounded-md overflow-hidden bg-[var(--theme-surface-soft)]">
                          {sourceDocument?.file?.publicUrl ? (
                            <PdfPagePreview pdfUrl={sourceDocument.file.publicUrl} pageNumber={page.pageNumber} width={650} />
                          ) : (
                            <p className="p-4 italic text-[var(--theme-text-muted)]">Không tìm thấy file PDF</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              previewMode === "ocr" ? (
                <MathpixMarkdownRenderer content={fullText} />
              ) : (
                <div className="pointer-events-none py-2 opacity-50 flex items-center gap-2 italic text-[var(--theme-text-muted)]">
                  <span>Mở rộng để xem bản PDF chi tiết</span>
                </div>
              )
            )
          ) : (
            <p>
              {printedPage
                ? `Trang in ${printedPage.printedPageLabel ?? printedPage.printedPageNumber ?? "chưa rõ"}`
                : "Chưa có trang xem nhanh"}
            </p>
          )}
          {!isExpanded && fullText && previewMode === "ocr" && (
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-[var(--theme-surface-soft)] to-transparent" />
          )}
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-start">
        <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-extrabold uppercase text-[var(--theme-text-muted)]">
              Tài liệu chính
            </p>
            {primaryDocument ? (
              <DocumentStatusBadge
                jobStatus={primaryDocument.processingJob?.status}
                progress={primaryDocument.processingJob?.progress}
                status={primaryDocument.status}
              />
            ) : null}
          </div>
          {primaryDocument ? (
            <div className="mt-2">
              <p className="line-clamp-1 text-sm font-extrabold text-[var(--theme-text-strong)]">
                {primaryDocument.title ??
                  primaryDocument.sourceDocument?.title ??
                  primaryDocument.file.originalName}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm font-semibold text-[var(--theme-text-muted)]">
              Chưa có tài liệu chính
            </p>
          )}
        </div>

        <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-extrabold uppercase text-[var(--theme-text-muted)]">
              Tài liệu bổ sung
            </p>
            <span className="rounded-full bg-[var(--theme-surface)] px-2 py-1 text-xs font-extrabold text-[var(--theme-text-muted)]">
              {supplements.length}
            </span>
          </div>

          {supplements.length === 0 ? (
            <p className="mt-2 text-sm font-semibold text-[var(--theme-text-muted)]">
              Chưa có file bổ sung
            </p>
          ) : (
            <div className="mt-2 grid gap-2">
              {supplements.map((document) => (
                <div
                  key={document.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-[var(--theme-surface)] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm font-bold text-[var(--theme-text-strong)]">
                      {document.title ?? document.file.originalName}
                    </p>
                    <p className="text-xs font-bold text-[var(--theme-text-muted)]">
                      {formatFileSize(document.file.sizeBytes)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <DocumentStatusBadge
                      jobStatus={document.processingJob?.status}
                      progress={document.processingJob?.progress}
                      status={document.status}
                    />
                    <button
                      type="button"
                      disabled={isDeletingSupplement}
                      onClick={() => onDeleteSupplement(item.lesson.id, document.id)}
                      aria-label={`Xóa ${document.title ?? document.file.originalName}`}
                      className="theme-button-danger-subtle grid h-9 w-9 place-items-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row xl:flex-col">
          <button
            type="button"
            onClick={() => onOpenPrimaryUpload(item.lesson.id)}
            className="theme-button-primary-subtle inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-extrabold transition"
          >
            {primaryDocument ? (
              <Upload className="h-4 w-4" aria-hidden="true" />
            ) : (
              <FileText className="h-4 w-4" aria-hidden="true" />
            )}
            {primaryDocument ? "Thay tài liệu chính" : "Upload tài liệu chính"}
          </button>
          <button
            type="button"
            onClick={() => onOpenSupplementUpload(item.lesson.id)}
            className="theme-button-success inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-extrabold transition"
          >
            <FilePlus2 className="h-4 w-4" aria-hidden="true" />
            Thêm tài liệu bổ sung
          </button>
        </div>
      </div>

      {rangeSubmitAttempted && issue ? (
        <p className="rounded-lg border border-[var(--theme-danger-border)] bg-[var(--theme-danger-soft)] px-3 py-2 text-sm font-bold text-[var(--theme-danger)]">
          {issue.message}
        </p>
      ) : null}
    </article>
  );
}
