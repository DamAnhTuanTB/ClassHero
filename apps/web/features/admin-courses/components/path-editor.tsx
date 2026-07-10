import {
  BookOpen,
  CircleDollarSign,
  Hash,
  Layers3,
  LinkIcon,
  ListOrdered,
  Loader2,
  Save,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import {
  CheckboxField,
  OptionField,
  TextField,
} from "@/components/forms/form-primitives";
import {
  adminGrades,
  adminStatuses,
  adminSubjects,
  statusLabels,
  subjectLabels,
  type AdminLearningPath,
} from "@/features/admin-courses/data";
import type { LearningPathFormValues } from "@/features/admin-courses/schemas";
import type { EditorMode } from "@/features/admin-courses/types";

export function PathEditor({
  mode,
  form,
  isSaving,
  selectedPath,
  onSubmit,
  onArchive,
}: {
  mode: EditorMode;
  form: UseFormReturn<LearningPathFormValues>;
  isSaving: boolean;
  selectedPath: AdminLearningPath | null;
  onSubmit: (values: LearningPathFormValues) => void | Promise<void>;
  onArchive: () => void;
}) {
  return (
    <form
      className="rounded-lg border border-slate-200 bg-white p-4"
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-950">
            {mode === "create" ? "Tạo lộ trình" : "Thông tin lộ trình"}
          </h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {mode === "create"
              ? "Nhập thông tin cơ bản."
              : "Cập nhật tiêu đề, giá và trạng thái."}
          </p>
        </div>
        {mode === "edit" && selectedPath ? (
          <button
            type="button"
            onClick={onArchive}
            className="inline-flex min-h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-rose-200 hover:text-rose-600"
            aria-label="Lưu trữ lộ trình"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3">
        <TextField
          id="admin-course-title"
          label="Tên lộ trình"
          icon={<BookOpen className="h-5 w-5" aria-hidden="true" />}
          error={form.formState.errors.title}
          {...form.register("title")}
        />
        <TextField
          id="admin-course-slug"
          label="Slug"
          icon={<LinkIcon className="h-5 w-5" aria-hidden="true" />}
          error={form.formState.errors.slug}
          {...form.register("slug")}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <OptionField
            id="admin-course-subject"
            label="Môn"
            value={form.watch("subject")}
            icon={<Layers3 className="h-5 w-5" aria-hidden="true" />}
            options={adminSubjects.map((subject) => ({
              value: subject,
              label: subjectLabels[subject],
            }))}
            onChange={(value) =>
              form.setValue("subject", value as LearningPathFormValues["subject"], {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
          />
          <OptionField
            id="admin-course-grade"
            label="Lớp"
            value={String(form.watch("grade"))}
            icon={<Hash className="h-5 w-5" aria-hidden="true" />}
            options={adminGrades.map((grade) => ({
              value: String(grade),
              label: `Lớp ${grade}`,
            }))}
            onChange={(value) =>
              form.setValue("grade", Number(value), {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            id="admin-course-original-price"
            label="Giá gốc"
            type="number"
            icon={<CircleDollarSign className="h-5 w-5" aria-hidden="true" />}
            error={form.formState.errors.originalPriceVnd}
            {...form.register("originalPriceVnd")}
          />
          <TextField
            id="admin-course-sale-price"
            label="Giá ưu đãi"
            type="number"
            icon={<CircleDollarSign className="h-5 w-5" aria-hidden="true" />}
            error={form.formState.errors.salePriceVnd}
            {...form.register("salePriceVnd")}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <OptionField
            id="admin-course-status"
            label="Trạng thái"
            value={form.watch("status")}
            icon={<SlidersHorizontal className="h-5 w-5" aria-hidden="true" />}
            options={adminStatuses.map((status) => ({
              value: status,
              label: statusLabels[status],
            }))}
            onChange={(value) =>
              form.setValue("status", value as LearningPathFormValues["status"], {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
          />
          <TextField
            id="admin-course-sort-order"
            label="Thứ tự"
            type="number"
            icon={<ListOrdered className="h-5 w-5" aria-hidden="true" />}
            {...form.register("sortOrder")}
          />
        </div>
        <CheckboxField
          id="admin-course-trial-enabled"
          label="Cho phép học thử"
          {...form.register("trialEnabled")}
        />
      </div>

      <button
        type="submit"
        disabled={isSaving}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-extrabold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {isSaving ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Save className="h-4 w-4" aria-hidden="true" />
        )}
        {isSaving ? "Đang lưu" : "Lưu lộ trình"}
      </button>
    </form>
  );
}
