import { Check } from "lucide-react";
import Link from "next/link";
import type { InputHTMLAttributes } from "react";

export function TermsConsentField({
  checked,
  disabled,
  errorMessage,
  ...inputProps
}: InputHTMLAttributes<HTMLInputElement> & {
  checked: boolean;
  disabled: boolean;
  errorMessage?: string;
}) {
  return (
    <div className="text-sm font-semibold leading-6 text-slate-700">
      <div className="flex flex-wrap items-start gap-x-1.5 gap-y-1">
        <label className="inline-flex cursor-pointer items-start gap-3 transition hover:text-slate-950">
          <input
            {...inputProps}
            type="checkbox"
            autoComplete="off"
            disabled={disabled}
            className="peer sr-only"
          />
          <span
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition peer-focus-visible:ring-4 peer-focus-visible:ring-indigo-100 peer-disabled:cursor-not-allowed peer-disabled:opacity-60 ${
              checked
                ? "border-[var(--auth-primary)] bg-[var(--auth-primary)] text-white shadow-sm shadow-indigo-950/10"
                : "border-slate-300 bg-white text-transparent"
            }`}
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <span>Tôi đã đọc và đồng ý với</span>
        </label>
        <Link
          className="font-extrabold text-blue-600 underline-offset-4 hover:text-blue-700 hover:none"
          href="/terms"
        >
          Điều khoản sử dụng
        </Link>
      </div>
      {errorMessage ? (
        <span className="mt-1 block text-sm font-semibold leading-5 text-red-600">
          {errorMessage}
        </span>
      ) : null}
    </div>
  );
}
