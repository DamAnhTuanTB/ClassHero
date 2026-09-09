"use client";

import {
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleX,
  Coins,
  Loader2,
  Zap,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import type { AdminFlashcardSet } from "@/features/admin/flashcards/api/admin-flashcards-api";
import {
  formatDateTime,
  formatVnd,
} from "@/features/admin/ai-settings/utils/provider-operations-formatters";
import { formatAiModelDisplayName } from "@/features/admin/ai-generation/utils/format-ai-model-display-name";
import { cn } from "@/lib/utils";

const AdminAiGenerationUsageDialog = dynamic(
  () =>
    import("@/features/admin/ai-generation/components/admin-ai-generation-usage-dialog").then(
      (module) => module.AdminAiGenerationUsageDialog,
    ),
  { ssr: false },
);

type FlashcardGeneration = NonNullable<AdminFlashcardSet["aiGenerations"]>[number];

export function AdminFlashcardGenerationHistoryDialog({
  flashcardSet,
  isOpen,
  onClose,
}: {
  flashcardSet: AdminFlashcardSet;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [selectedGenerationId, setSelectedGenerationId] = useState<string | null>(null);
  const generations = flashcardSet.aiGenerations ?? [];
  const totals = useMemo(
    () =>
      generations.reduce(
        (summary, generation) => ({
          costVnd: summary.costVnd + generation.totalCostVnd,
          usageEvents: summary.usageEvents + generation.usageEventCount,
        }),
        { costVnd: 0, usageEvents: 0 },
      ),
    [generations],
  );

  useEffect(() => {
    if (!isOpen) setSelectedGenerationId(null);
  }, [flashcardSet.id, isOpen]);

  return (
    <>
      <EditorDialogShell
        ariaLabel={`Lịch sử sinh AI của ${flashcardSet.title}`}
        isOpen={isOpen}
        onClose={onClose}
        panelClassName="max-w-4xl"
      >
        <header className="theme-dialog-header flex min-h-16 shrink-0 items-center px-4 py-3 pr-16 sm:px-5">
          <h2 className="truncate text-lg font-extrabold text-[var(--theme-text-strong)]">
            Lịch sử sinh Flashcard bằng AI
          </h2>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard label="Tổng lần sinh" value={formatNumber(generations.length)} />
            <SummaryCard label="Tổng lượt gọi" value={formatNumber(totals.usageEvents)} />
            <SummaryCard label="Tổng chi phí thực tế" value={formatVnd(totals.costVnd)} />
          </div>
          <div className="mt-4 overflow-hidden rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)]">
            {generations.length > 0 ? (
              <div className="divide-y divide-[var(--theme-border)]">
                {generations.map((generation, index) => (
                  <GenerationRow
                    generation={generation}
                    index={generations.length - index}
                    key={generation.id}
                    onClick={() => setSelectedGenerationId(generation.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="grid min-h-52 place-items-center px-5 py-10 text-center">
                <div>
                  <span className="mx-auto grid size-11 place-items-center rounded-lg bg-[var(--theme-surface-soft)] text-[var(--theme-text-muted)]">
                    <Coins className="size-5" aria-hidden="true" />
                  </span>
                  <p className="mt-3 font-extrabold text-[var(--theme-text-strong)]">
                    Chưa có lần sinh bằng AI
                  </p>
                  <p className="mt-1 text-sm font-medium text-[var(--theme-text-muted)]">
                    Chi phí sẽ được ghi nhận sau khi bộ Flashcard được sinh bằng AI.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        <footer className="theme-dialog-footer flex shrink-0 justify-end p-3 sm:p-4">
          <button
            type="button"
            onClick={onClose}
            className="theme-button-primary min-h-11 whitespace-nowrap rounded-lg px-6 font-extrabold"
          >
            Đóng
          </button>
        </footer>
      </EditorDialogShell>
      <AdminAiGenerationUsageDialog
        aiGenerationId={selectedGenerationId}
        isOpen={selectedGenerationId !== null}
        onClose={() => setSelectedGenerationId(null)}
      />
    </>
  );
}

function GenerationRow({
  generation,
  index,
  onClick,
}: {
  generation: FlashcardGeneration;
  index: number;
  onClick: () => void;
}) {
  const status = generationStatusPresentation[generation.status];
  const StatusIcon = status.icon;
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={onClick}
      className="group grid min-h-20 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--theme-surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--theme-primary)] sm:px-5"
    >
      <span className="flex min-w-0 items-start gap-3">
        <span className={cn("mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg", status.iconClassName)}>
          <StatusIcon className={cn("size-4", status.animate && "animate-spin")} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <strong className="text-sm font-extrabold text-[var(--theme-text-strong)]">
              Lần sinh {index}
            </strong>
            <span className={cn("rounded-full px-2 py-1 text-[10px] font-extrabold leading-none", status.badgeClassName)}>
              {status.label}
            </span>
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-[var(--theme-text-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="size-3.5" aria-hidden="true" />
              {formatDateTime(generation.createdAt)}
            </span>
            {generation.model ? (
              <span className="inline-flex items-center gap-1.5">
                <Zap className="size-3.5" aria-hidden="true" />
                {formatAiModelDisplayName(generation.model)}
              </span>
            ) : null}
          </span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2 pl-2">
        <span className="text-right">
          <strong className="block whitespace-nowrap text-sm font-extrabold text-[var(--theme-text-strong)]">
            {formatVnd(generation.totalCostVnd)}
          </strong>
          <span className="mt-0.5 block whitespace-nowrap text-xs font-semibold text-[var(--theme-text-muted)]">
            {formatNumber(generation.usageEventCount)} lượt gọi
          </span>
        </span>
        <ChevronRight className="size-4 text-[var(--theme-text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--theme-primary)]" aria-hidden="true" />
      </span>
    </button>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--theme-text-muted)]">
        <Coins className="size-4" aria-hidden="true" />
        {label}
      </div>
      <p className="mt-1 text-xl font-extrabold text-[var(--theme-text-strong)]">{value}</p>
    </div>
  );
}

const generationStatusPresentation = {
  QUEUED: {
    label: "Đang chờ",
    icon: Loader2,
    animate: true,
    iconClassName: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    badgeClassName: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  },
  RUNNING: {
    label: "Đang sinh",
    icon: Loader2,
    animate: true,
    iconClassName: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    badgeClassName: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  SUCCEEDED: {
    label: "Thành công",
    icon: CheckCircle2,
    animate: false,
    iconClassName: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    badgeClassName: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
  FAILED: {
    label: "Thất bại",
    icon: CircleX,
    animate: false,
    iconClassName: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
    badgeClassName: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  },
} as const;

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}
