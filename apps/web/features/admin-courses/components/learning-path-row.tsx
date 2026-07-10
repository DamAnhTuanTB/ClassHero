import Link from "next/link";
import { ChevronRight, Pencil, Trash2 } from "lucide-react";
import { StatusBadge } from "@/features/admin-courses/components/badges";
import { subjectLabels, type AdminLearningPath } from "@/features/admin-courses/data";
import {
  formatPrice,
  getPriceChangePercent,
} from "@/features/admin-courses/utils";
import { cn } from "@/lib/utils";

export function LearningPathRow({
  isDarkTheme,
  isSelected,
  path,
  onArchive,
  onEdit,
  onSelect,
}: {
  isDarkTheme: boolean;
  isSelected: boolean;
  path: AdminLearningPath;
  onArchive: () => void;
  onEdit: () => void;
  onSelect: () => void;
}) {
  const currentPrice = path.salePriceVnd ?? path.originalPriceVnd;
  const priceChangePercent = getPriceChangePercent(path.originalPriceVnd, currentPrice);

  return (
    <article
      className={cn(
        "grid grid-cols-[2.75rem_minmax(0,1fr)] gap-3 border-b px-4 py-4 transition-colors last:border-b-0 lg:grid-cols-[2.75rem_1.2fr_0.42fr_0.42fr_0.75fr_0.55fr_7rem] lg:items-center",
        isDarkTheme ? "border-slate-800" : "border-slate-100",
        isSelected
          ? isDarkTheme
            ? "bg-sky-500/10"
            : "bg-sky-50"
          : isDarkTheme
            ? "hover:bg-slate-800/70"
            : "hover:bg-sky-50/50",
      )}
    >
      <label
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg border text-sky-600 transition",
          isDarkTheme
            ? "border-slate-700 bg-slate-900 hover:border-sky-500/50 hover:bg-slate-800"
            : "border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50",
        )}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
          aria-label={`Chọn ${path.title}`}
          className="h-4 w-4 rounded border-slate-300 text-sky-600 accent-sky-600"
        />
      </label>
      <Link href={`/admin/courses/${path.id}`} className="min-w-0 rounded-lg">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              "truncate text-base font-extrabold",
              isDarkTheme ? "text-white" : "text-slate-950",
            )}
          >
            {path.title}
          </p>
          <ChevronRight
            className={cn("h-4 w-4", isDarkTheme ? "text-slate-500" : "text-slate-400")}
            aria-hidden="true"
          />
        </div>
        <p
          className={cn(
            "mt-1 truncate text-sm font-semibold",
            isDarkTheme ? "text-slate-400" : "text-slate-500",
          )}
        >
          {path.slug}
        </p>
      </Link>
      <div className="col-span-2 lg:col-span-1">
        <span
          className={cn(
            "text-sm font-extrabold",
            isDarkTheme ? "text-slate-200" : "text-slate-700",
          )}
        >
          {subjectLabels[path.subject]}
        </span>
      </div>
      <div className="col-span-2 lg:col-span-1">
        <span
          className={cn(
            "text-sm font-extrabold",
            isDarkTheme ? "text-slate-200" : "text-slate-700",
          )}
        >
          Lớp {path.grade}
        </span>
      </div>
      <div className="col-span-2 grid gap-1 lg:col-span-1">
        <p
          className={cn(
            "text-sm font-extrabold",
            isDarkTheme ? "text-white" : "text-slate-950",
          )}
        >
          {formatPrice(currentPrice)}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {path.salePriceVnd === null ? (
            <span
              className={cn(
                "text-xs font-bold",
                isDarkTheme ? "text-slate-400" : "text-slate-500",
              )}
            >
              Giá gốc
            </span>
          ) : (
            <span
              className={cn(
                "text-xs font-bold line-through",
                isDarkTheme ? "text-slate-500" : "text-slate-400",
              )}
            >
              {formatPrice(path.originalPriceVnd)}
            </span>
          )}
          {priceChangePercent !== null ? (
            <span
              className={cn(
                "inline-flex min-h-6 items-center rounded-full border px-2 text-xs font-extrabold",
                priceChangePercent < 0
                  ? "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700"
                  : "border-violet-200 bg-violet-50 text-violet-700",
              )}
            >
              {priceChangePercent < 0 ? "Giảm" : "Tăng"}{" "}
              {Math.abs(priceChangePercent)}%
            </span>
          ) : null}
        </div>
      </div>
      <div className="col-span-2 lg:col-span-1">
        <StatusBadge status={path.status} />
      </div>
      <div className="col-span-2 flex justify-end gap-2 lg:col-span-1">
        <button
          type="button"
          onClick={onEdit}
          className={cn(
            "grid h-10 w-10 place-items-center rounded-lg border transition",
            isDarkTheme
              ? "border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/15"
              : "border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300 hover:bg-sky-100",
          )}
          aria-label={`Sửa ${path.title}`}
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onArchive}
          className={cn(
            "grid h-10 w-10 place-items-center rounded-lg border transition",
            isDarkTheme
              ? "border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/15"
              : "border-rose-200 bg-rose-50 text-rose-600 hover:border-rose-300 hover:bg-rose-100",
          )}
          aria-label={`Xóa ${path.title}`}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
