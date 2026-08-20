"use client";

import { FileText, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdminDataErrorState } from "@/components/admin/admin-data-error-state";
import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import { PdfPagePreview } from "@/components/shared/pdf-page-preview";
import { useAdminFileAccessUrl } from "@/features/admin/courses/hooks/use-admin-file-access-url";
import type { AdminLessonSummarySourcePage } from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import { cn } from "@/lib/utils";

export function AdminSummarySourcePagesDialog({
  isOpen,
  sourcePageNumbers,
  sourcePages,
  onClose,
}: {
  isOpen: boolean;
  sourcePageNumbers: number[];
  sourcePages: AdminLessonSummarySourcePage[];
  onClose: () => void;
}) {
  const resolvedPages = useMemo(() => {
    const pageByPacketNumber = new Map(
      sourcePages.map((page) => [page.packetPageNumber, page] as const),
    );
    return sourcePageNumbers
      .map((pageNumber) => pageByPacketNumber.get(pageNumber))
      .filter((page): page is AdminLessonSummarySourcePage => Boolean(page));
  }, [sourcePageNumbers, sourcePages]);
  const [activePacketPageNumber, setActivePacketPageNumber] = useState(
    resolvedPages[0]?.packetPageNumber ?? null,
  );
  const [previewWidth, setPreviewWidth] = useState(760);
  const activePage =
    resolvedPages.find((page) => page.packetPageNumber === activePacketPageNumber) ??
    resolvedPages[0] ??
    null;
  const pdfAccessUrlQuery = useAdminFileAccessUrl(
    activePage?.sourceFileId ?? null,
    isOpen && Boolean(activePage),
  );

  useEffect(() => {
    setActivePacketPageNumber(resolvedPages[0]?.packetPageNumber ?? null);
  }, [resolvedPages]);

  useEffect(() => {
    function updatePreviewWidth() {
      setPreviewWidth(Math.max(240, Math.min(820, window.innerWidth - 64)));
    }
    updatePreviewWidth();
    window.addEventListener("resize", updatePreviewWidth);
    return () => window.removeEventListener("resize", updatePreviewWidth);
  }, []);

  return (
    <EditorDialogShell
      ariaLabel="Xem PDF nguồn của khối"
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="max-w-5xl"
    >
      <header className="theme-dialog-header flex min-h-16 shrink-0 items-center px-4 py-3 pr-20 sm:px-5">
        <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
          PDF nguồn của khối
        </h2>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--theme-bg-subtle)] p-3 sm:p-5">
        {resolvedPages.length > 0 ? (
          <div className="space-y-4">
            <div
              aria-label="Chọn trang nguồn"
              className="flex gap-2 overflow-x-auto pb-1"
              role="tablist"
            >
              {resolvedPages.map((page) => {
                const isActive = page.packetPageNumber === activePage?.packetPageNumber;
                return (
                  <button
                    key={page.packetPageNumber}
                    aria-selected={isActive}
                    className={cn(
                      "min-h-10 shrink-0 whitespace-nowrap rounded-lg border px-3 text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)]",
                      isActive
                        ? "border-[var(--theme-primary)] bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]"
                        : "border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-strong)]",
                    )}
                    onClick={() => setActivePacketPageNumber(page.packetPageNumber)}
                    role="tab"
                    type="button"
                  >
                    Trang nguồn {page.packetPageNumber}
                  </button>
                );
              })}
            </div>

            {activePage ? (
              <section className="space-y-3">
                <div className="flex items-start gap-3 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]">
                    <FileText className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="break-words text-sm font-extrabold text-[var(--theme-text-strong)]">
                      {activePage.documentTitle}
                    </p>
                    <p className="mt-1 text-xs font-bold text-[var(--theme-text-muted)]">
                      Trang PDF {activePage.sourcePdfPageNumber}
                      {activePage.printedPageLabel
                        ? ` · Trang in ${activePage.printedPageLabel}`
                        : ""}
                    </p>
                  </div>
                </div>

                <div className="flex min-h-72 justify-center overflow-x-auto rounded-lg border border-[var(--theme-border)] bg-white p-2 sm:p-4">
                  {pdfAccessUrlQuery.isPending ? (
                    <div className="grid min-h-72 place-items-center text-[var(--theme-text-muted)]">
                      <span className="inline-flex items-center gap-2 text-sm font-bold">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        Đang tải PDF…
                      </span>
                    </div>
                  ) : pdfAccessUrlQuery.isError ? (
                    <AdminDataErrorState
                      description="Vui lòng thử lại để xem trang PDF nguồn."
                      headingLevel={3}
                      isRetrying={pdfAccessUrlQuery.isFetching}
                      onRetry={() => pdfAccessUrlQuery.refetch()}
                      title="Không tải được PDF nguồn"
                      variant="compact"
                    />
                  ) : (
                    <PdfPagePreview
                      pageNumber={activePage.sourcePdfPageNumber}
                      pdfUrl={pdfAccessUrlQuery.data?.url ?? null}
                      width={previewWidth}
                    />
                  )}
                </div>
              </section>
            ) : null}
          </div>
        ) : (
          <AdminDataErrorState
            description="Bản kiến thức này chưa có ánh xạ từ số trang nguồn sang file PDF gốc."
            headingLevel={3}
            title="Không tìm thấy trang PDF nguồn"
            variant="compact"
          />
        )}
      </div>

      <footer className="grid shrink-0 grid-cols-1 gap-2 border-t border-[var(--theme-border)] p-3 sm:flex sm:justify-end sm:p-4">
        <button
          className="theme-button-neutral inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-lg px-4 text-sm font-extrabold sm:w-auto"
          onClick={onClose}
          type="button"
        >
          Hủy
        </button>
      </footer>
    </EditorDialogShell>
  );
}
