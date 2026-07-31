"use client";

import { Star } from "lucide-react";
import { SkeletonBlock } from "@/components/common/ui/skeleton-block";
import { CourseSearchFilterPanel } from "@/features/student/explore/screens/explore-courses-screen/components/course-search-filter-panel";
import { EmptyCourseState } from "@/components/student/courses/empty-course-state";
import { ExploreCourseCard } from "@/components/student/courses/explore-course-card";
import { StudentCoursesHeader } from "@/components/student/courses/student-courses-header";
import { useStudentCoursesFilter } from "@/features/student/explore/hooks/use-student-courses-filter";
import {
  getExploreCourseGroups,
  hasMixedExploreCourseAccess,
} from "@/features/student/shared/utils/student-courses-utils";
import { useStudentCourseDetailPrefetch } from "@/features/student/shared/hooks/use-student-courses-query";
import type { StudentCoursesListResult } from "@/features/student/shared/types/student-course-api-results";
import type { AppThemeMode } from "@/lib/theme-store";

export function ExploreCoursesScreen({
  initialData,
  initialThemeMode = "light",
}: {
  initialData?: StudentCoursesListResult | null;
  initialThemeMode?: AppThemeMode;
}) {
  const {
    coursesQuery,
    filteredCourses,
    grade,
    isError,
    isLoading,
    query,
    refetch,
    setGrade,
    setQuery,
    setSubject,
    subject,
    total,
  } = useStudentCoursesFilter(initialData);
  const prefetchCourseDetail = useStudentCourseDetailPrefetch();
  const { otherCourses, purchasedCourses } = getExploreCourseGroups(filteredCourses);
  const apiHasMixedCourseAccess = hasMixedExploreCourseAccess(
    coursesQuery.data?.courses ?? [],
  );
  const visibleHasMixedCourseAccess = hasMixedExploreCourseAccess(filteredCourses);
  const shouldShowCourseRibbons = apiHasMixedCourseAccess && visibleHasMixedCourseAccess;
  const screenBackground = "var(--student-screen-bg)";

  if (isLoading) {
    return (
      <main
        aria-busy="true"
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
          <ExploreCoursesSkeleton />
        </div>
      </main>
    );
  }

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
              {total} khóa học phù hợp
            </p>
          </div>
        </div>

        {isError ? (
          <div className="px-4 sm:px-6 lg:px-6">
            <EmptyCourseState
              action={
                <button
                  type="button"
                  onClick={() => void refetch()}
                  className="student-learn-cta-3d inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-sky-500 px-4 text-sm font-black text-white transition hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100"
                >
                  Tải lại
                </button>
              }
              isPageState
              title="Chưa tải được danh sách khóa học"
              description="Bạn thử tải lại danh sách hoặc quay lại sau ít phút nhé."
            />
          </div>
        ) : filteredCourses.length > 0 ? (
          <section
            className="grid min-w-0 gap-5 px-4 pb-2 sm:px-6 lg:px-6"
            aria-label="Danh sách tất cả khóa học"
          >
            {shouldShowCourseRibbons ? (
              <>
                {purchasedCourses.length > 0 ? (
                  <div className="grid min-w-0 gap-4">
                    <div className="relative z-10 -mb-2 flex min-w-0 items-center">
                      <h2 className="student-section-ribbon relative min-w-0 overflow-visible text-base font-extrabold text-white">
                        <span className="relative z-10 block truncate">
                          Khóa học đã mua
                        </span>
                      </h2>
                    </div>
                    <div className="grid min-w-0 gap-6 xl:grid-cols-2 xl:gap-10">
                      {purchasedCourses.map((course) => (
                        <ExploreCourseCard
                          key={course.id}
                          course={course}
                          onPrefetch={prefetchCourseDetail}
                        />
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
                        <ExploreCourseCard
                          key={course.id}
                          course={course}
                          onPrefetch={prefetchCourseDetail}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="grid min-w-0 gap-6 xl:grid-cols-2 xl:gap-10">
                {filteredCourses.map((course) => (
                  <ExploreCourseCard
                    key={course.id}
                    course={course}
                    onPrefetch={prefetchCourseDetail}
                  />
                ))}
              </div>
            )}
          </section>
        ) : (
          <div className="px-4 sm:px-6 lg:px-6">
            <EmptyCourseState
              title="Chưa có khóa học phù hợp"
              description={
                coursesQuery.data?.meta.total === 0
                  ? "Hiện chưa có khóa học đã xuất bản nào để hiển thị."
                  : "Bạn thử đổi lớp, môn học hoặc từ khóa tìm kiếm để xem thêm khóa học khác nhé."
              }
            />
          </div>
        )}
      </div>
    </main>
  );
}

function ExploreCoursesSkeleton() {
  return (
    <div className="grid gap-4 px-4 sm:px-6 lg:px-6">
      <div className="grid animate-pulse gap-3 rounded-2xl bg-white p-4 dark:bg-[var(--theme-surface)] sm:grid-cols-[minmax(0,1fr)_9rem_9rem]">
        <SkeletonBlock className="h-11 rounded-xl" />
        <SkeletonBlock className="h-11 rounded-xl" />
        <SkeletonBlock className="h-11 rounded-xl" />
      </div>
      <SkeletonBlock className="h-5 w-40 rounded-full" />
      <EmptyCourseState
        isLoading
        title="Đang tải danh sách khóa học"
        description="ClassHero đang lấy các khóa học đã xuất bản phù hợp với bạn."
      />
    </div>
  );
}
