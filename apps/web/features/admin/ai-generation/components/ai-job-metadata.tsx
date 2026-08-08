import { Pencil, Timer, Zap, Coins } from "lucide-react";
import type { AdminAiPanelJob } from "@/features/admin/ai-generation/types/admin-ai-generation.types";

export function AiJobMetadata({
  job,
  onEdit,
}: {
  job: AdminAiPanelJob | null;
  onEdit: () => void;
}) {
  if (!job || job.status !== "SUCCEEDED") return null;

  const durationSecs =
    job.startedAt && job.finishedAt
      ? Math.ceil(
          (new Date(job.finishedAt).getTime() - new Date(job.startedAt).getTime()) / 1000
        )
      : null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-4 text-sm font-medium text-[var(--theme-text-muted)]">
      {job.model && (
        <span className="flex items-center gap-1.5" title="Mô hình AI">
          <Zap className="h-4 w-4" aria-hidden="true" />
          {job.model}
        </span>
      )}
      {durationSecs !== null && (
        <span className="flex items-center gap-1.5" title="Thời gian tạo">
          <Timer className="h-4 w-4" aria-hidden="true" />
          {durationSecs}s
        </span>
      )}
      {job.estimatedCostVnd !== undefined && job.estimatedCostVnd !== null && (
        <span className="flex items-center gap-1.5" title="Chi phí dự kiến">
          <Coins className="h-4 w-4" aria-hidden="true" />
          {job.estimatedCostVnd > 0
            ? `${job.estimatedCostVnd.toLocaleString("vi-VN")} VNĐ`
            : "0 VNĐ"}
        </span>
      )}
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
      <button
        onClick={onEdit}
        className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 transition-colors"
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        Sửa cấu hình sinh
      </button>
    </div>
  );
}
