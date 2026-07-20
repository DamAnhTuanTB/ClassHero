"use client";

import { useCallback, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

/**
 * Renders a single page of a PDF document given a URL and page number.
 * Uses react-pdf (pdfjs) for client-side rendering.
 */
export function PdfPagePreview({
  pageNumber,
  pdfUrl,
  width = 280,
}: {
  pageNumber: number;
  pdfUrl: string | null;
  width?: number;
}) {
  const [hasError, setHasError] = useState(false);

  const handleError = useCallback(() => {
    setHasError(true);
  }, []);

  if (!pdfUrl || hasError) {
    return (
      <div
        className="grid place-items-center rounded-md border border-dashed border-[var(--theme-border)] bg-[var(--theme-surface-soft)] text-[var(--theme-text-muted)]"
        style={{ width, height: Math.round(width * 1.414) }}
      >
        <span className="text-xs font-semibold">
          {hasError ? "Không tải được trang" : "Đang chờ PDF..."}
        </span>
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-md border border-[var(--theme-border)] bg-white"
      style={{ width }}
    >
      <Document file={pdfUrl} loading={<PdfPageSkeleton width={width} />} onLoadError={handleError}>
        <Page
          pageNumber={pageNumber}
          width={width}
          loading={<PdfPageSkeleton width={width} />}
          renderAnnotationLayer={false}
          renderTextLayer={false}
          onRenderError={handleError}
        />
      </Document>
    </div>
  );
}

function PdfPageSkeleton({ width }: { width: number }) {
  return (
    <div
      className="animate-pulse bg-[var(--theme-surface-soft)]"
      style={{ width, height: Math.round(width * 1.414) }}
    />
  );
}
