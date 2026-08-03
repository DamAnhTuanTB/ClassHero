"use client";

import dynamic from "next/dynamic";

const PdfPagePreviewClient = dynamic(
  () =>
    import("@/components/shared/pdf-page-preview-client").then(
      (module) => module.PdfPagePreviewClient,
    ),
  {
    loading: () => null,
    ssr: false,
  },
);

export type PdfPagePreviewProps = {
  pageNumber: number;
  pdfUrl: string | null;
  width?: number;
};

/**
 * Renders a single page of a PDF document given a URL and page number.
 * The pdf.js implementation is loaded client-only because it requires browser DOM APIs.
 */
export function PdfPagePreview({
  pageNumber,
  pdfUrl,
  width = 280,
}: PdfPagePreviewProps) {
  if (!pdfUrl) {
    return (
      <div
        className="grid place-items-center rounded-md border border-dashed border-[var(--theme-border)] bg-[var(--theme-surface-soft)] text-[var(--theme-text-muted)]"
        style={{ width, height: Math.round(width * 1.414) }}
      >
        <span className="text-xs font-semibold">Đang chờ PDF...</span>
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden rounded-md"
      style={{ width, minHeight: Math.round(width * 1.414) }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 animate-pulse bg-[var(--theme-skeleton)]"
      />
      <div className="relative">
        <PdfPagePreviewClient
          pageNumber={pageNumber}
          pdfUrl={pdfUrl}
          width={width}
        />
      </div>
    </div>
  );
}
