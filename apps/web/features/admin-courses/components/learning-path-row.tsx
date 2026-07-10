import { ChevronRight, Pencil } from "lucide-react";
import { Badge, StatusBadge } from "@/features/admin-courses/components/badges";
import { subjectLabels, type AdminLearningPath } from "@/features/admin-courses/data";
import { formatPrice } from "@/features/admin-courses/utils";
import { cn } from "@/lib/utils";

export function LearningPathRow({
  path,
  selected,
  onSelect,
}: {
  path: AdminLearningPath;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "grid w-full gap-3 px-4 py-4 text-left transition hover:bg-sky-50/50 lg:grid-cols-[1.35fr_0.7fr_0.55fr_0.6fr_5rem] lg:items-center",
        selected && "bg-sky-50",
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-base font-extrabold text-slate-950">{path.title}</p>
          <ChevronRight
            className={cn(
              "h-4 w-4 text-slate-400 transition",
              selected && "text-sky-600",
            )}
            aria-hidden="true"
          />
        </div>
        <p className="mt-1 truncate text-sm font-semibold text-slate-500">{path.slug}</p>
      </div>
      <div className="flex flex-wrap gap-2 text-sm font-bold text-slate-700">
        <Badge>{subjectLabels[path.subject]}</Badge>
        <Badge>Lớp {path.grade}</Badge>
      </div>
      <div className="text-sm font-extrabold text-slate-950">
        {formatPrice(path.salePriceVnd ?? path.originalPriceVnd)}
      </div>
      <div>
        <StatusBadge status={path.status} />
      </div>
      <div className="flex justify-end">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500">
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
    </button>
  );
}
