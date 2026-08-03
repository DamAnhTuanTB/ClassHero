import {
  BookOpen,
  CheckCircle2,
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
import Link from "next/link";
import { useState, type DragEvent } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/admin/courses/status-badge";
import type {
  AdminChapter,
  AdminLearningPath,
  AdminLesson,
} from "@/features/admin/courses/admin-courses-data";
import {
  canMoveLessonToPosition,
  formatDateTime,
  getCourseStructureDisplayOrders,
  getCourseStructureItems,
} from "@/features/admin/courses/admin-courses-utils";
import { CourseStructureDropIndicator } from "@/features/admin/courses/screens/admin-course-detail-manager/components/course-structure-drop-indicator";
import { LessonTypeBadge } from "@/features/admin/courses/screens/admin-course-detail-manager/components/lesson-type-badge";
import { cn } from "@/lib/utils";

type DraggedLesson = {
  chapterId: string | null;
  lessonId: string;
};

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
  onMoveChapter,
  onMoveLesson,
}: {
  isDarkTheme?: boolean;
  path: AdminLearningPath;
  selectedChapterId: string | null;
  selectedLessonId: string | null;
  onArchiveChapter: (chapterId: string) => void;
  onArchiveLesson: (lessonId: string) => void;
  onCreateChapter: () => void;
  onCreateLesson: (chapterId: string | null) => void;
  onEditChapter: (chapterId: string) => void;
  onEditLesson: (lessonId: string) => void;
  onMoveChapter: (chapterId: string, targetOrderIndex: number) => void;
  onMoveLesson: (
    lessonId: string,
    chapterId: string | null,
    targetOrderIndex: number,
  ) => Promise<boolean>;
}) {
  const structureItems = getCourseStructureItems(path);
  const displayOrders = getCourseStructureDisplayOrders(path);
  const [draggedChapterId, setDraggedChapterId] = useState<string | null>(null);
  const [draggedLesson, setDraggedLesson] = useState<DraggedLesson | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);

  function clearDragState() {
    setDraggedChapterId(null);
    setDraggedLesson(null);
    setDropTargetKey(null);
  }

  function beginChapterDrag(event: DragEvent<HTMLElement>, chapterId: string) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", chapterId);
    setDraggedChapterId(chapterId);
    setDraggedLesson(null);
  }

  function beginLessonDrag(
    event: DragEvent<HTMLElement>,
    chapterId: string | null,
    lessonId: string,
  ) {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", lessonId);
    setDraggedLesson({ chapterId, lessonId });
    setDraggedChapterId(null);
  }

  function allowDrop(event: DragEvent<HTMLElement>, key: string) {
    if (!draggedChapterId && !draggedLesson) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetKey(key);
  }

  function dropAtTopLevel(event: DragEvent<HTMLElement>, targetOrderIndex: number) {
    event.preventDefault();
    event.stopPropagation();

    if (draggedLesson) {
      moveDraggedLesson(null, adjustDropOrder(targetOrderIndex, null));
    } else if (draggedChapterId) {
      onMoveChapter(draggedChapterId, adjustDropOrder(targetOrderIndex, null));
    }
    clearDragState();
  }

  function dropInsideChapter(
    event: DragEvent<HTMLElement>,
    chapterId: string,
    targetOrderIndex: number,
  ) {
    event.preventDefault();
    event.stopPropagation();
    if (draggedLesson) {
      moveDraggedLesson(chapterId, adjustDropOrder(targetOrderIndex, chapterId));
    }
    clearDragState();
  }

  function moveDraggedLesson(
    destinationChapterId: string | null,
    targetOrderIndex: number,
  ) {
    if (!draggedLesson) {
      return;
    }

    if (
      !canMoveLessonToPosition(
        path,
        draggedLesson.lessonId,
        destinationChapterId,
        targetOrderIndex,
      )
    ) {
      toast.error("Không thể đặt buổi học ở vị trí này", {
        description: "Buổi học không được đứng trước một buổi đã có học sinh hoàn thành.",
      });
      return;
    }

    void onMoveLesson(draggedLesson.lessonId, destinationChapterId, targetOrderIndex);
  }

  function adjustDropOrder(
    targetOrderIndex: number,
    destinationChapterId: string | null,
  ) {
    if (draggedLesson) {
      const source = findLessonAndChapter(path, draggedLesson.lessonId);
      if (
        source?.chapterId === destinationChapterId &&
        source.lesson.orderIndex < targetOrderIndex
      ) {
        return Math.max(1, targetOrderIndex - 1);
      }
    }

    if (draggedChapterId && destinationChapterId === null) {
      const source = path.chapters.find((chapter) => chapter.id === draggedChapterId);
      if (source && source.orderIndex < targetOrderIndex) {
        return Math.max(1, targetOrderIndex - 1);
      }
    }

    return targetOrderIndex;
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
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => onCreateLesson(null)}
            className="theme-button-success inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-extrabold transition"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Thêm buổi học
          </button>
          <button
            type="button"
            onClick={onCreateChapter}
            className="theme-button-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-extrabold transition"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Thêm chương
          </button>
        </div>
      </div>

      {structureItems.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-[var(--theme-border-strong)] bg-[var(--theme-surface)] p-6 text-center">
          <Layers3
            className="mx-auto h-9 w-9 text-[var(--theme-text-muted)]"
            aria-hidden="true"
          />
          <p className="mt-3 text-sm font-extrabold text-[var(--theme-text-strong)]">
            Khóa học chưa có nội dung
          </p>
          <p className="mt-1 text-sm text-[var(--theme-text-muted)]">
            Bạn có thể bắt đầu bằng một chương hoặc thêm buổi học độc lập.
          </p>
          <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => onCreateLesson(null)}
              className="theme-button-success inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-extrabold transition"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Thêm buổi học đầu tiên
            </button>
            <button
              type="button"
              onClick={onCreateChapter}
              className="theme-button-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-extrabold transition"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Thêm chương đầu tiên
            </button>
          </div>
        </div>
      ) : (
        <div
          className="mt-4 grid gap-4"
          onDragOver={(event) => allowDrop(event, "top-level-end")}
          onDrop={(event) => dropAtTopLevel(event, structureItems.length + 1)}
        >
          {structureItems.map((item) =>
            item.type === "LESSON" ? (
              <div
                key={item.id}
                className="relative"
                onDragOver={(event) => {
                  event.stopPropagation();
                  allowDrop(event, `top-level-lesson-${item.id}`);
                }}
                onDrop={(event) => dropAtTopLevel(event, item.orderIndex)}
              >
                <CourseStructureDropIndicator
                  visible={
                    Boolean(draggedLesson) &&
                    dropTargetKey === `top-level-lesson-${item.id}`
                  }
                />
                <LessonCard
                  chapterId={null}
                  displayOrder={displayOrders.lessonById.get(item.id) ?? 1}
                  isDropTarget={
                    !draggedLesson && dropTargetKey === `top-level-lesson-${item.id}`
                  }
                  isStandalone
                  lesson={item}
                  selected={selectedLessonId === item.id}
                  onArchive={onArchiveLesson}
                  onDragEnd={clearDragState}
                  onDragStart={beginLessonDrag}
                  onEdit={onEditLesson}
                />
              </div>
            ) : (
              <ChapterCard
                key={item.id}
                chapter={item}
                chapterDisplayOrder={displayOrders.chapterById.get(item.id) ?? 1}
                draggedChapterId={draggedChapterId}
                draggedLesson={draggedLesson}
                dropTargetKey={dropTargetKey}
                selectedChapterId={selectedChapterId}
                selectedLessonId={selectedLessonId}
                lessonDisplayOrders={displayOrders.lessonById}
                onAllowDrop={allowDrop}
                onArchiveChapter={onArchiveChapter}
                onArchiveLesson={onArchiveLesson}
                onChapterDragStart={beginChapterDrag}
                onCreateLesson={onCreateLesson}
                onDragEnd={clearDragState}
                onDropInsideChapter={dropInsideChapter}
                onDropTopLevel={dropAtTopLevel}
                onEditChapter={onEditChapter}
                onEditLesson={onEditLesson}
                onLessonDragStart={beginLessonDrag}
              />
            ),
          )}
          <div
            className={cn(
              "relative h-4 rounded-full transition",
              draggedLesson && "cursor-grabbing",
            )}
            aria-hidden="true"
          >
            <CourseStructureDropIndicator
              className="top-1/2"
              visible={Boolean(draggedLesson) && dropTargetKey === "top-level-end"}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function ChapterCard({
  chapter,
  chapterDisplayOrder,
  draggedChapterId,
  draggedLesson,
  dropTargetKey,
  selectedChapterId,
  selectedLessonId,
  lessonDisplayOrders,
  onAllowDrop,
  onArchiveChapter,
  onArchiveLesson,
  onChapterDragStart,
  onCreateLesson,
  onDragEnd,
  onDropInsideChapter,
  onDropTopLevel,
  onEditChapter,
  onEditLesson,
  onLessonDragStart,
}: {
  chapter: AdminChapter;
  chapterDisplayOrder: number;
  draggedChapterId: string | null;
  draggedLesson: DraggedLesson | null;
  dropTargetKey: string | null;
  selectedChapterId: string | null;
  selectedLessonId: string | null;
  lessonDisplayOrders: Map<string, number>;
  onAllowDrop: (event: DragEvent<HTMLElement>, key: string) => void;
  onArchiveChapter: (chapterId: string) => void;
  onArchiveLesson: (lessonId: string) => void;
  onChapterDragStart: (event: DragEvent<HTMLElement>, chapterId: string) => void;
  onCreateLesson: (chapterId: string | null) => void;
  onDragEnd: () => void;
  onDropInsideChapter: (
    event: DragEvent<HTMLElement>,
    chapterId: string,
    targetOrderIndex: number,
  ) => void;
  onDropTopLevel: (event: DragEvent<HTMLElement>, targetOrderIndex: number) => void;
  onEditChapter: (chapterId: string) => void;
  onEditLesson: (lessonId: string) => void;
  onLessonDragStart: (
    event: DragEvent<HTMLElement>,
    chapterId: string | null,
    lessonId: string,
  ) => void;
}) {
  const chapterOverview = (chapter.overview ?? "").trim();
  const topLevelTargetKey = `top-level-chapter-${chapter.id}`;

  return (
    <article
      onDragOver={(event) => {
        event.stopPropagation();
        onAllowDrop(event, topLevelTargetKey);
      }}
      onDrop={(event) => onDropTopLevel(event, chapter.orderIndex)}
      className={cn(
        "relative rounded-lg border bg-[var(--theme-surface)] transition",
        selectedChapterId === chapter.id
          ? "border-[var(--theme-primary-border)] shadow-[var(--theme-shadow-sm)]"
          : "border-[var(--theme-border)]",
        draggedChapterId === chapter.id && "opacity-60",
        !draggedLesson &&
          dropTargetKey === topLevelTargetKey &&
          "border-[var(--theme-success-border)] ring-2 ring-[var(--theme-success-border)]",
      )}
    >
      <CourseStructureDropIndicator
        visible={Boolean(draggedLesson) && dropTargetKey === topLevelTargetKey}
      />
      <div className="grid grid-cols-[4.25rem_minmax(0,1fr)] gap-3 p-4 md:grid-cols-[4.25rem_minmax(0,1fr)_auto]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            draggable
            onDragStart={(event) => onChapterDragStart(event, chapter.id)}
            onDragEnd={onDragEnd}
            className="grid h-10 w-6 cursor-grab place-items-center rounded-md text-[var(--theme-text-muted)] transition hover:bg-[var(--theme-surface-soft)] hover:text-[var(--theme-text-strong)] active:cursor-grabbing"
            aria-label={`Kéo để đổi vị trí ${chapter.title}`}
          >
            <GripVertical className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--theme-primary-soft)] text-sm font-extrabold text-[var(--theme-primary)] ring-1 ring-[var(--theme-primary-border)]">
            {chapterDisplayOrder}
          </div>
        </div>
        <div className="flex items-center justify-end md:hidden">
          <StatusBadge status={chapter.status} />
        </div>
        <div className="col-span-2 min-w-0 md:col-span-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-extrabold leading-6 text-[var(--theme-text-strong)]">
              {chapter.title}
            </h3>
            <span className="hidden md:inline-flex">
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
          <p className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[var(--theme-text-muted)]">
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
            {chapter.lessons.length} buổi học
          </p>
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

      <div
        className={cn(
          "border-t border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-3 transition",
          dropTargetKey === `chapter-end-${chapter.id}` &&
            "ring-2 ring-inset ring-[var(--theme-success-border)]",
        )}
        onDragOver={(event) => {
          event.stopPropagation();
          if (draggedLesson) {
            onAllowDrop(event, `chapter-end-${chapter.id}`);
          }
        }}
        onDrop={(event) =>
          onDropInsideChapter(event, chapter.id, chapter.lessons.length + 1)
        }
      >
        {chapter.lessons.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--theme-border-strong)] bg-[var(--theme-surface)] p-4 text-center">
            <ListChecks
              className="mx-auto h-7 w-7 text-[var(--theme-text-muted)]"
              aria-hidden="true"
            />
            <p className="mt-2 text-sm font-extrabold text-[var(--theme-text-strong)]">
              Chưa có buổi học trong chương này
            </p>
            <p className="mt-1 text-xs text-[var(--theme-text-muted)]">
              Thêm mới hoặc kéo một buổi học vào đây.
            </p>
          </div>
        ) : (
          <div className="grid gap-2">
            {chapter.lessons.map((lesson) => (
              <div
                key={lesson.id}
                onDragOver={(event) => {
                  event.stopPropagation();
                  if (draggedLesson) {
                    onAllowDrop(event, `chapter-lesson-${lesson.id}`);
                  }
                }}
                onDrop={(event) =>
                  onDropInsideChapter(event, chapter.id, lesson.orderIndex)
                }
              >
                <LessonCard
                  chapterId={chapter.id}
                  displayOrder={lessonDisplayOrders.get(lesson.id) ?? 1}
                  isDropTarget={dropTargetKey === `chapter-lesson-${lesson.id}`}
                  lesson={lesson}
                  selected={selectedLessonId === lesson.id}
                  onArchive={onArchiveLesson}
                  onDragEnd={onDragEnd}
                  onDragStart={onLessonDragStart}
                  onEdit={onEditLesson}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function LessonCard({
  chapterId,
  displayOrder,
  isDropTarget,
  isStandalone = false,
  lesson,
  selected,
  onArchive,
  onDragEnd,
  onDragStart,
  onEdit,
}: {
  chapterId: string | null;
  displayOrder: number;
  isDropTarget: boolean;
  isStandalone?: boolean;
  lesson: AdminLesson;
  selected: boolean;
  onArchive: (lessonId: string) => void;
  onDragEnd: () => void;
  onDragStart: (
    event: DragEvent<HTMLElement>,
    chapterId: string | null,
    lessonId: string,
  ) => void;
  onEdit: (lessonId: string) => void;
}) {
  const lessonDescription = (lesson.shortDescription ?? "").trim();

  return (
    <article
      className={cn(
        "grid grid-cols-[3.75rem_minmax(0,1fr)] gap-3 rounded-lg border p-3 transition md:grid-cols-[3.75rem_minmax(0,1fr)_auto]",
        selected
          ? "border-[var(--theme-primary-border)] bg-[var(--theme-primary-soft)]"
          : "border-[var(--theme-border)] bg-[var(--theme-surface)]",
        isStandalone && "shadow-[var(--theme-shadow-sm)]",
        isDropTarget &&
          "border-[var(--theme-success-border)] ring-2 ring-[var(--theme-success-border)]",
      )}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          draggable
          onDragStart={(event) => onDragStart(event, chapterId, lesson.id)}
          onDragEnd={onDragEnd}
          className="grid h-10 w-5 cursor-grab place-items-center rounded-md text-[var(--theme-text-muted)] transition hover:bg-[var(--theme-surface-soft)] hover:text-[var(--theme-text-strong)] active:cursor-grabbing"
          aria-label={`Kéo để di chuyển ${lesson.title}`}
        >
          <GripVertical className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--theme-surface-soft)] text-sm font-extrabold text-[var(--theme-text)]">
          {displayOrder}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 md:hidden">
        <StatusBadge status={lesson.status} />
        <LessonTypeBadge lessonType={lesson.lessonType} />
      </div>
      <div className="col-span-2 min-w-0 md:col-span-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/lessons/${lesson.id}`}
            className="min-w-0 hover:text-[var(--theme-primary)] hover:underline"
          >
            <h4 className="text-sm font-extrabold leading-6 text-[var(--theme-text-strong)]">
              {lesson.title}
            </h4>
          </Link>
          <span className="hidden md:inline-flex">
            <StatusBadge status={lesson.status} />
          </span>
          <span className="hidden md:inline-flex">
            <LessonTypeBadge lessonType={lesson.lessonType} />
          </span>
          {isStandalone ? (
            <span className="-ml-1 inline-flex min-h-7 items-center rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-2.5 text-xs font-extrabold text-[var(--theme-text-muted)]">
              Không thuộc chương
            </span>
          ) : null}
          {lesson.trialEnabled ? (
            <span className="inline-flex min-h-7 items-center gap-1 rounded-full border border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] px-2.5 text-xs font-extrabold text-[var(--theme-warning-text)]">
              <Crown className="h-3.5 w-3.5" aria-hidden="true" />
              Học thử
            </span>
          ) : null}
          {lesson.hasStudentCompletion ? (
            <span className="inline-flex min-h-7 items-center gap-1 rounded-full border border-[var(--theme-success-border)] bg-[var(--theme-success-bg)] px-2.5 text-xs font-extrabold text-[var(--theme-success-text)]">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              Đã có học sinh hoàn thành
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
        <div className="mt-2 flex flex-wrap gap-3 text-xs font-bold text-[var(--theme-text-muted)]">
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
      <div className="col-span-2 flex flex-wrap items-center justify-end gap-2 md:col-span-1">
        <Link
          href={`/admin/lessons/${lesson.id}`}
          className="theme-button-primary inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition"
        >
          <Target className="h-4 w-4" aria-hidden="true" />
          Quản lý
        </Link>
        <button
          type="button"
          onClick={() => onEdit(lesson.id)}
          className="theme-button-primary-subtle inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Sửa
        </button>
        <button
          type="button"
          onClick={() => onArchive(lesson.id)}
          className="theme-button-danger-subtle inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition"
          aria-label={`Xóa ${lesson.title}`}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Xóa
        </button>
      </div>
    </article>
  );
}

function findLessonAndChapter(path: AdminLearningPath, lessonId: string) {
  for (const chapter of path.chapters) {
    const lesson = chapter.lessons.find((item) => item.id === lessonId);
    if (lesson) {
      return { chapterId: chapter.id, lesson };
    }
  }

  const lesson = getCourseStructureItems(path).find(
    (item): item is AdminLesson & { type: "LESSON" } =>
      item.type === "LESSON" && item.id === lessonId,
  );
  return lesson ? { chapterId: null, lesson } : null;
}
