import { CheckCircle2, CirclePlay, LockKeyhole, Wrench } from "lucide-react";
import type { StudentCourseAccess } from "@/features/student/shared/student-courses-types";
import { accessLabels } from "@/features/student/shared/utils/student-courses-utils";
import { cn } from "@/lib/utils";

const badgeStyles: Record<StudentCourseAccess, string> = {
  completed: "border-emerald-100 bg-emerald-50 text-emerald-600",
  enrolled: "border-sky-100 bg-sky-50 text-sky-600",
  locked:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/15 dark:text-rose-300",
};

export function CourseStatusBadge({
  access,
  isUnderMaintenance = false,
}: {
  access: StudentCourseAccess;
  isUnderMaintenance?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-sm font-extrabold leading-none lg:px-3 lg:py-1.5 lg:text-xs",
        isUnderMaintenance
          ? "border-amber-100 bg-amber-50 text-amber-700 dark:border-[var(--theme-warning-border)] dark:bg-[var(--theme-warning-bg)] dark:text-[var(--theme-warning-text)]"
          : badgeStyles[access],
      )}
    >
      {isUnderMaintenance ? (
        <Wrench className="h-3.5 w-3.5 shrink-0 lg:h-4 lg:w-4" aria-hidden="true" />
      ) : access === "completed" ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 lg:h-4 lg:w-4" aria-hidden="true" />
      ) : access === "enrolled" ? (
        <CirclePlay className="h-3.5 w-3.5 shrink-0 lg:h-4 lg:w-4" aria-hidden="true" />
      ) : (
        <LockKeyhole className="h-3.5 w-3.5 shrink-0 lg:h-4 lg:w-4" aria-hidden="true" />
      )}
      {isUnderMaintenance ? "Bảo trì" : accessLabels[access]}
    </span>
  );
}
