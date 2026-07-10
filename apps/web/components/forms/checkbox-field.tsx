"use client";

import { cn } from "@/lib/utils";
import type { CheckboxFieldProps } from "@/components/forms/form-types";

export function CheckboxField({
  id,
  label,
  error,
  wrapperClassName,
  className,
  ...inputProps
}: CheckboxFieldProps) {
  return (
    <div className={wrapperClassName}>
      <label
        htmlFor={id}
        className="flex min-h-[3.35rem] cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 transition hover:border-indigo-200 hover:bg-white"
      >
        <span className="text-sm font-extrabold text-slate-800">{label}</span>
        <input
          {...inputProps}
          id={id}
          type="checkbox"
          autoComplete="off"
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            "h-5 w-5 rounded-md border-slate-300 text-[var(--form-primary,var(--auth-primary,#4f46e5))] focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60",
            className,
          )}
        />
      </label>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm leading-5 text-red-600">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}
