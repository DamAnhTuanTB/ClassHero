"use client";

import { BookOpen, FileText, Link2 } from "lucide-react";
import { useMemo } from "react";
import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import { SourceDocumentRangePreview } from "@/components/admin/courses/source-document-range-preview";
import type { AdminLessonWithChapter } from "@/features/admin/courses/admin-course-documents-utils";
import type {
  AdminLessonDocumentApi,
  AdminSourceDocumentApi,
  AdminSourceDocumentPageApi,
} from "@/features/admin/courses/types/admin-course-document-types";

type SourceDocumentAssignmentRange = {
  id: string;
  pageEnd: number;
  pages: AdminSourceDocumentPageApi[];
  pageStart: number;
};

type SourceDocumentAssignment = {
  chapterOrder: number;
  chapterTitle: string;
  lessonId: string;
  lessonOrder: number;
  lessonTitle: string;
  ranges: SourceDocumentAssignmentRange[];
};

export function SourceDocumentAssignmentsDialog({
  documentsByLessonId,
  isOpen,
  lessons,
  pages,
  sourceDocument,
  onClose,
}: {
  documentsByLessonId: Record<string, AdminLessonDocumentApi[]>;
  isOpen: boolean;
  lessons: AdminLessonWithChapter[];
  pages: AdminSourceDocumentPageApi[];
  sourceDocument: AdminSourceDocumentApi | null;
  onClose: () => void;
}) {
  const assignments = useMemo(
    () =>
      buildSourceDocumentAssignments({
        documentsByLessonId,
        lessons,
        pages,
        sourceDocumentId: sourceDocument?.id ?? null,
      }),
    [documentsByLessonId, lessons, pages, sourceDocument?.id],
  );
  return (
    <EditorDialogShell
      ariaLabel="Chi tiết buổi học đã gán"
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="max-w-4xl"
    >
      <div className="theme-dialog-header flex min-h-16 shrink-0 items-center gap-3 p-4 pr-16 sm:p-5 sm:pr-20">
        <span className="theme-button-primary-subtle grid h-10 w-10 shrink-0 place-items-center rounded-lg">
          <Link2 className="h-5 w-5" aria-hidden="true" />
        </span>
        <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
          Chi tiết buổi học đã gán
        </h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="mb-5 overflow-hidden rounded-xl border border-[var(--theme-primary-border)] bg-[var(--theme-primary-soft)] shadow-[var(--theme-shadow-sm)]">
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[var(--theme-primary-border)] bg-[var(--theme-surface)] text-[var(--theme-primary)]">
                <FileText className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-wide text-[var(--theme-primary)]">
                  Tài liệu nguồn
                </p>
                <p className="mt-1 truncate text-base font-extrabold text-[var(--theme-text-strong)]">
                  {sourceDocument?.title ??
                    sourceDocument?.file.originalName ??
                    "Tài liệu nguồn"}
                </p>
              </div>
            </div>

            <span className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-[var(--theme-primary-border)] bg-[var(--theme-surface)] px-3 py-2 text-sm font-extrabold text-[var(--theme-text-strong)]">
              <BookOpen
                className="h-4 w-4 text-[var(--theme-primary)]"
                aria-hidden="true"
              />
              {assignments.length} buổi học đã gán
            </span>
          </div>
        </div>

        {assignments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--theme-border-strong)] bg-[var(--theme-surface-soft)] p-6 text-center">
            <BookOpen
              className="mx-auto h-9 w-9 text-[var(--theme-text-muted)]"
              aria-hidden="true"
            />
            <p className="mt-3 text-sm font-extrabold text-[var(--theme-text-strong)]">
              Chưa gán buổi học
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--theme-text-muted)]">
              Tài liệu nguồn này chưa có khoảng trang được gán.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {assignments.map((assignment) => (
              <article
                key={assignment.lessonId}
                className="overflow-hidden rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)]"
              >
                <div className="border-b border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-3 py-3 sm:px-4">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-[var(--theme-text-muted)]">
                    {assignment.chapterTitle}
                  </p>
                  <h3 className="mt-1 text-base font-extrabold text-[var(--theme-text-strong)]">
                    {assignment.lessonTitle}
                  </h3>
                </div>

                <div className="grid gap-2 p-3 sm:p-4">
                  {assignment.ranges.map((range) => (
                    <div key={range.id} className="grid gap-2">
                      <p className="inline-flex items-center gap-2 text-sm font-extrabold text-[var(--theme-text-strong)]">
                        <FileText
                          className="h-4 w-4 shrink-0 text-[var(--theme-primary)]"
                          aria-hidden="true"
                        />
                        {formatPageRange(range.pageStart, range.pageEnd)}
                      </p>
                      <SourceDocumentRangePreview
                        pages={range.pages}
                        sourceDocument={sourceDocument}
                      />
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="theme-dialog-footer grid shrink-0 grid-cols-1 gap-2 p-3 sm:flex sm:justify-end sm:p-4">
        <button
          type="button"
          onClick={onClose}
          className="theme-button-neutral inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-lg px-4 text-sm font-extrabold transition sm:w-auto"
        >
          Hủy
        </button>
      </div>
    </EditorDialogShell>
  );
}

function buildSourceDocumentAssignments({
  documentsByLessonId,
  lessons,
  pages,
  sourceDocumentId,
}: {
  documentsByLessonId: Record<string, AdminLessonDocumentApi[]>;
  lessons: AdminLessonWithChapter[];
  pages: AdminSourceDocumentPageApi[];
  sourceDocumentId: string | null;
}) {
  if (!sourceDocumentId) {
    return [];
  }

  return lessons
    .map<SourceDocumentAssignment | null>((item) => {
      const uniqueRanges = new Map<string, AdminLessonDocumentApi>();

      for (const document of documentsByLessonId[item.lesson.id] ?? []) {
        if (
          document.kind !== "PRIMARY_FROM_SOURCE" ||
          document.sourceDocumentId !== sourceDocumentId ||
          !document.pageRange
        ) {
          continue;
        }

        uniqueRanges.set(document.pageRange.id, document);
      }

      const ranges = Array.from(uniqueRanges.values())
        .map((document) => {
          const pageRange = document.pageRange;
          if (!pageRange) {
            return null;
          }

          return {
            id: pageRange.id,
            pageEnd: pageRange.pageEnd,
            pageStart: pageRange.pageStart,
            pages: pages
              .filter(
                (page) =>
                  page.pageNumber >= pageRange.pageStart &&
                  page.pageNumber <= pageRange.pageEnd,
              )
              .sort((left, right) => left.pageNumber - right.pageNumber),
          };
        })
        .filter((range): range is SourceDocumentAssignmentRange => range !== null)
        .sort((left, right) => left.pageStart - right.pageStart);

      if (ranges.length === 0) {
        return null;
      }

      return {
        chapterOrder: item.chapterOrder,
        chapterTitle: item.chapterTitle,
        lessonId: item.lesson.id,
        lessonOrder: item.lesson.orderIndex,
        lessonTitle: item.lesson.title,
        ranges,
      };
    })
    .filter((assignment): assignment is SourceDocumentAssignment => assignment !== null)
    .sort(
      (left, right) =>
        left.chapterOrder - right.chapterOrder || left.lessonOrder - right.lessonOrder,
    );
}

function formatPageRange(pageStart: number, pageEnd: number) {
  return pageStart === pageEnd ? `Trang ${pageStart}` : `Trang ${pageStart}–${pageEnd}`;
}
