"use client";

import { Loader2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import type { AdminQuizQuestion } from "@/features/admin/quiz/api/admin-quiz-api";
import { cn } from "@/lib/utils";

export const ADMIN_QUIZ_FIGURE_ROLES = ["QUESTION", "SOLUTION"] as const;

export type AdminQuizFigureRole = (typeof ADMIN_QUIZ_FIGURE_ROLES)[number];
export type AdminQuizDraftFigureFiles = Partial<Record<AdminQuizFigureRole, File>>;

export function AdminQuizFigureUploadFields({
  disabled,
  draftFiles,
  pendingRole,
  question,
  onFileSelect,
}: {
  disabled: boolean;
  draftFiles: AdminQuizDraftFigureFiles;
  pendingRole?: AdminQuizFigureRole;
  question: AdminQuizQuestion | null;
  onFileSelect: (role: AdminQuizFigureRole, file: File) => void | Promise<void>;
}) {
  const questionPreviewUrl = useFilePreviewUrl(draftFiles.QUESTION);
  const solutionPreviewUrl = useFilePreviewUrl(draftFiles.SOLUTION);
  const draftPreviewUrls: Partial<Record<AdminQuizFigureRole, string>> = {
    QUESTION: questionPreviewUrl,
    SOLUTION: solutionPreviewUrl,
  };

  return (
    <section className="space-y-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-4">
      <div>
        <h3 className="text-sm font-extrabold text-[var(--theme-text-strong)]">
          Hình minh họa riêng của Quiz
        </h3>
        <p className="mt-1 text-xs font-medium text-[var(--theme-text-muted)]">
          Hình đề hiển thị khi làm bài. Hình lời giải chỉ hiển thị sau khi kiểm tra
          đáp án và phải được dựng trên hình đề.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {ADMIN_QUIZ_FIGURE_ROLES.map((role) => {
          const figure = question?.figures?.find((item) => item.role === role);
          const draftFile = draftFiles[role];
          const imageUrl =
            draftPreviewUrls[role] ??
            figure?.currentRevision?.deliveryFile?.publicUrl ??
            undefined;
          const isPending = pendingRole === role;
          const roleLabel = role === "QUESTION" ? "Hình đề" : "Hình lời giải";

          return (
            <div
              key={role}
              className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3"
            >
              <p className="text-sm font-extrabold text-[var(--theme-text-strong)]">
                {roleLabel}
              </p>
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={
                    draftFile
                      ? `Xem trước ${roleLabel.toLocaleLowerCase("vi")}`
                      : (figure?.currentRevision?.altText ?? `${roleLabel} Quiz`)
                  }
                  className="mt-2 max-h-44 w-full rounded-lg object-contain"
                />
              ) : (
                <p className="mt-2 text-xs font-semibold text-[var(--theme-text-muted)]">
                  {figure ? `Trạng thái: ${figure.status}` : "Chưa có hình được tải lên."}
                </p>
              )}
              {draftFile ? (
                <p className="mt-2 truncate text-xs font-semibold text-[var(--theme-text-muted)]">
                  Đã chọn: {draftFile.name}
                </p>
              ) : null}
              <label
                className={cn(
                  "theme-button-primary-subtle mt-3 inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-extrabold",
                  disabled
                    ? "cursor-not-allowed opacity-60"
                    : "cursor-pointer",
                )}
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Upload className="h-4 w-4" aria-hidden="true" />
                )}
                {imageUrl ? "Thay hình" : "Tải hình lên"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={disabled}
                  aria-label={`${imageUrl ? "Thay" : "Tải"} ${roleLabel.toLocaleLowerCase("vi")}`}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = "";
                    if (file) void onFileSelect(role, file);
                  }}
                />
              </label>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function useFilePreviewUrl(file?: File) {
  const [previewUrl, setPreviewUrl] = useState<string>();

  useEffect(() => {
    if (!file) {
      setPreviewUrl(undefined);
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl(nextPreviewUrl);
    return () => URL.revokeObjectURL(nextPreviewUrl);
  }, [file]);

  return previewUrl;
}
