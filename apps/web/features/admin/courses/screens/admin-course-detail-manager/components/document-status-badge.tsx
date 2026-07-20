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
  status,
}: {
  hasPrintedPageWarning?: boolean;
  jobStatus?: AdminBackgroundJobStatus | null;
  status: AdminDocumentStatus;
}) {
  const useWarningOverride = status === "READY" && hasPrintedPageWarning;
  const statusView = useWarningOverride
    ? reviewRequiredView
    : getDocumentStatusView(status);
  const label =
    status === "PROCESSING" ? getJobStatusLabel(jobStatus) : statusView.label;

  return (
    <span
      className={cn(
        "inline-flex min-h-7 shrink-0 items-center rounded-full border px-2.5 text-xs font-extrabold",
        statusView.toneClass,
      )}
    >
      {label}
    </span>
  );
}

