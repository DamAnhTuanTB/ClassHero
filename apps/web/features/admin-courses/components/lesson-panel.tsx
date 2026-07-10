import { Archive, BookOpen, Clock3, Pencil, Plus, Video } from "lucide-react";
import { StatusBadge } from "@/features/admin-courses/components/badges";
import type { AdminLearningPath } from "@/features/admin-courses/data";
import { formatDateTime } from "@/features/admin-courses/utils";
import { cn } from "@/lib/utils";

export function LessonPanel({
  path,
  selectedLessonId,
  onCreate,
  onEdit,
  onArchive,
}: {
  path: AdminLearningPath;
  selectedLessonId: string | null;
  onCreate: () => void;
  onEdit: (lessonId: string) => void;
  onArchive: (lessonId: string) => void;
}) {
  return (
    <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-slate-950">
            Buổi học trong lộ trình
          </h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {path.lessons.length} buổi học, sắp xếp theo thứ tự tăng dần.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 text-sm font-extrabold text-sky-700 transition hover:bg-sky-100"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Thêm buổi học
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        {path.lessons.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
            <p className="mt-2 text-sm font-extrabold text-slate-800">Chưa có buổi học</p>
            <p className="mt-1 text-sm text-slate-500">
              Thêm buổi đầu tiên để hoàn thiện cấu trúc lộ trình.
            </p>
          </div>
        ) : (
          path.lessons.map((lesson) => (
            <article
              key={lesson.id}
              className={cn(
                "grid gap-3 rounded-lg border p-3 transition md:grid-cols-[3rem_minmax(0,1fr)_auto]",
                selectedLessonId === lesson.id
                  ? "border-sky-200 bg-sky-50"
                  : "border-slate-200 bg-white",
              )}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-sm font-extrabold text-slate-700">
                {lesson.orderIndex}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-extrabold text-slate-950">
                    {lesson.title}
                  </h3>
                  <StatusBadge status={lesson.status} />
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {lesson.shortDescription || "Chưa có mô tả ngắn."}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                    Mở bài thi: {formatDateTime(lesson.examOpenAt)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Video className="h-3.5 w-3.5" aria-hidden="true" />
                    Điểm hoàn thành: {lesson.completionMinScore}/10
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onEdit(lesson.id)}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:border-sky-200 hover:text-sky-700"
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  Sửa
                </button>
                <button
                  type="button"
                  onClick={() => onArchive(lesson.id)}
                  className="inline-flex min-h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-rose-200 hover:text-rose-600"
                  aria-label={`Lưu trữ ${lesson.title}`}
                >
                  <Archive className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
