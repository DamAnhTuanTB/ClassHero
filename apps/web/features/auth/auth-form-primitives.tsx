"use client";

import {
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  IdCard,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
} from "react";
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
  const isAccountIdentifier =
    normalized.includes("identifier") ||
    normalized.includes("tài khoản") ||
    normalized.includes("username") ||
    normalized.includes("tên đăng nhập");

  if (type === "password" || normalized.includes("mật khẩu")) {
    return <LockKeyhole className="h-5 w-5" aria-hidden="true" />;
  }

  if (type === "email" || normalized.includes("email")) {
    return <Mail className="h-5 w-5" aria-hidden="true" />;
  }

  if (isAccountIdentifier) {
    return <UserRound className="h-5 w-5" aria-hidden="true" />;
  }

  if (type === "tel" || normalized.includes("điện thoại")) {
    return <Phone className="h-5 w-5" aria-hidden="true" />;
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
  const browserFieldId = suppressBrowserSuggestions ? `auth-field-${safeFieldId}` : id;
  const browserFieldName = suppressBrowserSuggestions
    ? `auth-input-${safeFieldId}`
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
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={browserFieldId} className="text-sm font-extrabold text-slate-800">
          {label}
        </label>
        {labelAction ? <div className="shrink-0">{labelAction}</div> : null}
      </div>
      <div className="relative mt-2">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
          <FieldIcon id={id} type={type} label={label} />
        </span>
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
          className={`min-h-[3.35rem] w-full rounded-xl border border-slate-200 bg-white py-0 pl-12 text-base font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-indigo-200 focus:border-[var(--auth-primary)] focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 lg:text-sm${passwordMaskClass} ${
            isPasswordField ? "pr-14" : "pr-12"
          }`}
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
  const listboxRef = useRef<HTMLDivElement | null>(null);
  const selectedOptionRef = useRef<HTMLButtonElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const selectedOption = options.find((option) => option.value === value);

  useEffect(() => {
    if (!isOpen || !value) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const listbox = listboxRef.current;
      const selectedElement = selectedOptionRef.current;

      if (!listbox || !selectedElement) {
        return;
      }

      const centeredScrollTop =
        selectedElement.offsetTop -
        listbox.clientHeight / 2 +
        selectedElement.offsetHeight / 2;
      listbox.scrollTop = Math.max(centeredScrollTop, 0);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, value]);

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
        <button
          ref={triggerRef}
          id={id}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? `${id}-error` : undefined}
          disabled={disabled}
          onClick={() => setIsOpen((open) => !open)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setIsOpen(false);
              triggerRef.current?.focus();
            }

            if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setIsOpen(true);
            }
          }}
          className="flex min-h-[3.35rem] w-full touch-manipulation items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-0 text-left text-base font-semibold text-slate-950 outline-none transition hover:border-indigo-200 focus:border-[var(--auth-primary)] focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 lg:text-sm"
        >
          <span className="flex min-w-0 flex-1 items-center gap-3">
            <span className="shrink-0 text-slate-500">
              {icon ?? <UserRound className="h-5 w-5" aria-hidden="true" />}
            </span>
            <span
              className={`min-w-0 flex-1 truncate text-left ${
                selectedOption ? "text-slate-950" : "text-slate-400"
              }`}
            >
              {selectedOption?.label ?? placeholder}
            </span>
          </span>
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-slate-500 transition-transform duration-200 ease-out ${
              isOpen ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </button>
      </div>
      {isOpen ? (
        <div
          ref={listboxRef}
          role="listbox"
          aria-labelledby={id}
          className="absolute z-50 mt-2 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1.5 text-base text-slate-950 shadow-xl shadow-slate-900/12 lg:text-sm"
        >
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                ref={isSelected ? selectedOptionRef : undefined}
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                  triggerRef.current?.focus();
                }}
                className={`relative flex min-h-10 w-full items-center rounded-lg py-2 pl-9 pr-3 text-left font-bold outline-none transition ${
                  isSelected
                    ? "bg-sky-500 text-white shadow-sm shadow-sky-400/15 ring-1 ring-sky-400 hover:bg-sky-500 focus:bg-sky-500 focus:text-white"
                    : "text-slate-700 hover:bg-sky-100 hover:text-sky-800 focus:bg-sky-100 focus:text-sky-800 active:bg-sky-200"
                }`}
              >
                <span className="absolute left-3 flex h-4 w-4 items-center justify-center">
                  {isSelected ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                </span>
                {option.label}
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

export function SubmitButton({
  isPending,
  onClick,
  children,
}: {
  isPending: boolean;
  onClick: React.MouseEventHandler<HTMLButtonElement>;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={onClick}
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
