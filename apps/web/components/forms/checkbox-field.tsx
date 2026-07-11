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
        className="flex min-h-[3.35rem] cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--theme-input-border)] bg-[var(--theme-surface-soft)] px-4 transition hover:border-[var(--theme-input-hover-border)] hover:bg-[var(--theme-input-bg)]"
      >
        <span className="text-sm font-extrabold text-[var(--theme-text-strong)]">
          {label}
        </span>
        <input
          {...inputProps}
          id={id}
          type="checkbox"
          autoComplete="off"
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            "h-5 w-5 rounded-md border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] text-[var(--form-primary,var(--auth-primary,var(--theme-primary)))] focus:ring-4 focus:ring-[var(--theme-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60",
            className,
          )}
        />
      </label>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm leading-5 text-[var(--theme-error-text)]">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}
