"use client";

import { AdminFigureCandidateProgress } from "@/components/admin/admin-figure-candidate-progress";
import { StemFigure } from "@/components/common/content/stem-figure";
import { AdminStemFigureActionFrame } from "@/features/admin/ai-generation/components/admin-stem-figure-action-frame";
import type {
  AdminAiModelConfiguration,
  AdminStemFigure,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";

export function AdminStemFigureInline({
  figure,
  isSourceCropOpen,
  lessonId,
  modelConfiguration,
  onSourceCropOpenChange,
}: {
  figure: AdminStemFigure;
  isSourceCropOpen?: boolean;
  lessonId: string;
  modelConfiguration?: AdminAiModelConfiguration;
  onSourceCropOpenChange?: (isOpen: boolean) => void;
}) {
  const candidateActive = ["QUEUED", "RENDERING", "REPAIRING"].includes(figure.status);

  return (
    <div className="my-4" data-admin-stem-figure={figure.id}>
      <AdminStemFigureActionFrame
        figure={figure}
        isSourceCropOpen={isSourceCropOpen}
        lessonId={lessonId}
        modelConfiguration={modelConfiguration}
        onSourceCropOpenChange={onSourceCropOpenChange}
      >
        <StemFigure
          displaySize={
            figure.currentAssetKind === "TEXTBOOK_SOURCE" ? "textbook-source" : "default"
          }
          showStatus
          visual={{
            kind: "TEX_FIGURE",
            figureId: figure.id,
            altText: figure.altText,
            caption: figure.caption,
            status: figure.status,
            previewSvg: figure.previewSvg ?? undefined,
            assetUrl: figure.assetUrl,
            lastErrorCategory: figure.lastErrorCategory,
          }}
        />
        {candidateActive && figure.hasCurrentAsset ? (
          <AdminFigureCandidateProgress />
        ) : null}
      </AdminStemFigureActionFrame>

      {figure.lastErrorMessage ? (
        <details className="mx-2 mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <summary className="cursor-pointer font-extrabold">
            {figure.lastErrorCategory ?? "Lỗi"} · {figure.retryIssueCount} vấn đề
          </summary>
          <p className="mt-2 break-words">
            {figure.lastErrorCode}: {figure.lastErrorMessage}
          </p>
        </details>
      ) : null}
    </div>
  );
}
