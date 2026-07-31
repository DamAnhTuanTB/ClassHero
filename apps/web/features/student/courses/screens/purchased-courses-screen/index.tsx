"use client";

import { useEffect } from "react";
import { EmptyCourseState } from "@/components/student/courses/empty-course-state";
import { SkeletonBlock } from "@/components/common/ui/skeleton-block";
import { ExploreCourseCard } from "@/components/student/courses/explore-course-card";
import { StudentLearningGreetingPanel } from "@/features/student/courses/screens/purchased-courses-screen/components/student-learning-greeting-panel";
import { StudentCoursesHeader } from "@/components/student/courses/student-courses-header";
import { TodayLearningGoalsPanel } from "@/features/student/courses/screens/purchased-courses-screen/components/today-learning-goals-panel";
import {
  useStudentCourseDetailPrefetch,
  useStudentCoursesQuery,
} from "@/features/student/shared/hooks/use-student-courses-query";
import {
  buildTodayLearningGoals,
  getPurchasedCourses,
} from "@/features/student/shared/utils/student-courses-utils";
import type { StudentCoursesListResult } from "@/features/student/shared/types/student-course-api-results";
import type { AppThemeMode } from "@/lib/theme-store";

export function PurchasedCoursesScreen({
  initialData,
  initialStudentName,
  initialThemeMode = "light",
}: {
  initialData?: StudentCoursesListResult | null;
  initialStudentName?: string | null;
  initialThemeMode?: AppThemeMode;
}) {
  const { isAuthHydrated, query: coursesQuery, session } =
    useStudentCoursesQuery(initialData);
  const prefetchCourseDetail = useStudentCourseDetailPrefetch();
  const courses = coursesQuery.data?.courses ?? [];
  const purchasedCourses = getPurchasedCourses(courses);
  const likelyNextCourseSlug = purchasedCourses[0]?.slug;
  const studentName = session?.user.fullName ?? initialStudentName ?? "bạn";
  const todayGoals = buildTodayLearningGoals(courses);
  const screenBackground = "var(--student-screen-bg)";
  const isInitialPending =
    coursesQuery.data === undefined &&
    (!isAuthHydrated || coursesQuery.isLoading);

  useEffect(() => {
    if (likelyNextCourseSlug) {
      void prefetchCourseDetail(likelyNextCourseSlug);
    }
  }, [likelyNextCourseSlug, prefetchCourseDetail]);

  if (isInitialPending) {
    return (
      <main
        aria-busy="true"
        className="min-h-screen w-full min-w-0 overflow-x-hidden"
        style={{ background: screenBackground }}
      >
        <div
          className="mx-auto grid w-full min-w-0 max-w-[560px] gap-4 overflow-x-hidden lg:max-w-3xl"
          style={{ background: screenBackground }}
        >
          <StudentCoursesHeader title="Học tập" initialThemeMode={initialThemeMode} />
          <PurchasedCoursesSkeleton />
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
        className="mx-auto grid w-full min-w-0 max-w-[560px] gap-4 overflow-x-hidden lg:max-w-3xl"
        style={{ background: screenBackground }}
      >
        <StudentCoursesHeader title="Học tập" initialThemeMode={initialThemeMode} />

        <div className="grid min-w-0 gap-4 px-4 sm:px-6 lg:px-6">
          <StudentLearningGreetingPanel studentName={studentName} />

          <TodayLearningGoalsPanel goals={todayGoals} />
        </div>

        {coursesQuery.isError ? (
          <div className="px-4 sm:px-6 lg:px-6">
            <EmptyCourseState
              isPageState
              title="Chưa tải được khóa học"
              description="Bạn thử tải lại trang hoặc kiểm tra kết nối mạng rồi quay lại nhé."
            />
          </div>
        ) : purchasedCourses.length > 0 ? (
          <section
            className="grid min-w-0 gap-4 px-4 pb-2 sm:px-6 lg:px-6"
            aria-label="Danh sách khóa học của tôi"
          >
            <div className="relative z-10 -mb-2 flex min-w-0 items-center">
              <h2 className="student-section-ribbon relative min-w-0 overflow-visible text-base font-extrabold text-white">
                <span className="relative z-10 block truncate">Khóa học của tôi</span>
              </h2>
            </div>
            <div className="grid min-w-0 gap-6">
              {purchasedCourses.map((course) => (
                <ExploreCourseCard
                  key={course.id}
                  course={course}
                  onPrefetch={prefetchCourseDetail}
                />
              ))}
            </div>
          </section>
        ) : (
          <div className="px-4 sm:px-6 lg:px-6">
            <EmptyCourseState
              title="Bạn chưa có khóa học nào"
              description="Hãy khám phá các khóa học phù hợp với lớp của bạn để bắt đầu học thử hoặc đăng ký."
            />
          </div>
        )}
      </div>
    </main>
  );
}

function PurchasedCoursesSkeleton() {
  return (
    <div className="grid gap-4 px-4 sm:px-6 lg:px-6">
      <div className="animate-pulse space-y-3 rounded-2xl bg-white p-5 dark:bg-[var(--theme-surface)]">
        <SkeletonBlock className="h-6 w-2/5 rounded-full" />
        <SkeletonBlock className="h-4 w-3/5 rounded-full opacity-75" />
      </div>
      <div className="grid animate-pulse grid-cols-2 gap-3">
        <SkeletonBlock className="h-24 rounded-2xl" />
        <SkeletonBlock className="h-24 rounded-2xl" />
      </div>
      <EmptyCourseState
        isLoading
        title="Đang tải khóa học"
        description="ClassHero đang lấy danh sách khóa học của bạn."
      />
    </div>
  );
}
