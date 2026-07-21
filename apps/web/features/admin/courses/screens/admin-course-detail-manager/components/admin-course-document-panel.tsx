"use client";

import {
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { DeleteConfirmDialog } from "@/components/admin/courses/delete-confirm-dialog";
import type { AdminLearningPath } from "@/features/admin/courses/admin-courses-data";
import {
  formatFileSize,
  formatQualityPercent,
  getOcrStatusSummary,
} from "@/features/admin/courses/admin-course-documents-utils";
import type { AdminSourceDocumentPageApi } from "@/features/admin/courses/types/admin-course-document-types";
import { useAdminCourseDocumentsManager } from "@/features/admin/courses/hooks/use-admin-course-documents-manager";
import { AdminCourseDocumentStat } from "@/features/admin/courses/screens/admin-course-detail-manager/components/admin-course-document-stat";
import { DocumentStatusBadge } from "@/features/admin/courses/screens/admin-course-detail-manager/components/document-status-badge";
import { LessonDocumentUploadDialog } from "@/features/admin/courses/screens/admin-course-detail-manager/components/lesson-document-upload-dialog";
import { LessonPageRangeDialog } from "@/features/admin/courses/screens/admin-course-detail-manager/components/lesson-page-range-dialog";
import { SourceDocumentPagesDialog } from "@/features/admin/courses/screens/admin-course-detail-manager/components/source-document-pages-dialog";
import { SourceDocumentUploadDialog } from "@/features/admin/courses/screens/admin-course-detail-manager/components/source-document-upload-dialog";

export function AdminCourseDocumentPanel({ path }: { path: AdminLearningPath }) {
  const manager = useAdminCourseDocumentsManager(path);
  const [isDeleteSourceConfirmOpen, setIsDeleteSourceConfirmOpen] = useState(false);
  const sourceDocument = manager.selectedSourceDocument;
  const canMapRanges = Boolean(
    sourceDocument &&
    manager.pageLimit &&
    manager.lessons.length &&
    manager.rangeReadiness.isReady,
  );
  const isSourceProcessing = 
    sourceDocument?.status === "PROCESSING" || 
    sourceDocument?.processingJob?.status === "PROCESSING";

  const uploadLessonKind =
    manager.dialogState?.type === "lesson-upload"
      ? manager.dialogState.kind
      : "SUPPLEMENT";

  async function handleDeleteSourceDocument() {
    await manager.actions.deleteSourceDocument();
    setIsDeleteSourceConfirmOpen(false);
  }

  return (
    <section
      data-testid="admin-course-document-panel"
      className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4 sm:p-5"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[var(--theme-primary)]">
            Tài liệu buổi học
          </p>
          <h2 className="mt-1 text-xl font-extrabold text-[var(--theme-text-strong)]">
            Sách nguồn và tài liệu từng buổi
          </h2>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={manager.actions.openSourceUploadDialog}
            className="theme-button-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-extrabold transition"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            {sourceDocument ? "Thay PDF nguồn" : "Upload PDF nguồn"}
          </button>
          <button
            type="button"
            disabled={!canMapRanges}
            onClick={manager.actions.openRangesDialog}
            title={
              canMapRanges
                ? undefined
                : !manager.lessons.length
                  ? "Cần tạo ít nhất 1 buổi học trước khi gán trang"
                  : manager.rangeReadiness.reason
            }
            className="theme-button-primary-subtle inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-extrabold transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            Nhập khoảng trang
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <AdminCourseDocumentStat
          label="Tổng trang"
          testId="document-stat-total-pages"
          value={sourceDocument?.pageCount ?? manager.pageLimit ?? 0}
        />
        <AdminCourseDocumentStat
          label="Đã đọc"
          testId="document-stat-ready-pages"
          value={manager.sourceStats.readyPages}
        />
        <AdminCourseDocumentStat
          label="Đã gán"
          testId="document-stat-mapped-lessons"
          value={`${manager.mappedLessonCount}/${manager.lessons.length}`}
        />
        <AdminCourseDocumentStat
          label="Độ rõ"
          testId="document-stat-quality"
          value={formatQualityPercent(manager.sourceStats.averageQuality)}
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)]">
        {manager.isLoading && !sourceDocument ? (
          <div className="flex min-h-48 items-center justify-center p-6 text-center">
            <div>
              <Loader2
                className="mx-auto h-8 w-8 animate-spin text-[var(--theme-primary)]"
                aria-hidden="true"
              />
              <p className="mt-3 text-sm font-extrabold text-[var(--theme-text-strong)]">
                Đang tải tài liệu
              </p>
            </div>
          </div>
        ) : null}

        {!manager.isLoading && !sourceDocument ? (
          <div className="grid gap-3 p-6 text-center">
            <FileText
              className="mx-auto h-10 w-10 text-[var(--theme-text-muted)]"
              aria-hidden="true"
            />
            <p className="text-base font-extrabold text-[var(--theme-text-strong)]">
              Chưa có tài liệu nguồn
            </p>
            <p className="mx-auto max-w-md text-sm font-semibold leading-6 text-[var(--theme-text-muted)]">
              Upload sách hoặc giáo trình chính để gán trang cho từng buổi học.
            </p>
            <button
              type="button"
              onClick={manager.actions.openSourceUploadDialog}
              className="theme-button-primary mx-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-extrabold transition"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              Chọn file PDF
            </button>
          </div>
        ) : null}

        {sourceDocument ? (
          <div>
            <div className="grid items-start gap-4 border-b border-[var(--theme-border)] bg-[var(--theme-surface)] p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="min-w-0 text-lg font-extrabold text-[var(--theme-text-strong)]">
                    {sourceDocument.title ?? sourceDocument.file.originalName}
                  </h3>
                  <DocumentStatusBadge
                    hasPrintedPageWarning={manager.rangeReadiness.warningPageCount > 0}
                    jobStatus={sourceDocument.processingJob?.status}
                    progress={sourceDocument.processingJob?.progress}
                    status={sourceDocument.status}
                  />
                </div>
                <p className="mt-2 text-sm font-semibold flex items-center min-w-0">
                  <button
                    type="button"
                    title={sourceDocument.file.originalName}
                    onClick={manager.actions.openSourceDocumentFile}
                    disabled={manager.isOpeningFile}
                    className="text-[var(--theme-primary)] hover:underline disabled:opacity-60 disabled:no-underline text-left truncate min-w-0"
                  >
                    {sourceDocument.file.originalName}
                  </button>
                  <span className="text-[var(--theme-text-muted)] mx-2 shrink-0">•</span>
                  <span className="text-[var(--theme-text-muted)] shrink-0">
                    {formatFileSize(sourceDocument.file.sizeBytes)}
                  </span>
                </p>
              </div>

              <div className="flex flex-wrap gap-2 lg:justify-end">
                <button
                  type="button"
                  disabled={manager.isOpeningFile}
                  onClick={manager.actions.openSourceDocumentFile}
                  className="theme-button-neutral inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition disabled:cursor-wait disabled:opacity-60"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Mở PDF
                </button>
                <button
                  type="button"
                  disabled={isSourceProcessing}
                  onClick={manager.actions.openPagesDialog}
                  className="theme-button-primary-subtle inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  Xem trang
                </button>

                <button
                  type="button"
                  disabled={isSourceProcessing || manager.isRetryingSourceDocument}
                  onClick={() => void manager.actions.retrySourceDocument()}
                  className="theme-button-primary-subtle inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw
                    className={
                      manager.isRetryingSourceDocument
                        ? "h-4 w-4 animate-spin"
                        : "h-4 w-4"
                    }
                    aria-hidden="true"
                  />
                  Xử lý lại
                </button>
                <button
                  type="button"
                  disabled={manager.isDeletingSourceDocument}
                  onClick={() => setIsDeleteSourceConfirmOpen(true)}
                  className="theme-button-danger-subtle inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Xóa
                </button>
              </div>
            </div>

            {manager.latestRangeWarnings.length > 0 ? (
              <div className="grid gap-2 border-b border-[var(--theme-border)] bg-[var(--theme-warning-bg)] px-4 py-3">
                {manager.latestRangeWarnings.map((warning) => (
                  <p
                    key={warning.code}
                    className="text-sm font-bold text-[var(--theme-warning-text)]"
                  >
                    {warning.message}
                  </p>
                ))}
              </div>
            ) : null}

            <div className="p-4">
              {manager.sourcePages.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[var(--theme-border-strong)] bg-[var(--theme-surface)] p-4 text-sm font-semibold text-[var(--theme-text-muted)]">
                  Chưa có dữ liệu trang.
                </p>
              ) : (
                <OcrStatusSummaryView 
                  pages={manager.sourcePages} 
                  onResolveWarning={manager.actions.openPagesDialogWithWarnings}
                />
              )}
            </div>
          </div>
        ) : null}
      </div>

      <SourceDocumentUploadDialog
        isOpen={manager.dialogState?.type === "source-upload"}
        isSaving={manager.isUploadingSourceDocument}
        onClose={manager.actions.closeDialog}
        onSubmit={manager.actions.uploadSourceDocument}
      />
      <LessonDocumentUploadDialog
        isOpen={manager.dialogState?.type === "lesson-upload"}
        isSaving={manager.isUploadingLessonDocument}
        kind={uploadLessonKind}
        lesson={manager.selectedUploadLesson}
        onClose={manager.actions.closeDialog}
        onSubmit={(file, title) => {
          const lessonId = manager.selectedUploadLesson?.lesson.id;
          if (!lessonId || manager.dialogState?.type !== "lesson-upload") {
            return Promise.resolve();
          }

          return manager.actions.uploadLessonDocument(
            lessonId,
            manager.dialogState.kind,
            file,
            title,
          );
        }}
      />
      <SourceDocumentPagesDialog
        isOpen={manager.dialogState?.type === "pages"}
        initialFilter={manager.dialogState?.type === "pages" ? manager.dialogState.filter : undefined}
        pages={manager.sourcePages}
        sourceDocument={sourceDocument}
        onClose={manager.actions.closeDialog}
      />
      <LessonPageRangeDialog
        isOpen={manager.dialogState?.type === "ranges"}
        documentsByLessonId={manager.documentsByLessonId}
        isDeletingSupplement={manager.isDeletingSupplement}
        isSaving={manager.isSavingRanges}
        latestWarnings={manager.latestRangeWarnings}
        lessons={manager.lessons}
        localWarnings={manager.localRangeWarnings}
        pageLimit={manager.pageLimit}
        pages={manager.sourcePages}
        rangeDraft={manager.rangeDraft}
        rangeSubmitAttempted={manager.rangeSubmitAttempted}
        rangeValidation={manager.rangeValidation}
        sourceDocument={sourceDocument}
        onAutofill={manager.actions.autofillRanges}
        onClose={manager.actions.closeDialog}
        onDeleteSupplement={manager.actions.deleteSupplementDocument}
        onOpenPrimaryUpload={(lessonId) =>
          manager.actions.openLessonPrimaryUpload(lessonId, "ranges")
        }
        onOpenSupplementUpload={(lessonId) =>
          manager.actions.openLessonSupplementUpload(lessonId, "ranges")
        }
        onSave={manager.actions.saveRanges}
        onUpdateRange={manager.actions.updateRangeDraft}
      />
      <DeleteConfirmDialog
        confirmLabel="Xóa tài liệu"
        description="Tài liệu đang được gán vào buổi học sẽ không thể xóa."
        isConfirming={manager.isDeletingSourceDocument}
        isOpen={isDeleteSourceConfirmOpen}
        itemName={
          sourceDocument?.title ?? sourceDocument?.file.originalName ?? "tài liệu"
        }
        title="Xóa tài liệu nguồn"
        onCancel={() => setIsDeleteSourceConfirmOpen(false)}
        onConfirm={() => void handleDeleteSourceDocument()}
      />
    </section>
  );
}

function OcrStatusSummaryView({ 
  pages,
  onResolveWarning
}: { 
  pages: AdminSourceDocumentPageApi[];
  onResolveWarning?: () => void;
}) {
  const summary = useMemo(() => getOcrStatusSummary(pages), [pages]);

  const failedIssues = summary.issues.filter((issue) => issue.type === "failed");
  const warningIssues = summary.issues.filter((issue) => issue.type === "warning");
  const processingIssues = summary.issues.filter((issue) => issue.type === "processing");
  const successCount = summary.readyPages - summary.warningPages;

  return (
    <div className="grid gap-3">
      {/* Success row */}
      <div className="flex items-center gap-3 rounded-lg border border-[var(--theme-success-border)] bg-[var(--theme-success-bg)] px-4 py-3">
        <CheckCircle
          className="h-5 w-5 shrink-0 text-[var(--theme-success-text)]"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-[var(--theme-success-text)]">
            {successCount}/{summary.totalPages} trang OCR thành công
          </p>
          {successCount === summary.totalPages && summary.totalPages > 0 ? (
            <p className="mt-0.5 text-xs font-semibold text-[var(--theme-success-text)]">
              Tất cả trang đã sẵn sàng để gán vào buổi học.
            </p>
          ) : null}
        </div>
      </div>

      {/* Failed pages */}
      {failedIssues.length > 0 ? (
        <div className="rounded-lg border border-[var(--theme-danger-border)] bg-[var(--theme-danger-soft)]">
          <div className="flex items-center gap-3 px-4 py-3">
            <XCircle
              className="h-5 w-5 shrink-0 text-[var(--theme-danger)]"
              aria-hidden="true"
            />
            <p className="text-sm font-extrabold text-[var(--theme-danger)]">
              {failedIssues.length} trang gặp lỗi — cần xử lý lại
            </p>
          </div>
          <div className="border-t border-[var(--theme-danger-border)] px-4 py-2">
            {failedIssues.map((issue) => (
              <p
                key={issue.pageNumber}
                className="py-1 text-sm font-semibold text-[var(--theme-danger)]"
              >
                <span className="font-extrabold">Trang {issue.pageNumber}:</span>{" "}
                {issue.message}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      {/* Warning pages */}
      {warningIssues.length > 0 ? (
        <div className="rounded-lg border border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)]">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <AlertTriangle
                className="h-5 w-5 shrink-0 text-[var(--theme-warning-text)]"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-[var(--theme-warning-text)]">
                  {warningIssues.length} trang cần admin xác nhận số trang in
                </p>
                <p className="mt-0.5 text-xs font-semibold text-[var(--theme-warning-text)]">
                  Không thể gán khoảng trang cho buổi học cho đến khi xác nhận xong.
                </p>
              </div>
            </div>
            {onResolveWarning && (
              <button
                type="button"
                onClick={onResolveWarning}
                className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--theme-warning-border)] bg-[var(--theme-surface)] px-3 text-sm font-bold text-[var(--theme-warning-text)] shadow-sm transition hover:bg-[var(--theme-surface-hover)]"
              >
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                Xác nhận trang in
              </button>
            )}
          </div>
          <div className="border-t border-[var(--theme-warning-border)] px-4 py-2">
            {warningIssues.map((issue) => (
              <p
                key={issue.pageNumber}
                className="py-1 text-sm font-semibold text-[var(--theme-warning-text)]"
              >
                <span className="font-extrabold">Trang {issue.pageNumber}:</span>{" "}
                {issue.message}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      {/* Processing pages */}
      {processingIssues.length > 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-[var(--theme-primary-border)] bg-[var(--theme-primary-soft)] px-4 py-3">
          <Loader2
            className="h-5 w-5 shrink-0 animate-spin text-[var(--theme-primary)]"
            aria-hidden="true"
          />
          <p className="text-sm font-extrabold text-[var(--theme-primary)]">
            {processingIssues.length} trang đang xử lý
          </p>
        </div>
      ) : null}
    </div>
  );
}
