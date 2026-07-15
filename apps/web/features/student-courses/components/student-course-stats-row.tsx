import { BookOpen, CalendarDays, PieChart } from "lucide-react";
import type { StudentCourseStat } from "@/features/student-courses/types";

export function StudentCourseStatsRow({ stats }: { stats: StudentCourseStat[] }) {
  const icons = [BookOpen, PieChart, CalendarDays];
  const iconStyles = [
    "text-blue-600 bg-blue-50",
    "text-emerald-600 bg-emerald-50",
    "text-amber-500 bg-amber-50",
  ];

  return (
    <section className="grid min-w-0 grid-cols-3 gap-2" aria-label="Tổng quan học tập">
      {stats.map((stat, index) => {
        const Icon = icons[index] ?? BookOpen;

        return (
          <div
            key={stat.label}
            className="flex min-h-[5rem] min-w-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] sm:p-3"
          >
            <span
              className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-full sm:flex ${iconStyles[index] ?? iconStyles[0]}`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 text-center sm:text-left">
              <span className="block text-xl font-extrabold leading-none text-slate-700 dark:text-[var(--theme-text-strong)]">
                {stat.value}
              </span>
              <span className="mt-1 block text-xs font-medium leading-4 text-slate-500 dark:text-[var(--theme-text-muted)]">
                {stat.label}
              </span>
            </span>
          </div>
        );
      })}
    </section>
  );
}
