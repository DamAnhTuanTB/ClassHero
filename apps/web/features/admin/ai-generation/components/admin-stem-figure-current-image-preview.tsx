import { Eye } from "lucide-react";

import { StemFigure } from "@/components/common/content/stem-figure";
import type { AdminStemFigure } from "@/features/admin/ai-generation/types/admin-ai-generation.types";

export function AdminStemFigureCurrentImagePreview({
  figure,
}: {
  figure: AdminStemFigure;
}) {
  return (
    <section
      aria-label="Ảnh hiện tại"
      className="mt-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-3 sm:p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-extrabold text-[var(--theme-text-strong)]">
          <Eye className="h-4 w-4 text-[var(--theme-primary)]" aria-hidden="true" />
          Ảnh hiện tại
        </p>
        <span className="shrink-0 rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface)] px-2.5 py-1 text-xs font-bold text-[var(--theme-text-muted)]">
          Chỉ xem
        </span>
      </div>
      <div className="mt-3 [&>figure]:my-0">
        <StemFigure
          displaySize="textbook-source"
          visual={{
            kind: "TEX_FIGURE",
            figureId: figure.id,
            altText: figure.altText,
            caption: null,
            status: figure.status,
            previewSvg: figure.previewSvg ?? undefined,
            assetUrl: figure.assetUrl,
            lastErrorCategory: figure.lastErrorCategory,
          }}
        />
      </div>
    </section>
  );
}
