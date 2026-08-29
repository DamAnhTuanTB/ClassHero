"use client";

import { AlertTriangle, Eye, ImageIcon, LocateFixed, LoaderCircle } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import { AdminFigureStatusBadge } from "@/components/admin/admin-figure-status-badge";
import { AdminFigureStatusCounts } from "@/components/admin/admin-figure-status-counts";
import { AdminAiFigureUsageBadges } from "@/components/admin/ai-figure-usage-badges";
import { StemFigureMathText } from "@/components/common/content/stem-figure";
import { AdminStemFigureActionFrame } from "@/features/admin/ai-generation/components/admin-stem-figure-action-frame";
import type {
  AdminAiModelConfiguration,
  AdminLessonSummaryContent,
  AdminStemFigure,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import {
  findAdminLessonSummaryFigureBlockPath,
  getAdminLessonSummaryBlock,
} from "@/features/admin/ai-generation/utils/admin-lesson-summary-block";

const StemFigureBlockDetailsDialog = dynamic(
  () =>
    import("@/features/admin/ai-generation/components/admin-stem-figure-block-details-dialog").then(
      (module) => module.AdminStemFigureBlockDetailsDialog,
    ),
  { ssr: false },
);

export function AdminStemFigureOverviewDialog({
  content,
  figures,
  isOpen,
  lessonId,
  modelConfiguration,
  onClose,
  onNavigateToBlock,
}: {
  content: AdminLessonSummaryContent;
  figures: AdminStemFigure[];
  isOpen: boolean;
  lessonId: string;
  modelConfiguration?: AdminAiModelConfiguration;
  onClose: () => void;
  onNavigateToBlock: (blockPath: string) => void;
}) {
  const [selectedBlock, setSelectedBlock] = useState<{
    blockPath: string;
    figureId: string;
  } | null>(null);
  const orderedFigures = useMemo(() => [...figures].sort(compareFigures), [figures]);
  const selectedFigure = selectedBlock
    ? figures.find((figure) => figure.id === selectedBlock.figureId)
    : null;

  return (
    <>
      <EditorDialogShell
        ariaLabel="Toàn bộ hình minh họa"
        isOpen={isOpen}
        onClose={selectedBlock ? () => setSelectedBlock(null) : onClose}
        panelClassName="max-w-6xl"
      >
        <header className="theme-dialog-header flex min-h-16 shrink-0 items-center px-4 py-3 pr-20 sm:px-6 sm:pr-20">
          <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
            Toàn bộ hình minh họa
          </h2>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <AdminFigureStatusCounts figures={orderedFigures} />

          {orderedFigures.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {orderedFigures.map((figure, index) => (
                <FigureOverviewCard
                  content={content}
                  figure={figure}
                  index={index}
                  key={figure.id}
                  lessonId={lessonId}
                  modelConfiguration={modelConfiguration}
                  onNavigateToBlock={onNavigateToBlock}
                  onViewBlock={(blockPath) =>
                    setSelectedBlock({ blockPath, figureId: figure.id })
                  }
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

      {selectedBlock && selectedFigure ? (
        <StemFigureBlockDetailsDialog
          blockPath={selectedBlock.blockPath}
          content={content}
          figures={figures}
          isOpen
          onClose={() => setSelectedBlock(null)}
        />
      ) : null}
    </>
  );
}

function FigureOverviewCard({
  content,
  figure,
  index,
  lessonId,
  modelConfiguration,
  onNavigateToBlock,
  onViewBlock,
}: {
  content: AdminLessonSummaryContent;
  figure: AdminStemFigure;
  index: number;
  lessonId: string;
  modelConfiguration?: AdminAiModelConfiguration;
  onNavigateToBlock: (blockPath: string) => void;
  onViewBlock: (blockPath: string) => void;
}) {
  const imageUrl = figure.assetUrl ?? toSvgDataUrl(figure.previewSvg);
  const blockPath = findAdminLessonSummaryFigureBlockPath(
    content,
    figure.id,
    figure.blockPath,
  );
  const blockLocation = formatBlockLocation(content, blockPath);

  return (
    <article
      className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] shadow-sm"
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
        <AdminFigureStatusBadge status={figure.status} />
      </div>

      <AdminStemFigureActionFrame
        contextActions={
          <>
            <button
              aria-label={`Xem chi tiết khối chứa Ảnh ${index + 1}`}
              className="theme-button-primary-subtle grid h-9 w-9 place-items-center rounded-lg shadow-sm"
              onClick={() => onViewBlock(blockPath)}
              title="Xem chi tiết khối"
              type="button"
            >
              <Eye className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              aria-label={`Đi đến khối chứa Ảnh ${index + 1}`}
              className="theme-button-primary-subtle grid h-9 w-9 place-items-center rounded-lg shadow-sm"
              onClick={() => onNavigateToBlock(blockPath)}
              title="Đi đến khối chứa hình"
              type="button"
            >
              <LocateFixed className="h-4 w-4" aria-hidden="true" />
            </button>
          </>
        }
        figure={figure}
        lessonId={lessonId}
        modelConfiguration={modelConfiguration}
        sourceCropContainerClassName="p-3 pb-0 sm:p-4 sm:pb-0"
      >
        <div className="flex min-h-60 flex-col bg-white p-3 sm:p-4">
          <div className="flex min-h-0 flex-1 items-center justify-center">
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
          {imageUrl ? (
            <AdminAiFigureUsageBadges
              cachedInputTokens={figure.openAiCachedInputTokens}
              costVnd={figure.openAiGenerationCostVnd}
              testIdPrefix="admin-stem-figure-overview"
            />
          ) : null}
        </div>
      </AdminStemFigureActionFrame>

      <div className="border-t border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-3 py-2 text-xs font-semibold text-[var(--theme-text-muted)] sm:px-4">
        <span className="block truncate" title={blockLocation}>
          <StemFigureMathText value={blockLocation} />
        </span>
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

function compareFigures(left: AdminStemFigure, right: AdminStemFigure) {
  const pathOrder = left.blockPath.localeCompare(right.blockPath, "vi", {
    numeric: true,
  });
  return (
    pathOrder || left.figureIndex - right.figureIndex || left.id.localeCompare(right.id)
  );
}

function formatBlockLocation(content: AdminLessonSummaryContent, blockPath: string) {
  const location = getAdminLessonSummaryBlock(content, blockPath);
  const fallback = location
    ? `Phần ${location.sectionIndex + 1} - Khối nội dung`
    : "Khối nội dung";
  if (!location) return fallback;

  const sectionNumber =
    typeof location.section.order === "number" && Number.isFinite(location.section.order)
      ? location.section.order
      : location.sectionIndex + 1;
  const sectionName =
    typeof location.section.displayHeading === "string"
      ? location.section.displayHeading.trim()
      : "";
  const blockName = formatBlockType(location.block.type);
  const sectionLabel = sectionName
    ? `Phần ${sectionNumber}. ${sectionName}`
    : `Phần ${sectionNumber}`;
  return `${sectionLabel} - Khối ${blockName}`;
}

function formatBlockType(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "nội dung";
  return value
    .trim()
    .split(/[_-]+/u)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function toSvgDataUrl(svg: string | null) {
  return svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : null;
}
