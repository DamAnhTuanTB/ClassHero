import {
  BookOpenCheck,
  Check,
  ClipboardCheck,
  Hourglass,
  ListChecks,
  Trophy,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { todayLearningGoals } from "@/features/student-courses/data";
import type { StudentTodayGoal } from "@/features/student-courses/types";
import { cn } from "@/lib/utils";

const goalIcons: Record<StudentTodayGoal["icon"], LucideIcon> = {
  lesson: BookOpenCheck,
  practice: ClipboardCheck,
  score: Trophy,
};

const goalToneClasses: Record<
  StudentTodayGoal["tone"],
  {
    icon: string;
    item: string;
  }
> = {
  amber: {
    icon: "student-goal-icon--amber",
    item: "student-goal-item--amber",
  },
  emerald: {
    icon: "student-goal-icon--emerald",
    item: "student-goal-item--emerald",
  },
  indigo: {
    icon: "student-goal-icon--indigo",
    item: "student-goal-item--indigo",
  },
  sky: {
    icon: "student-goal-icon--sky",
    item: "student-goal-item--sky",
  },
};

export function TodayLearningGoalsPanel({
  goals = todayLearningGoals,
}: {
  goals?: StudentTodayGoal[];
}) {
  const completedGoalCount = goals.filter((goal) => goal.completed).length;
  const totalGoalCount = goals.length;

  return (
    <section
      className="min-w-0 overflow-hidden rounded-[1.75rem] bg-white p-4 shadow-none dark:bg-[var(--theme-surface)] sm:p-5"
      aria-labelledby="today-goals-title"
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/5 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
            <ListChecks className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2
              id="today-goals-title"
              className="student-soft-bold-text student-goals-title truncate text-lg font-extrabold leading-tight sm:text-xl"
            >
              Nhiệm vụ hôm nay
            </h2>
          </div>
        </div>
        <span className="shrink-0 rounded-xl bg-emerald-500/5 px-4 py-2 text-sm font-extrabold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
          {completedGoalCount}/{totalGoalCount} xong
        </span>
      </div>

      <div className="mt-2 grid min-w-0 gap-2.5">
        {goals.map((goal) => {
          const Icon = goalIcons[goal.icon];
          const toneClasses = goalToneClasses[goal.tone];

          return (
            <article
              key={goal.id}
              className={cn(
                "grid min-h-[4.5rem] min-w-0 grid-cols-[3rem_minmax(0,1fr)_1.75rem] items-center gap-x-3 rounded-2xl px-3.5 pb-2 pt-2",
                toneClasses.item,
              )}
            >
              <span
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-2xl",
                  toneClasses.icon,
                )}
              >
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h3 className="student-soft-bold-text min-w-0 text-base font-extrabold leading-6 text-slate-600 dark:text-[var(--theme-text-strong)] sm:text-lg sm:leading-7">
                  {goal.title}
                </h3>
              </div>
              <span
                className={cn(
                  "flex h-8 w-7 shrink-0 items-center justify-center transition-colors",
                  goal.completed
                    ? "text-emerald-600 dark:text-emerald-300"
                    : "text-slate-400 dark:text-slate-500",
                )}
                aria-label={goal.completed ? "Đã hoàn thành" : "Chưa hoàn thành"}
                role="img"
                title={goal.completed ? "Đã hoàn thành" : "Chưa hoàn thành"}
              >
                {goal.completed ? (
                  <Check className="h-6 w-6" strokeWidth={3.4} aria-hidden="true" />
                ) : (
                  <Hourglass className="h-6 w-6" aria-hidden="true" />
                )}
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
