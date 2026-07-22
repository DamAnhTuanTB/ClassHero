import { Loader2 } from "lucide-react";
import type {
  AdminBackgroundJobStatus,
  AdminDocumentStatus,
} from "@/features/admin/courses/types/admin-course-document-types";
import {
  getDocumentStatusView,
  getJobStatusLabel,
} from "@/features/admin/courses/admin-course-documents-utils";
import { cn } from "@/lib/utils";

const reviewRequiredView = {
  label: "Cần xác nhận",
  toneClass:
    "border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] text-[var(--theme-warning-text)]",
};

export function DocumentStatusBadge({
  hasPrintedPageWarning,
  jobStatus,
  progress,
  status,
  isCacheRun,
}: {
  hasPrintedPageWarning?: boolean;
  jobStatus?: AdminBackgroundJobStatus | null;
  progress?: number;
  status: AdminDocumentStatus;
  isCacheRun?: boolean | null;
}) {
  const useWarningOverride = status === "READY" && hasPrintedPageWarning;
  const statusView = useWarningOverride
    ? reviewRequiredView
    : getDocumentStatusView(status);

  let label =
    status === "PROCESSING" && jobStatus
      ? getJobStatusLabel(jobStatus)
      : statusView.label;

  if (status === "PROCESSING") {
    if (jobStatus === "RUNNING") {
      label = isCacheRun ? "Đang xử lý cache" : "Đang OCR mới";
    }
    const p = typeof progress === "number" ? progress : 0;
    label = `${label} (${p}%)`;
  }

  return (
    <span
      className={cn(
        "inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-extrabold",
        statusView.toneClass,
      )}
    >
      {status === "PROCESSING" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {label}
    </span>
  );
}
