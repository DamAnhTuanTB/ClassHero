import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";

export function FieldLabel({
  id,
  label,
  hideLabel = false,
  isOptional = false,
  optionalLabel = "Không bắt buộc nhập",
  labelAction,
}: {
  id: string;
  label: string;
  hideLabel?: boolean;
  isDarkTheme?: boolean;
  isOptional?: boolean;
  optionalLabel?: string;
  labelAction?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3",
        hideLabel && "sr-only",
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        <label
          htmlFor={id}
          className="text-sm font-extrabold text-[var(--theme-text-strong)]"
        >
          {label}
        </label>
        {isOptional ? (
          <span
            tabIndex={0}
            aria-label={optionalLabel}
            className="group relative inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[var(--theme-text-muted)] outline-none transition hover:bg-[var(--theme-surface-soft)] hover:text-[var(--theme-primary)] focus-visible:bg-[var(--theme-surface-soft)] focus-visible:text-[var(--theme-primary)] focus-visible:ring-4 focus-visible:ring-[var(--theme-focus-ring)]"
          >
            <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
            <span
              role="tooltip"
              className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-max max-w-48 -translate-x-1/2 rounded-lg bg-[var(--theme-tooltip-bg)] px-2.5 py-1.5 text-xs font-bold text-[var(--theme-tooltip-text)] opacity-0 shadow-[var(--theme-shadow-sm)] transition group-hover:opacity-100 group-focus-visible:opacity-100"
            >
              {optionalLabel}
            </span>
          </span>
        ) : null}
      </div>
      {labelAction ? <div className="shrink-0">{labelAction}</div> : null}
    </div>
  );
}
