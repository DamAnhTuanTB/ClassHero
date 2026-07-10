import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { SortDirection } from "@/features/admin-courses/types";
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
  isDarkTheme = false,
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
        "inline-flex min-h-8 items-center gap-1.5 rounded-md text-left text-xs font-extrabold uppercase transition-colors focus:outline-none focus-visible:bg-sky-500/10 focus-visible:text-sky-700",
        align === "right" && "justify-end text-right",
        isActive
          ? isDarkTheme
            ? "text-sky-300"
            : "text-sky-700"
          : isDarkTheme
            ? "text-slate-400 hover:text-slate-100"
            : "text-slate-500 hover:text-slate-800",
        isDarkTheme && "focus-visible:text-sky-300",
      )}
    >
      <span>{label}</span>
      <Icon
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          isActive ? "opacity-100" : "opacity-70",
        )}
        aria-hidden="true"
      />
    </button>
  );
}
