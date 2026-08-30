import { CircleAlert } from "lucide-react";

import type { AdminJobErrorDetails } from "@/lib/admin-job-error";
import { sanitizeUserFacingMessage } from "@/lib/user-facing-error";
import { cn } from "@/lib/utils";

export function AdminJobErrorAlert({
  className,
  details,
  fallbackMessage,
}: {
  className?: string;
  details?: AdminJobErrorDetails | null;
  fallbackMessage?: string | null;
}) {
  const message = details?.message
    ? normalizeStructuredCopy(details.message, "Tác vụ chưa thể hoàn tất.")
    : sanitizeUserFacingMessage(fallbackMessage, "Tác vụ chưa thể hoàn tất.");
  const action = details?.action
    ? normalizeStructuredCopy(
        details.action,
        "Hãy thử lại. Nếu lỗi lặp lại, kiểm tra cấu hình backend và worker.",
      )
    : "Hãy thử lại. Nếu lỗi lặp lại, kiểm tra cấu hình backend và worker.";

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2.5 rounded-lg border border-[var(--theme-danger-border)] bg-[var(--theme-danger-soft)] p-3",
        className,
      )}
    >
      <CircleAlert
        className="mt-0.5 h-4 w-4 shrink-0 text-[var(--theme-danger)]"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="text-sm font-extrabold leading-5 text-[var(--theme-danger)]">
          {message}
        </p>
        <p className="mt-1 text-xs font-semibold leading-5 text-[var(--theme-text-muted)]">
          {action}
        </p>
      </div>
    </div>
  );
}

function normalizeStructuredCopy(value: string, fallback: string) {
  const normalized = value.replace(/\s+/gu, " ").trim().slice(0, 1_000);
  return normalized || fallback;
}
