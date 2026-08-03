import { Star } from "lucide-react";
import type { CSSProperties } from "react";

export function CourseProgressBar({ value }: { value: number }) {
  const markerLeft = Math.min(Math.max(value, 0), 100);
  const progressStyle = {
    "--student-progress-marker": `calc(${markerLeft}% - 1.25rem * (${markerLeft} / 100))`,
    "--student-progress-value": `${value}%`,
  } as CSSProperties;

  return (
    <div className="grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-3">
      <span className="student-progress-label text-sm font-bold text-sky-700 dark:text-sky-300">
        Tiến độ
      </span>
      <span className="student-progress-accent-text text-sm font-extrabold text-sky-600 dark:text-sky-300">
        {value}%
      </span>
      <div className="relative h-4 min-w-0">
        <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full bg-slate-400/60 dark:bg-[var(--theme-surface-muted)]">
          <div
            className="student-progress-animated-fill h-full rounded-full bg-sky-500 dark:bg-sky-400"
            style={progressStyle}
          />
        </div>
        <span
          className="student-progress-animated-marker student-progress-star-marker absolute top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-sky-50 text-sky-600 shadow-sm dark:bg-sky-50 dark:text-sky-600"
          style={progressStyle}
        >
          <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}
