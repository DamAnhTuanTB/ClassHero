import { Search, SlidersHorizontal, X } from "lucide-react";
import { OptionField } from "@/components/common/forms/option-field";
import { TextField } from "@/components/common/forms/text-field";
import {
  adminGrades,
  adminStatuses,
  adminSubjects,
  statusLabels,
  subjectLabels,
  type AdminPublishStatus,
  type AdminSubject,
} from "@/features/admin/courses/admin-courses-data";

export function FilterBar({
  query,
  subjectFilter,
  statusFilter,
  gradeFilter,
  onQueryChange,
  onSubjectChange,
  onStatusChange,
  onGradeChange,
}: {
  isDarkTheme?: boolean;
  query: string;
  subjectFilter: AdminSubject | "ALL";
  statusFilter: AdminPublishStatus | "ALL";
  gradeFilter: number | "ALL";
  onQueryChange: (value: string) => void;
  onSubjectChange: (value: AdminSubject | "ALL") => void;
  onStatusChange: (value: AdminPublishStatus | "ALL") => void;
  onGradeChange: (value: number | "ALL") => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-3">
      <div className="flex items-center gap-2 text-sm font-extrabold text-[var(--theme-text-strong)]">
        <SlidersHorizontal
          className="h-4 w-4 text-[var(--theme-primary)]"
          aria-hidden="true"
        />
        Bộ lọc
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1.2fr)_0.6fr_0.7fr_0.7fr]">
        <TextField
          id="admin-course-filter-query"
          label="Tìm khóa học"
          hideLabel
          value={query}
          icon={<Search className="h-5 w-5" aria-hidden="true" />}
          placeholder="Tìm tên hoặc slug"
          onChange={(event) => onQueryChange(event.target.value)}
          trailingAction={
            query ? (
              <button
                type="button"
                aria-label="Xóa từ khóa tìm kiếm"
                onClick={() => onQueryChange("")}
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[var(--theme-text-muted)] transition hover:bg-[var(--theme-surface-soft)] hover:text-[var(--theme-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-focus-ring)] dark:focus:ring-1 dark:focus:ring-sky-500/15"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null
          }
        />
        <OptionField
          id="admin-course-filter-grade"
          label="Lớp"
          hideLabel
          value={String(gradeFilter)}
          icon={null}
          onChange={(value) => onGradeChange(value === "ALL" ? "ALL" : Number(value))}
          options={[
            { value: "ALL", label: "Tất cả lớp" },
            ...adminGrades.map((grade) => ({
              value: String(grade),
              label: `Lớp ${grade}`,
            })),
          ]}
        />
        <OptionField
          id="admin-course-filter-subject"
          label="Môn"
          hideLabel
          value={subjectFilter}
          icon={null}
          onChange={(value) => onSubjectChange(value as AdminSubject | "ALL")}
          options={[
            { value: "ALL", label: "Tất cả môn" },
            ...adminSubjects.map((subject) => ({
              value: subject,
              label: subjectLabels[subject],
            })),
          ]}
        />
        <OptionField
          id="admin-course-filter-status"
          label="Trạng thái"
          hideLabel
          value={statusFilter}
          icon={null}
          onChange={(value) => onStatusChange(value as AdminPublishStatus | "ALL")}
          options={[
            { value: "ALL", label: "Tất cả trạng thái" },
            ...adminStatuses.map((status) => ({
              value: status,
              label: statusLabels[status],
            })),
          ]}
        />
      </div>
    </div>
  );
}
