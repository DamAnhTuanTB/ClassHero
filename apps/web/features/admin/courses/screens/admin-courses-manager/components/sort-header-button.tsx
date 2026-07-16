import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { SortDirection } from "@/features/admin/courses/admin-courses-types";
import { cn } from "@/lib/utils";

type SortHeaderButtonProps = {
  label: string;
  isActive: boolean;
  direction: SortDirection;
  isDarkTheme?: boolean;
  align?: "left" | "right";
  onClick: () => void;
};

export function SortHeaderButton({
  label,
  isActive,
  direction,
  align = "left",
  onClick,
}: SortHeaderButtonProps) {
  const Icon = isActive ? (direction === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;
  const directionLabel = direction === "asc" ? "tăng dần" : "giảm dần";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={
        isActive ? `${label}, đang sắp xếp ${directionLabel}` : `Sắp xếp theo ${label}`
      }
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-md text-left text-xs font-extrabold uppercase transition-colors focus:outline-none focus-visible:bg-[var(--theme-primary-soft)] focus-visible:text-[var(--theme-primary)]",
        align === "right" && "justify-end text-right",
        isActive
          ? "text-[var(--theme-primary)]"
          : "text-[var(--theme-text-muted)] hover:text-[var(--theme-text-strong)]",
      )}
    >
      <span>{label}</span>
      <Icon
        className={cn("h-3.5 w-3.5 shrink-0", isActive ? "opacity-100" : "opacity-70")}
        aria-hidden="true"
      />
    </button>
  );
}
