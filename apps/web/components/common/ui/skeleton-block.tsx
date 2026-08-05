import { cn } from "@/lib/utils";

export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("bg-[var(--theme-skeleton)]", className)} />
  );
}
