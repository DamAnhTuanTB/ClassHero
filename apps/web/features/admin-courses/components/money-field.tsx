"use client";

import { CircleDollarSign } from "lucide-react";
import type { FieldError } from "react-hook-form";
import { FieldLabel } from "@/components/forms/field-label";
import { formFocusClass } from "@/components/forms/form-styles";
import { cn } from "@/lib/utils";

export function MoneyField({
  id,
  label,
  isOptional = false,
  optionalLabel,
  value,
  error,
  onChange,
}: {
  id: string;
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
        isOptional={isOptional}
        optionalLabel={optionalLabel}
      />
      <div className="relative mt-2">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
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
          className={cn(
            "min-h-[3.35rem] w-full rounded-xl border border-slate-200 bg-white py-0 pl-12 pr-16 text-base font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-indigo-200 focus:bg-white focus:ring-4 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 lg:text-sm",
            formFocusClass,
          )}
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-extrabold text-slate-400">
          đ
        </span>
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm leading-5 text-red-600">
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
