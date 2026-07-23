"use client";

import { FilePlus2, FileUp, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import { TextField } from "@/components/common/forms/text-field";
import type { AdminLessonWithChapter } from "@/features/admin/courses/admin-course-documents-utils";
import type { AdminLessonDocumentKind } from "@/features/admin/courses/types/admin-course-document-types";

export function LessonDocumentUploadDialog({
  isOpen,
  isSaving,
  kind,
  lesson,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  isSaving: boolean;
  kind: Exclude<AdminLessonDocumentKind, "HOMEWORK">;
  lesson: AdminLessonWithChapter | null;
  onClose: () => void;
  onSubmit: (file: File, title: string) => Promise<unknown>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const isPrimary = kind === "PRIMARY_FROM_SOURCE";

  useEffect(() => {
    if (isOpen) {
      setFile(null);
      setTitle("");
      setTitleError(null);
      setFileError(null);
    }
  }, [isOpen, lesson?.lesson.id]);

  async function handleSubmit() {
    if (!lesson) {
      return;
    }

    let hasError = false;

    if (!file) {
      setFileError("Chọn một file PDF.");
      hasError = true;
    } else if (file.type !== "application/pdf") {
      setFileError("File phải là PDF.");
      hasError = true;
    }

    if (!title.trim()) {
      setTitleError("Vui lòng nhập tên tài liệu.");
      hasError = true;
    }

    if (hasError || !file) {
      return;
    }

    setFileError(null);
    await onSubmit(file, title);
  }

  return (
    <EditorDialogShell
      ariaLabel={isPrimary ? "Thay tài liệu chính" : "Thêm tài liệu bổ sung"}
      isOpen={isOpen}
      onClose={isSaving ? () => undefined : onClose}
    >
      <div className="theme-dialog-header flex min-h-16 shrink-0 items-center gap-3 p-4 pr-16 sm:p-5 sm:pr-20">
        <span className="theme-button-primary-subtle grid h-10 w-10 shrink-0 place-items-center rounded-lg">
          {isPrimary ? (
            <FileUp className="h-5 w-5" aria-hidden="true" />
          ) : (
            <FilePlus2 className="h-5 w-5" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
            {isPrimary ? "Thay tài liệu chính" : "Thêm tài liệu bổ sung"}
          </h2>
          {lesson ? (
            <p className="mt-1 truncate text-sm font-semibold text-[var(--theme-text-muted)]">
              {lesson.lesson.title}
            </p>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="grid gap-4">
          <label className="block">
            <span className="text-sm font-extrabold text-[var(--theme-text-strong)]">
              File PDF
            </span>
            <input
              type="file"
              accept="application/pdf"
              disabled={isSaving}
              aria-invalid={fileError ? "true" : "false"}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setFileError(null);
              }}
              className="mt-2 block w-full cursor-pointer rounded-lg border border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] p-3 text-sm font-semibold text-[var(--theme-text)] file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[var(--theme-primary)] file:px-3 file:py-2 file:text-sm file:font-extrabold file:text-[var(--theme-primary-foreground)] disabled:cursor-not-allowed disabled:opacity-60"
            />
            {fileError ? (
              <p className="mt-1.5 text-sm leading-5 text-[var(--theme-error-text)]">
                {fileError}
              </p>
            ) : null}
          </label>

          <TextField
            id="lesson-document-title"
            label="Tên hiển thị"
            icon={null}
            value={title}
            disabled={isSaving}
            maxLength={180}
            onChange={(event) => {
              const val = event.target.value;
              setTitle(val);
              setTitleError(val.trim() ? null : "Vui lòng nhập tên tài liệu.");
            }}
            onBlur={() => {
              setTitleError(title.trim() ? null : "Vui lòng nhập tên tài liệu.");
            }}
            placeholder={isPrimary ? "PDF chính của buổi học" : "Phiếu bài tập thêm"}
            error={titleError ? { message: titleError, type: "manual" } : undefined}
          />
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
          disabled={isSaving || !lesson}
          onClick={() => void handleSubmit()}
          className="theme-button-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-extrabold transition disabled:cursor-wait disabled:opacity-70"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <FileUp className="h-4 w-4" aria-hidden="true" />
          )}
          {isSaving ? "Đang tải lên" : isPrimary ? "Thay tài liệu" : "Thêm tài liệu"}
        </button>
      </div>
    </EditorDialogShell>
  );
}
