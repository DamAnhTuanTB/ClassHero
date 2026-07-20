"use client";

import { useEffect, useState } from "react";
import { FileText, Eye, EyeOff, AlertTriangle, XCircle, ChevronDown, ChevronUp, ImageIcon } from "lucide-react";
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
import { getAdminSourceDocumentOcrHtml } from "@/features/admin/courses/api/admin-course-documents-api";
import { PdfPagePreview } from "@/components/shared/pdf-page-preview";
import { MathpixMarkdownRenderer } from "@/components/shared/mathpix-markdown-renderer";

type ViewMode = "html" | "pages";

export function SourceDocumentPagesDialog({
  isOpen,
  pages,
  sourceDocument,
  onClose,
}: {
  isOpen: boolean;
  pages: AdminSourceDocumentPageApi[];
  sourceDocument: AdminSourceDocumentApi | null;
  onClose: () => void;
}) {
  const token = useAuthSessionStore((state) => state.session?.accessToken ?? "");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showPdfPreview, setShowPdfPreview] = useState(true);
  const [ocrHtml, setOcrHtml] = useState<string | null>(null);
  const [htmlLoading, setHtmlLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("html");

  const readyCount = pages.filter((page) => page.status === "READY").length;
  const failedCount = pages.filter((page) => page.status === "FAILED").length;

  useEffect(() => {
    if (isOpen && sourceDocument?.file?.publicUrl) {
      setPdfUrl(sourceDocument.file.publicUrl);
    } else {
      setPdfUrl(null);
    }
  }, [isOpen, sourceDocument]);

  // Fetch OCR HTML when dialog opens
  useEffect(() => {
    if (!isOpen || !sourceDocument || !token) {
      setOcrHtml(null);
      return;
    }

    let cancelled = false;
    setHtmlLoading(true);

    async function fetchHtml() {
      try {
        const response = await getAdminSourceDocumentOcrHtml(sourceDocument!.id, token);
        if (!cancelled) {
          setOcrHtml(response.html);
        }
      } catch {
        // Fall back to page-by-page view
        if (!cancelled) {
          setViewMode("pages");
        }
      } finally {
        if (!cancelled) {
          setHtmlLoading(false);
        }
      }
    }

    void fetchHtml();
    return () => {
      cancelled = true;
    };
  }, [isOpen, sourceDocument, token]);

  return (
    <EditorDialogShell
      ariaLabel="Xem trang tài liệu"
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="h-[90dvh] max-w-4xl"
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
              Rendered
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
          <span className="text-xs font-bold text-[var(--theme-text-muted)]">
            {pages.length} trang
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 flex flex-col overflow-y-auto">
        {viewMode === "html" ? (
          <OcrHtmlView html={ocrHtml} loading={htmlLoading} />
        ) : pages.length === 0 ? (
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
            {pages.map((page) => (
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

function OcrHtmlView({ html, loading }: { html: string | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--theme-border)] border-t-[var(--theme-primary)]" />
        <span className="ml-3 text-sm font-semibold text-[var(--theme-text-muted)]">
          Đang tải nội dung HTML...
        </span>
      </div>
    );
  }

  if (!html) {
    return (
      <div className="m-4 rounded-lg border border-dashed border-[var(--theme-border-strong)] bg-[var(--theme-surface)] p-6 text-center">
        <FileText className="mx-auto h-9 w-9 text-[var(--theme-text-muted)]" aria-hidden="true" />
        <p className="mt-3 text-sm font-extrabold text-[var(--theme-text-strong)]">
          Chưa có nội dung Rendered (HTML)
        </p>
        <p className="mt-1 text-xs text-[var(--theme-text-muted)]">
          Chuyển sang chế độ "Từng trang" để xem nội dung text
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full relative">
      <iframe
        srcDoc={html}
        title="Mathpix OCR HTML Preview"
        className="absolute inset-0 h-full w-full border-0 bg-white"
        sandbox="allow-same-origin allow-scripts"
      />
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
        <div className="mt-2 flex items-center gap-2 rounded-md border border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] px-3 py-2 text-xs font-bold text-[var(--theme-warning-text)]">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Cần xác nhận số trang in — {printedPage.warning}
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
        <div className="min-w-0 flex-1">
          {text ? (
            <div>
              <div
                className={`rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)] p-3 ${
                  !isExpanded && isLongText ? "max-h-[310px] overflow-hidden" : ""
                }`}
              >
                <MathpixMarkdownRenderer content={text} />
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
