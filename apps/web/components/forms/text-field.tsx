"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type ChangeEvent, type FocusEvent } from "react";
import { FieldLabel } from "@/components/forms/field-label";
import { FieldIcon } from "@/components/forms/field-icon";
import { formFocusClass } from "@/components/forms/form-styles";
import type { TextFieldProps } from "@/components/forms/form-types";
import { cn } from "@/lib/utils";

export function TextField({
  id,
  label,
  type = "text",
  placeholder,
  autoComplete,
  error,
  helperText,
  wrapperClassName,
  labelAction,
  hideLabel = false,
  isOptional = false,
  optionalLabel,
  icon,
  isDarkTheme = false,
  suppressBrowserSuggestions = true,
  inputMode,
  name,
  onChange,
  onBlur,
  onFocus,
  readOnly,
  ...inputProps
}: TextFieldProps) {
  const safeFieldId = useId().replace(/:/g, "");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const isPasswordField = type === "password";
  const browserFieldId = suppressBrowserSuggestions ? `form-field-${safeFieldId}` : id;
  const browserFieldName = suppressBrowserSuggestions
    ? `form-input-${safeFieldId}`
    : name;
  const originalFieldName = typeof name === "string" ? name : undefined;
  const inputType =
    suppressBrowserSuggestions && (isPasswordField || type === "tel" || type === "email")
      ? "text"
      : isPasswordField && isPasswordVisible
        ? "text"
        : type;
  const inputAutoComplete = suppressBrowserSuggestions ? "off" : (autoComplete ?? "off");
  const resolvedInputMode =
    inputMode ??
    (suppressBrowserSuggestions && type === "tel"
      ? "tel"
      : suppressBrowserSuggestions && type === "email"
        ? "email"
        : undefined);
  const passwordMaskClass =
    suppressBrowserSuggestions && isPasswordField && !isPasswordVisible
      ? " [-webkit-text-security:disc]"
      : "";
  const resolvedIcon =
    icon === null ? null : (icon ?? <FieldIcon id={id} type={type} label={label} />);

  const runWithOriginalFieldName = <
    TEvent extends ChangeEvent<HTMLInputElement> | FocusEvent<HTMLInputElement>,
  >(
    event: TEvent,
    handler: ((event: TEvent) => void) | undefined,
  ) => {
    if (!handler) {
      return;
    }

    if (!suppressBrowserSuggestions || !originalFieldName) {
      handler(event);
      return;
    }

    const currentName = event.currentTarget.name;
    event.currentTarget.name = originalFieldName;
    handler(event);
    event.currentTarget.name = currentName;
  };

  return (
    <div className={wrapperClassName}>
      <FieldLabel
        id={browserFieldId}
        label={label}
        hideLabel={hideLabel}
        isDarkTheme={isDarkTheme}
        isOptional={isOptional}
        optionalLabel={optionalLabel}
        labelAction={labelAction}
      />
      <div className={cn("relative", !hideLabel && "mt-2")}>
        {resolvedIcon ? (
          <span
            className={cn(
              "pointer-events-none absolute left-4 top-1/2 -translate-y-1/2",
              isDarkTheme ? "text-slate-400" : "text-slate-500",
            )}
          >
            {resolvedIcon}
          </span>
        ) : null}
        <input
          {...inputProps}
          id={browserFieldId}
          name={browserFieldName}
          type={inputType}
          placeholder={placeholder}
          autoComplete={inputAutoComplete}
          inputMode={resolvedInputMode}
          autoCorrect={suppressBrowserSuggestions ? "off" : undefined}
          autoCapitalize={suppressBrowserSuggestions ? "none" : undefined}
          spellCheck={suppressBrowserSuggestions ? false : undefined}
          data-autocomplete={suppressBrowserSuggestions ? "off" : undefined}
          data-1p-ignore={suppressBrowserSuggestions ? "true" : undefined}
          data-bwignore={suppressBrowserSuggestions ? "true" : undefined}
          data-form-type={suppressBrowserSuggestions ? "other" : undefined}
          data-lpignore={suppressBrowserSuggestions ? "true" : undefined}
          aria-autocomplete={suppressBrowserSuggestions ? "none" : undefined}
          readOnly={readOnly}
          onBlur={(event) => {
            runWithOriginalFieldName(event, onBlur);
          }}
          onFocus={(event) => {
            onFocus?.(event);
          }}
          onChange={(event) => {
            runWithOriginalFieldName(event, onChange);
          }}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={
            error ? `${id}-error` : helperText ? `${id}-helper` : undefined
          }
          className={cn(
            "min-h-[3.35rem] w-full rounded-xl border py-0 text-base font-semibold outline-none transition focus:ring-4 disabled:cursor-not-allowed lg:text-sm",
            isDarkTheme
              ? "border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500 hover:border-sky-500/50 focus:border-sky-500 focus:bg-slate-950 focus:ring-sky-500/15 disabled:bg-slate-900 disabled:text-slate-500"
              : [
                  "border-slate-200 bg-white text-slate-950 placeholder:text-slate-400 hover:border-indigo-200 focus:bg-white disabled:bg-slate-100 disabled:text-slate-500",
                  formFocusClass,
                ],
            resolvedIcon ? "pl-12" : "pl-4",
            isPasswordField ? "pr-14" : "pr-4",
            passwordMaskClass,
          )}
        />
        {isPasswordField ? (
          <button
            type="button"
            aria-label={isPasswordVisible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            aria-pressed={isPasswordVisible}
            disabled={inputProps.disabled}
            onClick={() => setIsPasswordVisible((visible) => !visible)}
            className={cn(
              "absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full transition focus:outline-none focus:ring-4 disabled:pointer-events-none disabled:opacity-50",
              isDarkTheme
                ? "text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus:ring-sky-500/15"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:ring-indigo-100",
            )}
          >
            {isPasswordVisible ? (
              <EyeOff className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Eye className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        ) : null}
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm leading-5 text-red-600">
          {error.message}
        </p>
      ) : helperText ? (
        <p
          id={`${id}-helper`}
          className={cn(
            "mt-1.5 text-sm leading-5",
            isDarkTheme ? "text-slate-400" : "text-slate-500",
          )}
        >
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
