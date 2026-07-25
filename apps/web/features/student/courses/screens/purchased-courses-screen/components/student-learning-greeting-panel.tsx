import { UserRound } from "lucide-react";
import { LearningStreakStat } from "@/features/student/courses/screens/purchased-courses-screen/components/learning-streak-stat";

export function StudentLearningGreetingPanel({ studentName }: { studentName: string }) {
  return (
    <section
      className="min-w-0 overflow-hidden rounded-[1.75rem] bg-white p-4 shadow-none dark:bg-[var(--theme-surface)] sm:p-5"
      aria-label="Lời chào học tập"
    >
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-sky-100 text-3xl ring-4 ring-sky-50 dark:bg-sky-950 dark:ring-sky-900/40 sm:h-16 sm:w-16 sm:text-4xl"
          aria-label={`Ảnh đại diện ${studentName}`}
        >
          <UserRound
            className="h-8 w-8 text-sky-600 dark:text-sky-300 sm:h-9 sm:w-9"
            aria-hidden="true"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="student-soft-bold-text text-lg font-extrabold leading-tight text-slate-600 dark:text-[var(--theme-text-strong)] sm:text-xl">
            Chào {studentName}
          </p>
          <p className="mt-1 text-sm font-semibold leading-5 text-slate-500 dark:text-[var(--theme-text-muted)] sm:text-base">
            Cùng nhau hoàn thành nhiệm vụ học tập hôm nay em nhé!
          </p>
        </div>
        <LearningStreakStat className="hidden sm:flex" />
      </div>

      <LearningStreakStat className="mt-3 flex sm:hidden" />
    </section>
  );
}
