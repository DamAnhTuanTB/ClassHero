"use client";

import { cn } from "@/lib/utils";
import {
  statusLabels,
  statusStyles,
  type AdminPublishStatus,
} from "@/features/admin-courses/data";

export function StatusBadge({ status }: { status: AdminPublishStatus }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-extrabold",
        statusStyles[status],
      )}
    >
      {statusLabels[status]}
    </span>
  );
}
