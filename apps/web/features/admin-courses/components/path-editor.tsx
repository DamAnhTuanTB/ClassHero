import {
  BookOpen,
  Hash,
  Layers3,
  LinkIcon,
  Loader2,
  Save,
  SlidersHorizontal,
} from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { OptionField, TextField } from "@/components/forms/form-primitives";
import { MoneyField } from "@/features/admin-courses/components/money-field";
import { PathCoverUpload } from "@/features/admin-courses/components/path-cover-upload";
import { PathDescriptionField } from "@/features/admin-courses/components/path-description-field";
import {
  adminGrades,
  adminStatuses,
  adminSubjects,
  statusLabels,
  subjectLabels,
} from "@/features/admin-courses/data";
import type { LearningPathFormValues } from "@/features/admin-courses/schemas";
import type { EditorMode } from "@/features/admin-courses/types";

export function PathEditor({
  mode,
  form,
  isSaving,
  onSubmit,
}: {
  mode: EditorMode;
  form: UseFormReturn<LearningPathFormValues>;
  isSaving: boolean;
  onSubmit: (values: LearningPathFormValues) => void | Promise<void>;
}) {
  return (
    <form
      className="grid gap-4"
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
    >
      <div className="flex items-start justify-between gap-3 pr-28">
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
      </div>

      <div className="grid gap-3">
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
        <PathCoverUpload
          fileName={form.watch("thumbnailFileName")}
          imageUrl={form.watch("thumbnailImageUrl")}
          onChange={(value) => {
            form.setValue("thumbnailFileName", value.fileName, {
              shouldDirty: true,
              shouldTouch: true,
              shouldValidate: true,
            });
            form.setValue("thumbnailImageUrl", value.imageUrl, {
              shouldDirty: true,
              shouldTouch: true,
              shouldValidate: true,
            });
          }}
        />
        <PathDescriptionField
          placeholder="Ví dụ: Lộ trình giúp học sinh nắm chắc kiến thức nền tảng và luyện bài theo từng chủ đề."
          error={form.formState.errors.description}
          {...form.register("description")}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <OptionField
            id="admin-course-subject"
            label="Môn"
            value={form.watch("subject")}
            placeholder="Chọn môn"
            icon={<Layers3 className="h-5 w-5" aria-hidden="true" />}
            error={form.formState.errors.subject}
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
            value={form.watch("grade") === "" ? "" : String(form.watch("grade"))}
            placeholder="Chọn lớp"
            icon={<Hash className="h-5 w-5" aria-hidden="true" />}
            error={form.formState.errors.grade}
            options={adminGrades.map((grade) => ({
              value: String(grade),
              label: `Lớp ${grade}`,
            }))}
            onChange={(value) =>
              form.setValue("grade", value === "" ? "" : Number(value), {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <MoneyField
            id="admin-course-original-price"
            label="Giá gốc"
            value={form.watch("originalPriceVnd")}
            error={form.formState.errors.originalPriceVnd}
            onChange={(value) =>
              form.setValue("originalPriceVnd", value, {
                shouldDirty: true,
                shouldTouch: true,
                shouldValidate: true,
              })
            }
          />
          <MoneyField
            id="admin-course-sale-price"
            label="Giá ưu đãi"
            isOptional
            value={form.watch("salePriceVnd")}
            error={form.formState.errors.salePriceVnd}
            onChange={(value) =>
              form.setValue("salePriceVnd", value, {
                shouldDirty: true,
                shouldTouch: true,
                shouldValidate: true,
              })
            }
          />
        </div>
        <div className="grid gap-3">
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
        </div>
      </div>

      <button
        type="submit"
        disabled={isSaving}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-extrabold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
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
