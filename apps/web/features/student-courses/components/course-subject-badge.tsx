import { Atom, Calculator, FlaskConical, type LucideIcon } from "lucide-react";
import type { StudentCourseSubject } from "@/features/student-courses/types";
import { getSubjectBadgeClass, subjectLabels } from "@/features/student-courses/utils";
import { cn } from "@/lib/utils";

const subjectIconBySubject: Record<StudentCourseSubject, LucideIcon> = {
  CHEMISTRY: FlaskConical,
  MATH: Calculator,
  PHYSICS: Atom,
};

export function CourseSubjectBadge({ subject }: { subject: StudentCourseSubject }) {
  const SubjectIcon = subjectIconBySubject[subject];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-xl px-2 py-1 text-[11px] font-extrabold leading-none lg:gap-1.5 lg:px-3 lg:py-1.5 lg:text-sm",
        getSubjectBadgeClass(subject),
      )}
    >
      <SubjectIcon className="hidden h-4 w-4 shrink-0 lg:block" aria-hidden="true" />
      {subjectLabels[subject]}
    </span>
  );
}
