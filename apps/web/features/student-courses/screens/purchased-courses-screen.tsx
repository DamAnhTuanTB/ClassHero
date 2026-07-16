import { EmptyCourseState } from "@/features/student-courses/components/empty-course-state";
import { ExploreCourseCard } from "@/features/student-courses/components/explore-course-card";
import { StudentLearningGreetingPanel } from "@/features/student-courses/components/student-learning-greeting-panel";
import { StudentCoursesHeader } from "@/features/student-courses/components/student-courses-header";
import { TodayLearningGoalsPanel } from "@/features/student-courses/components/today-learning-goals-panel";
import { studentCourses } from "@/features/student-courses/data";
import { getPurchasedCourses } from "@/features/student-courses/utils";
import type { AppThemeMode } from "@/lib/theme-store";

export function PurchasedCoursesScreen({
  initialThemeMode = "light",
}: {
  initialThemeMode?: AppThemeMode;
}) {
  const purchasedCourses = getPurchasedCourses(studentCourses);
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
          <StudentLearningGreetingPanel />

          <TodayLearningGoalsPanel />
        </div>

        {purchasedCourses.length > 0 ? (
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
