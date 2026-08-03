import { BookOpen, CalendarDays } from "lucide-react";
import type { StudentCourse } from "@/features/student/shared/student-courses-types";

export function CourseMetaRow({ course }: { course: StudentCourse }) {
  const lessonCountMin = course.lessonCountMin ?? course.lessonCount;
  const lessonCountMax = course.lessonCountMax ?? course.lessonCount;
  const hasLessonRange = lessonCountMin !== lessonCountMax;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[15px] font-semibold text-slate-600 dark:text-[var(--theme-text-muted)] md:flex-nowrap md:text-[13.5px] lg:gap-x-4 lg:text-[13.5px]">
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap lg:gap-2">
        <BookOpen
          className="student-chapter-icon h-[18px] w-[18px] text-emerald-800 dark:text-emerald-300 lg:h-[22px] lg:w-[22px]"
          aria-hidden="true"
        />
        {course.chapterCount} chương
      </span>
      <span className="inline-flex items-center gap-1 lg:gap-2">
        <CalendarDays
          className="student-progress-accent-text h-[18px] w-[18px] text-sky-600 dark:text-sky-300 lg:h-[22px] lg:w-[22px]"
          aria-hidden="true"
        />
        {hasLessonRange ? (
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <span>{lessonCountMin}</span>
            <span
              className="relative mr-0.5 inline-block h-px w-2 shrink-0 bg-current after:absolute after:-right-px after:top-1/2 after:h-1.5 after:w-1.5 after:-translate-y-1/2 after:rotate-45 after:border-r after:border-t after:border-current"
              aria-hidden="true"
            />
            <span>{lessonCountMax}</span>
            <span>buổi học online</span>
          </span>
        ) : (
          `${lessonCountMin} buổi học online`
        )}
      </span>
    </div>
  );
}
