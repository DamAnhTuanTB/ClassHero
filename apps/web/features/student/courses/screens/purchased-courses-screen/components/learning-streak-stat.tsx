import { Flame } from "lucide-react";
import { learningStreakStat } from "@/features/student/shared/student-courses-data";

export function LearningStreakStat({ className }: { className?: string }) {
  return (
    <div
      className={`student-streak-stat min-w-0 shrink-0 items-center gap-3 rounded-2xl px-3 py-3 ${className ?? ""}`}
    >
      <span className="student-streak-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-sm">
        <Flame className="h-7 w-7 fill-current" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="student-streak-label block truncate text-[11px] font-extrabold uppercase tracking-[0.06em]">
          {learningStreakStat.label}
        </span>
        <span className="student-streak-value student-soft-bold-text mt-0.5 block truncate text-lg font-extrabold leading-6">
          {learningStreakStat.value} {learningStreakStat.unit}
        </span>
      </span>
    </div>
  );
}
