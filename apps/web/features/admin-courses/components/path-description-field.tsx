"use client";

import { FileText } from "lucide-react";
import type { TextareaHTMLAttributes } from "react";
import type { FieldError } from "react-hook-form";
import { FieldLabel } from "@/components/forms/field-label";
import { formFocusClass } from "@/components/forms/form-styles";
import { cn } from "@/lib/utils";

export function PathDescriptionField({
  error,
  ...textareaProps
}: {
  error?: FieldError;
} & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <FieldLabel
        id="admin-course-description"
        label="Mô tả lộ trình"
        isOptional
      />
      <div className="relative mt-2">
        <span className="pointer-events-none absolute left-4 top-4 text-slate-500">
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
          className={cn(
            "min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-white py-3 pl-12 pr-4 text-base font-semibold leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-indigo-200 focus:bg-white focus:ring-4 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 lg:text-sm",
            formFocusClass,
          )}
        />
      </div>
      {error ? (
        <p
          id="admin-course-description-error"
          className="mt-1.5 text-sm leading-5 text-red-600"
        >
          {error.message}
        </p>
      ) : null}
    </div>
  );
}
