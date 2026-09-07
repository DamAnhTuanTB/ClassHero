"use client";

import { useEffect, useState } from "react";
import { AdminImageUploadField } from "@/components/common/forms/admin-image-upload-field";
import type { AdminQuizQuestion } from "@/features/admin/quiz/api/admin-quiz-api";

export const ADMIN_QUIZ_FIGURE_ROLES = ["QUESTION", "SOLUTION"] as const;

export type AdminQuizFigureRole = (typeof ADMIN_QUIZ_FIGURE_ROLES)[number];
export type AdminQuizDraftFigureFiles = Partial<Record<AdminQuizFigureRole, File>>;

export function AdminQuizFigureUploadFields({
  disabled,
  deletedRoles,
  draftFiles,
  pendingRole,
  question,
  deletingRole,
  onDelete,
  onFileSelect,
}: {
  disabled: boolean;
  deletedRoles: readonly AdminQuizFigureRole[];
  draftFiles: AdminQuizDraftFigureFiles;
  deletingRole?: AdminQuizFigureRole;
  pendingRole?: AdminQuizFigureRole;
  question: AdminQuizQuestion | null;
  onDelete: (role: AdminQuizFigureRole) => void | Promise<void>;
  onFileSelect: (role: AdminQuizFigureRole, file: File) => void | Promise<void>;
}) {
  const questionPreviewUrl = useFilePreviewUrl(draftFiles.QUESTION);
  const solutionPreviewUrl = useFilePreviewUrl(draftFiles.SOLUTION);
  const draftPreviewUrls: Partial<Record<AdminQuizFigureRole, string>> = {
    QUESTION: questionPreviewUrl,
    SOLUTION: solutionPreviewUrl,
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {ADMIN_QUIZ_FIGURE_ROLES.map((role) => {
        const figure = question?.figures?.find((item) => item.role === role);
        const draftFile = draftFiles[role];
        const isDeleted = deletedRoles.includes(role);
        const imageUrl = isDeleted
          ? undefined
          : (draftPreviewUrls[role] ??
            figure?.currentRevision?.deliveryFile?.publicUrl ??
            undefined);
        const isPending = pendingRole === role;
        const roleLabel = role === "QUESTION" ? "Hình đề" : "Hình lời giải";

        return (
          <AdminImageUploadField
            key={role}
            altText={
              draftFile
                ? `Xem trước ${roleLabel.toLocaleLowerCase("vi")}`
                : (figure?.currentRevision?.altText ?? `${roleLabel} Quiz`)
            }
            disabled={disabled}
            emptyText={
              isDeleted
                ? "Hình sẽ được xóa khi lưu."
                : figure
                  ? `Trạng thái: ${figure.status}`
                  : "Chưa có hình được tải lên."
            }
            imageUrl={imageUrl}
            isDeleting={deletingRole === role}
            isUploading={isPending}
            label={roleLabel}
            selectedFileName={draftFile?.name}
            onDelete={imageUrl ? () => onDelete(role) : undefined}
            onFileSelect={(file) => onFileSelect(role, file)}
          />
        );
      })}
    </div>
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
