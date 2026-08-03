import { cn } from "@/lib/utils";

export function CourseStructureDropIndicator({
  className,
  visible,
}: {
  className?: string;
  visible: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-x-3 -top-2 z-20 -translate-y-1/2 transition-opacity duration-150",
        visible ? "opacity-100" : "opacity-0",
        className,
      )}
    >
      <div className="relative flex items-center">
        <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--theme-text-strong)]" />
        <span className="min-w-0 flex-1 border-t-2 border-dashed border-[var(--theme-danger)]" />
        <span className="mx-2 shrink-0 rounded-full border border-[var(--theme-danger)] bg-[var(--theme-danger-soft)] px-2.5 py-1 text-[11px] font-extrabold leading-none text-[var(--theme-danger)] shadow-[var(--theme-shadow-sm)]">
          Thả buổi học tại đây
        </span>
        <span className="min-w-0 flex-1 border-t-2 border-dashed border-[var(--theme-danger)]" />
        <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--theme-text-strong)]" />
      </div>
    </div>
  );
}
