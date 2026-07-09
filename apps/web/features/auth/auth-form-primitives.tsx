"use client";

import {
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  GraduationCap,
  IdCard,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import type { FieldError } from "react-hook-form";

type TextFieldProps = {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  error?: FieldError;
  helperText?: string;
  wrapperClassName?: string;
  labelAction?: React.ReactNode;
  suppressBrowserSuggestions?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>;

type SelectFieldProps = {
  id: string;
  label: string;
  error?: FieldError;
  children: React.ReactNode;
} & React.SelectHTMLAttributes<HTMLSelectElement>;

export type OptionItem = {
  value: string;
  label: string;
};

type OptionFieldProps = {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  options: OptionItem[];
  error?: FieldError;
  disabled?: boolean;
  icon?: React.ReactNode;
  onChange: (value: string) => void;
};

type FormStatusProps = {
  tone: "success" | "error" | "info";
  title: string;
  message: string;
  detail?: string;
};

const statusToneClass = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  error: "border-red-200 bg-red-50 text-red-950",
  info: "border-violet-100 bg-violet-50 text-violet-950",
};

function FieldIcon({ id, type, label }: { id: string; type: string; label: string }) {
  const normalized = `${id} ${label}`.toLowerCase();

  if (type === "password" || normalized.includes("mật khẩu")) {
    return <LockKeyhole className="h-5 w-5" aria-hidden="true" />;
  }

  if (type === "email" || normalized.includes("email")) {
    return <Mail className="h-5 w-5" aria-hidden="true" />;
  }

  if (type === "tel" || normalized.includes("điện thoại")) {
    return <Phone className="h-5 w-5" aria-hidden="true" />;
  }

  if (
    normalized.includes("tài khoản") ||
    normalized.includes("username") ||
    normalized.includes("tên đăng nhập")
  ) {
    return <UserRound className="h-5 w-5" aria-hidden="true" />;
  }

  if (normalized.includes("họ tên")) {
    return <IdCard className="h-5 w-5" aria-hidden="true" />;
  }

  if (normalized.includes("địa chỉ")) {
    return <MapPin className="h-5 w-5" aria-hidden="true" />;
  }

  if (normalized.includes("mã")) {
    return <ShieldCheck className="h-5 w-5" aria-hidden="true" />;
  }

  return <UserRound className="h-5 w-5" aria-hidden="true" />;
}

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
  suppressBrowserSuggestions = true,
  onBlur,
  onFocus,
  readOnly,
  ...inputProps
}: TextFieldProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSuggestionLocked, setIsSuggestionLocked] = useState(
    suppressBrowserSuggestions,
  );
  const isPasswordField = type === "password";
  const inputType = isPasswordField && isPasswordVisible ? "text" : type;
  const inputAutoComplete = suppressBrowserSuggestions ? "off" : (autoComplete ?? "off");

  return (
    <div className={wrapperClassName}>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-extrabold text-slate-800">
          {label}
        </label>
        {labelAction ? <div className="shrink-0">{labelAction}</div> : null}
      </div>
      <div className="relative mt-2">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
          <FieldIcon id={id} type={type} label={label} />
        </span>
        <input
          id={id}
          type={inputType}
          placeholder={placeholder}
          autoComplete={inputAutoComplete}
          autoCorrect={suppressBrowserSuggestions ? "off" : undefined}
          autoCapitalize={suppressBrowserSuggestions ? "none" : undefined}
          spellCheck={suppressBrowserSuggestions ? false : undefined}
          data-1p-ignore={suppressBrowserSuggestions ? "true" : undefined}
          data-bwignore={suppressBrowserSuggestions ? "true" : undefined}
          data-form-type={suppressBrowserSuggestions ? "other" : undefined}
          data-lpignore={suppressBrowserSuggestions ? "true" : undefined}
          aria-autocomplete={suppressBrowserSuggestions ? "none" : undefined}
          readOnly={suppressBrowserSuggestions ? isSuggestionLocked : readOnly}
          onBlur={(event) => {
            if (suppressBrowserSuggestions) {
              setIsSuggestionLocked(true);
            }

            onBlur?.(event);
          }}
          onFocus={(event) => {
            if (suppressBrowserSuggestions) {
              window.setTimeout(() => setIsSuggestionLocked(false), 80);
            }

            onFocus?.(event);
          }}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={
            error ? `${id}-error` : helperText ? `${id}-helper` : undefined
          }
          className={`min-h-[3.35rem] w-full rounded-xl border border-slate-200 bg-white py-0 pl-12 text-sm font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-indigo-200 focus:border-[var(--auth-primary)] focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 ${
            isPasswordField ? "pr-14" : "pr-12"
          }`}
          {...inputProps}
        />
        {isPasswordField ? (
          <button
            type="button"
            aria-label={isPasswordVisible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            aria-pressed={isPasswordVisible}
            disabled={inputProps.disabled}
            onClick={() => setIsPasswordVisible((visible) => !visible)}
            className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:pointer-events-none disabled:opacity-50"
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
        <p id={`${id}-helper`} className="mt-1.5 text-sm leading-5 text-slate-500">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

export function OptionField({
  id,
  label,
  value,
  placeholder = "Chọn",
  options,
  error,
  disabled,
  icon,
  onChange,
}: OptionFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsOpen(false);
        }
      }}
    >
      <label htmlFor={id} className="text-sm font-extrabold text-slate-800">
        {label}
      </label>
      <div className="relative mt-2">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
          {icon ?? <UserRound className="h-5 w-5" aria-hidden="true" />}
        </span>
        <button
          id={id}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? `${id}-error` : undefined}
          disabled={disabled}
          onClick={() => setIsOpen((open) => !open)}
          className="flex min-h-[3.35rem] w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white py-0 pl-12 pr-4 text-left text-sm font-semibold text-slate-950 outline-none transition hover:border-indigo-200 focus:border-[var(--auth-primary)] focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
        >
          <span className={selectedOption ? "text-slate-950" : "text-slate-400"}>
            {selectedOption?.label ?? placeholder}
          </span>
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-slate-500 transition ${
              isOpen ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </button>
      </div>
      {isOpen ? (
        <div
          role="listbox"
          aria-labelledby={id}
          className="absolute z-40 mt-2 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/12"
        >
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`flex min-h-10 w-full items-center justify-between rounded-lg px-3 text-left text-sm font-bold transition ${
                  isSelected
                    ? "bg-sky-50 text-[var(--auth-primary)]"
                    : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"
                }`}
              >
                {option.label}
                {isSelected ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm leading-5 text-red-600">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}

export function SelectField({
  id,
  label,
  error,
  children,
  ...selectProps
}: SelectFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-extrabold text-slate-800">
        {label}
      </label>
      <div className="relative mt-2">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
          <GraduationCap className="h-5 w-5" aria-hidden="true" />
        </span>
        <select
          id={id}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? `${id}-error` : undefined}
          className="min-h-[3.35rem] w-full rounded-xl border border-slate-200 bg-white px-12 text-sm font-semibold text-slate-950 outline-none transition hover:border-indigo-200 focus:border-[var(--auth-primary)] focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
          {...selectProps}
        >
          {children}
        </select>
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm leading-5 text-red-600">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}

export function SubmitButton({
  isPending,
  children,
}: {
  isPending: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={isPending}
      className="inline-flex min-h-[3.45rem] w-full items-center justify-center rounded-xl bg-[linear-gradient(90deg,var(--auth-primary),var(--auth-secondary))] px-4 text-base font-extrabold text-white shadow-lg shadow-indigo-950/18 transition hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.99] disabled:cursor-wait disabled:bg-none disabled:bg-slate-300"
    >
      {isPending ? "Đang xử lý..." : children}
    </button>
  );
}

export function FormStatus({ tone, title, message, detail }: FormStatusProps) {
  return (
    <div
      className={`rounded-[1.05rem] border p-4 ${statusToneClass[tone]}`}
      role="status"
    >
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-6">{message}</p>
      {detail ? <p className="mt-2 text-xs leading-5 opacity-80">{detail}</p> : null}
    </div>
  );
}

export function FormHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="pb-1">
      <div className="mb-3 h-1.5 w-12 rounded-full bg-[linear-gradient(90deg,var(--auth-primary),var(--auth-secondary))]" />
      <h2 className="text-2xl font-extrabold leading-tight text-slate-950 sm:text-3xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
          {description}
        </p>
      ) : null}
    </div>
  );
}
