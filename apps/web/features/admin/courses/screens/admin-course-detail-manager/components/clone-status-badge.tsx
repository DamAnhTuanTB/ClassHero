import { Loader2 } from "lucide-react";
import type { PersonalizationStatus } from "@/features/admin/courses/types/admin-course-api-types";
import { cn } from "@/lib/utils";

const statusConfig: Record<
  PersonalizationStatus,
  { label: string; toneClass: string; showSpinner?: boolean }
> = {
  BASE: {
    label: "Đang học khóa gốc",
    toneClass:
      "border-[var(--theme-primary-border,#3b82f6)] bg-[var(--theme-primary-subtle,#eff6ff)] text-[var(--theme-primary,#2563eb)]",
  },
  CLONING: {
    label: "Đang tạo bản cá nhân",
    toneClass:
      "border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] text-[var(--theme-warning-text)]",
    showSpinner: true,
  },
  FAILED: {
    label: "Tạo thất bại",
    toneClass:
      "border-[var(--theme-danger-border)] bg-[var(--theme-danger-bg)] text-[var(--theme-danger-text)]",
  },
  PERSONALIZED: {
    label: "Đang học bản cá nhân",
    toneClass:
      "border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-700 dark:bg-purple-950 dark:text-purple-300",
  },
};

export function CloneStatusBadge({
  status,
  className,
}: {
  status: PersonalizationStatus;
  className?: string;
}) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-extrabold",
        config.toneClass,
        className,
      )}
    >
      {config.showSpinner && (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      )}
      {config.label}
    </span>
  );
}
