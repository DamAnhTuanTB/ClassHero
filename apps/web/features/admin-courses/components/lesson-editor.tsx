import {
  CalendarDays,
  Check,
  FileText,
  ListOrdered,
  Loader2,
  Plus,
  SlidersHorizontal,
  Trophy,
  Video,
} from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { OptionField, TextField } from "@/components/forms/form-primitives";
import { adminStatuses, statusLabels } from "@/features/admin-courses/data";
import type { LessonFormValues } from "@/features/admin-courses/schemas";
import type { EditorMode } from "@/features/admin-courses/types";
import { cn } from "@/lib/utils";

export function LessonEditor({
  mode,
  form,
  isSaving,
  disabled,
  onSubmit,
  onCreateMode,
}: {
  mode: EditorMode;
  form: UseFormReturn<LessonFormValues>;
  isSaving: boolean;
  disabled: boolean;
  onSubmit: (values: LessonFormValues) => void | Promise<void>;
  onCreateMode: () => void;
}) {
  return (
    <form
      className={cn(
        "rounded-lg border border-slate-200 bg-white p-4",
        disabled && "opacity-65",
      )}
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-950">
            {mode === "create" ? "Thêm buổi học" : "Sửa buổi học"}
          </h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Thứ tự, video và thời điểm mở bài thi.
          </p>
        </div>
        {mode === "edit" ? (
          <button
            type="button"
            onClick={onCreateMode}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:border-sky-200 hover:text-sky-700"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Mới
          </button>
        ) : null}
      </div>

      <fieldset disabled={disabled || isSaving} className="mt-4 grid gap-3">
        <div className="grid gap-3 sm:grid-cols-[6rem_minmax(0,1fr)]">
          <TextField
            id="admin-lesson-order"
            label="Thứ tự"
            type="number"
            icon={<ListOrdered className="h-5 w-5" aria-hidden="true" />}
            error={form.formState.errors.orderIndex}
            {...form.register("orderIndex")}
          />
          <TextField
            id="admin-lesson-title"
            label="Tên buổi học"
            icon={<FileText className="h-5 w-5" aria-hidden="true" />}
            error={form.formState.errors.title}
            {...form.register("title")}
          />
        </div>
        <TextField
          id="admin-lesson-description"
          label="Mô tả ngắn"
          icon={<FileText className="h-5 w-5" aria-hidden="true" />}
          error={form.formState.errors.shortDescription}
          {...form.register("shortDescription")}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            id="admin-lesson-scheduled-at"
            label="Ngày học"
            type="datetime-local"
            icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />}
            {...form.register("scheduledAt")}
          />
          <TextField
            id="admin-lesson-exam-open-at"
            label="Mở bài thi"
            type="datetime-local"
            icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />}
            {...form.register("examOpenAt")}
          />
        </div>
        <TextField
          id="admin-lesson-video-url"
          label="Video URL"
          icon={<Video className="h-5 w-5" aria-hidden="true" />}
          error={form.formState.errors.videoUrl}
          {...form.register("videoUrl")}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            id="admin-lesson-completion-score"
            label="Điểm hoàn thành"
            type="number"
            step="0.5"
            icon={<Trophy className="h-5 w-5" aria-hidden="true" />}
            error={form.formState.errors.completionMinScore}
            {...form.register("completionMinScore")}
          />
          <OptionField
            id="admin-lesson-status"
            label="Trạng thái"
            value={form.watch("status")}
            icon={<SlidersHorizontal className="h-5 w-5" aria-hidden="true" />}
            options={adminStatuses.map((status) => ({
              value: status,
              label: statusLabels[status],
            }))}
            onChange={(value) =>
              form.setValue("status", value as LessonFormValues["status"], {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
          />
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={disabled || isSaving}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 text-sm font-extrabold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {isSaving ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Check className="h-4 w-4" aria-hidden="true" />
        )}
        {isSaving ? "Đang lưu" : "Lưu buổi học"}
      </button>
    </form>
  );
}
