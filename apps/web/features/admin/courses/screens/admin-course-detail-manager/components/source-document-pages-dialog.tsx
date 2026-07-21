"use client";

import { useEffect, useState } from "react";
import { FileText, Eye, EyeOff, AlertTriangle, XCircle, ChevronDown, ChevronUp, ImageIcon, Check } from "lucide-react";
import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import {
  getPageVisualSummary,
  getPrintedPageView,
  formatQualityPercent,
} from "@/features/admin/courses/admin-course-documents-utils";
import type {
  AdminSourceDocumentApi,
  AdminSourceDocumentPageApi,
} from "@/features/admin/courses/types/admin-course-document-types";
import { DocumentStatusBadge } from "@/features/admin/courses/screens/admin-course-detail-manager/components/document-status-badge";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";
import { confirmAdminSourceDocumentPagePrintedPage } from "@/features/admin/courses/api/admin-course-documents-api";
import { PdfPagePreview } from "@/components/shared/pdf-page-preview";
import { useQueryClient } from "@tanstack/react-query";
import { adminCourseDocumentQueryKeys } from "@/features/admin/courses/hooks/use-admin-course-documents-manager";
import { toast } from "sonner";
import { MathpixMarkdownRenderer } from "@/components/shared/mathpix-markdown-renderer";

type ViewMode = "html" | "pages";

export function SourceDocumentPagesDialog({
  isOpen,
  initialFilter,
  pages,
  sourceDocument,
  onClose,
}: {
  isOpen: boolean;
  initialFilter?: "all" | "warnings";
  pages: AdminSourceDocumentPageApi[];
  sourceDocument: AdminSourceDocumentApi | null;
  onClose: () => void;
}) {
  const token = useAuthSessionStore((state) => state.session?.accessToken ?? "");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("html");
  const [filterMode, setFilterMode] = useState<"all" | "warnings">("all");
  const [searchPrintedPage, setSearchPrintedPage] = useState("");

  const filteredPages = pages.filter((page) => {
    if (filterMode === "warnings" && !getPrintedPageView(page).warning) {
      return false;
    }
    if (searchPrintedPage) {
      const printed = getPrintedPageView(page);
      if (!printed.printedPageLabel?.toLowerCase().includes(searchPrintedPage.trim().toLowerCase())) {
        return false;
      }
    }
    return true;
  });

  const readyCount = pages.filter((page) => page.status === "READY").length;
  const failedCount = pages.filter((page) => page.status === "FAILED").length;

  useEffect(() => {
    if (isOpen) {
      if (sourceDocument?.file?.publicUrl) {
        setPdfUrl(sourceDocument.file.publicUrl);
      } else {
        setPdfUrl(null);
      }
      // Reset view state when opening
      setShowPdfPreview(initialFilter === "warnings");
      setViewMode(initialFilter === "warnings" ? "pages" : "html");
      setFilterMode(initialFilter ?? "all");
    } else {
      setPdfUrl(null);
    }
  }, [isOpen, sourceDocument, initialFilter]);


  return (
    <EditorDialogShell
      ariaLabel="Xem trang tài liệu"
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="h-[90dvh] w-[95vw] max-w-6xl"
    >
      <div className="theme-dialog-header flex min-h-16 shrink-0 items-center gap-3 p-4 pr-16 sm:p-5 sm:pr-20">
        <span className="theme-button-primary-subtle grid h-10 w-10 shrink-0 place-items-center rounded-lg">
          <FileText className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
            Xem trang OCR
          </h2>
          <p className="mt-1 truncate text-sm font-semibold text-[var(--theme-text-muted)]">
            {sourceDocument?.title ?? sourceDocument?.file.originalName ?? "Tài liệu nguồn"}
          </p>
        </div>

        {readyCount > 0 || failedCount > 0 ? (
          <div className="ml-4 hidden items-center gap-2 sm:flex">
            {readyCount > 0 && <SummaryPill color="success" icon={null} label={`${readyCount} sẵn sàng`} />}
            {failedCount > 0 && <SummaryPill color="danger" icon={null} label={`${failedCount} lỗi`} />}
          </div>
        ) : null}

        <div className="ml-auto flex items-center gap-3">
          <input
            type="text"
            value={searchPrintedPage}
            onChange={(e) => setSearchPrintedPage(e.target.value)}
            placeholder="Tìm số trang in..."
            className="h-7 w-32 rounded-md border border-[var(--theme-border-strong)] bg-[var(--theme-surface)] px-2 text-xs font-semibold text-[var(--theme-text)] placeholder:text-[var(--theme-text-muted)] focus:border-[var(--theme-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-primary)]"
          />

          {/* View mode toggle */}
          <div className="flex rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)]">
            <button
              type="button"
              onClick={() => setViewMode("html")}
              className={`px-2.5 py-1 text-xs font-bold rounded-l-md transition-colors ${
                viewMode === "html"
                  ? "bg-[var(--theme-primary)] text-white"
                  : "text-[var(--theme-text-muted)] hover:bg-[var(--theme-surface-soft)]"
              }`}
            >
              Toàn bộ
            </button>
            <button
              type="button"
              onClick={() => setViewMode("pages")}
              className={`px-2.5 py-1 text-xs font-bold rounded-r-md transition-colors ${
                viewMode === "pages"
                  ? "bg-[var(--theme-primary)] text-white"
                  : "text-[var(--theme-text-muted)] hover:bg-[var(--theme-surface-soft)]"
              }`}
            >
              Từng trang
            </button>
          </div>

          {viewMode === "pages" ? (
            <button
              type="button"
              onClick={() => setShowPdfPreview((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--theme-primary)] hover:underline"
            >
              {showPdfPreview ? (
                <>
                  <EyeOff className="h-3.5 w-3.5" /> Ẩn PDF
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5" /> Hiện PDF
                </>
              )}
            </button>
          ) : null}
          {viewMode === "pages" ? (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--theme-text-strong)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterMode === "warnings"}
                  onChange={(e) => setFilterMode(e.target.checked ? "warnings" : "all")}
                  className="rounded border-[var(--theme-border-strong)] text-[var(--theme-primary)] focus:ring-[var(--theme-primary)]"
                />
                Chỉ hiện trang cần xác nhận
              </label>
            </div>
          ) : null}
          <span className="text-xs font-bold text-[var(--theme-text-muted)]">
            {filteredPages.length} trang
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 flex flex-col overflow-y-auto">
        {viewMode === "html" ? (
          <OcrRenderedPagesView pages={filteredPages} />
        ) : filteredPages.length === 0 ? (
          <div className="m-4 rounded-lg border border-dashed border-[var(--theme-border-strong)] bg-[var(--theme-surface)] p-6 text-center">
            <FileText
              className="mx-auto h-9 w-9 text-[var(--theme-text-muted)]"
              aria-hidden="true"
            />
            <p className="mt-3 text-sm font-extrabold text-[var(--theme-text-strong)]">
              Chưa có trang để xem
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--theme-border)]">
            {filteredPages.map((page) => (
              <PageDetailRow
                key={page.id}
                page={page}
                pdfUrl={showPdfPreview ? pdfUrl : null}
              />
            ))}
          </div>
        )}
      </div>
    </EditorDialogShell>
  );
}

function OcrRenderedPagesView({ pages }: { pages: AdminSourceDocumentPageApi[] }) {
  if (pages.length === 0) {
    return (
      <div className="m-4 rounded-lg border border-dashed border-[var(--theme-border-strong)] bg-[var(--theme-surface)] p-6 text-center">
        <FileText className="mx-auto h-9 w-9 text-[var(--theme-text-muted)]" aria-hidden="true" />
        <p className="mt-3 text-sm font-extrabold text-[var(--theme-text-strong)]">
          Chưa có nội dung
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full bg-[var(--theme-surface-soft)] p-4 sm:p-6 lg:p-8 flex justify-center">
      <div className="w-full max-w-3xl bg-white border border-[var(--theme-border)] rounded-md shadow-sm p-8">
        <div className="flex flex-col gap-4">
          {pages.map((page, index) => {
            const text = page.mathpixMarkdown ?? page.fullText ?? page.textPreview;
            const printed = getPrintedPageView(page);
            return (
              <div key={page.id} className={index > 0 ? "border-t border-[var(--theme-border-strong)] pt-8" : ""}>
                <div className="mb-4 text-xs font-bold text-[var(--theme-text-muted)]">
                  Trang PDF {page.pageNumber} {printed.printedPageLabel ? `(Trang in: ${printed.printedPageLabel})` : ""}
                </div>
                {text ? (
                  <MathpixMarkdownRenderer content={text} />
                ) : (
                  <p className="italic text-[var(--theme-text-muted)]">Không có nội dung</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PageDetailRow({
  page,
  pdfUrl,
}: {
  page: AdminSourceDocumentPageApi;
  pdfUrl: string | null;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const printedPage = getPrintedPageView(page);
  const hasWarning = Boolean(printedPage.warning);
  const hasError = page.status === "FAILED";
  // Prefer mathpixMarkdown (rich: images, tables, math) over plain text
  const richContent = page.mathpixMarkdown;
  const plainText = page.fullText ?? page.textPreview;
  const text = richContent ?? plainText;
  const isLongText = (text?.length ?? 0) > 200;

  return (
    <div
      className={`px-4 py-4 sm:px-5 ${
        hasError
          ? "bg-[var(--theme-danger-soft)]"
          : hasWarning
            ? "bg-[var(--theme-warning-bg)]"
            : ""
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--theme-surface-soft)] text-xs font-extrabold text-[var(--theme-text-muted)]">
            {page.pageNumber}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-extrabold text-[var(--theme-text-strong)]">
                Trang PDF {page.pageNumber}
              </span>
              <DocumentStatusBadge
                hasPrintedPageWarning={hasWarning}
                status={page.status}
              />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-[var(--theme-text-muted)]">
              <span>
                Trang in:{" "}
                <strong>
                  {printedPage.printedPageLabel ??
                    printedPage.printedPageNumber ??
                    "chưa rõ"}
                </strong>
              </span>
              {page.qualityScore !== null ? (
                <span>
                  Độ rõ: <strong>{formatQualityPercent(page.qualityScore)}</strong>
                </span>
              ) : null}
              {page.textSource ? (
                <span>
                  Nguồn: <strong>{page.textSource}</strong>
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Warning/Error messages */}
      {hasWarning ? (
        <div className="mt-2 flex flex-col gap-2 rounded-md border border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] p-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--theme-warning-text)]">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Cần xác nhận số trang in — {printedPage.warning}
          </div>
          <PrintedPageConfirmForm page={page} />
        </div>
      ) : null}

      {hasError && page.extractError ? (
        <div className="mt-2 flex items-center gap-2 rounded-md border border-[var(--theme-danger-border)] bg-[var(--theme-danger-soft)] px-3 py-2 text-xs font-bold text-[var(--theme-danger)]">
          <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {page.extractError}
        </div>
      ) : null}

      {/* PDF preview + Text content side by side */}
      <div className={`mt-3 ${pdfUrl ? "flex gap-4" : ""}`}>
        {/* PDF page image */}
        {pdfUrl ? (
          <div className="shrink-0">
            <PdfPagePreview pageNumber={page.pageNumber} pdfUrl={pdfUrl} width={220} />
          </div>
        ) : null}

        {/* OCR text content */}
        <div className="min-w-0 flex-1 flex justify-center">
          {text ? (
            <div className="w-full max-w-3xl">
              <div
                className={`rounded-md shadow-sm border border-[var(--theme-border)] bg-white p-8 ${
                  !isExpanded && isLongText ? "max-h-[310px] overflow-hidden relative" : ""
                }`}
              >
                <MathpixMarkdownRenderer content={text} />
                {!isExpanded && isLongText && (
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent" />
                )}
              </div>
              {isLongText ? (
                <button
                  type="button"
                  onClick={() => setIsExpanded((previous) => !previous)}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-[var(--theme-primary)] hover:underline"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-3.5 w-3.5" /> Thu gọn
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3.5 w-3.5" /> Xem đầy đủ
                    </>
                  )}
                </button>
              ) : null}
            </div>
          ) : (
            <p className="text-xs font-semibold italic text-[var(--theme-text-muted)]">
              Chưa có nội dung OCR.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryPill({
  color,
  icon,
  label,
}: {
  color: "success" | "warning" | "danger";
  icon: React.ReactNode;
  label: string;
}) {
  const colorMap = {
    success:
      "border-[var(--theme-success-border)] bg-[var(--theme-success-bg)] text-[var(--theme-success-text)]",
    warning:
      "border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] text-[var(--theme-warning-text)]",
    danger:
      "border-[var(--theme-danger-border)] bg-[var(--theme-danger-soft)] text-[var(--theme-danger)]",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-extrabold ${colorMap[color]}`}
    >
      {icon}
      {label}
    </span>
  );
}

function PrintedPageConfirmForm({ page }: { page: AdminSourceDocumentPageApi }) {
  const queryClient = useQueryClient();
  const token = useAuthSessionStore((state) => state.session?.accessToken ?? "");
  const printedPage = getPrintedPageView(page);
  const [labelInput, setLabelInput] = useState(
    printedPage.printedPageLabel ?? printedPage.printedPageNumber?.toString() ?? "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labelInput.trim() || !page.sourceDocumentId) return;

    try {
      setIsSubmitting(true);
      const val = labelInput.trim();
      const numVal = parseInt(val, 10);
      const isNum = !isNaN(numVal) && numVal.toString() === val;

      const payload = {
        printedPageLabel: val,
        printedPageNumber: isNum ? numVal : null,
      };

      await confirmAdminSourceDocumentPagePrintedPage(
        page.sourceDocumentId,
        page.id,
        payload,
        token,
      );

      toast.success("Đã xác nhận trang in");
      
      // Mutate the pages list
      queryClient.invalidateQueries({
        queryKey: adminCourseDocumentQueryKeys.all, // invalidate all to refresh documents and pages
      });
    } catch (err) {
      toast.error("Lỗi khi xác nhận trang in");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2 mt-1">
      <input
        type="text"
        placeholder="Nhập nhãn hoặc số trang in (VD: 4, iv)"
        value={labelInput}
        onChange={(e) => setLabelInput(e.target.value)}
        disabled={isSubmitting}
        className="block w-full sm:w-80 rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-1.5 text-sm font-medium text-[var(--theme-text-strong)] placeholder:text-[var(--theme-text-muted)] focus:border-[var(--theme-primary)] focus:ring-1 focus:ring-[var(--theme-primary)] disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={!labelInput.trim() || isSubmitting}
        className="inline-flex items-center gap-1.5 rounded-md bg-[var(--theme-primary)] px-3 py-1.5 text-sm font-bold text-white shadow-sm hover:bg-[var(--theme-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-primary)] disabled:opacity-50 transition-colors"
      >
        {isSubmitting ? (
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        ) : (
          <Check className="h-3.5 w-3.5" />
        )}
        Xác nhận
      </button>
    </form>
  );
}
