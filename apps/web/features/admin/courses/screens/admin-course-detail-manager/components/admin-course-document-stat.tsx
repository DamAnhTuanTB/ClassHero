import type { ReactNode } from "react";

export function AdminCourseDocumentStat({
  label,
  testId,
  value,
}: {
  label: string;
  testId?: string;
  value: ReactNode;
}) {
  return (
    <div
      data-testid={testId}
      className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-3"
    >
      <p className="text-xs font-extrabold uppercase text-[var(--theme-text-muted)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-extrabold text-[var(--theme-text-strong)]">
        {value}
      </p>
    </div>
  );
}
