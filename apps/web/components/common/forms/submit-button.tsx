"use client";

import type { SubmitButtonProps } from "@/components/common/forms/form-types";

export function SubmitButton({ isPending, onClick, children }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={isPending}
      onClick={onClick}
      className="inline-flex min-h-[3.45rem] w-full items-center justify-center whitespace-nowrap rounded-xl bg-[linear-gradient(90deg,var(--form-primary,var(--auth-primary,var(--theme-primary))),var(--form-secondary,var(--auth-secondary,var(--theme-primary-hover))))] px-4 text-base font-extrabold text-white shadow-[var(--theme-shadow-sm)] transition hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.99] disabled:bg-none disabled:bg-[var(--theme-surface-muted)] disabled:text-[var(--theme-text-muted)]"
    >
      {isPending ? "Đang xử lý..." : children}
    </button>
  );
}
