import { Atom, Calculator, FlaskConical } from "lucide-react";
import type { StudentCourseTone } from "@/features/student-courses/types";
import { cn } from "@/lib/utils";

const toneStyles: Record<StudentCourseTone, string> = {
  chemistry:
    "from-violet-100 via-sky-50 to-rose-50 text-violet-700 dark:from-violet-950 dark:via-slate-900 dark:to-rose-950",
  math: "from-sky-100 via-blue-50 to-amber-50 text-sky-700 dark:from-sky-950 dark:via-slate-900 dark:to-amber-950",
  physics:
    "from-emerald-100 via-cyan-50 to-sky-50 text-emerald-700 dark:from-emerald-950 dark:via-slate-900 dark:to-sky-950",
};

const visualToneStyles = {
  blue: "from-sky-100 via-blue-50 to-cyan-50 text-blue-700 dark:from-sky-950 dark:via-slate-900 dark:to-cyan-950",
};

export function CourseIllustration({
  className,
  tone,
  visualTone,
}: {
  className?: string;
  tone: StudentCourseTone;
  visualTone?: keyof typeof visualToneStyles;
}) {
  const Icon = tone === "math" ? Calculator : tone === "physics" ? Atom : FlaskConical;

  return (
    <div
      className={cn(
        "student-course-illustration relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br",
        visualTone ? visualToneStyles[visualTone] : toneStyles[tone],
        className,
      )}
    >
      <span className="absolute left-3 top-3 text-[10px] font-extrabold opacity-60">
        {tone === "math" ? "x+y=7" : tone === "physics" ? "E=mc²" : "H₂O"}
      </span>
      <span className="student-course-illustration-glow absolute bottom-3 right-3 h-10 w-10 rounded-full bg-white/55 blur-sm dark:bg-white/10" />
      <span className="student-course-illustration-icon flex h-14 w-14 items-center justify-center rounded-xl bg-white/78 shadow-[var(--theme-shadow-sm)] dark:bg-slate-900/70">
        <Icon className="h-8 w-8" aria-hidden="true" />
      </span>
    </div>
  );
}
