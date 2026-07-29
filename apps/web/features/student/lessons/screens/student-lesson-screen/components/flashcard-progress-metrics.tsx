"use client";

import type { FlashcardProgressSummary } from "@/features/student/lessons/types/student-lesson-types";
import { cn } from "@/lib/utils";

export function FlashcardProgressMetrics({
  progress,
}: {
  progress: FlashcardProgressSummary;
}) {
  const scoreOnTen = Number(
    ((progress.knownCount / Math.max(progress.totalCount, 1)) * 10).toFixed(1),
  );
  const metrics = [
    {
      key: "known",
      label: "Đã thuộc",
      tone: "success",
      value: progress.knownCount,
    },
    {
      key: "unknown",
      label: "Chưa thuộc",
      tone: "danger",
      value: progress.unknownCount,
    },
    {
      key: "score",
      label: "Điểm",
      tone: "primary",
      value: scoreOnTen,
    },
  ] as const;

  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      {metrics.map((metric) => (
        <div
          key={metric.key}
          className={cn(
            "rounded-2xl px-2 py-4",
            metric.tone === "success"
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
              : metric.tone === "danger"
                ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
                : "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
          )}
        >
          <p className="text-xl font-black sm:text-2xl">{metric.value}</p>
          <p className="mt-1 text-[10px] font-black uppercase tracking-wide sm:text-xs">
            {metric.label}
          </p>
        </div>
      ))}
    </div>
  );
}
