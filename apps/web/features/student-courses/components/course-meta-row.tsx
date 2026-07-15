import { BookOpen, CalendarDays } from "lucide-react";
import type { StudentCourse } from "@/features/student-courses/types";

export function CourseMetaRow({ course }: { course: StudentCourse }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-slate-600 dark:text-[var(--theme-text-muted)] lg:gap-x-5 lg:text-[15px]">
      <span className="inline-flex items-center gap-1.5 lg:gap-2">
        <BookOpen
          className="student-chapter-icon h-[18px] w-[18px] text-emerald-800 dark:text-emerald-300 lg:h-[22px] lg:w-[22px]"
          aria-hidden="true"
        />
        {course.chapterCount} chương
      </span>
      <span className="inline-flex items-center gap-1.5 lg:gap-2">
        <CalendarDays
          className="student-progress-accent-text h-[18px] w-[18px] text-sky-600 dark:text-sky-300 lg:h-[22px] lg:w-[22px]"
          aria-hidden="true"
        />
        {course.lessonCount} buổi
      </span>
    </div>
  );
}
