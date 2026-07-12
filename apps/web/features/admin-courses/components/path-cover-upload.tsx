"use client";

import { ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FieldLabel } from "@/components/forms/field-label";

const maxImageSizeBytes = 5 * 1024 * 1024;

export function PathCoverUpload({
  fileName,
  imageUrl,
  isDarkTheme = false,
  onChange,
  onUploadFile,
}: {
  fileName: string;
  imageUrl: string;
  isDarkTheme?: boolean;
  onChange: (value: { fileId: string; fileName: string; imageUrl: string }) => void;
  onUploadFile: (file: File) => Promise<{
    fileId: string;
    fileName: string;
    imageUrl: string;
  }>;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [localError, setLocalError] = useState("");
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const visibleImageUrl = localPreviewUrl || imageUrl;
  const shouldShowImage = Boolean(visibleImageUrl) && !imageLoadFailed;

  useEffect(() => {
    setImageLoadFailed(false);
  }, [visibleImageUrl]);

  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <FieldLabel
          id="admin-course-cover"
          label="Ảnh đại diện"
          isDarkTheme={isDarkTheme}
          isOptional
        />
        <span className="text-xs font-bold text-[var(--theme-text-muted)]">
          PNG/JPG/WebP tối đa 5MB
        </span>
      </div>
      <div className="grid gap-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-center">
        <div className="relative aspect-[16/10] overflow-hidden rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)]">
          {shouldShowImage ? (
            <img
              src={visibleImageUrl}
              alt="Ảnh đại diện lộ trình"
              onError={() => setImageLoadFailed(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full place-items-center bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]">
              <ImagePlus className="h-9 w-9" aria-hidden="true" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold text-[var(--theme-text-strong)]">
            {fileName || "Chưa chọn ảnh"}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading}
              className="theme-button-success inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-extrabold transition"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Upload className="h-4 w-4" aria-hidden="true" />
              )}
              {isUploading ? "Đang tải" : "Chọn ảnh"}
            </button>
            {visibleImageUrl ? (
              <button
                type="button"
                disabled={isUploading}
                onClick={() => {
                  setLocalError("");
                  setImageLoadFailed(false);
                  setLocalPreviewUrl("");
                  onChange({ fileId: "", fileName: "", imageUrl: "" });
                  if (inputRef.current) {
                    inputRef.current.value = "";
                  }
                }}
                className="theme-button-danger-subtle inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-extrabold transition"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Xóa ảnh
              </button>
            ) : null}
          </div>
          <input
            ref={inputRef}
            id="admin-course-cover"
            name="admin-course-cover"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={async (event) => {
              const file = event.currentTarget.files?.[0];
              if (!file) {
                return;
              }

              if (!file.type.startsWith("image/")) {
                setLocalError("Vui lòng chọn file ảnh.");
                event.currentTarget.value = "";
                return;
              }

              if (file.size > maxImageSizeBytes) {
                setLocalError("Ảnh tối đa 5MB.");
                event.currentTarget.value = "";
                return;
              }

              try {
                const nextImageUrl = await readFileAsDataUrl(file);
                setLocalPreviewUrl(nextImageUrl);
                setIsUploading(true);
                setImageLoadFailed(false);
                setLocalError("");
                const uploadedFile = await onUploadFile(file);
                setLocalPreviewUrl("");
                onChange(uploadedFile);
              } catch (error) {
                setLocalPreviewUrl("");
                setLocalError(
                  error instanceof Error
                    ? error.message
                    : "Không upload được ảnh. Vui lòng thử lại.",
                );
                event.currentTarget.value = "";
              } finally {
                setIsUploading(false);
              }
            }}
          />
          {localError ? (
            <p className="mt-2 text-sm leading-5 text-[var(--theme-error-text)]">
              {localError}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Invalid image result"));
    });
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}
