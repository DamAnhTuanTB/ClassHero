"use client";

import {
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleX,
  Coins,
  Loader2,
  Timer,
  Zap,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import type { AdminQuizSet } from "@/features/admin/quiz/api/admin-quiz-api";
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

type QuizGeneration = NonNullable<AdminQuizSet["aiGenerations"]>[number];

export function AdminQuizGenerationHistoryDialog({
  isOpen,
  onClose,
  quizSet,
}: {
  isOpen: boolean;
  onClose: () => void;
  quizSet: AdminQuizSet;
}) {
  const [selectedGenerationId, setSelectedGenerationId] = useState<string | null>(null);
  const generations = quizSet.aiGenerations ?? [];
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
  }, [isOpen, quizSet.id]);

  return (
    <>
      <EditorDialogShell
        ariaLabel={`Lịch sử sinh AI của ${quizSet.title}`}
        isOpen={isOpen}
        onClose={onClose}
        panelClassName="max-w-4xl"
      >
        <header className="theme-dialog-header flex min-h-16 shrink-0 items-center px-4 py-3 pr-16 sm:px-5">
          <h2 className="truncate text-lg font-extrabold text-[var(--theme-text-strong)]">
            Lịch sử sinh Quiz bằng AI
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
                    Chi phí sẽ được ghi nhận sau khi bộ Quiz được sinh bằng AI.
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
  generation: QuizGeneration;
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
        <span
          className={cn(
            "mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg",
            status.iconClassName,
          )}
        >
          <StatusIcon
            className={cn("size-4", status.animate && "animate-spin")}
            aria-hidden="true"
          />
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <strong className="text-sm font-extrabold text-[var(--theme-text-strong)]">
              Lần sinh {index}
            </strong>
            <span
              className={cn(
                "rounded-full px-2 py-1 text-[10px] font-extrabold leading-none",
                status.badgeClassName,
              )}
            >
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
        <ChevronRight
          className="size-4 text-[var(--theme-text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--theme-primary)]"
          aria-hidden="true"
        />
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
      <p className="mt-1 text-xl font-extrabold text-[var(--theme-text-strong)]">
        {value}
      </p>
    </div>
  );
}

const generationStatusPresentation: Record<
  QuizGeneration["status"],
  {
    animate?: boolean;
    badgeClassName: string;
    icon: typeof CheckCircle2;
    iconClassName: string;
    label: string;
  }
> = {
  QUEUED: {
    badgeClassName: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    icon: Timer,
    iconClassName: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    label: "Đang chờ",
  },
  RUNNING: {
    animate: true,
    badgeClassName: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    icon: Loader2,
    iconClassName: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    label: "Đang xử lý",
  },
  SUCCEEDED: {
    badgeClassName:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    icon: CheckCircle2,
    iconClassName:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    label: "Thành công",
  },
  FAILED: {
    badgeClassName: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    icon: CircleX,
    iconClassName: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    label: "Không thành công",
  },
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}
