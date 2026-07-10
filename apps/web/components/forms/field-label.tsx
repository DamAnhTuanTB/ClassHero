import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";

export function FieldLabel({
  id,
  label,
  hideLabel = false,
  isDarkTheme = false,
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
          className={cn(
            "text-sm font-extrabold",
            isDarkTheme ? "text-slate-200" : "text-slate-800",
          )}
        >
          {label}
        </label>
        {isOptional ? (
          <span
            tabIndex={0}
            aria-label={optionalLabel}
            className={cn(
              "group relative inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full outline-none transition focus-visible:ring-4",
              isDarkTheme
                ? "text-slate-400 hover:bg-slate-800 hover:text-sky-200 focus-visible:bg-slate-800 focus-visible:text-sky-200 focus-visible:ring-sky-500/15"
                : "text-slate-400 hover:bg-slate-100 hover:text-sky-700 focus-visible:bg-slate-100 focus-visible:text-sky-700 focus-visible:ring-sky-100",
            )}
          >
            <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
            <span
              role="tooltip"
              className={cn(
                "pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-max max-w-48 -translate-x-1/2 rounded-lg px-2.5 py-1.5 text-xs font-bold opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-visible:opacity-100",
                isDarkTheme
                  ? "bg-slate-800 text-slate-100 shadow-slate-950/40"
                  : "bg-slate-950 text-white shadow-slate-900/20",
              )}
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
