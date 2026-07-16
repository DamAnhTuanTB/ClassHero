"use client";

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
import { OptionField } from "@/components/common/forms/option-field";
import { TextField } from "@/components/common/forms/text-field";
import { MoneyField } from "@/features/admin/courses/screens/admin-courses-manager/components/money-field";
import { PathCoverUpload } from "@/features/admin/courses/screens/admin-courses-manager/components/path-cover-upload";
import { PathDescriptionField } from "@/features/admin/courses/screens/admin-courses-manager/components/path-description-field";
import {
  adminGrades,
  adminStatuses,
  adminSubjects,
  statusLabels,
  subjectLabels,
} from "@/features/admin/courses/admin-courses-data";
import type { LearningPathFormValues } from "@/features/admin/courses/admin-courses-schemas";
import type { EditorMode } from "@/features/admin/courses/admin-courses-types";

export function PathEditor({
  mode,
  form,
  isSaving,
  onClose,
  onSubmit,
  onUploadCover,
}: {
  mode: EditorMode;
  form: UseFormReturn<LearningPathFormValues>;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (values: LearningPathFormValues) => void | Promise<void>;
  onUploadCover: (file: File) => Promise<{
    fileId: string;
    fileName: string;
    imageUrl: string;
  }>;
}) {
  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
    >
      <div className="theme-dialog-header flex min-h-16 shrink-0 items-center px-4 py-3 pr-20 sm:px-5 sm:py-3 sm:pr-20">
        <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
          {mode === "create" ? "Tạo lộ trình" : "Thông tin lộ trình"}
        </h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
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
            onUploadFile={onUploadCover}
            onChange={(value) => {
              form.setValue("thumbnailFileId", value.fileId, {
                shouldDirty: true,
                shouldTouch: true,
                shouldValidate: true,
              });
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
      </div>

      <div className="theme-dialog-footer grid shrink-0 grid-cols-2 gap-2 p-3 sm:flex sm:justify-end sm:p-4">
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          className="theme-button-neutral inline-flex min-h-11 min-w-0 items-center justify-center whitespace-nowrap rounded-lg px-4 text-center text-sm font-extrabold transition disabled:cursor-not-allowed sm:w-auto"
        >
          Hủy
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="theme-button-primary inline-flex min-h-11 min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-center text-sm font-extrabold transition disabled:cursor-not-allowed sm:w-auto"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="h-4 w-4" aria-hidden="true" />
          )}
          {isSaving ? "Đang lưu" : "Lưu lộ trình"}
        </button>
      </div>
    </form>
  );
}
