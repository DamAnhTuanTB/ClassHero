"use client";

import { cn } from "@/lib/utils";
import type { CheckboxFieldProps } from "@/components/common/forms/form-types";
import { formFocusClass } from "@/components/common/forms/form-styles";

export function CheckboxField({
  id,
  label,
  error,
  wrapperClassName,
  labelClassName,
  className,
  ...inputProps
}: CheckboxFieldProps) {
  return (
    <div className={wrapperClassName}>
      <label
        htmlFor={id}
        className={cn(
          "flex min-h-[3.35rem] cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--theme-input-border)] bg-transparent px-4 transition hover:border-[var(--theme-input-hover-border)]",
          labelClassName,
        )}
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
            "h-5 w-5 rounded-md border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] text-[var(--form-primary,var(--auth-primary,var(--theme-primary)))] disabled:cursor-not-allowed disabled:opacity-60",
            formFocusClass,
            className,
          )}
        />
      </label>
      {error ? (
        <p
          id={`${id}-error`}
          className="mt-1.5 text-sm leading-5 text-[var(--theme-error-text)]"
        >
          {error.message}
        </p>
      ) : null}
    </div>
  );
}
