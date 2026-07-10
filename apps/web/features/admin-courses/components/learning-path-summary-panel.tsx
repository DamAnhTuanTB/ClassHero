import {
  CalendarDays,
  CircleDollarSign,
  CircleDot,
  FileText,
  Hash,
  ImagePlus,
  Layers3,
} from "lucide-react";
import { StatusBadge } from "@/features/admin-courses/components/badges";
import {
  subjectLabels,
  type AdminLearningPath,
} from "@/features/admin-courses/data";
import {
  formatDateTime,
  formatPrice,
  getPriceChangePercent,
} from "@/features/admin-courses/utils";

export function LearningPathSummaryPanel({ path }: { path: AdminLearningPath }) {
  const price = path.salePriceVnd ?? path.originalPriceVnd;
  const priceChangePercent = getPriceChangePercent(path.originalPriceVnd, price);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          <div className="aspect-[16/10] bg-gradient-to-br from-sky-50 via-white to-emerald-50">
            {path.thumbnailImageUrl ? (
              <img
                src={path.thumbnailImageUrl}
                alt={`Ảnh đại diện ${path.title}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full place-items-center text-sky-600">
                <ImagePlus className="h-12 w-12" aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="border-t border-slate-200 px-3 py-2">
            <p className="truncate text-xs font-bold text-slate-500">
              {path.thumbnailFileName || "Chưa có ảnh đại diện"}
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-200">
          <div className="grid gap-px sm:grid-cols-2 xl:grid-cols-3">
            <div className="bg-slate-50 p-3">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-slate-500">
                <Layers3 className="h-4 w-4" aria-hidden="true" />
                Môn học
              </div>
              <p className="mt-1.5 text-sm font-extrabold text-slate-900">
                {subjectLabels[path.subject]}
              </p>
            </div>
            <div className="bg-slate-50 p-3">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-slate-500">
                <Hash className="h-4 w-4" aria-hidden="true" />
                Khối lớp
              </div>
              <p className="mt-1.5 text-sm font-extrabold text-slate-900">
                Lớp {path.grade}
              </p>
            </div>
            <div className="bg-slate-50 p-3">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-slate-500">
                <CircleDollarSign className="h-4 w-4" aria-hidden="true" />
                Giá hiển thị
              </div>
              <p className="mt-1.5 text-sm font-extrabold text-slate-900">
                {formatPrice(price)}
              </p>
              {path.salePriceVnd !== null ? (
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-500">
                  <span className="line-through">{formatPrice(path.originalPriceVnd)}</span>
                  {priceChangePercent !== null ? (
                    <span className="text-fuchsia-700">
                      {priceChangePercent < 0 ? "Giảm" : "Tăng"}{" "}
                      {Math.abs(priceChangePercent)}%
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>
            <div className="bg-slate-50 p-3">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-slate-500">
                <Layers3 className="h-4 w-4" aria-hidden="true" />
                Chương học
              </div>
              <p className="mt-1.5 text-sm font-extrabold text-slate-900">
                {path.totalChapterCount} chương
              </p>
            </div>
            <div className="bg-slate-50 p-3">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-slate-500">
                <FileText className="h-4 w-4" aria-hidden="true" />
                Buổi học
              </div>
              <p className="mt-1.5 text-sm font-extrabold text-slate-900">
                {path.totalLessonCount} buổi
              </p>
            </div>
            <div className="bg-slate-50 p-3">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-slate-500">
                <CircleDot className="h-4 w-4" aria-hidden="true" />
                Trạng thái
              </div>
              <div className="mt-1.5">
                <StatusBadge status={path.status} />
              </div>
            </div>
            <div className="bg-slate-50 p-3 sm:col-span-2 xl:col-span-3">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-slate-500">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                Cập nhật
              </div>
              <p className="mt-1.5 text-sm font-extrabold text-slate-900">
                {formatDateTime(path.updatedAt)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-200 pt-4">
        <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-slate-500">
          <FileText className="h-4 w-4" aria-hidden="true" />
          Mô tả lộ trình
        </div>
        <p className="mt-1.5 text-sm leading-6 text-slate-700">
          {path.description || "Chưa nhập mô tả cho lộ trình này."}
        </p>
      </div>
    </section>
  );
}
