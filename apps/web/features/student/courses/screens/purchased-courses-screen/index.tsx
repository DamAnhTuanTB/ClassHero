"use client";

import { EmptyCourseState } from "@/components/student/courses/empty-course-state";
import { ExploreCourseCard } from "@/components/student/courses/explore-course-card";
import { StudentLearningGreetingPanel } from "@/features/student/courses/screens/purchased-courses-screen/components/student-learning-greeting-panel";
import { StudentCoursesHeader } from "@/components/student/courses/student-courses-header";
import { TodayLearningGoalsPanel } from "@/features/student/courses/screens/purchased-courses-screen/components/today-learning-goals-panel";
import { useStudentCoursesQuery } from "@/features/student/shared/hooks/use-student-courses-query";
import {
  buildTodayLearningGoals,
  getPurchasedCourses,
} from "@/features/student/shared/utils/student-courses-utils";
import type { AppThemeMode } from "@/lib/theme-store";

export function PurchasedCoursesScreen({
  initialThemeMode = "light",
}: {
  initialThemeMode?: AppThemeMode;
}) {
  const { isAuthHydrated, query: coursesQuery, session } = useStudentCoursesQuery();
  const courses = coursesQuery.data?.courses ?? [];
  const purchasedCourses = getPurchasedCourses(courses);
  const studentName = session?.user.fullName ?? "bạn";
  const todayGoals = buildTodayLearningGoals(courses);
  const screenBackground = "var(--student-screen-bg)";

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

        {!isAuthHydrated || coursesQuery.isLoading ? (
          <div className="px-4 sm:px-6 lg:px-6">
            <EmptyCourseState
              isLoading
              title="Đang tải khóa học"
              description="ClassHero đang lấy danh sách khóa học của bạn."
            />
          </div>
        ) : coursesQuery.isError ? (
          <div className="px-4 sm:px-6 lg:px-6">
            <EmptyCourseState
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
                <ExploreCourseCard key={course.id} course={course} />
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
