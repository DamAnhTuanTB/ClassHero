"use client";

import { AlertCircle } from "lucide-react";
import { useMemo, type ComponentProps } from "react";

import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import type { StemFigureVisual } from "@/components/common/content/stem-figure";
import type {
  AdminLessonSummaryContent,
  AdminStemFigure,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import { getAdminLessonSummaryBlock } from "@/features/admin/ai-generation/utils/admin-lesson-summary-block";
import { SummaryBlockRenderer } from "@/features/student/lessons/screens/student-lesson-screen/components/summary-block-renderer";

type SummaryBlockRendererData = ComponentProps<typeof SummaryBlockRenderer>["data"];

export function AdminStemFigureBlockDetailsDialog({
  blockPath,
  content,
  figures,
  isOpen,
  onClose,
}: {
  blockPath: string;
  content: AdminLessonSummaryContent;
  figures: AdminStemFigure[];
  isOpen: boolean;
  onClose: () => void;
}) {
  const previewData = useMemo(
    () => createBlockPreviewData(content, blockPath),
    [blockPath, content],
  );
  const stemFigureVisuals = useMemo(
    () =>
      new Map<string, StemFigureVisual>(
        figures.map((figure) => [
          figure.id,
          {
            kind: "TEX_FIGURE",
            figureId: figure.id,
            status: figure.status,
            altText: figure.altText,
            caption: figure.caption,
            previewSvg: figure.previewSvg ?? undefined,
            assetUrl: figure.assetUrl,
          },
        ]),
      ),
    [figures],
  );

  return (
    <EditorDialogShell
      ariaLabel="Chi tiết khối chứa hình"
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="max-w-4xl"
    >
      <header className="theme-dialog-header flex min-h-16 shrink-0 items-center px-4 py-3 pr-20 sm:px-6 sm:pr-20">
        <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
          Chi tiết khối chứa hình
        </h2>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        {previewData ? (
          <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-950 dark:ring-slate-800 sm:p-5">
            <SummaryBlockRenderer
              data={previewData}
              hideTitle
              showEditorialMetadata
              stemFigureVisuals={stemFigureVisuals}
              viewMode="UI_ONLY"
            />
          </div>
        ) : (
          <div className="grid min-h-56 place-items-center rounded-xl border border-dashed border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-6 text-center">
            <div>
              <AlertCircle
                aria-hidden="true"
                className="mx-auto h-8 w-8 text-[var(--theme-warning-text)]"
              />
              <p className="mt-3 text-sm font-extrabold text-[var(--theme-text-strong)]">
                Không tìm thấy khối nội dung của hình này
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

function createBlockPreviewData(
  content: AdminLessonSummaryContent,
  blockPath: string,
): SummaryBlockRendererData | null {
  const location = getAdminLessonSummaryBlock(content, blockPath);
  if (!location) return null;

  return {
    title: "Chi tiết khối chứa hình",
    sections: [
      {
        order:
          typeof location.section.order === "number" &&
          Number.isFinite(location.section.order)
            ? location.section.order
            : location.sectionIndex + 1,
        displayHeading:
          typeof location.section.displayHeading === "string" &&
          location.section.displayHeading.trim()
            ? location.section.displayHeading
            : `Phần ${location.sectionIndex + 1}`,
        ...(typeof location.section.sourceHeading === "string"
          ? { sourceHeading: location.section.sourceHeading }
          : {}),
        blocks: [structuredClone(location.block)],
      },
    ],
  };
}
