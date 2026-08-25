import {
  countAdminFigureStatuses,
  type AdminFigureStatus,
  type AdminFigureStatusCounts as FigureStatusCounts,
} from "@/lib/admin-figure-status";

type StatusVariant =
  "neutral" | "queued" | "processing" | "succeeded" | "needsReview" | "failed";

const STATUS_ITEMS: Array<{
  key: keyof FigureStatusCounts;
  label: string;
  variant: StatusVariant;
}> = [
  { key: "total", label: "Tổng", variant: "neutral" },
  { key: "succeeded", label: "Thành công", variant: "succeeded" },
  { key: "needsReview", label: "Cần xem lại", variant: "needsReview" },
  { key: "failed", label: "Lỗi", variant: "failed" },
  { key: "queued", label: "Chờ xử lý", variant: "queued" },
  { key: "processing", label: "Đang xử lý", variant: "processing" },
];

const STATUS_CLASSES: Record<StatusVariant, string> = {
  neutral:
    "border-[var(--theme-border)] bg-[var(--theme-surface-soft)] text-[var(--theme-text-muted)]",
  queued:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  processing:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
  succeeded:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  needsReview:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200",
  failed:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200",
};

export function AdminFigureStatusCounts({
  figures,
}: {
  figures: ReadonlyArray<{ status: AdminFigureStatus }>;
}) {
  const counts = countAdminFigureStatuses(figures);

  return (
    <div aria-live="polite" className="mb-4 flex flex-wrap gap-2">
      {STATUS_ITEMS.map((item) => (
        <span
          className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-extrabold tabular-nums ${STATUS_CLASSES[item.variant]}`}
          key={item.key}
        >
          {item.label} <strong>{counts[item.key]}</strong>
        </span>
      ))}
    </div>
  );
}
