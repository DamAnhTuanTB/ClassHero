"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminDataErrorState } from "@/components/admin/admin-data-error-state";
import { SkeletonBlock } from "@/components/common/ui/skeleton-block";
import { MathpixMarkdownRenderer } from "@/components/shared/mathpix-markdown-renderer";
import { useAdminSourceDocumentOcrPreviewContent } from "@/features/admin/courses/hooks/use-admin-source-document-ocr-preview-content";
import type { AdminSourceDocumentApi } from "@/features/admin/courses/types/admin-course-document-types";
import { splitOcrPreviewContent } from "@/features/admin/courses/utils/split-ocr-preview-content";

const INITIAL_VISIBLE_CHUNKS = 4;
const CHUNKS_PER_LOAD = 4;

export function SourceDocumentOcrPreviewView({
  enabled,
  sourceDocument,
}: {
  enabled: boolean;
  sourceDocument: AdminSourceDocumentApi | null;
}) {
  const previewQuery = useAdminSourceDocumentOcrPreviewContent(
    sourceDocument?.id ?? null,
    sourceDocument?.processedAt ?? sourceDocument?.updatedAt ?? null,
    enabled,
  );
  const contentChunks = useMemo(
    () => splitOcrPreviewContent(previewQuery.data?.content ?? ""),
    [previewQuery.data?.content],
  );
  const [visibleChunkCount, setVisibleChunkCount] = useState(INITIAL_VISIBLE_CHUNKS);
  const observer = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useCallback((node: HTMLDivElement | null) => {
    observer.current?.disconnect();
    if (!node) {
      return;
    }

    observer.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleChunkCount((previous) => previous + CHUNKS_PER_LOAD);
        }
      },
      { rootMargin: "600px" },
    );
    observer.current.observe(node);
  }, []);

  useEffect(() => {
    setVisibleChunkCount(INITIAL_VISIBLE_CHUNKS);
  }, [previewQuery.data?.content]);

  useEffect(() => () => observer.current?.disconnect(), []);

  if (!sourceDocument) {
    return (
      <div className="m-4 rounded-lg border border-dashed border-[var(--theme-border-strong)] bg-[var(--theme-surface)] p-6 text-center">
        <p className="text-sm font-extrabold text-[var(--theme-text-strong)]">
          Chưa có tài liệu OCR để xem
        </p>
      </div>
    );
  }

  if (previewQuery.isPending || !enabled) {
    return <OcrPreviewLoadingState />;
  }

  if (previewQuery.isError) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--theme-surface-soft)] p-4 sm:p-6">
        <AdminDataErrorState
          className="max-w-xl"
          description="Không tải được nội dung MMD gốc của Mathpix. Bạn vẫn có thể chuyển sang “Từng trang” để xem dữ liệu OCR đã chuẩn hóa."
          isRetrying={previewQuery.isFetching}
          onRetry={() => previewQuery.refetch()}
          title="Không tải được bản OCR toàn bộ"
        />
      </div>
    );
  }

  if (!previewQuery.data.content.trim()) {
    return (
      <div className="m-4 rounded-lg border border-dashed border-[var(--theme-border-strong)] bg-[var(--theme-surface)] p-6 text-center">
        <p className="text-sm font-extrabold text-[var(--theme-text-strong)]">
          Bản OCR không có nội dung
        </p>
      </div>
    );
  }

  const visibleChunks = contentChunks.slice(0, visibleChunkCount);

  return (
    <div className="h-full overflow-y-auto bg-[var(--theme-surface-soft)] p-2 sm:p-4 lg:p-8">
      <div className="mx-auto w-full max-w-4xl rounded-md border border-[var(--theme-border)] bg-white p-3 shadow-sm sm:p-6 lg:p-8">
        {visibleChunks.map((chunk, index) => (
          <MathpixMarkdownRenderer
            className="mmd-content--ocr-document"
            content={chunk}
            key={`${index}-${chunk.length}`}
          />
        ))}
        {visibleChunkCount < contentChunks.length ? (
          <div
            className="py-8 text-center text-sm font-semibold text-[var(--theme-text-muted)]"
            ref={loadMoreRef}
          >
            Đang hiển thị thêm nội dung OCR…
          </div>
        ) : null}
      </div>
    </div>
  );
}

function OcrPreviewLoadingState() {
  return (
    <div
      aria-label="Đang tải bản OCR toàn bộ"
      className="flex h-full justify-center overflow-hidden bg-[var(--theme-surface-soft)] p-3 sm:p-5 lg:p-8"
      role="status"
    >
      <div className="h-max w-full max-w-4xl rounded-lg border border-[var(--theme-border)] bg-white p-5 shadow-sm sm:p-8">
        <SkeletonBlock className="h-5 w-40 rounded" />
        <SkeletonBlock className="mt-7 h-4 w-full rounded" />
        <SkeletonBlock className="mt-3 h-4 w-11/12 rounded" />
        <SkeletonBlock className="mt-3 h-4 w-4/5 rounded" />
        <SkeletonBlock className="mt-8 h-44 w-full rounded" />
        <SkeletonBlock className="mt-8 h-4 w-full rounded" />
        <SkeletonBlock className="mt-3 h-4 w-10/12 rounded" />
      </div>
    </div>
  );
}
