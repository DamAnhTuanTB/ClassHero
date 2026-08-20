"use client";

import { CheckCircle2, ExternalLink, FileSearch, Loader2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import {
  promoteAdminSourceDocumentSearchablePdf,
  uploadAdminLessonDocumentFile,
  validateAdminSourceDocumentSearchablePdf,
} from "@/features/admin/courses/api/admin-course-documents-api";
import type { AdminSearchablePdfValidationApi } from "@/features/admin/courses/types/admin-course-document-types";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";

export function SearchablePdfPromoteDialog({
  isOpen,
  sourceDocumentId,
  onClose,
  onPromoted,
}: {
  isOpen: boolean;
  sourceDocumentId: string | null;
  onClose: () => void;
  onPromoted: () => void;
}) {
  const token = useAuthSessionStore((state) => state.session?.accessToken ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<AdminSearchablePdfValidationApi | null>(null);
  const [acceptWarnings, setAcceptWarnings] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFile(null);
    setValidation(null);
    setAcceptWarnings(false);
    setError(null);
  }, [isOpen]);

  async function validate() {
    if (!file || file.type !== "application/pdf" || !sourceDocumentId) {
      setError("Chọn đúng file PDF searchable cần đối chiếu.");
      return;
    }
    setIsValidating(true);
    setError(null);
    try {
      const uploaded = await uploadAdminLessonDocumentFile(file, token);
      const result = await validateAdminSourceDocumentSearchablePdf(
        sourceDocumentId,
        uploaded.id,
        token,
      );
      setValidation(result);
      if (result.status === "FAILED") {
        setError("PDF không tương đương với bản scan hiện hành; không thể promote.");
      }
    } catch (caught) {
      setError(getUserFacingErrorMessage(caught, "Không thể đối chiếu PDF."));
    } finally {
      setIsValidating(false);
    }
  }

  async function promote() {
    if (!sourceDocumentId || !validation) return;
    if (validation.status === "WARNING" && !acceptWarnings) {
      setError("Hãy xem contact sheet và xác nhận chấp nhận cảnh báo trước khi promote.");
      return;
    }
    setIsPromoting(true);
    setError(null);
    try {
      await promoteAdminSourceDocumentSearchablePdf(
        sourceDocumentId,
        validation.id,
        acceptWarnings,
        token,
      );
      toast.success("Đã dùng PDF searchable làm file nguồn hiện hành");
      onPromoted();
      onClose();
    } catch (caught) {
      setError(getUserFacingErrorMessage(caught, "Không thể promote PDF searchable."));
    } finally {
      setIsPromoting(false);
    }
  }

  const isBusy = isValidating || isPromoting;
  const canPromote =
    validation?.status === "PASSED" ||
    (validation?.status === "WARNING" && acceptWarnings);

  return (
    <EditorDialogShell
      ariaLabel="Thay bằng PDF searchable"
      isOpen={isOpen}
      onClose={isBusy ? () => undefined : onClose}
    >
      <div className="theme-dialog-header flex min-h-16 items-center gap-3 p-4 pr-16 sm:p-5 sm:pr-20">
        <span className="theme-button-primary-subtle grid h-10 w-10 place-items-center rounded-lg">
          <FileSearch className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
            Thay bằng PDF searchable
          </h2>
          <p className="text-sm font-semibold text-[var(--theme-text-muted)]">
            Hệ thống đối chiếu toàn bộ trang, bố cục và crop trước khi thay file.
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        <label className="block">
          <span className="text-sm font-extrabold text-[var(--theme-text-strong)]">
            File PDF đã có text layer
          </span>
          <input
            type="file"
            accept="application/pdf"
            disabled={isBusy}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setValidation(null);
              setAcceptWarnings(false);
              setError(null);
            }}
            className="mt-2 block w-full cursor-pointer rounded-lg border border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] p-3 text-sm font-semibold text-[var(--theme-text)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--theme-primary)] file:px-3 file:py-2 file:text-sm file:font-extrabold file:text-[var(--theme-primary-foreground)] disabled:opacity-60"
          />
        </label>

        {validation ? (
          <div className="space-y-3 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-4">
            <div className="flex items-center gap-2">
              {validation.status === "PASSED" ? (
                <CheckCircle2 className="h-5 w-5 text-[var(--theme-success-text)]" />
              ) : (
                <TriangleAlert className="h-5 w-5 text-[var(--theme-warning-text)]" />
              )}
              <p className="font-extrabold text-[var(--theme-text-strong)]">
                {validation.report.pageCount} trang · text layer {validation.report.searchablePageCount}/
                {validation.report.pageCount} · crop {validation.report.cropAudit.passed}/
                {validation.report.cropAudit.checked}
              </p>
            </div>
            {validation.report.warnings.map((warning) => (
              <p key={warning} className="text-sm font-semibold text-[var(--theme-warning-text)]">
                {warning}
              </p>
            ))}
            {validation.report.hardFailures.map((failure) => (
              <p key={failure} className="text-sm font-semibold text-[var(--theme-error-text)]">
                {failure}
              </p>
            ))}
            {validation.contactSheetUrl ? (
              <a
                href={validation.contactSheetUrl}
                target="_blank"
                rel="noreferrer"
                className="theme-button-neutral inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-bold"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Mở contact sheet để kiểm tra bằng mắt
              </a>
            ) : null}
            {validation.status === "WARNING" ? (
              <label className="flex items-start gap-2 text-sm font-semibold text-[var(--theme-text)]">
                <input
                  type="checkbox"
                  checked={acceptWarnings}
                  onChange={(event) => setAcceptWarnings(event.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                Tôi đã kiểm tra contact sheet và chấp nhận các cảnh báo trên.
              </label>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-lg bg-[var(--theme-danger-soft)] p-3 text-sm font-semibold text-[var(--theme-error-text)]">
            {error}
          </p>
        ) : null}
      </div>

      <div className="theme-dialog-footer grid grid-cols-2 gap-2 p-3 sm:flex sm:justify-end sm:p-4">
        <button type="button" disabled={isBusy} onClick={onClose} className="theme-button-neutral min-h-11 rounded-lg px-4 text-sm font-extrabold disabled:opacity-60">
          Đóng
        </button>
        {!validation ? (
          <button type="button" disabled={isBusy || !file} onClick={() => void validate()} className="theme-button-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-extrabold disabled:opacity-60">
            {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}
            {isValidating ? "Đang đối chiếu" : "Đối chiếu toàn bộ"}
          </button>
        ) : (
          <button type="button" disabled={isBusy || !canPromote} onClick={() => void promote()} className="theme-button-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-extrabold disabled:opacity-60">
            {isPromoting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {isPromoting ? "Đang thay file" : "Dùng PDF này"}
          </button>
        )}
      </div>
    </EditorDialogShell>
  );
}
