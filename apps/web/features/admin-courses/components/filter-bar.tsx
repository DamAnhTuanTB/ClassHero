import { Search, SlidersHorizontal } from "lucide-react";
import { OptionField, TextField } from "@/components/forms/form-primitives";
import {
  adminGrades,
  adminStatuses,
  adminSubjects,
  statusLabels,
  subjectLabels,
  type AdminPublishStatus,
  type AdminSubject,
} from "@/features/admin-courses/data";
import { cn } from "@/lib/utils";

export function FilterBar({
  isDarkTheme = false,
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
    <div
      className={cn(
        "rounded-lg border p-3",
        isDarkTheme
          ? "border-slate-800 bg-slate-900"
          : "border-slate-200 bg-white",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 text-sm font-extrabold",
          isDarkTheme ? "text-slate-100" : "text-slate-800",
        )}
      >
        <SlidersHorizontal
          className={cn("h-4 w-4", isDarkTheme ? "text-sky-300" : "text-sky-600")}
          aria-hidden="true"
        />
        Bộ lọc
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1.2fr)_0.6fr_0.7fr_0.7fr]">
        <TextField
          id="admin-course-filter-query"
          label="Tìm lộ trình"
          hideLabel
          isDarkTheme={isDarkTheme}
          value={query}
          icon={<Search className="h-5 w-5" aria-hidden="true" />}
          placeholder="Tìm tên hoặc slug"
          onChange={(event) => onQueryChange(event.target.value)}
        />
        <OptionField
          id="admin-course-filter-grade"
          label="Lớp"
          hideLabel
          isDarkTheme={isDarkTheme}
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
          isDarkTheme={isDarkTheme}
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
          isDarkTheme={isDarkTheme}
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
