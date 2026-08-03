import { ExploreCourseCard } from "@/components/student/courses/explore-course-card";
import type { StudentCourse } from "@/features/student/shared/student-courses-types";

export function ExploreGradeCourseGroup({
  courses,
  accentCount = courses.length,
  accentOffset = 0,
  grade,
  onPrefetch,
}: {
  accentCount?: number;
  accentOffset?: number;
  courses: StudentCourse[];
  grade: number;
  onPrefetch: (slug: string) => Promise<unknown>;
}) {
  return (
    <section className="grid min-w-0 gap-3" aria-label={`Khối ${grade}`}>
      <div className="flex min-w-0 items-center gap-3 px-1">
        <div className="min-w-0">
          <h3 className="text-base font-black leading-none text-slate-800 dark:text-[var(--theme-text-strong)]">
            Khối {grade}
          </h3>
          <p className="mt-1 text-xs font-bold text-sky-700 dark:text-sky-300">
            {courses.length} khóa học
          </p>
        </div>
        <span
          className="h-px min-w-6 flex-1 bg-gradient-to-r from-sky-300 via-sky-100 to-transparent dark:from-sky-400/50 dark:via-sky-400/10"
          aria-hidden="true"
        />
      </div>

      <div className="grid min-w-0 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {courses.map((course, index) => (
          <ExploreCourseCard
            key={course.id}
            course={course}
            onPrefetch={onPrefetch}
            accentCount={accentCount}
            accentIndex={accentOffset + index}
            targetAudienceGrade={grade}
            targetAudienceName={`Khối ${grade}`}
          />
        ))}
      </div>
    </section>
  );
}
