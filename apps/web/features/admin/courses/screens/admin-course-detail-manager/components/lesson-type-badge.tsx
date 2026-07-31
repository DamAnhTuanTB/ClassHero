import { RadioTower } from "lucide-react";
import type { AdminLessonType } from "@/features/admin/courses/admin-courses-data";

export function LessonTypeBadge({ lessonType }: { lessonType: AdminLessonType }) {
  if (lessonType !== "LIVE") {
    return null;
  }

  return (
    <span
      className="inline-flex min-h-7 shrink-0 items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 text-xs font-extrabold text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300"
      aria-label="Buổi học live"
    >
      <RadioTower className="h-3.5 w-3.5" aria-hidden="true" />
      Live
    </span>
  );
}
