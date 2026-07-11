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
    <div className="text-sm font-semibold leading-6 text-[var(--theme-text)]">
      <div className="flex flex-wrap items-start gap-x-1.5 gap-y-1">
        <label className="inline-flex cursor-pointer items-start gap-3 transition hover:text-[var(--theme-text-strong)]">
          <input
            {...inputProps}
            type="checkbox"
            autoComplete="off"
            disabled={disabled}
            className="peer sr-only"
          />
          <span
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition peer-focus-visible:ring-4 peer-focus-visible:ring-[var(--theme-focus-ring)] peer-disabled:cursor-not-allowed peer-disabled:opacity-60 ${
              checked
                ? "border-[var(--auth-primary,var(--theme-primary))] bg-[var(--auth-primary,var(--theme-primary))] text-[var(--theme-primary-foreground)] shadow-[var(--theme-shadow-sm)]"
                : "border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] text-transparent"
            }`}
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <span>Tôi đã đọc và đồng ý với</span>
        </label>
        <Link
          className="font-extrabold text-[var(--theme-primary)] underline-offset-4 hover:text-[var(--theme-primary-hover)] hover:none"
          href="/terms"
        >
          Điều khoản sử dụng
        </Link>
      </div>
      {errorMessage ? (
        <span className="mt-1 block text-sm font-semibold leading-5 text-[var(--theme-error-text)]">
          {errorMessage}
        </span>
      ) : null}
    </div>
  );
}
