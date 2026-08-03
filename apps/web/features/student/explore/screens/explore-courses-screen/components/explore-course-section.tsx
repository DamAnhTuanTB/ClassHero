import { ExploreCourseCard } from "@/components/student/courses/explore-course-card";
import type { StudentCourse } from "@/features/student/shared/student-courses-types";
import { cn } from "@/lib/utils";

export type ExploreCourseSectionTone =
  | "audience"
  | "all-students"
  | "emerald"
  | "high-school"
  | "primary-school"
  | "secondary-school"
  | "grade-3"
  | "grade-4"
  | "grade-5"
  | "grade-6"
  | "grade-7"
  | "grade-8"
  | "grade-9"
  | "grade-10"
  | "grade-11"
  | "grade-12"
  | "sky"
  | "working-adult";

export function ExploreCourseSection({
  courses,
  accentCount = courses.length,
  accentOffset = 0,
  onPrefetch,
  targetAudienceGrade,
  targetAudienceByCourseId,
  targetAudienceCode,
  targetAudienceName,
  title,
  tone = "sky",
}: {
  accentCount?: number;
  accentOffset?: number;
  courses: StudentCourse[];
  onPrefetch: (slug: string) => Promise<unknown>;
  targetAudienceGrade?: number | null;
  targetAudienceByCourseId?: Record<
    string,
    { code: string; grade: number | null; name: string }
  >;
  targetAudienceCode?: string;
  targetAudienceName?: string;
  title: string;
  tone?: ExploreCourseSectionTone;
}) {
  return (
    <section className="grid min-w-0 gap-4" aria-label={title}>
      <div className="relative z-10 -mb-2 flex min-w-0 items-center">
        <h2
          className={cn(
            "student-section-ribbon relative min-w-0 overflow-visible text-base font-extrabold text-white",
            `student-section-ribbon--${tone}`,
          )}
        >
          <span className="relative z-10 block whitespace-nowrap">{title}</span>
        </h2>
      </div>

      <div className="grid min-w-0 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {courses.map((course, index) => {
          const courseAudience = targetAudienceByCourseId?.[course.id];

          return (
            <ExploreCourseCard
              key={course.id}
              course={course}
              onPrefetch={onPrefetch}
              accentCount={accentCount}
              accentIndex={accentOffset + index}
              targetAudienceGrade={courseAudience?.grade ?? targetAudienceGrade}
              targetAudienceCode={courseAudience?.code ?? targetAudienceCode}
              targetAudienceName={courseAudience?.name ?? targetAudienceName}
            />
          );
        })}
      </div>
    </section>
  );
}
