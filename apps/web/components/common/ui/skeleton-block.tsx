import { cn } from "@/lib/utils";

export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "bg-[var(--theme-surface-soft)] ring-1 ring-inset ring-[var(--theme-border)]",
        className,
      )}
    />
  );
}
