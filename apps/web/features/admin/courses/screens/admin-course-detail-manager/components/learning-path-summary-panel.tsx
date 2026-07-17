import {
  CalendarDays,
  CircleDollarSign,
  CircleDot,
  FileText,
  Hash,
  ImagePlus,
  Layers3,
} from "lucide-react";
import { StatusBadge } from "@/components/admin/courses/status-badge";
import {
  subjectLabels,
  type AdminLearningPath,
} from "@/features/admin/courses/admin-courses-data";
import {
  formatDateTime,
  formatPrice,
  getPriceChangePercent,
} from "@/features/admin/courses/admin-courses-utils";
import { cn } from "@/lib/utils";

export function LearningPathSummaryPanel({
  path,
}: {
  isDarkTheme?: boolean;
  path: AdminLearningPath;
}) {
  const price = path.salePriceVnd ?? path.originalPriceVnd;
  const priceChangePercent = getPriceChangePercent(path.originalPriceVnd, price);
  const labelClass =
    "flex items-center gap-2 text-xs font-extrabold uppercase text-[var(--theme-text-muted)]";
  const valueClass = "mt-1.5 text-sm font-extrabold text-[var(--theme-text-strong)]";
  const cellClass = "bg-[var(--theme-surface)] p-3";

  return (
    <section className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4 sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
        <div className="overflow-hidden rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)]">
          <div className="aspect-[16/10] bg-[var(--theme-primary-soft)]">
            {path.thumbnailImageUrl ? (
              <img
                src={path.thumbnailImageUrl}
                alt={`Ảnh đại diện ${path.title}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full place-items-center text-[var(--theme-primary)]">
                <ImagePlus className="h-12 w-12" aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="border-t border-[var(--theme-border)] px-3 py-2">
            <p className="truncate text-xs font-bold text-[var(--theme-text-muted)]">
              {path.thumbnailFileName || "Chưa có ảnh đại diện"}
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-[var(--theme-border)] bg-[var(--theme-border)]">
          <div className="grid gap-px sm:grid-cols-2 xl:grid-cols-3">
            <div className={cellClass}>
              <div className={labelClass}>
                <Layers3 className="h-4 w-4" aria-hidden="true" />
                Môn học
              </div>
              <p className={valueClass}>{subjectLabels[path.subject]}</p>
            </div>
            <div className={cellClass}>
              <div className={labelClass}>
                <Hash className="h-4 w-4" aria-hidden="true" />
                Khối lớp
              </div>
              <p className={valueClass}>Lớp {path.grade}</p>
            </div>
            <div className={cellClass}>
              <div className={labelClass}>
                <CircleDollarSign className="h-4 w-4" aria-hidden="true" />
                Giá hiển thị
              </div>
              <p className={valueClass}>{formatPrice(price)}</p>
              {path.salePriceVnd !== null ? (
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-bold text-[var(--theme-text-muted)]">
                  <span className="line-through">
                    {formatPrice(path.originalPriceVnd)}
                  </span>
                  {priceChangePercent !== null ? (
                    <span className="text-[var(--theme-primary)]">
                      {priceChangePercent < 0 ? "Giảm" : "Tăng"}{" "}
                      {Math.abs(priceChangePercent)}%
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>
            <div className={cellClass}>
              <div className={labelClass}>
                <Layers3 className="h-4 w-4" aria-hidden="true" />
                Chương học
              </div>
              <p className={valueClass}>{path.totalChapterCount} chương</p>
            </div>
            <div className={cellClass}>
              <div className={labelClass}>
                <FileText className="h-4 w-4" aria-hidden="true" />
                Bài học
              </div>
              <p className={valueClass}>{path.totalLessonCount} bài học</p>
            </div>
            <div className={cellClass}>
              <div className={labelClass}>
                <CircleDot className="h-4 w-4" aria-hidden="true" />
                Trạng thái
              </div>
              <div className="mt-1.5">
                <StatusBadge status={path.status} />
              </div>
            </div>
            <div className={cn(cellClass, "sm:col-span-2 xl:col-span-3")}>
              <div className={labelClass}>
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                Cập nhật
              </div>
              <p className={valueClass}>{formatDateTime(path.updatedAt)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-[var(--theme-border)] pt-4">
        <div className={labelClass}>
          <FileText className="h-4 w-4" aria-hidden="true" />
          Mô tả lộ trình
        </div>
        <p className="mt-1.5 text-sm leading-6 text-[var(--theme-text)]">
          {path.description || "Chưa nhập mô tả cho lộ trình này."}
        </p>
      </div>
    </section>
  );
}
