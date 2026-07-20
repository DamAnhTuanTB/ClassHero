"use client";

import { FileUp, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";

export function SourceDocumentUploadDialog({
  isOpen,
  isSaving,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (file: File, title: string) => Promise<unknown>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFile(null);
      setTitle("");
      setError(null);
    }
  }, [isOpen]);

  async function handleSubmit() {
    if (!file) {
      setError("Chọn một file PDF.");
      return;
    }

    if (file.type !== "application/pdf") {
      setError("File phải là PDF.");
      return;
    }

    setError(null);
    await onSubmit(file, title);
  }

  return (
    <EditorDialogShell
      ariaLabel="Upload tài liệu nguồn"
      isOpen={isOpen}
      onClose={isSaving ? () => undefined : onClose}
    >
      <div className="theme-dialog-header flex min-h-16 shrink-0 items-center gap-3 p-4 pr-16 sm:p-5 sm:pr-20">
        <span className="theme-button-primary-subtle grid h-10 w-10 shrink-0 place-items-center rounded-lg">
          <FileUp className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
            Upload PDF nguồn
          </h2>
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
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setError(null);
              }}
              className="mt-2 block w-full cursor-pointer rounded-lg border border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] p-3 text-sm font-semibold text-[var(--theme-text)] file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[var(--theme-primary)] file:px-3 file:py-2 file:text-sm file:font-extrabold file:text-[var(--theme-primary-foreground)] disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>

          <label className="block">
            <span className="text-sm font-extrabold text-[var(--theme-text-strong)]">
              Tên tài liệu
            </span>
            <input
              value={title}
              disabled={isSaving}
              maxLength={180}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ví dụ: Toán 7 Tập 1"
              className="mt-2 min-h-12 w-full rounded-lg border border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] px-3 text-sm font-bold text-[var(--theme-text-strong)] outline-none transition placeholder:text-[var(--theme-text-placeholder)] focus:border-[var(--theme-primary)] focus:ring-4 focus:ring-[var(--theme-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>

          {error ? (
            <p className="rounded-lg border border-[var(--theme-danger-border)] bg-[var(--theme-danger-soft)] px-3 py-2 text-sm font-bold text-[var(--theme-danger)]">
              {error}
            </p>
          ) : null}
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
          disabled={isSaving}
          onClick={() => void handleSubmit()}
          className="theme-button-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-extrabold transition disabled:cursor-wait disabled:opacity-70"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <FileUp className="h-4 w-4" aria-hidden="true" />
          )}
          {isSaving ? "Đang tải lên" : "Upload và xử lý"}
        </button>
      </div>
    </EditorDialogShell>
  );
}
