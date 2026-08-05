import {
  Atom,
  BookMarked,
  BookOpen,
  Brain,
  Calculator,
  FlaskConical,
  Globe2,
  Languages,
  Music2,
  Palette,
  type LucideIcon,
} from "lucide-react";
import type { StudentCourseSubject } from "@/features/student/shared/student-courses-types";
import {
  getSubjectBadgeClass,
  subjectLabels,
} from "@/features/student/shared/utils/student-courses-utils";
import { cn } from "@/lib/utils";

const subjectIconBySubject: Partial<Record<StudentCourseSubject, LucideIcon>> = {
  CHEMISTRY: FlaskConical,
  MATH: Calculator,
  PHYSICS: Atom,
};

const subjectIconByDomainName: Record<string, LucideIcon> = {
  "Hóa học": FlaskConical,
  "Tiếng Anh": Languages,
  Toán: Calculator,
  "Vật lý": Atom,
};

const fallbackSubjectIcons: LucideIcon[] = [
  BookOpen,
  BookMarked,
  Brain,
  Globe2,
  Music2,
  Palette,
];

export function CourseSubjectBadge({ subject }: { subject: StudentCourseSubject }) {
  const SubjectIcon = getSubjectIcon(subject);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-xl px-2 py-1 text-[11px] font-extrabold leading-none lg:gap-1.5 lg:px-3 lg:py-1.5 lg:text-xs",
        getSubjectBadgeClass(subject),
      )}
    >
      <SubjectIcon className="h-3.5 w-3.5 shrink-0 lg:h-4 lg:w-4" aria-hidden="true" />
      {subjectLabels[subject] ?? subject}
    </span>
  );
}

function getSubjectIcon(subject: StudentCourseSubject) {
  const exactIcon = subjectIconByDomainName[subject] ?? subjectIconBySubject[subject];

  if (exactIcon) {
    return exactIcon;
  }

  const subjectHash = Array.from(subject).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );

  return fallbackSubjectIcons[subjectHash % fallbackSubjectIcons.length] ?? BookOpen;
}
