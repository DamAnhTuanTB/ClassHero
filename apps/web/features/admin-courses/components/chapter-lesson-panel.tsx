import {
  BookOpen,
  Clock3,
  Layers3,
  ListChecks,
  Pencil,
  Plus,
  Target,
  Trash2,
  Video,
} from "lucide-react";
import { StatusBadge } from "@/features/admin-courses/components/badges";
import type { AdminLearningPath } from "@/features/admin-courses/data";
import { formatDateTime } from "@/features/admin-courses/utils";
import { cn } from "@/lib/utils";

export function ChapterLessonPanel({
  path,
  selectedChapterId,
  selectedLessonId,
  onArchiveChapter,
  onArchiveLesson,
  onCreateChapter,
  onCreateLesson,
  onEditChapter,
  onEditLesson,
}: {
  path: AdminLearningPath;
  selectedChapterId: string | null;
  selectedLessonId: string | null;
  onArchiveChapter: (chapterId: string) => void;
  onArchiveLesson: (lessonId: string) => void;
  onCreateChapter: () => void;
  onCreateLesson: (chapterId: string) => void;
  onEditChapter: (chapterId: string) => void;
  onEditLesson: (lessonId: string) => void;
}) {
  return (
    <section className="mt-5">
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-slate-950">
            Cấu trúc lộ trình
          </h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {path.chapters.length} chương, {path.totalLessonCount} buổi học
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateChapter}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 text-sm font-extrabold text-sky-700 transition hover:bg-sky-100"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Thêm chương
        </button>
      </div>

      <div className="mt-4 grid gap-4">
        {path.chapters.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
            <Layers3 className="mx-auto h-9 w-9 text-slate-400" aria-hidden="true" />
            <p className="mt-3 text-sm font-extrabold text-slate-800">
              Chưa có chương học
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Tạo chương học trước, sau đó thêm các buổi học vào từng chương.
            </p>
            <button
              type="button"
              onClick={onCreateChapter}
              className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 text-sm font-extrabold text-white transition hover:bg-sky-700"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Thêm chương đầu tiên
            </button>
          </div>
        ) : (
          path.chapters.map((chapter) => (
            <article
              key={chapter.id}
              className={cn(
                "rounded-lg border bg-white transition",
                selectedChapterId === chapter.id
                  ? "border-sky-200 shadow-sm shadow-sky-900/10"
                  : "border-slate-200",
              )}
            >
              <div className="grid gap-3 p-4 md:grid-cols-[3.25rem_minmax(0,1fr)_auto]">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-sky-50 text-sm font-extrabold text-sky-700 ring-1 ring-sky-100">
                  {chapter.orderIndex}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-extrabold text-slate-950">
                      {chapter.title}
                    </h3>
                    <StatusBadge status={chapter.status} />
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {chapter.overview || "Chưa có tổng quan cho chương này."}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                      {chapter.lessons.length} buổi học
                    </span>
                    {chapter.objectives ? (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <Target className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="line-clamp-1">{chapter.objectives}</span>
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => onCreateLesson(chapter.id)}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm font-bold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Thêm buổi
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditChapter(chapter.id)}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 text-sm font-bold text-sky-700 transition hover:border-sky-300 hover:bg-sky-100"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Sửa
                  </button>
                  <button
                    type="button"
                    onClick={() => onArchiveChapter(chapter.id)}
                    className="grid h-10 w-10 place-items-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 transition hover:border-rose-300 hover:bg-rose-100"
                    aria-label={`Xóa ${chapter.title}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-200 bg-slate-50/70 p-3">
                {chapter.lessons.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center">
                    <ListChecks
                      className="mx-auto h-7 w-7 text-slate-400"
                      aria-hidden="true"
                    />
                    <p className="mt-2 text-sm font-extrabold text-slate-800">
                      Chưa có buổi học trong chương này
                    </p>
                    <button
                      type="button"
                      onClick={() => onCreateLesson(chapter.id)}
                      className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm font-extrabold text-emerald-700 transition hover:bg-emerald-100"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Thêm buổi học
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {chapter.lessons.map((lesson) => (
                      <article
                        key={lesson.id}
                        className={cn(
                          "grid gap-3 rounded-lg border p-3 transition md:grid-cols-[2.75rem_minmax(0,1fr)_auto]",
                          selectedLessonId === lesson.id
                            ? "border-sky-200 bg-sky-50"
                            : "border-slate-200 bg-white",
                        )}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-sm font-extrabold text-slate-700">
                          {lesson.orderIndex}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-extrabold text-slate-950">
                              {lesson.title}
                            </h4>
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
                            onClick={() => onEditLesson(lesson.id)}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 text-sm font-bold text-sky-700 transition hover:border-sky-300 hover:bg-sky-100"
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                            Sửa
                          </button>
                          <button
                            type="button"
                            onClick={() => onArchiveLesson(lesson.id)}
                            className="grid h-10 w-10 place-items-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 transition hover:border-rose-300 hover:bg-rose-100"
                            aria-label={`Xóa ${lesson.title}`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
