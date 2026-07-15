import { EmptyCourseState } from "@/features/student-courses/components/empty-course-state";
import { PurchasedCourseCard } from "@/features/student-courses/components/purchased-course-card";
import { StudentCoursesHeader } from "@/features/student-courses/components/student-courses-header";
import { StudentCourseStatsRow } from "@/features/student-courses/components/student-course-stats-row";
import { StudentProfileIntro } from "@/features/student-courses/components/student-profile-intro";
import { purchasedStats, studentCourses } from "@/features/student-courses/data";
import { getPurchasedCourses } from "@/features/student-courses/utils";
import type { AppThemeMode } from "@/lib/theme-store";

export function PurchasedCoursesScreen({
  initialThemeMode = "light",
}: {
  initialThemeMode?: AppThemeMode;
}) {
  const purchasedCourses = getPurchasedCourses(studentCourses);
  const [priorityCourse, ...otherCourses] = purchasedCourses;

  return (
    <main
      className="min-h-screen w-full min-w-0 overflow-x-hidden"
      style={{ background: "var(--student-screen-bg)" }}
    >
      <div
        className="mx-auto grid w-full min-w-0 max-w-[560px] gap-5 overflow-x-hidden lg:max-w-6xl lg:bg-transparent"
        style={{ background: "var(--student-screen-bg)" }}
      >
        <StudentCoursesHeader title="Khóa học của tôi" initialThemeMode={initialThemeMode} />

        <div className="grid min-w-0 gap-5 px-4 sm:px-6 lg:px-0">
          <StudentProfileIntro />

          <StudentCourseStatsRow stats={purchasedStats} />
        </div>

        {priorityCourse ? (
          <section
            className="grid min-w-0 gap-3 px-4 sm:px-6 lg:px-0"
            aria-labelledby="continue-learning-title"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2
                  id="continue-learning-title"
                  className="student-soft-bold-text text-xl font-extrabold text-slate-600 dark:text-[var(--theme-text-strong)]"
                >
                  Tiếp tục học
                </h2>
              </div>
            </div>
            <PurchasedCourseCard course={priorityCourse} prominent />
          </section>
        ) : (
          <div className="px-4 sm:px-6 lg:px-0">
            <EmptyCourseState
              title="Bạn chưa có khóa học nào"
              description="Hãy khám phá các khóa học phù hợp với lớp của bạn để bắt đầu học thử hoặc đăng ký."
            />
          </div>
        )}

        {otherCourses.length > 0 ? (
          <section
            className="grid min-w-0 gap-3 px-4 pb-2 sm:px-6 lg:px-0"
            aria-labelledby="owned-courses-title"
          >
            <div className="flex items-center justify-between gap-3">
              <h2
                id="owned-courses-title"
                className="student-soft-bold-text text-xl font-extrabold text-slate-600 dark:text-[var(--theme-text-strong)]"
              >
                Khóa học đã mua
              </h2>
              <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] dark:text-[var(--theme-text-muted)]">
                Gần đây
              </span>
            </div>
            <div className="grid min-w-0 gap-3 lg:grid-cols-2">
              {otherCourses.map((course) => (
                <PurchasedCourseCard key={course.id} course={course} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
