"use client";

import { CalendarClock, Timer, Zap, Coins } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import type { AdminAiPanelJob } from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import { formatAiModelDisplayName } from "@/features/admin/ai-generation/utils/format-ai-model-display-name";

const AdminAiGenerationUsageDialog = dynamic(
  () =>
    import(
      "@/features/admin/ai-generation/components/admin-ai-generation-usage-dialog"
    ).then((module) => module.AdminAiGenerationUsageDialog),
  { ssr: false },
);

export function AiJobMetadata({ job }: { job: AdminAiPanelJob | null }) {
  const [isUsageDialogOpen, setIsUsageDialogOpen] = useState(false);

  if (!job || job.status !== "SUCCEEDED") return null;

  const durationSecs =
    job.startedAt && job.finishedAt
      ? Math.ceil(
          (new Date(job.finishedAt).getTime() - new Date(job.startedAt).getTime()) / 1000,
        )
      : null;
  const createdAt = formatCreatedAt(job.createdAt);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-4 text-sm font-medium text-[var(--theme-text-muted)]">
      {job.model && (
        <span className="flex items-center gap-1.5" title="Mô hình AI">
          <Zap className="h-4 w-4" aria-hidden="true" />
          {formatAiModelDisplayName(job.model)}
        </span>
      )}
      {createdAt && (
        <span className="flex items-center gap-1.5" title="Thời điểm tạo">
          <CalendarClock className="h-4 w-4" aria-hidden="true" />
          {createdAt}
        </span>
      )}
      {durationSecs !== null && (
        <span className="flex items-center gap-1.5" title="Thời gian tạo">
          <Timer className="h-4 w-4" aria-hidden="true" />
          {durationSecs}s
        </span>
      )}
      {job.estimatedCostVnd !== undefined && job.estimatedCostVnd !== null ? (
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => setIsUsageDialogOpen(true)}
          className="-m-1 flex items-center gap-1.5 rounded-md p-1 text-left transition-colors hover:bg-[var(--theme-surface-soft)] hover:text-[var(--theme-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)]"
          title="Xem chi tiết các lượt gọi và chi phí"
        >
          <Coins className="h-4 w-4" aria-hidden="true" />
          {job.usageEventCount && job.usageEventCount > 1
            ? `Tổng ${job.usageEventCount} lượt gọi: `
            : ""}
          {`${job.estimatedCostVnd.toLocaleString("vi-VN")} VNĐ`}
        </button>
      ) : null}
      {job.inputMetaJson?.temperature !== undefined && (
        <span className="flex items-center gap-1.5" title="Độ sáng tạo (Temperature)">
          Temp: {job.inputMetaJson.temperature}
        </span>
      )}
      {job.inputMetaJson?.reasoningEffort !== undefined && (
        <span className="flex items-center gap-1.5" title="Reasoning effort">
          Effort: {job.inputMetaJson.reasoningEffort}
        </span>
      )}
      <AdminAiGenerationUsageDialog
        aiGenerationId={job.aiGenerationId}
        isOpen={isUsageDialogOpen}
        onClose={() => setIsUsageDialogOpen(false)}
      />
    </div>
  );
}

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const pad = (part: number) => String(part).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())} ${pad(date.getDate())}-${pad(
    date.getMonth() + 1,
  )}-${date.getFullYear()}`;
}
