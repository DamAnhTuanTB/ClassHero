import { useState } from "react";
import {
  Maximize2,
  Minimize2,
  Plus,
  Trash2,
  FileText,
  FilePlus2,
  Upload,
  Eye,
} from "lucide-react";
import {
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
import { cn } from "@/lib/utils";
import { MathpixMarkdownRenderer } from "@/components/shared/mathpix-markdown-renderer";
import { PdfPagePreview } from "@/components/shared/pdf-page-preview";

export function LessonPageRangeRow({
  documents,
  draft,
  isDeletingSupplement,
  isSaving,
  issues,
  item,
  pages,
  sourceDocument,
  rangeSubmitAttempted,
  onDeleteSupplement,
  onUpdateRange,
}: {
  documents: AdminLessonDocumentApi[];
  draft: LessonRangeDraft[string];
  isDeletingSupplement: boolean;
  isSaving: boolean;
  issues: LessonRangeValidationIssue[];
  item: AdminLessonWithChapter;
  pages: AdminSourceDocumentPageApi[];
  sourceDocument: AdminSourceDocumentApi | null;
  rangeSubmitAttempted: boolean;
  onDeleteSupplement: (lessonId: string, documentId: string) => void;
  onUpdateRange: (
    lessonId: string,
    field:
      "pageEnd" | "pageStart" | "isPrimary" | "primarySupplementId" | "newSupplements",
    value:
      | string
      | boolean
      | null
      | { id: string; file: File | null; title: string; isPrimary?: boolean; type?: "SUPPLEMENT" | "HOMEWORK" }[],
  ) => void;
}) {
  const primaryDocument = getPrimaryLessonDocument(documents);
  const allSupplements = getSupplementLessonDocuments(documents);
  const supplements = allSupplements.filter((d) => d.kind === "SUPPLEMENT");
  const homeworks = allSupplements.filter((d) => d.kind === "HOMEWORK");

  const allNewSupplements = draft.newSupplements ?? [];
  const newSupplements = allNewSupplements.filter(
    (d) => d.type === "SUPPLEMENT" || !d.type,
  );
  const newHomeworks = allNewSupplements.filter((d) => d.type === "HOMEWORK");
  const [isExpanded, setIsExpanded] = useState(false);
  const [previewMode, setPreviewMode] = useState<"ocr" | "pdf">("pdf");
  const pdfPageStart = getPdfPageFromPrintedPage(draft.pageStart, pages);
  const pdfPageEnd = getPdfPageFromPrintedPage(draft.pageEnd, pages);
  const previewPage =
    pdfPageStart !== null ? pages.find((page) => page.pageNumber === pdfPageStart) : null;
  const printedPage = previewPage ? getPrintedPageView(previewPage) : null;

  const previewPages =
    pdfPageStart !== null && pdfPageEnd !== null && pdfPageStart <= pdfPageEnd
      ? pages.filter(
          (page) => page.pageNumber >= pdfPageStart && page.pageNumber <= pdfPageEnd,
        )
      : previewPage
        ? [previewPage]
        : [];
  const fullText = previewPages
    .map((page) => page.mathpixMarkdown ?? page.fullText ?? page.textPreview)
    .filter(Boolean)
    .join("\n\n");
  const hasMultiplePages = previewPages.length > 1 || (fullText && fullText.length > 200);

  const hasPageError = issues.some(
    (issue) =>
      issue.message.includes("trang") ||
      issue.message.includes("số nguyên dương")
  );

  const inputClass = cn(
    "mt-1 min-h-[2.75rem] w-full rounded-lg border bg-[var(--theme-surface)] px-3 text-sm font-semibold outline-none transition disabled:cursor-not-allowed disabled:opacity-60",
    hasPageError
      ? "border-[var(--theme-error-border)] focus:border-[var(--theme-error-border)] focus:ring-4 focus:ring-[var(--theme-error-ring)] text-[var(--theme-error-text)]"
      : "border-[var(--theme-input-border)] focus:border-[var(--theme-primary)] focus:ring-4 focus:ring-[var(--theme-focus-ring)] text-[var(--theme-text-strong)]"
  );

  return (
    <article
      data-testid={`lesson-document-row-${item.lesson.id}`}
      className="flex flex-col gap-4"
    >
      <div className="min-w-0 pt-2">
        <p className="text-xs font-extrabold uppercase text-[var(--theme-text-muted)]">
          Chương {item.chapterOrder}
        </p>
        <h3 className="mt-1 text-sm font-extrabold leading-tight text-[var(--theme-text-strong)]">
          {item.lesson.title}
        </h3>
      </div>

      <section className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-3">
        <div className="mb-4 flex items-center gap-2">
          <div className="theme-button-primary-subtle grid h-9 w-9 shrink-0 place-items-center rounded-lg">
            <FileText className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-[var(--theme-text-strong)]">
              Tài liệu nền tảng
            </h3>
          </div>
        </div>

        <p className="mb-4 text-sm font-medium text-[var(--theme-text-muted)]">
          Gợi ý: Nhập khoảng trang để hệ thống tự động trích xuất nội dung buổi học từ Tài
          liệu nguồn.
        </p>

        <div className="grid gap-3 xl:grid-cols-[1fr_1fr]">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-[var(--theme-text-muted)]">
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
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-bold text-[var(--theme-text-muted)]">
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
              className={inputClass}
            />
          </label>
        </div>

        <div className="mt-4 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-3 transition-all">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-extrabold uppercase text-[var(--theme-text-muted)]">
              Xem nhanh
            </p>
            <div className="flex items-center gap-2 sm:gap-3">
              {previewPages.length > 0 && (
                <div className="hidden overflow-hidden rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] sm:flex">
                  <button
                    type="button"
                    onClick={() => setPreviewMode("ocr")}
                    className={`min-h-9 min-w-[7.75rem] whitespace-nowrap px-4 py-1.5 text-center text-xs font-bold transition-colors lg:px-5 ${
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
                    className={`min-h-9 min-w-[6.5rem] whitespace-nowrap px-4 py-1.5 text-center text-xs font-bold transition-colors lg:px-5 ${
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
          {/* Mobile-only toggle row */}
          {previewPages.length > 0 && (
            <div className="mt-1.5 flex items-center justify-center gap-2 sm:hidden">
              <div className="flex overflow-hidden rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface-soft)]">
                <button
                  type="button"
                  onClick={() => setPreviewMode("ocr")}
                  className={`min-h-9 whitespace-nowrap px-3.5 py-1.5 text-xs font-bold transition-colors ${
                    previewMode === "ocr"
                      ? "bg-[var(--theme-primary)] text-white"
                      : "text-[var(--theme-text-muted)] hover:bg-[var(--theme-surface-hover)]"
                  }`}
                >
                  Nội dung OCR
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("pdf")}
                  className={`min-h-9 whitespace-nowrap px-3.5 py-1.5 text-xs font-bold transition-colors ${
                    previewMode === "pdf"
                      ? "bg-[var(--theme-primary)] text-white"
                      : "text-[var(--theme-text-muted)] hover:bg-[var(--theme-surface-hover)]"
                  }`}
                >
                  PDF gốc
                </button>
              </div>
            </div>
          )}
          {/* Compact hint when collapsed */}
          {!isExpanded && previewMode === "pdf" && (
            <p className="mt-1 text-xs italic text-[var(--theme-text-muted)]">
              Mở rộng để xem bản PDF chi tiết
            </p>
          )}
          {isExpanded && (
            <div className="mx-auto mt-2 w-full max-w-3xl max-h-[500px] overflow-y-auto whitespace-normal rounded-md border border-[var(--theme-border)] bg-white p-3 sm:p-6 lg:p-8 shadow-sm text-sm font-semibold leading-5 text-[var(--theme-text)] transition-all">
              {previewPages.length > 0 ? (
                <div className="flex flex-col gap-4">
                  {previewPages.map((page, index) => {
                    const text =
                      page.mathpixMarkdown ?? page.fullText ?? page.textPreview;
                    const printed = getPrintedPageView(page);
                    return (
                      <div
                        key={page.id}
                        className={
                          index > 0
                            ? "border-t border-[var(--theme-border-strong)] pt-4"
                            : ""
                        }
                      >
                        <div className="mb-2 text-xs font-bold text-[var(--theme-text-muted)]">
                          Trang PDF {page.pageNumber}{" "}
                          {printed.printedPageLabel
                            ? `(Trang in: ${printed.printedPageLabel})`
                            : ""}
                        </div>
                        {previewMode === "ocr" ? (
                          text ? (
                            <MathpixMarkdownRenderer content={text} />
                          ) : (
                            <p className="italic text-[var(--theme-text-muted)]">
                              Không có nội dung
                            </p>
                          )
                        ) : (
                          <div className="flex justify-center border border-[var(--theme-border)] rounded-md overflow-x-auto overflow-y-hidden bg-[var(--theme-surface-soft)] text-center">
                            {sourceDocument?.file?.publicUrl ? (
                              <div className="inline-block align-top">
                                <PdfPagePreview
                                  pdfUrl={sourceDocument.file.publicUrl}
                                  pageNumber={page.pageNumber}
                                  width={650}
                                />
                              </div>
                            ) : (
                              <p className="p-4 italic text-[var(--theme-text-muted)]">
                                Không tìm thấy file PDF
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p>
                  {printedPage
                    ? `Trang in ${printedPage.printedPageLabel ?? printedPage.printedPageNumber ?? "chưa rõ"}`
                    : "Chưa có trang xem nhanh"}
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-3">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="theme-button-primary-subtle grid h-9 w-9 shrink-0 place-items-center rounded-lg">
              <FilePlus2 className="h-4 w-4" aria-hidden="true" />
            </div>
            <h3 className="text-sm font-extrabold text-[var(--theme-text-strong)]">
              Tài liệu bổ sung
            </h3>
            <span className="rounded-full bg-[var(--theme-surface)] px-2 py-0.5 text-xs font-extrabold text-[var(--theme-text-muted)]">
              {supplements.length}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              onUpdateRange(item.lesson.id, "newSupplements", [
                ...allNewSupplements,
                { id: crypto.randomUUID(), file: null, title: "", type: "SUPPLEMENT" },
              ]);
            }}
            disabled={isSaving}
            className="theme-button-neutral inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-extrabold transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />
            Thêm tài liệu
          </button>
        </div>

        {supplements.length === 0 && newSupplements.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--theme-border-strong)] bg-[var(--theme-surface)] px-3 py-4 text-sm font-semibold text-[var(--theme-text-muted)]">
            Chưa thêm tài liệu tham khảo.
          </div>
        ) : (
          <div className="grid gap-3">
            {supplements.map((document, index) => {
              const displayIndex = index + 1;
              return (
                <div
                  key={document.id}
                  className="grid gap-3 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-3 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,0.85fr)_auto]"
                >
                  <label className="block min-w-0">
                    <span className="mb-1 block text-xs font-bold text-[var(--theme-text-muted)]">
                      Tên tài liệu
                    </span>
                    <input
                      type="text"
                      value={document.title ?? document.file.originalName}
                      readOnly
                      disabled
                      className="min-h-11 w-full rounded-lg border border-[var(--theme-input-border)] bg-[var(--theme-input-bg-disabled)] px-3 text-sm font-semibold text-[var(--theme-text-strong)] opacity-70 outline-none cursor-not-allowed"
                    />
                  </label>

                  <div className="min-w-0">
                    <span className="mb-1 block text-xs font-bold text-[var(--theme-text-muted)]">
                      File tài liệu {displayIndex}
                    </span>
                    <div className="mt-1 flex min-h-11 flex-1 items-center gap-3 rounded-xl border border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] px-4 text-sm font-semibold text-[var(--theme-text-strong)] transition">
                      <FilePlus2 className="h-5 w-5 shrink-0 text-[var(--theme-text-muted)]" />
                      <span
                        className="min-w-0 truncate"
                        title={document.file.originalName}
                      >
                        {document.file.originalName}
                      </span>
                      {document.status && (
                        <div className="ml-auto flex shrink-0 items-center">
                          <DocumentStatusBadge
                            jobStatus={document.processingJob?.status}
                            progress={document.processingJob?.progress}
                            status={document.status}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 lg:mt-[22px]">
                    <button
                      type="button"
                      disabled={!document.file.publicUrl}
                      onClick={() => {
                        if (document.file.publicUrl) {
                          window.open(document.file.publicUrl, "_blank");
                        }
                      }}
                      className="theme-button-neutral inline-flex h-11 w-11 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={isDeletingSupplement}
                      onClick={() => onDeleteSupplement(item.lesson.id, document.id)}
                      aria-label={`Xóa ${document.title ?? document.file.originalName}`}
                      className="theme-button-danger-subtle inline-flex h-11 w-11 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}

            {newSupplements.map((newDoc, index) => {
              const hasTitleError = !newDoc.title.trim() && issues.some(issue => issue.message.includes("tên cho tất cả tài liệu mới"));
              const hasFileError = !newDoc.file && issues.some(issue => issue.message.includes("file cho tất cả tài liệu mới"));

              return (
              <div
                key={newDoc.id}
                className="grid gap-3 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-3 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,0.85fr)_auto]"
              >
                <label className="block min-w-0">
                  <span className="mb-1 block text-xs font-bold text-[var(--theme-text-muted)]">
                    Tên tài liệu
                  </span>
                  <input
                    type="text"
                    value={newDoc.title}
                    onChange={(e) => {
                      const updated = allNewSupplements.map((doc) =>
                        doc.id === newDoc.id ? { ...doc, title: e.target.value } : doc,
                      );
                      onUpdateRange(item.lesson.id, "newSupplements", updated);
                    }}
                    placeholder="Ví dụ: Phiếu đọc thêm"
                    className={cn(
                      "min-h-11 w-full rounded-lg border bg-[var(--theme-input-bg)] px-3 text-sm font-semibold outline-none transition disabled:cursor-not-allowed disabled:opacity-60",
                      hasTitleError
                        ? "border-[var(--theme-error-border)] focus:border-[var(--theme-error-border)] focus:ring-4 focus:ring-[var(--theme-error-ring)] text-[var(--theme-error-text)]"
                        : "border-[var(--theme-input-border)] focus:border-[var(--theme-primary)] focus:ring-4 focus:ring-[var(--theme-focus-ring)] text-[var(--theme-text-strong)]"
                    )}
                  />
                </label>

                <div className="min-w-0">
                  <span className="mb-1 block text-xs font-bold text-[var(--theme-text-muted)]">
                    File tài liệu {supplements.length + index + 1}
                  </span>
                  <label
                    className={cn(
                      "mt-1 flex min-h-11 flex-1 cursor-pointer items-center gap-3 rounded-xl border border-dashed bg-[var(--theme-input-bg)] px-4 text-sm font-semibold transition hover:bg-[var(--theme-surface-hover)]",
                      hasFileError
                        ? "border-[var(--theme-error-border)] text-[var(--theme-error-text)] focus-within:border-[var(--theme-error-border)] focus-within:ring-4 focus-within:ring-[var(--theme-error-ring)]"
                        : "border-[var(--theme-input-border)] text-[var(--theme-text-strong)] hover:border-[var(--theme-primary)] focus-within:border-[var(--theme-primary)] focus-within:ring-4 focus-within:ring-[var(--theme-focus-ring)]"
                    )}
                  >
                    <Upload className={cn("h-5 w-5 shrink-0", hasFileError ? "text-[var(--theme-error-text)]" : "text-[var(--theme-text-muted)]")} />
                    <span className="min-w-0 truncate">
                      {newDoc.file?.name ?? "Chọn file PDF"}
                    </span>
                    <input
                      type="file"
                      accept="application/pdf"
                      disabled={isSaving}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        const updated = allNewSupplements.map((doc) =>
                          doc.id === newDoc.id ? { ...doc, file } : doc,
                        );
                        onUpdateRange(item.lesson.id, "newSupplements", updated);
                      }}
                    />
                  </label>
                </div>

                <div className="flex items-center gap-2 lg:mt-[22px]">
                  <button
                    type="button"
                    disabled={!newDoc.file}
                    onClick={() => {
                      if (newDoc.file) {
                        const objectUrl = URL.createObjectURL(newDoc.file);
                        window.open(objectUrl, "_blank");
                      }
                    }}
                    className="theme-button-neutral inline-flex h-11 w-11 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => {
                      const updated = allNewSupplements.filter(
                        (doc) => doc.id !== newDoc.id,
                      );
                      onUpdateRange(item.lesson.id, "newSupplements", updated);
                    }}
                    className="theme-button-danger-subtle inline-flex h-11 w-11 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-60"
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

      <section className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-3">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="theme-button-primary-subtle grid h-9 w-9 shrink-0 place-items-center rounded-lg">
              <FilePlus2 className="h-4 w-4" aria-hidden="true" />
            </div>
            <h3 className="text-sm font-extrabold text-[var(--theme-text-strong)]">
              Bài tập về nhà
            </h3>
            <span className="rounded-full bg-[var(--theme-surface)] px-2 py-0.5 text-xs font-extrabold text-[var(--theme-text-muted)]">
              {homeworks.length + newHomeworks.length}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              onUpdateRange(item.lesson.id, "newSupplements", [
                ...allNewSupplements,
                { id: crypto.randomUUID(), file: null, title: "", type: "HOMEWORK" },
              ]);
            }}
            disabled={isSaving}
            className="theme-button-neutral inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-extrabold transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />
            Thêm tài liệu
          </button>
        </div>

        {homeworks.length === 0 && newHomeworks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--theme-border-strong)] bg-[var(--theme-surface)] px-3 py-4 text-sm font-semibold text-[var(--theme-text-muted)]">
            Chưa thêm bài tập về nhà.
          </div>
        ) : (
          <div className="grid gap-3">
            {homeworks.map((document, index) => {
              return (
                <div
                  key={document.id}
                  className="grid gap-3 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-3 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,0.85fr)_auto]"
                >
                  <label className="block min-w-0">
                    <span className="mb-1 block text-xs font-bold text-[var(--theme-text-muted)]">
                      Tên tài liệu
                    </span>
                    <input
                      type="text"
                      value={document.title ?? document.file.originalName}
                      readOnly
                      disabled
                      className="min-h-11 w-full rounded-lg border border-[var(--theme-input-border)] bg-[var(--theme-input-bg-disabled)] px-3 text-sm font-semibold text-[var(--theme-text-strong)] opacity-70 outline-none cursor-not-allowed"
                    />
                  </label>

                  <div className="min-w-0">
                    <span className="mb-1 block text-xs font-bold text-[var(--theme-text-muted)]">
                      File tài liệu
                    </span>
                    <div className="mt-1 flex min-h-11 flex-1 items-center gap-3 rounded-xl border border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] px-4 text-sm font-semibold text-[var(--theme-text-strong)] transition">
                      <FilePlus2 className="h-5 w-5 shrink-0 text-[var(--theme-text-muted)]" />
                      <span
                        className="min-w-0 truncate"
                        title={document.file.originalName}
                      >
                        {document.file.originalName}
                      </span>
                      {document.status && (
                        <div className="ml-auto flex shrink-0 items-center">
                          <DocumentStatusBadge
                            jobStatus={document.processingJob?.status}
                            progress={document.processingJob?.progress}
                            status={document.status}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 lg:mt-[22px]">
                    <button
                      type="button"
                      disabled={!document.file.publicUrl}
                      onClick={() => {
                        if (document.file.publicUrl) {
                          window.open(document.file.publicUrl, "_blank");
                        }
                      }}
                      className="theme-button-neutral inline-flex h-11 w-11 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={isDeletingSupplement}
                      onClick={() => onDeleteSupplement(item.lesson.id, document.id)}
                      aria-label={`Xóa ${document.title ?? document.file.originalName}`}
                      className="theme-button-danger-subtle inline-flex h-11 w-11 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}

            {newHomeworks.map((newDoc, index) => {
              const hasTitleError = !newDoc.title.trim() && issues.some(issue => issue.message.includes("tên cho tất cả tài liệu mới"));
              const hasFileError = !newDoc.file && issues.some(issue => issue.message.includes("file cho tất cả tài liệu mới"));
              
              return (
              <div
                key={newDoc.id}
                className="grid gap-3 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-3 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,0.85fr)_auto]"
              >
                <label className="block min-w-0">
                  <span className="mb-1 block text-xs font-bold text-[var(--theme-text-muted)]">
                    Tên tài liệu
                  </span>
                  <input
                    type="text"
                    value={newDoc.title}
                    onChange={(e) => {
                      const updated = allNewSupplements.map((doc) =>
                        doc.id === newDoc.id ? { ...doc, title: e.target.value } : doc,
                      );
                      onUpdateRange(item.lesson.id, "newSupplements", updated);
                    }}
                    placeholder="Ví dụ: Phiếu bài tập"
                    className={cn(
                      "min-h-11 w-full rounded-lg border bg-[var(--theme-input-bg)] px-3 text-sm font-semibold outline-none transition disabled:cursor-not-allowed disabled:opacity-60",
                      hasTitleError
                        ? "border-[var(--theme-error-border)] focus:border-[var(--theme-error-border)] focus:ring-4 focus:ring-[var(--theme-error-ring)] text-[var(--theme-error-text)]"
                        : "border-[var(--theme-input-border)] focus:border-[var(--theme-primary)] focus:ring-4 focus:ring-[var(--theme-focus-ring)] text-[var(--theme-text-strong)]"
                    )}
                  />
                </label>

                <div className="min-w-0">
                  <span className="mb-1 block text-xs font-bold text-[var(--theme-text-muted)]">
                    File tài liệu
                  </span>
                  <label
                    className={cn(
                      "mt-1 flex min-h-11 flex-1 cursor-pointer items-center gap-3 rounded-xl border border-dashed bg-[var(--theme-input-bg)] px-4 text-sm font-semibold transition hover:bg-[var(--theme-surface-hover)]",
                      hasFileError
                        ? "border-[var(--theme-error-border)] text-[var(--theme-error-text)] focus-within:border-[var(--theme-error-border)] focus-within:ring-4 focus-within:ring-[var(--theme-error-ring)]"
                        : "border-[var(--theme-input-border)] text-[var(--theme-text-strong)] hover:border-[var(--theme-primary)] focus-within:border-[var(--theme-primary)] focus-within:ring-4 focus-within:ring-[var(--theme-focus-ring)]"
                    )}
                  >
                    <Upload className={cn("h-5 w-5 shrink-0", hasFileError ? "text-[var(--theme-error-text)]" : "text-[var(--theme-text-muted)]")} />
                    <span className="min-w-0 truncate">
                      {newDoc.file?.name ?? "Chọn file PDF"}
                    </span>
                    <input
                      type="file"
                      accept="application/pdf"
                      disabled={isSaving}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        const updated = allNewSupplements.map((doc) =>
                          doc.id === newDoc.id ? { ...doc, file } : doc,
                        );
                        onUpdateRange(item.lesson.id, "newSupplements", updated);
                      }}
                    />
                  </label>
                </div>

                <div className="flex items-center gap-2 lg:mt-[22px]">
                  <button
                    type="button"
                    disabled={!newDoc.file}
                    onClick={() => {
                      if (newDoc.file) {
                        const objectUrl = URL.createObjectURL(newDoc.file);
                        window.open(objectUrl, "_blank");
                      }
                    }}
                    className="theme-button-neutral inline-flex h-11 w-11 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => {
                      const updated = allNewSupplements.filter(
                        (doc) => doc.id !== newDoc.id,
                      );
                      onUpdateRange(item.lesson.id, "newSupplements", updated);
                    }}
                    className="theme-button-danger-subtle inline-flex h-11 w-11 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-60"
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

      {issues.length > 0 ? (
        <div className="grid gap-2">
          {issues.map((issue, index) => (
            <p
              key={index}
              className="rounded-lg border border-[var(--theme-danger-border)] bg-[var(--theme-danger-soft)] px-3 py-2 text-sm font-bold text-[var(--theme-danger)]"
            >
              {issue.message}
            </p>
          ))}
        </div>
      ) : null}
    </article>
  );
}
