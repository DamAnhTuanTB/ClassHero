import type { StudentCourseAccess } from "@/features/student-courses/types";
import { accessLabels } from "@/features/student-courses/utils";
import { cn } from "@/lib/utils";

const badgeStyles: Record<StudentCourseAccess, string> = {
  completed: "border-emerald-100 bg-emerald-50 text-emerald-600",
  enrolled: "border-sky-100 bg-sky-50 text-sky-600",
  locked: "border-slate-200 bg-slate-50 text-slate-500",
};

export function CourseStatusBadge({ access }: { access: StudentCourseAccess }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-xl border px-2.5 text-xs font-bold lg:min-h-9 lg:px-4 lg:text-sm lg:font-extrabold",
        badgeStyles[access],
      )}
    >
      {accessLabels[access]}
    </span>
  );
}
