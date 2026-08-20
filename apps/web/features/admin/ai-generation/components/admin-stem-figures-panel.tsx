"use client";

import { Loader2 } from "lucide-react";

import { StemFigure } from "@/components/common/content/stem-figure";
import { AdminStemFigureActionFrame } from "@/features/admin/ai-generation/components/admin-stem-figure-action-frame";
import type {
  AdminAiModelConfiguration,
  AdminStemFigure,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";

export function AdminStemFigureInline({
  figure,
  lessonId,
  modelConfiguration,
}: {
  figure: AdminStemFigure;
  lessonId: string;
  modelConfiguration?: AdminAiModelConfiguration;
}) {
  const candidateActive = ["QUEUED", "RENDERING", "REPAIRING"].includes(figure.status);

  return (
    <div className="my-4" data-admin-stem-figure={figure.id}>
      <AdminStemFigureActionFrame
        figure={figure}
        lessonId={lessonId}
        modelConfiguration={modelConfiguration}
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
          <div
            aria-busy="true"
            className="mx-3 -mt-2 flex min-h-12 animate-pulse items-center justify-center gap-2 rounded-b-xl border border-t-0 border-sky-200 bg-sky-50 px-3 text-center text-xs font-extrabold text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200 sm:mx-4"
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Đang sinh bản hình mới tại vị trí này. Ảnh hiện hành được giữ cho đến khi bản
            mới thành công
          </div>
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
