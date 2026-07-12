"use client";

import { CircleDollarSign } from "lucide-react";
import type { FieldError } from "react-hook-form";
import { FieldLabel } from "@/components/forms/field-label";

export function MoneyField({
  id,
  isDarkTheme = false,
  label,
  isOptional = false,
  optionalLabel,
  value,
  error,
  onChange,
}: {
  id: string;
  isDarkTheme?: boolean;
  label: string;
  isOptional?: boolean;
  optionalLabel?: string;
  value: number | "";
  error?: FieldError;
  onChange: (value: number | "") => void;
}) {
  const displayValue = value === "" ? "" : formatMoneyInput(value);

  return (
    <div>
      <FieldLabel
        id={id}
        label={label}
        isDarkTheme={isDarkTheme}
        isOptional={isOptional}
        optionalLabel={optionalLabel}
      />
      <div className="relative mt-2">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--theme-text-muted)]">
          <CircleDollarSign className="h-5 w-5" aria-hidden="true" />
        </span>
        <input
          id={id}
          name={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          value={displayValue}
          onChange={(event) => {
            const digits = event.currentTarget.value.replace(/\D/g, "");
            onChange(digits === "" ? "" : Number(digits));
          }}
          onBeforeInput={(event) => {
            const inputEvent = event.nativeEvent as InputEvent;
            if (inputEvent.data && /\D/.test(inputEvent.data)) {
              event.preventDefault();
            }
          }}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? `${id}-error` : undefined}
          className="theme-form-control min-h-[3.35rem] w-full rounded-xl py-0 pl-12 pr-16 text-base font-semibold outline-none transition disabled:cursor-not-allowed lg:text-sm"
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-extrabold text-[var(--theme-text-subtle)]">
          đ
        </span>
      </div>
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

function formatMoneyInput(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
  }).format(value);
}
