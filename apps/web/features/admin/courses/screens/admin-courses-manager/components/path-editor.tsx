"use client";

import { BookOpen, ListOrdered, Loader2, Save, SlidersHorizontal } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { OptionField } from "@/components/common/forms/option-field";
import { TextField } from "@/components/common/forms/text-field";
import { MoneyField } from "@/features/admin/courses/screens/admin-courses-manager/components/money-field";
import { CourseDateField } from "@/features/admin/courses/screens/admin-courses-manager/components/course-date-field";
import { PathCoverUpload } from "@/features/admin/courses/screens/admin-courses-manager/components/path-cover-upload";
import { PathDescriptionField } from "@/features/admin/courses/screens/admin-courses-manager/components/path-description-field";
import { adminStatuses, statusLabels } from "@/features/admin/courses/admin-courses-data";
import type {
  AdminDomain,
  AdminTargetAudience,
} from "@/features/admin/domains/api/admin-domains-api";
import type { LearningPathFormValues } from "@/features/admin/courses/admin-courses-schemas";
import type { EditorMode } from "@/features/admin/courses/admin-courses-types";

export function PathEditor({
  mode,
  form,
  isSaving,
  onClose,
  onSubmit,
  onUploadCover,
  domains,
  targetAudiences,
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
  domains: AdminDomain[];
  targetAudiences: AdminTargetAudience[];
}) {
  const startDate = form.watch("startDate");
  const endDate = form.watch("endDate");
  const dateRangeError = getDateRangeError(startDate, endDate);
  const endDateFieldError = dateRangeError
    ? { type: "validate" as const, message: dateRangeError }
    : form.formState.errors.endDate;
  const targetAudienceErrorMessage =
    form.formState.errors.targetAudienceIds?.message ??
    form.formState.errors.targetAudienceIds?.root?.message;
  const targetAudienceFieldError = targetAudienceErrorMessage
    ? { type: "validate" as const, message: targetAudienceErrorMessage }
    : undefined;

  function updateCourseDate(field: "startDate" | "endDate", value: string) {
    form.setValue(field, value, {
      shouldDirty: true,
      shouldTouch: true,
    });
  }

  function handleSubmit(values: LearningPathFormValues) {
    if (getDateRangeError(values.startDate, values.endDate)) {
      return;
    }

    return onSubmit(values);
  }

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={form.handleSubmit(handleSubmit)}
      noValidate
    >
      <div className="theme-dialog-header flex min-h-16 shrink-0 items-center px-4 py-3 pr-20 sm:px-5 sm:py-3 sm:pr-20">
        <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
          {mode === "create" ? "Tạo khóa học" : "Thông tin khóa học"}
        </h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              id="admin-course-title"
              label="Tên khóa học"
              icon={<BookOpen className="h-5 w-5" aria-hidden="true" />}
              error={form.formState.errors.title}
              {...form.register("title")}
            />
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
            placeholder="Ví dụ: Khóa học giúp học sinh nắm chắc kiến thức nền tảng và luyện bài theo từng chủ đề."
            error={form.formState.errors.description}
            {...form.register("description")}
          />
          <div className="grid gap-3">
            <OptionField
              id="admin-course-domain"
              label="Lĩnh vực"
              value={form.watch("domainId")}
              placeholder="Chọn lĩnh vực"
              icon={null}
              error={form.formState.errors.domainId}
              options={domains.map((domain) => ({
                value: domain.id,
                label: domain.name,
              }))}
              disabled={domains.length === 0}
              onChange={(value) =>
                form.setValue("domainId", value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            />
            <OptionField
              id="admin-course-target-audience"
              label="Đối tượng hướng đến"
              value={form.watch("targetAudienceIds")[0] ?? ""}
              placeholder="Chọn đối tượng"
              error={targetAudienceFieldError}
              options={targetAudiences.map((audience) => ({
                value: audience.id,
                label: audience.name,
              }))}
              disabled={targetAudiences.length === 0}
              onChange={(value) =>
                form.setValue("targetAudienceIds", [value], {
                  shouldDirty: true,
                  shouldTouch: true,
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
          <div className="grid gap-3 sm:grid-cols-2">
            <CourseDateField
              id="admin-course-start-date"
              label="Ngày bắt đầu"
              value={startDate}
              error={form.formState.errors.startDate}
              onChange={(value) => updateCourseDate("startDate", value)}
            />
            <CourseDateField
              id="admin-course-end-date"
              label="Ngày kết thúc"
              value={endDate}
              error={endDateFieldError}
              onChange={(value) => updateCourseDate("endDate", value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              id="admin-course-lesson-count-min"
              label="Số buổi tối thiểu"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              isOptional
              icon={<ListOrdered className="h-5 w-5" aria-hidden="true" />}
              value={form.watch("lessonCountMin")}
              error={form.formState.errors.lessonCountMin}
              onChange={(event) => {
                const digits = event.currentTarget.value.replace(/\D/g, "");
                form.setValue("lessonCountMin", digits === "" ? "" : Number(digits), {
                  shouldDirty: true,
                  shouldTouch: true,
                  shouldValidate: true,
                });
              }}
            />
            <TextField
              id="admin-course-lesson-count-max"
              label="Số buổi tối đa"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              isOptional
              icon={<ListOrdered className="h-5 w-5" aria-hidden="true" />}
              value={form.watch("lessonCountMax")}
              error={form.formState.errors.lessonCountMax}
              onChange={(event) => {
                const digits = event.currentTarget.value.replace(/\D/g, "");
                form.setValue("lessonCountMax", digits === "" ? "" : Number(digits), {
                  shouldDirty: true,
                  shouldTouch: true,
                  shouldValidate: true,
                });
              }}
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
          {isSaving ? "Đang lưu" : "Lưu khóa học"}
        </button>
      </div>
    </form>
  );
}

function getDateRangeError(startDate: string, endDate: string) {
  return startDate && endDate && endDate < startDate
    ? "Ngày kết thúc không được sớm hơn ngày bắt đầu"
    : null;
}
