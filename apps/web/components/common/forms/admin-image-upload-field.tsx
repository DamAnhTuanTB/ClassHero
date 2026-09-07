"use client";

import { Loader2, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";

import { ImmediateTooltip } from "@/components/common/ui/immediate-tooltip";
import { cn } from "@/lib/utils";

export function AdminImageUploadField({
  altText,
  disabled,
  emptyText = "Chưa có hình được tải lên.",
  imageUrl,
  isDeleting = false,
  isUploading = false,
  label,
  onDelete,
  onFileSelect,
  selectedFileName,
  showUpload = true,
}: {
  altText: string;
  disabled: boolean;
  emptyText?: string;
  imageUrl?: string;
  isDeleting?: boolean;
  isUploading?: boolean;
  label: string;
  onDelete?: () => void | Promise<void>;
  onFileSelect?: (file: File) => void | Promise<void>;
  selectedFileName?: string;
  showUpload?: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => setImageFailed(false), [imageUrl]);

  const hasImage = Boolean(imageUrl) && !imageFailed;
  const isBusy = isDeleting || isUploading;

  return (
    <div className="flex h-full flex-col rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3">
      <p className="text-sm font-extrabold text-[var(--theme-text-strong)]">{label}</p>

      <div className="relative mt-2 flex min-h-52 flex-1 items-center justify-center overflow-hidden rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-2">
        {imageUrl ? (
          hasImage ? (
            <img
              src={imageUrl}
              alt={altText}
              className="max-h-52 w-full object-contain"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <p className="px-10 text-center text-xs font-semibold text-[var(--theme-text-muted)]">
              Không tải được ảnh xem trước.
            </p>
          )
        ) : (
          <p className="px-6 text-center text-xs font-semibold text-[var(--theme-text-muted)]">
            {emptyText}
          </p>
        )}
        {imageUrl && onDelete ? (
          <ImmediateTooltip content={`Xóa ${label.toLocaleLowerCase("vi")}`}>
            <button
              type="button"
              aria-label={`Xóa ${label.toLocaleLowerCase("vi")}`}
              disabled={disabled || isBusy}
              onClick={() => void onDelete()}
              className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-lg border border-red-200 bg-white/95 text-red-600 shadow-sm transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900 dark:bg-slate-950/95 dark:text-red-300 dark:hover:bg-red-950"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </ImmediateTooltip>
        ) : null}
      </div>

      <p
        className={cn(
          "mt-2 min-h-4 truncate text-xs font-semibold text-[var(--theme-text-muted)]",
          !selectedFileName && "invisible",
        )}
      >
        {selectedFileName ? `Đã chọn: ${selectedFileName}` : "Chưa chọn tệp"}
      </p>

      {showUpload && onFileSelect ? (
        <div className="mt-3 flex justify-center">
          <label
            className={cn(
              "theme-button-primary-subtle inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-extrabold",
              disabled || isBusy ? "cursor-not-allowed opacity-60" : "cursor-pointer",
            )}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Upload className="h-4 w-4" aria-hidden="true" />
            )}
            {imageUrl ? "Thay hình" : "Tải hình lên"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={disabled || isBusy}
              aria-label={`${imageUrl ? "Thay" : "Tải"} ${label.toLocaleLowerCase("vi")}`}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (file) void onFileSelect(file);
              }}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
