"use client";

import { FileText, ImageIcon } from "lucide-react";
import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import {
  getPageVisualSummary,
  getPrintedPageView,
} from "@/features/admin/courses/admin-course-documents-utils";
import type {
  AdminSourceDocumentApi,
  AdminSourceDocumentPageApi,
} from "@/features/admin/courses/types/admin-course-document-types";
import { DocumentStatusBadge } from "@/features/admin/courses/screens/admin-course-detail-manager/components/document-status-badge";

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
  return (
    <EditorDialogShell ariaLabel="Xem trang tài liệu" isOpen={isOpen} onClose={onClose}>
      <div className="theme-dialog-header flex min-h-16 shrink-0 items-center gap-3 p-4 pr-16 sm:p-5 sm:pr-20">
        <span className="theme-button-primary-subtle grid h-10 w-10 shrink-0 place-items-center rounded-lg">
          <FileText className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
            Xem trang
          </h2>
          <p className="mt-1 truncate text-sm font-semibold text-[var(--theme-text-muted)]">
            {sourceDocument?.title ??
              sourceDocument?.file.originalName ??
              "Tài liệu nguồn"}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        {pages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--theme-border-strong)] bg-[var(--theme-surface)] p-6 text-center">
            <FileText
              className="mx-auto h-9 w-9 text-[var(--theme-text-muted)]"
              aria-hidden="true"
            />
            <p className="mt-3 text-sm font-extrabold text-[var(--theme-text-strong)]">
              Chưa có trang để xem
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {pages.map((page) => {
              const printedPage = getPrintedPageView(page);
              const visualSummary = getPageVisualSummary(page);
              const thumbnailUrl = page.thumbnailFile?.publicUrl;

              return (
                <article
                  key={page.id}
                  className="overflow-hidden rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)]"
                >
                  <div className="aspect-[4/3] border-b border-[var(--theme-border)] bg-[var(--theme-surface-soft)]">
                    {thumbnailUrl ? (
                      <img
                        src={thumbnailUrl}
                        alt={`Trang ${page.pageNumber}`}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-[var(--theme-text-muted)]">
                        <ImageIcon className="h-9 w-9" aria-hidden="true" />
                      </div>
                    )}
                  </div>

                  <div className="grid gap-2 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-[var(--theme-text-strong)]">
                          Trang PDF {page.pageNumber}
                        </p>
                        <p className="text-xs font-bold text-[var(--theme-text-muted)]">
                          Trang in{" "}
                          {printedPage.printedPageLabel ??
                            printedPage.printedPageNumber ??
                            "chưa rõ"}
                        </p>
                      </div>
                      <DocumentStatusBadge status={page.status} />
                    </div>

                    <p className="line-clamp-3 min-h-[3.75rem] text-sm leading-5 text-[var(--theme-text)]">
                      {page.textPreview ??
                        page.extractError ??
                        "Chưa có nội dung đọc được."}
                    </p>

                    {printedPage.warning || visualSummary.hasVisualAssets ? (
                      <div className="flex flex-wrap gap-2 text-xs font-bold text-[var(--theme-text-muted)]">
                        {printedPage.warning ? <span>Cần rà số trang</span> : null}
                        {visualSummary.hasVisualAssets ? (
                          <span>{visualSummary.visualAssetCount || 1} hình</span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </EditorDialogShell>
  );
}
