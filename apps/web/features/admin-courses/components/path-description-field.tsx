"use client";

import { FileText } from "lucide-react";
import type { TextareaHTMLAttributes } from "react";
import type { FieldError } from "react-hook-form";
import { FieldLabel } from "@/components/forms/field-label";

export function PathDescriptionField({
  error,
  isDarkTheme = false,
  ...textareaProps
}: {
  error?: FieldError;
  isDarkTheme?: boolean;
} & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <FieldLabel
        id="admin-course-description"
        label="Mô tả lộ trình"
        isDarkTheme={isDarkTheme}
        isOptional
      />
      <div className="relative mt-2">
        <span className="pointer-events-none absolute left-4 top-4 text-[var(--theme-text-muted)]">
          <FileText className="h-5 w-5" aria-hidden="true" />
        </span>
        <textarea
          {...textareaProps}
          id="admin-course-description"
          rows={4}
          maxLength={600}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? "admin-course-description-error" : undefined}
          className="theme-form-control min-h-28 w-full resize-y rounded-xl py-3 pl-12 pr-4 text-base font-semibold leading-6 outline-none transition disabled:cursor-not-allowed lg:text-sm"
        />
      </div>
      {error ? (
        <p
          id="admin-course-description-error"
          className="mt-1.5 text-sm leading-5 text-[var(--theme-error-text)]"
        >
          {error.message}
        </p>
      ) : null}
    </div>
  );
}
