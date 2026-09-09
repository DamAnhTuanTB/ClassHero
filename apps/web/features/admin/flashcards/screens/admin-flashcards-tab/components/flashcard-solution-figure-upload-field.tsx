"use client";

import { useEffect, useState } from "react";
import { AdminImageUploadField } from "@/components/common/forms/admin-image-upload-field";
import type { AdminFlashcardFigure } from "@/features/admin/flashcards/api/admin-flashcards-api";

export function FlashcardSolutionFigureUploadField({
  deleted,
  disabled,
  figure,
  isDeleting,
  isUploading,
  selectedFile,
  onDelete,
  onFileSelect,
}: {
  deleted: boolean;
  disabled: boolean;
  figure?: AdminFlashcardFigure;
  isDeleting: boolean;
  isUploading: boolean;
  selectedFile?: File;
  onDelete: () => void;
  onFileSelect: (file: File) => void;
}) {
  const previewUrl = useFilePreviewUrl(selectedFile);
  const imageUrl = deleted
    ? undefined
    : (previewUrl ?? figure?.currentRevision?.deliveryFile?.publicUrl ?? undefined);

  return (
    <AdminImageUploadField
      altText={
        selectedFile
          ? "Xem trước hình lời giải Flashcard"
          : (figure?.currentRevision?.altText ?? "Hình lời giải Flashcard")
      }
      disabled={disabled}
      emptyText={
        deleted
          ? "Hình sẽ được xóa khi lưu."
          : figure
            ? `Trạng thái: ${figure.status}`
            : "Chưa có hình được tải lên."
      }
      imageUrl={imageUrl}
      isDeleting={isDeleting}
      isUploading={isUploading}
      label="Hình lời giải"
      selectedFileName={selectedFile?.name}
      onDelete={imageUrl ? onDelete : undefined}
      onFileSelect={onFileSelect}
    />
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
