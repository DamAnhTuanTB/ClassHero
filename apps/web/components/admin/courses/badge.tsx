import type { ReactNode } from "react";

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-h-7 items-center rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-2.5 text-xs font-extrabold text-[var(--theme-text)]">
      {children}
    </span>
  );
}
