"use client";

import { ChevronDown, Images, Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";

import type {
  AdminAiModelConfiguration,
  AdminStemFigure,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";

const StemFigureOverviewDialog = dynamic(
  () =>
    import("@/features/admin/ai-generation/components/admin-stem-figure-overview-dialog").then(
      (module) => module.AdminStemFigureOverviewDialog,
    ),
  { ssr: false },
);

export function AdminStemFigureStatusSummary({
  figures,
  lessonId,
  modelConfiguration,
}: {
  figures: AdminStemFigure[];
  lessonId: string;
  modelConfiguration?: AdminAiModelConfiguration;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const hasProcessingFigure = figures.some((figure) =>
    ["QUEUED", "RENDERING", "REPAIRING"].includes(figure.status),
  );

  return (
    <>
      <div
        aria-label="Theo dõi xử lý hình STEM"
        data-testid="admin-stem-figure-status-summary"
        role="group"
      >
        <button
          aria-haspopup="dialog"
          className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-2.5 text-xs font-extrabold tabular-nums text-[var(--theme-text-muted)] transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:hover:border-sky-700 dark:hover:bg-sky-950/50 dark:hover:text-sky-200"
          onClick={() => setIsOpen(true)}
          type="button"
        >
          <Images className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Tổng {figures.length} ảnh</span>
          {hasProcessingFigure ? (
            <>
              <Loader2
                className="h-3.5 w-3.5 shrink-0 animate-spin text-sky-600 dark:text-sky-300"
                aria-hidden="true"
              />
              <span className="sr-only">Còn ảnh đang xử lý</span>
            </>
          ) : null}
          <ChevronDown className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>

      {isOpen ? (
        <StemFigureOverviewDialog
          figures={figures}
          isOpen={isOpen}
          lessonId={lessonId}
          modelConfiguration={modelConfiguration}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </>
  );
}
