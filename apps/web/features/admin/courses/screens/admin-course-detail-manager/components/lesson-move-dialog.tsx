"use client";

import { ArrowRightLeft, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import { OptionField } from "@/components/common/forms/option-field";
import type {
  AdminLearningPath,
  AdminLesson,
} from "@/features/admin/courses/admin-courses-data";
import {
  canMoveLessonToPosition,
  getCourseStructureItems,
  getLessonsInContainer,
} from "@/features/admin/courses/admin-courses-utils";

const topLevelValue = "__TOP_LEVEL__";

export function LessonMoveDialog({
  currentChapterId,
  isMoving,
  lesson,
  path,
  onClose,
  onMove,
}: {
  currentChapterId: string | null;
  isMoving: boolean;
  lesson: AdminLesson | null;
  path: AdminLearningPath;
  onClose: () => void;
  onMove: (
    lessonId: string,
    chapterId: string | null,
    targetOrderIndex: number,
  ) => Promise<boolean>;
}) {
  const [containerValue, setContainerValue] = useState(topLevelValue);
  const [positionValue, setPositionValue] = useState("1");
  const destinationChapterId = containerValue === topLevelValue ? null : containerValue;
  const isBlockedByCompletion = lesson
    ? !canMoveLessonToPosition(
        path,
        lesson.id,
        destinationChapterId,
        Number(positionValue),
      )
    : false;

  const positionOptions = useMemo(() => {
    if (!lesson) {
      return [];
    }

    const destinationItems = destinationChapterId
      ? getLessonsInContainer(path, destinationChapterId)
      : getCourseStructureItems(path);
    const itemsWithoutMovingLesson = destinationItems.filter(
      (item) => item.id !== lesson.id,
    );

    return Array.from({ length: itemsWithoutMovingLesson.length + 1 }, (_, index) => {
      const nextItem = itemsWithoutMovingLesson[index];
      return {
        value: String(index + 1),
        label: nextItem
          ? `Vị trí ${index + 1} — trước ${nextItem.title}`
          : `Vị trí ${index + 1} — cuối ${destinationChapterId ? "chương" : "khóa học"}`,
      };
    });
  }, [destinationChapterId, lesson, path]);

  useEffect(() => {
    if (!lesson) {
      return;
    }

    setContainerValue(currentChapterId ?? topLevelValue);
    setPositionValue(String(lesson.orderIndex));
  }, [currentChapterId, lesson]);

  useEffect(() => {
    if (!positionOptions.some((option) => option.value === positionValue)) {
      setPositionValue(positionOptions.at(-1)?.value ?? "1");
    }
  }, [positionOptions, positionValue]);

  if (!lesson) {
    return null;
  }
  const lessonId = lesson.id;

  async function submit() {
    const didMove = await onMove(lessonId, destinationChapterId, Number(positionValue));
    if (didMove) {
      onClose();
    }
  }

  return (
    <EditorDialogShell
      ariaLabel={`Di chuyển ${lesson.title}`}
      isOpen
      onClose={onClose}
      panelClassName="max-w-xl"
    >
      <div className="border-b border-[var(--theme-border)] px-5 py-5 pr-16 sm:px-6">
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--theme-primary)]">
          Cấu trúc khóa học
        </p>
        <h2 className="mt-1 text-xl font-extrabold text-[var(--theme-text-strong)]">
          Di chuyển buổi học
        </h2>
        <p className="mt-1 line-clamp-2 text-sm text-[var(--theme-text-muted)]">
          {lesson.title}
        </p>
      </div>

      <div className="grid min-h-0 gap-4 overflow-y-auto px-5 py-5 sm:px-6">
        <OptionField
          id="lesson-move-container"
          label="Nơi đặt buổi học"
          value={containerValue}
          icon={<ArrowRightLeft className="h-5 w-5" aria-hidden="true" />}
          options={[
            { value: topLevelValue, label: "Không thuộc chương" },
            ...path.chapters.map((chapter) => ({
              value: chapter.id,
              label: chapter.title,
            })),
          ]}
          disabled={isMoving}
          onChange={(value) => {
            setContainerValue(value);
            setPositionValue("1");
          }}
        />
        <OptionField
          id="lesson-move-position"
          label="Vị trí mới"
          value={positionValue}
          icon={null}
          options={positionOptions}
          disabled={isMoving}
          onChange={setPositionValue}
        />

        <div className="flex gap-3 rounded-lg border border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] p-3 text-sm text-[var(--theme-warning-text)]">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="leading-6">
            {isBlockedByCompletion
              ? "Vị trí này không hợp lệ vì buổi học sẽ đứng trước một buổi đã có học sinh hoàn thành."
              : "Không thể đặt buổi học trước bất kỳ buổi nào đã có ít nhất một học sinh hoàn thành."}
          </p>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-[var(--theme-border)] px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
        <button
          type="button"
          onClick={onClose}
          disabled={isMoving}
          className="theme-button-neutral min-h-11 rounded-lg px-4 text-sm font-bold transition disabled:opacity-60"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={isMoving || positionOptions.length === 0 || isBlockedByCompletion}
          className="theme-button-primary min-h-11 rounded-lg px-4 text-sm font-extrabold transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isMoving ? "Đang di chuyển..." : "Di chuyển"}
        </button>
      </div>
    </EditorDialogShell>
  );
}
