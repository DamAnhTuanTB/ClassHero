"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type AdminDataErrorStateProps = {
  className?: string;
  description?: string;
  headingLevel?: 2 | 3 | 4;
  isRetrying?: boolean;
  onRetry?: () => unknown;
  title?: string;
  variant?: "compact" | "page" | "section";
};

const variantClasses = {
  compact: "min-h-36 p-5",
  page: "min-h-80 p-6 sm:p-8 lg:min-h-[calc(100svh-16rem)]",
  section: "min-h-52 p-6",
} as const;

export function AdminDataErrorState({
  className,
  description = "Vui lòng thử lại để tiếp tục quản lý dữ liệu.",
  headingLevel = 2,
  isRetrying = false,
  onRetry,
  title = "Không tải được dữ liệu",
  variant = "section",
}: AdminDataErrorStateProps) {
  return (
    <section
      aria-live="polite"
      className={cn(
        "flex w-full items-center justify-center rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] text-center shadow-[var(--theme-shadow-sm)]",
        variantClasses[variant],
        className,
      )}
      role="alert"
    >
      <div className="mx-auto w-full max-w-md">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-full border border-[var(--theme-danger-border)] bg-[var(--theme-danger-soft)] text-[var(--theme-danger)]">
          <AlertCircle className="h-5 w-5" aria-hidden="true" />
        </span>
        <p
          aria-level={headingLevel}
          className="mt-3 text-base font-extrabold text-[var(--theme-text-strong)]"
          role="heading"
        >
          {title}
        </p>
        <p className="mt-1.5 text-sm leading-6 text-[var(--theme-text-muted)]">
          {description}
        </p>
        {onRetry ? (
          <button
            type="button"
            onClick={() => void onRetry()}
            disabled={isRetrying}
            className="theme-button-primary mt-4 inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold transition disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw
              className={cn("h-4 w-4", isRetrying && "animate-spin")}
              aria-hidden="true"
            />
            {isRetrying ? "Đang tải lại" : "Thử lại"}
          </button>
        ) : null}
      </div>
    </section>
  );
}
