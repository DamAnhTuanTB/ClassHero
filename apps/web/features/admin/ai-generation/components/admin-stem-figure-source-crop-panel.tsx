"use client";

import { BookOpen, Check, ImageIcon, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { CheckboxField } from "@/components/common/forms/checkbox-field";
import { AdminStemFigureReferenceImagePreview } from "@/features/admin/ai-generation/components/admin-stem-figure-reference-image-preview";
import type {
  AdminStemFigure,
  AdminStemFigureSourceReferenceImage,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";

export function AdminStemFigureSourceCropPanel({
  figure,
  isUsing,
  onClose,
  onUse,
}: {
  figure: AdminStemFigure;
  isUsing: boolean;
  onClose: () => void;
  onUse: (sourceObjectKey: string, enhance: boolean) => Promise<void>;
}) {
  const usableImages = useMemo(
    () => figure.sourceReferenceImages.filter((image) => image.canUseAsFigure),
    [figure.sourceReferenceImages],
  );
  const [selectedObjectKey, setSelectedObjectKey] = useState<string | null>(null);
  const [enhance, setEnhance] = useState(false);

  useEffect(() => {
    setSelectedObjectKey(usableImages[0]?.objectKey ?? null);
  }, [usableImages]);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isUsing) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isUsing, onClose]);

  const isBusy = ["QUEUED", "RENDERING", "REPAIRING"].includes(figure.status);
  const canUse = Boolean(selectedObjectKey && !isUsing && !isBusy);

  return (
    <section
      aria-label="Hình gốc trong sách giáo khoa"
      className="theme-dialog-panel mb-4 overflow-hidden rounded-xl border border-sky-200 shadow-lg dark:border-sky-800"
      role="region"
    >
      <header className="theme-dialog-header flex min-h-16 shrink-0 items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <BookOpen
            className="h-5 w-5 shrink-0 text-sky-600 dark:text-sky-300"
            aria-hidden="true"
          />
          <h2 className="truncate text-lg font-extrabold text-[var(--theme-text-strong)]">
            Xem hình trong sách giáo khoa
          </h2>
        </div>
      </header>

      <div className="p-4 sm:p-6">
        {figure.sourceReferenceImages.length > 0 ? (
          <div className="grid gap-4">
            {figure.sourceReferenceImages.map((image) => (
              <SourceCropCard
                image={image}
                isSelected={selectedObjectKey === image.objectKey}
                key={`${image.index}:${image.objectKey}`}
                onSelect={() => {
                  if (image.canUseAsFigure) setSelectedObjectKey(image.objectKey);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--theme-border)] p-8 text-center">
            <ImageIcon
              className="mx-auto h-8 w-8 text-[var(--theme-text-muted)]"
              aria-hidden="true"
            />
            <p className="mt-3 font-extrabold text-[var(--theme-text-strong)]">
              Chưa có crop nguồn cho hình này
            </p>
            <p className="mt-2 text-sm text-[var(--theme-text-muted)]">
              Bộ chọn nguồn chưa xác định được một crop sách giáo khoa đủ chính xác.
            </p>
          </div>
        )}
        {isBusy ? (
          <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
            Revision AI đang xử lý. Hãy đợi kết thúc rồi mới thay bằng crop sách giáo
            khoa.
          </p>
        ) : null}
        {usableImages.length > 0 ? (
          <CheckboxField
            checked={enhance}
            disabled={isUsing || isBusy}
            id={`stem-figure-source-crop-enhance-${figure.id}`}
            label="Làm nét ảnh"
            labelClassName="bg-[var(--theme-surface-muted)]"
            onChange={(event) => setEnhance(event.currentTarget.checked)}
            wrapperClassName="ml-auto mt-4 w-full max-w-sm"
          />
        ) : null}
      </div>

      <footer className="theme-dialog-footer flex shrink-0 flex-wrap justify-end gap-2 px-4 py-3 sm:px-6">
        <button
          className="theme-button-neutral min-h-10 rounded-lg px-4 text-sm font-extrabold"
          disabled={isUsing}
          onClick={onClose}
          type="button"
        >
          Hủy
        </button>
        <button
          className="theme-button-primary inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canUse}
          onClick={() => {
            if (selectedObjectKey) void onUse(selectedObjectKey, enhance);
          }}
          type="button"
        >
          {isUsing ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="h-4 w-4" aria-hidden="true" />
          )}
          {isUsing ? (enhance ? "Đang làm nét..." : "Đang áp dụng...") : "Áp dụng"}
        </button>
      </footer>
    </section>
  );
}

function SourceCropCard({
  image,
  isSelected,
  onSelect,
}: {
  image: AdminStemFigureSourceReferenceImage;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      aria-pressed={isSelected}
      className={`w-fit max-w-full justify-self-center overflow-hidden rounded-xl border text-left transition ${
        isSelected
          ? "border-sky-500 ring-2 ring-sky-200 dark:ring-sky-900"
          : "border-[var(--theme-border)]"
      } ${image.canUseAsFigure ? "cursor-pointer" : "cursor-not-allowed opacity-70"}`}
      disabled={!image.canUseAsFigure}
      onClick={onSelect}
      style={{ maxWidth: "min(100%, 42rem)" }}
      type="button"
    >
      <AdminStemFigureReferenceImagePreview
        accessUrl={image.accessUrl}
        label={image.label}
      />
      <div className="border-t border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-extrabold text-[var(--theme-text-strong)]">
              {image.label}
            </p>
            <p className="mt-1 text-xs text-[var(--theme-text-muted)]">
              Trang packet {image.packetPageNumber} · {image.source}
            </p>
          </div>
          {isSelected ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sky-100 px-2 py-1 text-xs font-extrabold text-sky-800 dark:bg-sky-950 dark:text-sky-200">
              <Check className="h-3.5 w-3.5" aria-hidden="true" /> Đã chọn
            </span>
          ) : null}
        </div>
        {!image.canUseAsFigure ? (
          <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
            Đây là ảnh toàn trang dự phòng, không phải crop nên không thể dùng trực tiếp.
          </p>
        ) : null}
      </div>
    </button>
  );
}
