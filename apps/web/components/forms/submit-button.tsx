"use client";

import type { SubmitButtonProps } from "@/components/forms/form-types";

export function SubmitButton({ isPending, onClick, children }: SubmitButtonProps) {
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={onClick}
      className="inline-flex min-h-[3.45rem] w-full items-center justify-center rounded-xl bg-[linear-gradient(90deg,var(--form-primary,var(--auth-primary,#4f46e5)),var(--form-secondary,var(--auth-secondary,#7c3aed)))] px-4 text-base font-extrabold text-white shadow-lg shadow-indigo-950/18 transition hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.99] disabled:cursor-wait disabled:bg-none disabled:bg-slate-300"
    >
      {isPending ? "Đang xử lý..." : children}
    </button>
  );
}
