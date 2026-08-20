"use client";

import {
  AlertTriangle,
  CircleAlert,
  CircleCheckBig,
  CircleX,
  Clock3,
  ImageIcon,
  LoaderCircle,
} from "lucide-react";
import { useMemo } from "react";

import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import { StemFigureMathText } from "@/components/common/content/stem-figure";
import { AdminStemFigureActionFrame } from "@/features/admin/ai-generation/components/admin-stem-figure-action-frame";
import type {
  AdminAiModelConfiguration,
  AdminStemFigure,
  AdminStemFigureStatus,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";

export function AdminStemFigureOverviewDialog({
  figures,
  isOpen,
  lessonId,
  modelConfiguration,
  onClose,
}: {
  figures: AdminStemFigure[];
  isOpen: boolean;
  lessonId: string;
  modelConfiguration?: AdminAiModelConfiguration;
  onClose: () => void;
}) {
  const orderedFigures = useMemo(
    () => [...figures].sort(compareFigures),
    [figures],
  );
  const counts = countStatuses(orderedFigures);

  return (
    <EditorDialogShell
      ariaLabel="Toàn bộ hình minh họa"
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="max-w-6xl"
    >
      <header className="theme-dialog-header flex min-h-16 shrink-0 items-center px-4 py-3 pr-20 sm:px-6 sm:pr-20">
        <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
          Toàn bộ hình minh họa
        </h2>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div aria-live="polite" className="mb-4 flex flex-wrap gap-2">
          <StatusCount label="Tổng" value={counts.total} variant="neutral" />
          <StatusCount
            label="Thành công"
            value={counts.succeeded}
            variant="succeeded"
          />
          <StatusCount
            label="Cần xem lại"
            value={counts.needsReview}
            variant="needsReview"
          />
          <StatusCount label="Lỗi" value={counts.failed} variant="failed" />
          <StatusCount label="Chờ xử lý" value={counts.queued} variant="queued" />
          <StatusCount
            label="Đang xử lý"
            value={counts.processing}
            variant="processing"
          />
        </div>

        {orderedFigures.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {orderedFigures.map((figure, index) => (
              <FigureOverviewCard
                figure={figure}
                index={index}
                key={figure.id}
                lessonId={lessonId}
                modelConfiguration={modelConfiguration}
              />
            ))}
          </div>
        ) : (
          <div className="grid min-h-56 place-items-center rounded-xl border border-dashed border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-6 text-center">
            <div>
              <ImageIcon
                aria-hidden="true"
                className="mx-auto h-8 w-8 text-[var(--theme-text-muted)]"
              />
              <p className="mt-3 text-sm font-extrabold text-[var(--theme-text-strong)]">
                Bản kiến thức này không có hình minh họa
              </p>
            </div>
          </div>
        )}
      </div>

      <footer className="theme-dialog-footer flex shrink-0 justify-end p-3 sm:p-4">
        <button
          className="theme-button-neutral inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg px-4 text-sm font-extrabold"
          onClick={onClose}
          type="button"
        >
          Đóng
        </button>
      </footer>
    </EditorDialogShell>
  );
}

function FigureOverviewCard({
  figure,
  index,
  lessonId,
  modelConfiguration,
}: {
  figure: AdminStemFigure;
  index: number;
  lessonId: string;
  modelConfiguration?: AdminAiModelConfiguration;
}) {
  const imageUrl = figure.assetUrl ?? toSvgDataUrl(figure.previewSvg);
  const status = getStatusPresentation(figure.status);
  const StatusIcon = status.icon;

  return (
    <article
      className="min-w-0 overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] shadow-sm"
      data-admin-stem-figure-overview={figure.id}
    >
      <div className="flex items-start justify-between gap-3 border-b border-[var(--theme-border)] px-3 py-2.5 sm:px-4">
        <div className="min-w-0">
          <p className="text-xs font-bold text-[var(--theme-text-muted)]">
            Ảnh {index + 1}
          </p>
          <p className="mt-0.5 line-clamp-2 text-sm font-extrabold text-[var(--theme-text-strong)]">
            <StemFigureMathText value={figure.caption ?? figure.altText} />
          </p>
        </div>
        <span
          className={`inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-extrabold ${status.className}`}
        >
          <StatusIcon
            aria-hidden="true"
            className={`h-3.5 w-3.5 ${status.spins ? "animate-spin" : ""}`}
          />
          {status.label}
        </span>
      </div>

      <AdminStemFigureActionFrame
        figure={figure}
        lessonId={lessonId}
        modelConfiguration={modelConfiguration}
        sourceCropContainerClassName="p-3 pb-0 sm:p-4 sm:pb-0"
      >
        <div className="flex min-h-60 items-center justify-center bg-white p-3 sm:p-4">
          {imageUrl ? (
            <img
              alt={figure.altText}
              className="block max-h-[24rem] w-auto max-w-full object-contain"
              decoding="async"
              loading="lazy"
              src={imageUrl}
            />
          ) : (
            <FigurePlaceholder figure={figure} />
          )}
        </div>
      </AdminStemFigureActionFrame>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-3 py-2 text-xs font-semibold text-[var(--theme-text-muted)] sm:px-4">
        <span className="truncate">{formatBlockPath(figure.blockPath)}</span>
        <span className="shrink-0 tabular-nums">Vị trí {figure.figureIndex + 1}</span>
      </div>
    </article>
  );
}

function FigurePlaceholder({ figure }: { figure: AdminStemFigure }) {
  const failed = figure.status === "FAILED";
  const needsReview = figure.status === "NEEDS_REVIEW";
  return (
    <div className="flex max-w-sm flex-col items-center gap-2 text-center text-slate-600">
      {failed || needsReview ? (
        <AlertTriangle
          aria-hidden="true"
          className={`h-7 w-7 ${failed ? "text-rose-500" : "text-violet-500"}`}
        />
      ) : (
        <LoaderCircle aria-hidden="true" className="h-7 w-7 animate-spin text-sky-500" />
      )}
      <p className="text-sm font-bold">
        {failed
          ? "Chưa tạo được ảnh"
          : needsReview
            ? "Hình cần được kiểm tra"
            : "Hình đang được xử lý"}
      </p>
      {figure.lastErrorMessage ? (
        <p className="line-clamp-3 text-xs text-slate-500">{figure.lastErrorMessage}</p>
      ) : null}
    </div>
  );
}

type StatusVariant =
  | "neutral"
  | "queued"
  | "processing"
  | "succeeded"
  | "needsReview"
  | "failed";

function StatusCount({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant: StatusVariant;
}) {
  const classes: Record<StatusVariant, string> = {
    neutral:
      "border-[var(--theme-border)] bg-[var(--theme-surface-soft)] text-[var(--theme-text-muted)]",
    queued:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
    processing:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
    succeeded:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
    needsReview:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200",
    failed:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200",
  };
  return (
    <span
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-extrabold tabular-nums ${classes[variant]}`}
    >
      {label} <strong>{value}</strong>
    </span>
  );
}

function countStatuses(figures: AdminStemFigure[]) {
  const counts = {
    total: figures.length,
    queued: 0,
    processing: 0,
    succeeded: 0,
    needsReview: 0,
    failed: 0,
  };
  for (const figure of figures) {
    if (figure.status === "QUEUED") counts.queued += 1;
    if (figure.status === "RENDERING" || figure.status === "REPAIRING") {
      counts.processing += 1;
    }
    if (figure.status === "SUCCEEDED") counts.succeeded += 1;
    if (figure.status === "NEEDS_REVIEW") counts.needsReview += 1;
    if (figure.status === "FAILED") counts.failed += 1;
  }
  return counts;
}

function getStatusPresentation(status: AdminStemFigureStatus) {
  return {
    QUEUED: {
      label: "Chờ xử lý",
      icon: Clock3,
      spins: false,
      className:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
    },
    RENDERING: {
      label: "Đang render",
      icon: LoaderCircle,
      spins: true,
      className:
        "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
    },
    REPAIRING: {
      label: "Đang sửa",
      icon: LoaderCircle,
      spins: true,
      className:
        "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
    },
    SUCCEEDED: {
      label: "Thành công",
      icon: CircleCheckBig,
      spins: false,
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
    },
    NEEDS_REVIEW: {
      label: "Cần xem lại",
      icon: CircleAlert,
      spins: false,
      className:
        "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200",
    },
    FAILED: {
      label: "Lỗi",
      icon: CircleX,
      spins: false,
      className:
        "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200",
    },
  }[status];
}

function compareFigures(left: AdminStemFigure, right: AdminStemFigure) {
  const pathOrder = left.blockPath.localeCompare(right.blockPath, "vi", {
    numeric: true,
  });
  return pathOrder || left.figureIndex - right.figureIndex || left.id.localeCompare(right.id);
}

function formatBlockPath(blockPath: string) {
  const indexes = [...blockPath.matchAll(/\d+/gu)].map((match) => Number(match[0]) + 1);
  return indexes.length >= 2
    ? `Phần ${indexes[0]} · Khối ${indexes[1]}`
    : "Khối nội dung";
}

function toSvgDataUrl(svg: string | null) {
  return svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : null;
}
