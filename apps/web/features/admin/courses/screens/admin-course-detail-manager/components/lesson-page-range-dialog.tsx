"use client";

import { ListChecks, Loader2, Wand2 } from "lucide-react";
import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import type {
  AdminLessonWithChapter,
  LessonRangeDraft,
  LessonRangeValidationResult,
} from "@/features/admin/courses/admin-course-documents-utils";
import { LessonPageRangeRow } from "@/features/admin/courses/screens/admin-course-detail-manager/components/lesson-page-range-row";
import type {
  AdminLessonDocumentApi,
  AdminPageRangeWarningApi,
  AdminSourceDocumentApi,
  AdminSourceDocumentPageApi,
} from "@/features/admin/courses/types/admin-course-document-types";

export function LessonPageRangeDialog({
  isOpen,
  isSaving,
  isDeletingSupplement,
  latestWarnings,
  lessons,
  localWarnings,
  documentsByLessonId,
  pageLimit,
  pages,
  rangeDraft,
  rangeSubmitAttempted,
  rangeValidation,
  sourceDocument,
  onAutofill,
  onClose,
  onDeleteSupplement,
  onOpenSupplementUpload,
  onSave,
  onUpdateRange,
}: {
  isOpen: boolean;
  isSaving: boolean;
  isDeletingSupplement: boolean;
  latestWarnings: AdminPageRangeWarningApi[];
  lessons: AdminLessonWithChapter[];
  localWarnings: AdminPageRangeWarningApi[];
  documentsByLessonId: Record<string, AdminLessonDocumentApi[]>;
  pageLimit: number | null;
  pages: AdminSourceDocumentPageApi[];
  rangeDraft: LessonRangeDraft;
  rangeSubmitAttempted: boolean;
  rangeValidation: LessonRangeValidationResult;
  sourceDocument: AdminSourceDocumentApi | null;
  onAutofill: () => void;
  onClose: () => void;
  onDeleteSupplement: (lessonId: string, documentId: string) => void;
  onOpenSupplementUpload: (lessonId: string) => void;
  onSave: () => Promise<unknown>;
  onUpdateRange: (
    lessonId: string,
    field:
      "pageEnd" | "pageStart" | "isPrimary" | "primarySupplementId" | "newSupplements",
    value:
      | string
      | boolean
      | null
      | { id: string; file: File | null; title: string; isPrimary: boolean }[],
  ) => void;
}) {
  const warnings = localWarnings.length > 0 ? localWarnings : latestWarnings;

  return (
    <EditorDialogShell
      ariaLabel="Nhập khoảng trang"
      isOpen={isOpen}
      onClose={isSaving ? () => undefined : onClose}
      panelClassName="max-w-5xl"
    >
      <div className="theme-dialog-header flex min-h-16 shrink-0 items-center gap-3 p-4 pr-16 sm:p-5 sm:pr-20">
        <span className="theme-button-primary-subtle grid h-10 w-10 shrink-0 place-items-center rounded-lg">
          <ListChecks className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
            Nhập khoảng trang
          </h2>
          <p className="mt-1 truncate text-sm font-semibold text-[var(--theme-text-muted)]">
            {sourceDocument?.title ??
              sourceDocument?.file.originalName ??
              "Tài liệu chính"}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-extrabold text-[var(--theme-text-strong)]">
              {lessons.length} buổi học
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--theme-text-muted)]">
              {pageLimit ? `${pageLimit} trang PDF` : "Đang chờ số trang"}
            </p>
          </div>
          <button
            type="button"
            disabled={!pageLimit || lessons.length === 0 || isSaving}
            onClick={onAutofill}
            className="theme-button-primary-subtle inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-extrabold transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Wand2 className="h-4 w-4" aria-hidden="true" />
            Gợi ý chia trang
          </button>
        </div>
        {warnings.length > 0 ? (
          <div className="mb-4 grid gap-2">
            {warnings.map((warning) => (
              <p
                key={warning.code}
                className="rounded-lg border border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] px-3 py-2 text-sm font-bold text-[var(--theme-warning-text)]"
              >
                {warning.message}
              </p>
            ))}
          </div>
        ) : null}

        <div className="grid gap-3">
          {lessons.map((item) => {
            const draft = rangeDraft[item.lesson.id] ?? {
              pageEnd: "",
              pageStart: "",
            };
            const issue = rangeValidation.issues.find(
              (rangeIssue) => rangeIssue.lessonId === item.lesson.id,
            );

            return (
              <LessonPageRangeRow
                key={item.lesson.id}
                documents={documentsByLessonId[item.lesson.id] ?? []}
                draft={draft}
                isDeletingSupplement={isDeletingSupplement}
                isSaving={isSaving}
                issue={issue}
                item={item}
                pages={pages}
                sourceDocument={sourceDocument}
                rangeSubmitAttempted={rangeSubmitAttempted}
                onDeleteSupplement={onDeleteSupplement}
                onUpdateRange={onUpdateRange}
              />
            );
          })}
        </div>
      </div>

      <div className="theme-dialog-footer grid shrink-0 grid-cols-2 gap-2 p-3 sm:flex sm:justify-end sm:p-4">
        <button
          type="button"
          disabled={isSaving}
          onClick={onClose}
          className="theme-button-neutral inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-extrabold transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          Hủy
        </button>
        <button
          type="button"
          disabled={isSaving || !sourceDocument || !pageLimit || lessons.length === 0}
          onClick={() => void onSave()}
          className="theme-button-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-extrabold transition disabled:cursor-wait disabled:opacity-70"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <ListChecks className="h-4 w-4" aria-hidden="true" />
          )}
          {isSaving ? "Đang lưu" : "Lưu khoảng trang"}
        </button>
      </div>
    </EditorDialogShell>
  );
}
