import {
  BookOpen,
  Clock3,
  Crown,
  GripVertical,
  Layers3,
  ListChecks,
  Pencil,
  Plus,
  Target,
  Trash2,
  Video,
} from "lucide-react";
import { useState, type DragEvent } from "react";
import { StatusBadge } from "@/components/admin/courses/status-badge";
import type { AdminLearningPath } from "@/features/admin/courses/admin-courses-data";
import { formatDateTime } from "@/features/admin/courses/admin-courses-utils";
import { LessonTypeBadge } from "@/features/admin/courses/screens/admin-course-detail-manager/components/lesson-type-badge";
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
  onReorderChapter,
  onReorderLesson,
}: {
  isDarkTheme?: boolean;
  path: AdminLearningPath;
  selectedChapterId: string | null;
  selectedLessonId: string | null;
  onArchiveChapter: (chapterId: string) => void;
  onArchiveLesson: (lessonId: string) => void;
  onCreateChapter: () => void;
  onCreateLesson: (chapterId: string) => void;
  onEditChapter: (chapterId: string) => void;
  onEditLesson: (lessonId: string) => void;
  onReorderChapter: (sourceChapterId: string, targetChapterId: string) => void;
  onReorderLesson: (
    chapterId: string,
    sourceLessonId: string,
    targetLessonId: string,
  ) => void;
}) {
  const [draggedChapterId, setDraggedChapterId] = useState<string | null>(null);
  const [draggedLesson, setDraggedLesson] = useState<{
    chapterId: string;
    lessonId: string;
  } | null>(null);
  const [chapterDropTargetId, setChapterDropTargetId] = useState<string | null>(null);
  const [lessonDropTargetId, setLessonDropTargetId] = useState<string | null>(null);

  function handleChapterDragStart(event: DragEvent<HTMLElement>, chapterId: string) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", chapterId);
    setDraggedChapterId(chapterId);
  }

  function handleChapterDragOver(event: DragEvent<HTMLElement>, chapterId: string) {
    if (!draggedChapterId || draggedChapterId === chapterId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setChapterDropTargetId(chapterId);
  }

  function handleChapterDrop(event: DragEvent<HTMLElement>, targetChapterId: string) {
    event.preventDefault();
    if (draggedChapterId && draggedChapterId !== targetChapterId) {
      onReorderChapter(draggedChapterId, targetChapterId);
    }
    setDraggedChapterId(null);
    setChapterDropTargetId(null);
  }

  function handleLessonDragStart(
    event: DragEvent<HTMLElement>,
    chapterId: string,
    lessonId: string,
  ) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", lessonId);
    setDraggedLesson({ chapterId, lessonId });
  }

  function handleLessonDragOver(
    event: DragEvent<HTMLElement>,
    chapterId: string,
    lessonId: string,
  ) {
    if (
      !draggedLesson ||
      draggedLesson.chapterId !== chapterId ||
      draggedLesson.lessonId === lessonId
    ) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setLessonDropTargetId(lessonId);
  }

  function handleLessonDrop(
    event: DragEvent<HTMLElement>,
    chapterId: string,
    targetLessonId: string,
  ) {
    event.preventDefault();
    if (
      draggedLesson &&
      draggedLesson.chapterId === chapterId &&
      draggedLesson.lessonId !== targetLessonId
    ) {
      onReorderLesson(chapterId, draggedLesson.lessonId, targetLessonId);
    }
    setDraggedLesson(null);
    setLessonDropTargetId(null);
  }

  function clearDragState() {
    setDraggedChapterId(null);
    setDraggedLesson(null);
    setChapterDropTargetId(null);
    setLessonDropTargetId(null);
  }

  return (
    <section className="mt-5">
      <div className="flex flex-col gap-3 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
            Cấu trúc khóa học
          </h2>
          <p className="mt-1 text-sm font-semibold text-[var(--theme-text-muted)]">
            {path.chapters.length} chương, {path.totalLessonCount} buổi học
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateChapter}
          className="theme-button-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-extrabold transition disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Thêm chương
        </button>
      </div>

      <div className="mt-4 grid gap-4">
        {path.chapters.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--theme-border-strong)] bg-[var(--theme-surface)] p-6 text-center">
            <Layers3
              className="mx-auto h-9 w-9 text-[var(--theme-text-muted)]"
              aria-hidden="true"
            />
            <p className="mt-3 text-sm font-extrabold text-[var(--theme-text-strong)]">
              Chưa có chương học
            </p>
            <p className="mt-1 text-sm text-[var(--theme-text-muted)]">
              Tạo chương học trước, sau đó thêm các buổi học vào từng chương.
            </p>
            <button
              type="button"
              onClick={onCreateChapter}
              className="theme-button-primary mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-extrabold transition"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Thêm chương đầu tiên
            </button>
          </div>
        ) : (
          path.chapters.map((chapter) => {
            const chapterOverview = (chapter.overview ?? "").trim();

            return (
              <article
                key={chapter.id}
                onDragOver={(event) => handleChapterDragOver(event, chapter.id)}
                onDragLeave={() => setChapterDropTargetId(null)}
                onDrop={(event) => handleChapterDrop(event, chapter.id)}
                className={cn(
                  "rounded-lg border bg-[var(--theme-surface)] transition",
                  selectedChapterId === chapter.id
                    ? "border-[var(--theme-primary-border)] shadow-[var(--theme-shadow-sm)]"
                    : "border-[var(--theme-border)]",
                  draggedChapterId === chapter.id && "opacity-60",
                  chapterDropTargetId === chapter.id &&
                    "border-[var(--theme-success-border)] ring-2 ring-[var(--theme-success-border)]",
                )}
              >
                <div className="grid grid-cols-[4.25rem_minmax(0,1fr)] gap-3 p-4 md:grid-cols-[4.25rem_minmax(0,1fr)_auto]">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      draggable
                      onDragStart={(event) => handleChapterDragStart(event, chapter.id)}
                      onDragEnd={clearDragState}
                      className="grid h-10 w-6 cursor-grab place-items-center rounded-md text-[var(--theme-text-muted)] transition hover:bg-[var(--theme-surface-soft)] hover:text-[var(--theme-text-strong)] active:cursor-grabbing"
                      aria-label={`Kéo để đổi vị trí ${chapter.title}`}
                      title="Kéo để đổi vị trí chương"
                    >
                      <GripVertical className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--theme-primary-soft)] text-sm font-extrabold text-[var(--theme-primary)] ring-1 ring-[var(--theme-primary-border)]">
                      {chapter.orderIndex}
                    </div>
                  </div>
                  <div className="flex items-center justify-end md:hidden">
                    <StatusBadge status={chapter.status} />
                  </div>
                  <div className="col-span-2 min-w-0 md:col-span-1">
                    <div className="grid gap-2 md:flex md:flex-wrap md:items-center">
                      <h3 className="w-full text-base font-extrabold leading-6 text-[var(--theme-text-strong)] md:w-auto md:min-w-0">
                        {chapter.title}
                      </h3>
                      <span className="hidden shrink-0 md:inline-flex">
                        <StatusBadge status={chapter.status} />
                      </span>
                    </div>
                    <p
                      className={cn(
                        "mt-1 line-clamp-1 text-sm leading-6",
                        chapterOverview
                          ? "text-[var(--theme-text)]"
                          : "italic text-[var(--theme-text-muted)]",
                      )}
                    >
                      {chapterOverview || "Chưa có mô tả chương học"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-[var(--theme-text-muted)]">
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
                  <div className="col-span-2 flex flex-wrap items-center justify-end gap-2 md:col-span-1">
                    <button
                      type="button"
                      onClick={() => onCreateLesson(chapter.id)}
                      className="theme-button-success inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-extrabold transition"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Thêm buổi học
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditChapter(chapter.id)}
                      className="theme-button-primary-subtle inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      Sửa
                    </button>
                    <button
                      type="button"
                      onClick={() => onArchiveChapter(chapter.id)}
                      className="theme-button-danger-subtle inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition"
                      aria-label={`Xóa ${chapter.title}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Xóa
                    </button>
                  </div>
                </div>

                <div className="border-t border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-3">
                  {chapter.lessons.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[var(--theme-border-strong)] bg-[var(--theme-surface)] p-4 text-center">
                      <ListChecks
                        className="mx-auto h-7 w-7 text-[var(--theme-text-muted)]"
                        aria-hidden="true"
                      />
                      <p className="mt-2 text-sm font-extrabold text-[var(--theme-text-strong)]">
                        Chưa có buổi học trong chương này
                      </p>
                      <button
                        type="button"
                        onClick={() => onCreateLesson(chapter.id)}
                        className="theme-button-success mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-extrabold transition"
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Thêm buổi học
                      </button>
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {chapter.lessons.map((lesson) => {
                        const lessonDescription = (lesson.shortDescription ?? "").trim();

                        return (
                          <article
                            key={lesson.id}
                            onDragOver={(event) =>
                              handleLessonDragOver(event, chapter.id, lesson.id)
                            }
                            onDragLeave={() => setLessonDropTargetId(null)}
                            onDrop={(event) =>
                              handleLessonDrop(event, chapter.id, lesson.id)
                            }
                            className={cn(
                              "grid grid-cols-[3.75rem_minmax(0,1fr)] gap-3 rounded-lg border p-3 transition md:grid-cols-[3.75rem_minmax(0,1fr)_auto]",
                              selectedLessonId === lesson.id
                                ? "border-[var(--theme-primary-border)] bg-[var(--theme-primary-soft)]"
                                : "border-[var(--theme-border)] bg-[var(--theme-surface)]",
                              draggedLesson?.lessonId === lesson.id && "opacity-60",
                              lessonDropTargetId === lesson.id &&
                                "border-[var(--theme-success-border)] ring-2 ring-[var(--theme-success-border)]",
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                draggable
                                onDragStart={(event) =>
                                  handleLessonDragStart(event, chapter.id, lesson.id)
                                }
                                onDragEnd={clearDragState}
                                className="grid h-10 w-5 cursor-grab place-items-center rounded-md text-[var(--theme-text-muted)] transition hover:bg-[var(--theme-surface-soft)] hover:text-[var(--theme-text-strong)] active:cursor-grabbing"
                                aria-label={`Kéo để đổi vị trí ${lesson.title}`}
                                title="Kéo để đổi vị trí buổi học"
                              >
                                <GripVertical className="h-5 w-5" aria-hidden="true" />
                              </button>
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--theme-surface-soft)] text-sm font-extrabold text-[var(--theme-text)]">
                                {lesson.orderIndex}
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-2 md:hidden">
                              <StatusBadge status={lesson.status} />
                              <LessonTypeBadge lessonType={lesson.lessonType} />
                              {lesson.trialEnabled ? (
                                <span className="inline-flex min-h-7 shrink-0 items-center gap-1 rounded-full border border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] px-2.5 text-xs font-extrabold text-[var(--theme-warning-text)]">
                                  <Crown className="h-3.5 w-3.5" aria-hidden="true" />
                                  Học thử
                                </span>
                              ) : null}
                            </div>
                            <div className="col-span-2 min-w-0 md:col-span-1">
                              <div className="grid gap-2 md:flex md:flex-wrap md:items-center">
                                <h4 className="w-full text-sm font-extrabold leading-6 text-[var(--theme-text-strong)] md:w-auto md:min-w-0">
                                  {lesson.title}
                                </h4>
                                <span className="hidden shrink-0 md:inline-flex">
                                  <StatusBadge status={lesson.status} />
                                </span>
                                <span className="hidden shrink-0 md:inline-flex">
                                  <LessonTypeBadge lessonType={lesson.lessonType} />
                                </span>
                                {lesson.trialEnabled ? (
                                  <span className="hidden min-h-7 shrink-0 items-center gap-1 rounded-full border border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] px-2.5 text-xs font-extrabold text-[var(--theme-warning-text)] md:inline-flex">
                                    <Crown className="h-3.5 w-3.5" aria-hidden="true" />
                                    Học thử
                                  </span>
                                ) : null}
                              </div>
                              <p
                                className={cn(
                                  "mt-1 line-clamp-1 text-sm leading-6",
                                  lessonDescription
                                    ? "text-[var(--theme-text)]"
                                    : "italic text-[var(--theme-text-muted)]",
                                )}
                              >
                                {lessonDescription || "Chưa có mô tả buổi học"}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-[var(--theme-text-muted)]">
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
                            <div className="col-span-2 flex items-center justify-end gap-2 md:col-span-1">
                              <button
                                type="button"
                                onClick={() => onEditLesson(lesson.id)}
                                className="theme-button-primary-subtle inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition"
                              >
                                <Pencil className="h-4 w-4" aria-hidden="true" />
                                Sửa
                              </button>
                              <button
                                type="button"
                                onClick={() => onArchiveLesson(lesson.id)}
                                className="theme-button-danger-subtle inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition"
                                aria-label={`Xóa ${lesson.title}`}
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                                Xóa
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
