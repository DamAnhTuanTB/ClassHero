import Link from "next/link";
import { ChevronRight, Pencil, Trash2 } from "lucide-react";
import { StatusBadge } from "@/features/admin-courses/components/badges";
import { subjectLabels, type AdminLearningPath } from "@/features/admin-courses/data";
import { formatPrice, getPriceChangePercent } from "@/features/admin-courses/utils";
import { cn } from "@/lib/utils";

export function LearningPathRow({
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
  const mobileCellClass =
    "border-[var(--theme-border)] bg-[var(--theme-surface)] lg:border-0 lg:bg-transparent";
  const mobileLabelClass =
    "mb-1 block text-[0.68rem] font-extrabold uppercase tracking-normal text-[var(--theme-text-muted)] lg:hidden";
  const mobileValueClass = "text-sm font-extrabold text-[var(--theme-text)]";

  return (
    <article
      className={cn(
        "grid grid-cols-[2.75rem_minmax(0,1fr)_auto] gap-3 border-b px-4 py-4 transition-colors last:border-b-0 lg:grid-cols-[2.75rem_1.2fr_0.42fr_0.42fr_0.75fr_0.55fr_7rem] lg:items-center",
        "border-[var(--theme-border)]",
        isSelected
          ? "bg-[var(--theme-primary-soft)]"
          : "hover:bg-[var(--theme-surface-soft)]",
      )}
    >
      <label className="order-1 flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-primary)] transition hover:border-[var(--theme-primary-border)] hover:bg-[var(--theme-primary-soft)] lg:order-1">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
          aria-label={`Chọn ${path.title}`}
          className="admin-theme-checkbox"
        />
      </label>
      <Link
        href={`/admin/courses/${path.id}`}
        className="order-3 col-span-3 min-w-0 rounded-lg lg:order-2 lg:col-span-1"
      >
        <div className="flex items-center gap-2">
          <span
            className="group relative inline-flex min-w-0 max-w-full items-center"
            title={path.title}
          >
            <span className="truncate text-base font-extrabold text-[var(--theme-text-strong)]">
              {path.title}
            </span>
            <span
              role="tooltip"
              className="pointer-events-none absolute left-0 top-full z-40 mt-2 w-max max-w-64 rounded-lg bg-[var(--theme-tooltip-bg)] px-3 py-2 text-xs font-bold leading-5 text-[var(--theme-tooltip-text)] opacity-0 shadow-[var(--theme-shadow-sm)] ring-1 ring-[var(--theme-border)] transition group-hover:opacity-100 lg:hidden"
            >
              {path.title}
            </span>
          </span>
          <ChevronRight
            className="h-4 w-4 text-[var(--theme-text-muted)]"
            aria-hidden="true"
          />
        </div>
        <p className="mt-1 truncate text-sm font-semibold text-[var(--theme-text-muted)]">
          {path.slug}
        </p>
      </Link>
      <div
        className={cn(
          "order-4 col-span-2 rounded-lg border p-3 lg:order-3 lg:col-span-1 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0",
          mobileCellClass,
        )}
      >
        <span className={mobileLabelClass}>Môn học</span>
        <span className={mobileValueClass}>{subjectLabels[path.subject]}</span>
      </div>
      <div
        className={cn(
          "order-5 col-span-1 rounded-lg border p-3 lg:order-4 lg:col-span-1 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0",
          mobileCellClass,
        )}
      >
        <span className={mobileLabelClass}>Khối lớp</span>
        <span className={mobileValueClass}>Lớp {path.grade}</span>
      </div>
      <div
        className={cn(
          "order-6 col-span-2 grid gap-1 rounded-lg border p-3 lg:order-5 lg:col-span-1 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0",
          mobileCellClass,
        )}
      >
        <span className={mobileLabelClass}>Giá hiển thị</span>
        <p className="text-sm font-extrabold text-[var(--theme-text-strong)]">
          {formatPrice(currentPrice)}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {path.salePriceVnd === null ? (
            <span className="text-xs font-bold text-[var(--theme-text-muted)]">
              Giá gốc
            </span>
          ) : (
            <span className="text-xs font-bold text-[var(--theme-text-muted)] line-through">
              {formatPrice(path.originalPriceVnd)}
            </span>
          )}
          {priceChangePercent !== null ? (
            <span
              className={cn(
                "inline-flex min-h-6 items-center rounded-full border px-2 text-xs font-extrabold",
                priceChangePercent < 0
                  ? "border-[var(--theme-primary-border)] bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]"
                  : "border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] text-[var(--theme-warning-text)]",
              )}
            >
              {priceChangePercent < 0 ? "Giảm" : "Tăng"} {Math.abs(priceChangePercent)}%
            </span>
          ) : null}
        </div>
      </div>
      <div
        className={cn(
          "order-7 col-span-1 flex flex-col items-start gap-1.5 rounded-lg border p-3 lg:order-6 lg:col-span-1 lg:block lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0",
          mobileCellClass,
        )}
      >
        <span className={mobileLabelClass}>Trạng thái</span>
        <StatusBadge status={path.status} />
      </div>
      <div className="order-2 col-span-2 flex justify-end gap-1.5 lg:order-7 lg:col-span-1 lg:gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="theme-button-primary-subtle inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-bold transition lg:h-10 lg:w-10 lg:px-0"
          aria-label={`Sửa ${path.title}`}
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
          <span className="lg:sr-only">Sửa</span>
        </button>
        <button
          type="button"
          onClick={onArchive}
          className="theme-button-danger-subtle inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-bold transition lg:h-10 lg:w-10 lg:px-0"
          aria-label={`Xóa ${path.title}`}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          <span className="lg:sr-only">Xóa</span>
        </button>
      </div>
    </article>
  );
}
