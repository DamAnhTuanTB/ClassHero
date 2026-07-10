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
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2 text-sm font-extrabold text-slate-800">
        <SlidersHorizontal className="h-4 w-4 text-sky-600" aria-hidden="true" />
        Bộ lọc
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1.2fr)_0.7fr_0.7fr_0.6fr]">
        <TextField
          id="admin-course-filter-query"
          label="Tìm lộ trình"
          hideLabel
          value={query}
          icon={<Search className="h-5 w-5" aria-hidden="true" />}
          placeholder="Tìm tên hoặc slug"
          onChange={(event) => onQueryChange(event.target.value)}
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
            { value: "ALL", label: "Tất cả" },
            ...adminStatuses.map((status) => ({
              value: status,
              label: statusLabels[status],
            })),
          ]}
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
      </div>
    </div>
  );
}
