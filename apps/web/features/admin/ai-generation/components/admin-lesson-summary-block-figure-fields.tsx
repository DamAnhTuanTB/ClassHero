"use client";

import { useEffect, useState } from "react";

import { AdminImageUploadField } from "@/components/common/forms/admin-image-upload-field";
import type { AdminStemFigure } from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import type { LessonSummaryEditableBlockType } from "@/features/admin/ai-generation/utils/lesson-summary-block-editor";

export type AdminLessonSummaryFigureDraft =
  { kind: "delete" } | { kind: "replace"; file: File };

export type AdminLessonSummaryFigureDrafts = Partial<
  Record<number, AdminLessonSummaryFigureDraft>
>;

interface FigureSlot {
  figureIndex: number;
  label: string;
  showUpload: boolean;
}

export function AdminLessonSummaryBlockFigureFields({
  blockType,
  disabled,
  drafts,
  figures,
  onDraftChange,
}: {
  blockType: LessonSummaryEditableBlockType;
  disabled: boolean;
  drafts: AdminLessonSummaryFigureDrafts;
  figures: AdminStemFigure[];
  onDraftChange: (
    figureIndex: number,
    draft: AdminLessonSummaryFigureDraft | undefined,
  ) => void;
}) {
  const isProblemBlock = blockType === "example" || blockType === "exercise";
  const orderedFigures = [...figures].sort(
    (left, right) => left.figureIndex - right.figureIndex,
  );
  const primarySlots: FigureSlot[] = isProblemBlock
    ? [
        { figureIndex: 0, label: "Hình đề", showUpload: true },
        { figureIndex: 1, label: "Hình lời giải", showUpload: true },
      ]
    : [{ figureIndex: 0, label: "Hình minh họa", showUpload: true }];
  const primaryIndexes = new Set(primarySlots.map((slot) => slot.figureIndex));
  const extraSlots = orderedFigures
    .filter((figure) => !primaryIndexes.has(figure.figureIndex))
    .map<FigureSlot>((figure) => ({
      figureIndex: figure.figureIndex,
      label: `Hình bổ sung ${figure.figureIndex + 1}`,
      showUpload: false,
    }));
  const slots = [...primarySlots, ...extraSlots];
  const previewUrls = useFigureDraftPreviewUrls(drafts);

  return (
    <div className={isProblemBlock ? "grid gap-3 sm:grid-cols-2" : "grid gap-3"}>
      {slots.map((slot) => {
        const figure = orderedFigures.find(
          (item) => item.figureIndex === slot.figureIndex,
        );
        const draft = drafts[slot.figureIndex];
        const imageUrl =
          draft?.kind === "delete"
            ? undefined
            : draft?.kind === "replace"
              ? previewUrls[slot.figureIndex]
              : (figure?.assetUrl ?? toSvgDataUrl(figure?.previewSvg ?? null));

        return (
          <AdminImageUploadField
            key={slot.figureIndex}
            altText={figure?.altText ?? slot.label}
            disabled={disabled}
            emptyText={
              draft?.kind === "delete"
                ? "Hình sẽ được xóa khi lưu."
                : figure
                  ? `Trạng thái: ${figure.status}`
                  : "Chưa có hình được tải lên."
            }
            imageUrl={imageUrl}
            label={slot.label}
            selectedFileName={draft?.kind === "replace" ? draft.file.name : undefined}
            showUpload={slot.showUpload}
            onDelete={
              imageUrl
                ? () =>
                    onDraftChange(
                      slot.figureIndex,
                      figure ? { kind: "delete" } : undefined,
                    )
                : undefined
            }
            onFileSelect={
              slot.showUpload
                ? (file) => onDraftChange(slot.figureIndex, { kind: "replace", file })
                : undefined
            }
          />
        );
      })}
    </div>
  );
}

function toSvgDataUrl(svg: string | null) {
  return svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : undefined;
}

function useFigureDraftPreviewUrls(drafts: AdminLessonSummaryFigureDrafts) {
  const [previewUrls, setPreviewUrls] = useState<Record<number, string>>({});

  useEffect(() => {
    const nextPreviewUrls: Record<number, string> = {};
    for (const [index, draft] of Object.entries(drafts)) {
      if (draft?.kind !== "replace") continue;
      nextPreviewUrls[Number(index)] = URL.createObjectURL(draft.file);
    }
    setPreviewUrls(nextPreviewUrls);
    return () => Object.values(nextPreviewUrls).forEach(URL.revokeObjectURL);
  }, [drafts]);

  return previewUrls;
}
