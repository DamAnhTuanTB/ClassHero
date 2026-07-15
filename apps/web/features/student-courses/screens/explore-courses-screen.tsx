"use client";

import { Star } from "lucide-react";
import { CourseSearchFilterPanel } from "@/features/student-courses/components/course-search-filter-panel";
import { EmptyCourseState } from "@/features/student-courses/components/empty-course-state";
import { ExploreCourseCard } from "@/features/student-courses/components/explore-course-card";
import { StudentCoursesHeader } from "@/features/student-courses/components/student-courses-header";
import { useStudentCoursesFilter } from "@/features/student-courses/hooks";
import { getExploreCourseGroups } from "@/features/student-courses/utils";
import type { AppThemeMode } from "@/lib/theme-store";

export function ExploreCoursesScreen({
  initialThemeMode = "light",
}: {
  initialThemeMode?: AppThemeMode;
}) {
  const {
    filteredCourses,
    grade,
    query,
    setGrade,
    setQuery,
    setSubject,
    subject,
    total,
  } = useStudentCoursesFilter();
  const { otherCourses, purchasedCourses } = getExploreCourseGroups(filteredCourses);
  const screenBackground = "var(--student-screen-bg)";

  return (
    <main
      className="min-h-screen w-full min-w-0 overflow-x-hidden"
      style={{ background: screenBackground }}
    >
      <div
        className="mx-auto grid w-full min-w-0 max-w-[560px] gap-4 overflow-x-hidden lg:max-w-6xl"
        style={{ background: screenBackground }}
      >
        <StudentCoursesHeader
          title="Danh sách khóa học"
          initialThemeMode={initialThemeMode}
        />

        <div className="grid min-w-0 gap-4 px-4 sm:px-6 lg:px-6">
          <CourseSearchFilterPanel
            grade={grade}
            query={query}
            subject={subject}
            onGradeChange={setGrade}
            onQueryChange={setQuery}
            onSubjectChange={setSubject}
          />

          <div className="flex min-w-0 items-center gap-2">
            <Star
              className="h-5 w-5 shrink-0 fill-amber-400 text-amber-400"
              aria-hidden="true"
            />
            <p className="student-course-count-text min-w-0 truncate text-base font-extrabold text-sky-700 dark:text-sky-300">
              {Math.max(total, 12)} khóa học phù hợp
            </p>
          </div>
        </div>

        {filteredCourses.length > 0 ? (
          <section
            className="grid min-w-0 gap-5 px-4 pb-2 sm:px-6 lg:px-6"
            aria-label="Danh sách tất cả khóa học"
          >
            {purchasedCourses.length > 0 ? (
              <div className="grid min-w-0 gap-4">
                <div className="relative z-10 -mb-2 flex min-w-0 items-center">
                  <h2 className="student-section-ribbon relative min-w-0 overflow-visible text-base font-extrabold text-white">
                    <span className="relative z-10 block truncate">Khóa học đã mua</span>
                  </h2>
                </div>
                <div className="grid min-w-0 gap-6 xl:grid-cols-2 xl:gap-10">
                  {purchasedCourses.map((course) => (
                    <ExploreCourseCard key={course.id} course={course} />
                  ))}
                </div>
              </div>
            ) : null}

            {otherCourses.length > 0 ? (
              <div className="grid min-w-0 gap-4">
                <div className="relative z-10 -mb-2 flex min-w-0 items-center">
                  <h2 className="student-section-ribbon student-section-ribbon--emerald relative min-w-0 overflow-visible text-base font-extrabold text-white">
                    <span className="relative z-10 block truncate">
                      Các khóa học khác
                    </span>
                  </h2>
                </div>
                <div className="grid min-w-0 gap-6 xl:grid-cols-2 xl:gap-10">
                  {otherCourses.map((course) => (
                    <ExploreCourseCard key={course.id} course={course} />
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : (
          <div className="px-4 sm:px-6 lg:px-6">
            <EmptyCourseState
              title="Chưa có khóa học phù hợp"
              description="Bạn thử đổi lớp, môn học hoặc từ khóa tìm kiếm để xem thêm khóa học khác nhé."
            />
          </div>
        )}
      </div>
    </main>
  );
}
