"use client";

import { FieldLabel } from "@/components/common/forms/field-label";
import { formFocusClass } from "@/components/common/forms/form-styles";
import type { TextareaFieldProps } from "@/components/common/forms/form-types";
import { cn } from "@/lib/utils";

export function TextareaField({
  id,
  label,
  error,
  helperText,
  wrapperClassName,
  isOptional = false,
  optionalLabel,
  className,
  ...textareaProps
}: TextareaFieldProps) {
  return (
    <div className={wrapperClassName}>
      <FieldLabel
        id={id}
        label={label}
        isOptional={isOptional}
        optionalLabel={optionalLabel}
      />
      <textarea
        {...textareaProps}
        id={id}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? `${id}-error` : helperText ? `${id}-helper` : undefined}
        className={cn(
          "mt-2 min-h-28 w-full resize-y rounded-xl border border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] px-4 py-3 text-base font-semibold leading-6 text-[var(--theme-text-strong)] outline-none transition placeholder:text-[var(--theme-text-placeholder)] hover:border-[var(--theme-input-hover-border)] disabled:cursor-not-allowed disabled:bg-[var(--theme-input-bg-disabled)] disabled:text-[var(--theme-input-text-disabled)] lg:text-sm",
          formFocusClass,
          className,
        )}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-[var(--theme-error-text)]">
          {error.message}
        </p>
      ) : helperText ? (
        <p id={`${id}-helper`} className="mt-1.5 text-sm text-[var(--theme-text-muted)]">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
