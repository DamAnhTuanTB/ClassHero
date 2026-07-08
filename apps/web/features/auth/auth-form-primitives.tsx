"use client";

import {
  AtSign,
  Eye,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { FieldError } from "react-hook-form";

type TextFieldProps = {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  error?: FieldError;
  helperText?: string;
} & React.InputHTMLAttributes<HTMLInputElement>;

type SelectFieldProps = {
  id: string;
  label: string;
  error?: FieldError;
  children: React.ReactNode;
} & React.SelectHTMLAttributes<HTMLSelectElement>;

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

  if (normalized.includes("tài khoản") || normalized.includes("username")) {
    return <AtSign className="h-5 w-5" aria-hidden="true" />;
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
  ...inputProps
}: TextFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-extrabold text-slate-800">
        {label}
      </label>
      <div className="relative mt-2">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
          <FieldIcon id={id} type={type} label={label} />
        </span>
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={
            error ? `${id}-error` : helperText ? `${id}-helper` : undefined
          }
          className="min-h-[3.35rem] w-full rounded-xl border border-slate-200 bg-white px-12 text-sm font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-indigo-200 focus:border-[var(--auth-primary)] focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
          {...inputProps}
        />
        {type === "password" ? (
          <Eye className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
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
          <UserRound className="h-5 w-5" aria-hidden="true" />
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
  description: string;
}) {
  return (
    <div className="pb-1">
      <div className="mb-3 h-1.5 w-12 rounded-full bg-[linear-gradient(90deg,var(--auth-primary),var(--auth-secondary))]" />
      <h2 className="text-2xl font-extrabold leading-tight text-slate-950 sm:text-3xl">
        {title}
      </h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{description}</p>
    </div>
  );
}
