"use client";

import { useEffect, useState } from "react";
import { TextField } from "@/components/common/forms/text-field";

export function NumericSettingsField({
  id,
  label,
  value,
  min,
  max,
  allowDecimal = false,
  formatThousands = false,
  suffix,
  helperText,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max?: number;
  allowDecimal?: boolean;
  formatThousands?: boolean;
  suffix?: string;
  helperText?: string;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft((prev) => {
      const currentNumeric = Number(prev.replace(",", "."));
      if (value !== currentNumeric) return String(value);
      return prev;
    });
  }, [value]);

  const numericValue = Number(draft);
  const errorMessage =
    draft.trim() === ""
      ? `Nhập ${label.toLocaleLowerCase("vi-VN")}`
      : !Number.isFinite(numericValue)
        ? "Giá trị chưa đúng định dạng số"
        : numericValue < min
          ? `Giá trị nhỏ nhất là ${min}`
          : max !== undefined && numericValue > max
            ? `Giá trị lớn nhất là ${max}`
            : undefined;

  return (
    <TextField
      id={id}
      label={label}
      type="text"
      inputMode={allowDecimal ? "decimal" : "numeric"}
      pattern={
        allowDecimal ? "[0-9]*[.,]?[0-9]*" : formatThousands ? "[0-9.]*" : "[0-9]*"
      }
      icon={null}
      trailingAction={
        suffix ? (
          <span className="pointer-events-none text-sm font-extrabold text-[var(--theme-text-subtle)]">
            {suffix}
          </span>
        ) : undefined
      }
      suppressBrowserSuggestions={false}
      value={formatThousands ? formatIntegerInput(draft) : draft}
      helperText={helperText}
      error={errorMessage ? { type: "validate", message: errorMessage } : undefined}
      onChange={(event) => {
        const nextDraft = sanitizeNumericInput(event.currentTarget.value, allowDecimal);
        setDraft(nextDraft);
        const nextValue = Number(nextDraft.replace(",", "."));
        if (
          nextDraft !== "" &&
          Number.isFinite(nextValue) &&
          nextValue >= min &&
          (max === undefined || nextValue <= max)
        ) {
          onChange(nextValue);
        }
      }}
      onBlur={() => {
        if (errorMessage) {
          setDraft(String(value));
        }
      }}
    />
  );
}

export function sanitizeNumericInput(value: string, allowDecimal: boolean) {
  if (!allowDecimal) {
    return value.replace(/\D/g, "");
  }

  const normalized = value.replace(",", ".").replace(/[^0-9.]/g, "");
  const [integerPart = "", ...decimalParts] = normalized.split(".");
  return decimalParts.length > 0
    ? `${integerPart}.${decimalParts.join("")}`
    : integerPart;
}

function formatIntegerInput(value: string) {
  if (value === "") return "";

  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
  }).format(Number(value));
}
