"use client";

import { ImagePlus, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FieldLabel } from "@/components/forms/field-label";

const maxImageSizeBytes = 5 * 1024 * 1024;

export function PathCoverUpload({
  fileName,
  imageUrl,
  isDarkTheme = false,
  onChange,
}: {
  fileName: string;
  imageUrl: string;
  isDarkTheme?: boolean;
  onChange: (value: { fileName: string; imageUrl: string }) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [localError, setLocalError] = useState("");
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const shouldShowImage = Boolean(imageUrl) && !imageLoadFailed;

  useEffect(() => {
    setImageLoadFailed(false);
  }, [imageUrl]);

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
              src={imageUrl}
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
              className="theme-button-success inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-extrabold transition"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              Chọn ảnh
            </button>
            {imageUrl ? (
              <button
                type="button"
                onClick={() => {
                  setLocalError("");
                  setImageLoadFailed(false);
                  onChange({ fileName: "", imageUrl: "" });
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
                setImageLoadFailed(false);
                setLocalError("");
                onChange({ fileName: file.name, imageUrl: nextImageUrl });
              } catch {
                setLocalError("Không đọc được ảnh. Vui lòng chọn ảnh khác.");
                event.currentTarget.value = "";
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
