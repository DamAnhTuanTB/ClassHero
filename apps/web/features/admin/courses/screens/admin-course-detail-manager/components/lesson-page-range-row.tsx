import { FilePlus2, FileText, Trash2, Upload } from "lucide-react";
import {
  formatDocumentKind,
  formatFileSize,
  getLessonDocumentRange,
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
  AdminSourceDocumentPageApi,
} from "@/features/admin/courses/types/admin-course-document-types";

export function LessonPageRangeRow({
  documents,
  draft,
  isDeletingSupplement,
  isSaving,
  issue,
  item,
  pages,
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
  const savedRange = getLessonDocumentRange(primaryDocument);
  const previewPage = pages.find((page) => page.pageNumber === Number(draft.pageStart));
  const printedPage = previewPage ? getPrintedPageView(previewPage) : null;

  return (
    <article
      data-testid={`lesson-document-row-${item.lesson.id}`}
      className="grid gap-3 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-3"
    >
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_7rem_7rem_minmax(12rem,1fr)] xl:items-start">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase text-[var(--theme-text-muted)]">
            Chương {item.chapterOrder}
          </p>
          <h3 className="mt-1 text-sm font-extrabold leading-6 text-[var(--theme-text-strong)]">
            {item.lesson.title}
          </h3>
          <p className="mt-1 line-clamp-1 text-sm font-semibold text-[var(--theme-text-muted)]">
            {item.chapterTitle}
          </p>
        </div>

        <label className="block">
          <span className="text-xs font-extrabold uppercase text-[var(--theme-text-muted)]">
            Từ trang
          </span>
          <input
            value={draft.pageStart}
            inputMode="numeric"
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
            inputMode="numeric"
            disabled={isSaving}
            aria-label={`Trang kết thúc ${item.lesson.title}`}
            onChange={(event) =>
              onUpdateRange(item.lesson.id, "pageEnd", event.target.value)
            }
            className="mt-1 min-h-11 w-full rounded-lg border border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] px-3 text-sm font-extrabold text-[var(--theme-text-strong)] outline-none transition focus:border-[var(--theme-primary)] focus:ring-4 focus:ring-[var(--theme-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>

        <div className="min-w-0 rounded-lg bg-[var(--theme-surface-soft)] px-3 py-2">
          <p className="text-xs font-extrabold uppercase text-[var(--theme-text-muted)]">
            Xem nhanh
          </p>
          <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-[var(--theme-text)]">
            {previewPage?.textPreview ??
              (printedPage
                ? `Trang in ${printedPage.printedPageLabel ?? printedPage.printedPageNumber ?? "chưa rõ"}`
                : "Chưa có trang xem nhanh")}
          </p>
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
              <p className="mt-1 text-xs font-bold text-[var(--theme-text-muted)]">
                {formatDocumentKind(primaryDocument.kind)}
                {savedRange ? ` · trang ${savedRange.pageStart}-${savedRange.pageEnd}` : ""}
                {primaryDocument.chunkCount > 0
                  ? ` · ${primaryDocument.chunkCount} đoạn`
                  : ""}
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
