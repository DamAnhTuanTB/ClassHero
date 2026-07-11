import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  tone,
}: {
  isDarkTheme?: boolean;
  label: string;
  value: number;
  tone: "sky" | "emerald" | "amber";
}) {
  const toneClass = {
    sky: "border-[var(--theme-primary-border)] bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]",
    emerald:
      "border-[var(--theme-success-border)] bg-[var(--theme-success-bg)] text-[var(--theme-success-text)]",
    amber:
      "border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] text-[var(--theme-warning-text)]",
  }[tone];

  return (
    <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4">
      <div
        className={cn(
          "inline-flex rounded-lg border px-2 py-1 text-xs font-bold",
          toneClass,
        )}
      >
        {label}
      </div>
      <p className="mt-3 text-3xl font-extrabold text-[var(--theme-text-strong)]">
        {value}
      </p>
    </div>
  );
}
