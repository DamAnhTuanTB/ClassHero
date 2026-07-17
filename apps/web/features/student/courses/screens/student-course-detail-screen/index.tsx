"use client";

import {
  BadgeCheck,
  BookOpen,
  Calculator,
  GraduationCap,
  LockKeyhole,
  Play,
  PlayCircle,
  ShoppingCart,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { StudentCourseChapterCard } from "@/features/student/courses/screens/student-course-detail-screen/components/student-course-chapter-card";
import { StudentCourseDetailHeroArt } from "@/features/student/courses/screens/student-course-detail-screen/components/student-course-detail-hero-art";
import { StudentCourseDetailProgressCard } from "@/features/student/courses/screens/student-course-detail-screen/components/student-course-detail-progress-card";
import { StudentCourseMobileBrandBar } from "@/features/student/courses/screens/student-course-detail-screen/components/student-course-mobile-brand-bar";
import { StudentCoursesHeader } from "@/components/student/courses/student-courses-header";
import { EmptyCourseState } from "@/components/student/courses/empty-course-state";
import {
  useStudentCourseDetailQuery,
  useStudentMockPurchaseMutation,
} from "@/features/student/shared/hooks/use-student-courses-query";
import type { StudentCourseDetailChapter } from "@/features/student/shared/student-courses-types";
import {
  formatVnd,
  getCoursePrice,
  subjectLabels,
} from "@/features/student/shared/utils/student-courses-utils";
import { getStudentCourseContinueLessonCopy } from "@/features/student/shared/utils/student-course-continue-lesson";
import { cn } from "@/lib/utils";
import type { AppThemeMode } from "@/lib/theme-store";

export function StudentCourseDetailScreen({
  initialThemeMode,
  slug,
}: {
  initialThemeMode: AppThemeMode;
  slug: string;
}) {
  const { isAuthHydrated, query: courseDetailQuery } =
    useStudentCourseDetailQuery(slug);
  const mockPurchaseMutation = useStudentMockPurchaseMutation(slug);
  const course = courseDetailQuery.data?.course;
  const detail = courseDetailQuery.data?.detail;
  const defaultExpandedChapterId = useMemo(
    () =>
      detail?.chapters.find((chapter) => chapter.progressPercent > 0)?.id ??
      detail?.chapters[0]?.id,
    [detail],
  );
  const [expandedChapterIds, setExpandedChapterIds] = useState<string[]>(() =>
    defaultExpandedChapterId ? [defaultExpandedChapterId] : [],
  );

  useEffect(() => {
    setExpandedChapterIds(defaultExpandedChapterId ? [defaultExpandedChapterId] : []);
  }, [defaultExpandedChapterId]);

  if (!isAuthHydrated || courseDetailQuery.isLoading) {
    return (
      <main
        className="min-h-screen px-4 py-4 sm:px-6 lg:px-8"
        data-theme={initialThemeMode}
        style={{ background: "var(--student-screen-bg)" }}
      >
        <div className="mx-auto max-w-3xl">
          <EmptyCourseState
            title="Đang tải lộ trình"
            description="ClassHero đang lấy thông tin chương học và bài học mới nhất."
          />
        </div>
      </main>
    );
  }

  if (!course || !detail || courseDetailQuery.isError) {
    return (
      <main
        className="min-h-screen px-4 py-4 sm:px-6 lg:px-8"
        style={{ background: "var(--student-screen-bg)" }}
        data-theme={initialThemeMode}
      >
        <div className="mx-auto max-w-3xl">
          <EmptyCourseState
            title="Chưa tìm thấy lộ trình này"
            description="Bạn quay lại danh sách học tập để chọn lộ trình đang học nhé."
          />
        </div>
      </main>
    );
  }

  const continueLessonCopy = getStudentCourseContinueLessonCopy(
    detail.continueLessonKind,
  );
  const courseId = course.id;
  const isLockedCourse = course.access === "locked";
  const isCourseUnderMaintenance = course.isUnderMaintenance === true;
  const hasContinueLesson =
    course.lessonCount > 0 &&
    detail.continueLessonId.trim().length > 0 &&
    detail.continueLessonTitle.trim().length > 0;
  const shouldShowLearningProgress =
    course.access !== "locked" && !isCourseUnderMaintenance && hasContinueLesson;
  const coursePrice = getCoursePrice(course);
  const hasDiscountPrice = coursePrice < course.originalPriceVnd;
  const discountPercent = hasDiscountPrice
    ? Math.round(
        ((course.originalPriceVnd - coursePrice) / course.originalPriceVnd) * 100,
      )
    : 0;
  const CourseStatusIcon =
    isCourseUnderMaintenance
      ? LockKeyhole
      : course.access === "locked"
      ? LockKeyhole
      : course.access === "completed"
        ? BadgeCheck
        : Play;
  const courseStatusLabel =
    isCourseUnderMaintenance
      ? "Đang bảo trì"
      : course.access === "locked"
      ? "Chưa mua"
      : course.access === "completed"
        ? "Đã hoàn thành"
        : "Đang học";

  function handleToggleChapter(chapter: StudentCourseDetailChapter) {
    setExpandedChapterIds((currentIds) =>
      currentIds.includes(chapter.id)
        ? currentIds.filter((chapterId) => chapterId !== chapter.id)
        : [...currentIds, chapter.id],
    );
  }

  async function handleMockPurchase() {
    try {
      const result = await mockPurchaseMutation.mutateAsync(courseId);

      toast.success(
        result.mode === "ALREADY_ENROLLED"
          ? "Bạn đã có quyền học khóa này"
          : "Mua khóa học thành công",
        {
          description: "ClassHero đã mở khóa lộ trình cho bạn.",
        },
      );
    } catch (error) {
      toast.error("Chưa mua được khóa học", {
        description: getErrorMessage(error),
      });
    }
  }

  return (
    <main
      className="min-h-screen px-4 py-4 sm:px-6 lg:px-8"
      data-theme={initialThemeMode}
      style={{ background: "var(--student-screen-bg)" }}
    >
      <div className="hidden lg:block">
        <StudentCoursesHeader title={course.title} initialThemeMode={initialThemeMode} />
      </div>
      <div className="mx-auto grid max-w-3xl gap-4 lg:gap-6">
        <div className="min-w-0 space-y-4">
          <StudentCourseMobileBrandBar />

          <section className="overflow-hidden rounded-[1.35rem] bg-white p-2 dark:bg-[var(--theme-surface)] lg:p-4">
            <StudentCourseDetailHeroArt
              thumbnailImageUrl={course.thumbnailImageUrl}
              title={course.title}
            />
            <div className="px-3 pb-3 pt-4 sm:px-4">
              <h1 className="student-soft-bold-text text-2xl font-black leading-tight text-slate-950 dark:text-[var(--theme-text-strong)] sm:text-3xl">
                {course.title}
              </h1>
              <div className="mt-4 grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-2">
                <span className="inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-blue-50 px-2.5 text-xs font-black text-blue-700 dark:bg-[var(--theme-primary-soft)] dark:text-sky-300 sm:gap-2 sm:px-3 sm:text-sm">
                  <Calculator className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                  {subjectLabels[course.subject]}
                </span>
                <span className="inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-violet-50 px-2.5 text-xs font-black text-blue-700 dark:bg-violet-500/15 dark:text-sky-300 sm:gap-2 sm:px-3 sm:text-sm">
                  <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                  Lớp {course.grade}
                </span>
                <span
                  className={cn(
                    "inline-flex min-h-9 min-w-0 items-center justify-self-end gap-1.5 whitespace-nowrap rounded-xl border px-2.5 text-xs font-black sm:gap-2 sm:px-3 sm:text-sm",
                    isCourseUnderMaintenance
                      ? "border-amber-100 bg-amber-50 text-amber-700 dark:border-[var(--theme-warning-border)] dark:bg-[var(--theme-warning-bg)] dark:text-[var(--theme-warning-text)]"
                      : course.access === "locked"
                      ? "border-slate-200 bg-slate-50 text-slate-500 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface-muted)] dark:text-[var(--theme-text-muted)]"
                      : course.access === "completed"
                        ? "border-emerald-100 bg-emerald-50 text-emerald-600 dark:border-[var(--theme-success-border)] dark:bg-[var(--theme-success-bg)] dark:text-[var(--theme-success-text)]"
                        : "border-sky-100 bg-sky-50 text-sky-600 dark:border-[var(--theme-primary-border)] dark:bg-[var(--theme-primary-soft)] dark:text-sky-300",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-5 w-5 shrink-0 place-items-center rounded-full text-white",
                      isCourseUnderMaintenance
                        ? "bg-amber-500"
                        : course.access === "locked"
                        ? "bg-slate-400"
                        : course.access === "completed"
                          ? "bg-emerald-500"
                          : "bg-sky-600 dark:bg-sky-300 dark:text-slate-950",
                    )}
                  >
                    <CourseStatusIcon
                      className={cn(
                        isCourseUnderMaintenance ? "h-3.5 w-3.5" : "h-3 w-3",
                        !isCourseUnderMaintenance && course.access === "enrolled"
                          ? "fill-current"
                          : "",
                      )}
                      strokeWidth={
                        !isCourseUnderMaintenance && course.access === "enrolled"
                          ? 0
                          : 2.5
                      }
                      aria-hidden="true"
                    />
                  </span>
                  {courseStatusLabel}
                </span>
              </div>
              {isCourseUnderMaintenance ? (
                <div className="mt-3 inline-flex min-h-9 max-w-full items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 text-sm font-black leading-5 text-amber-700 dark:border-[var(--theme-warning-border)] dark:bg-[var(--theme-warning-bg)] dark:text-[var(--theme-warning-text)]">
                  <LockKeyhole className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 break-words">
                    Khóa học đang được bảo trì
                  </span>
                </div>
              ) : null}
              <p className="mt-4 text-base font-medium leading-7 text-slate-600 dark:text-[var(--theme-text-muted)]">
                Lộ trình giúp bạn nắm vững kiến thức trọng tâm, rèn luyện kỹ năng giải bài
                tập và tự tin bứt phá điểm số.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 text-slate-700 dark:text-[var(--theme-text)]">
                <div className="inline-flex min-w-0 items-center gap-2">
                  <BookOpen
                    className="h-6 w-6 shrink-0 text-slate-500"
                    aria-hidden="true"
                  />
                  <span className="truncate text-sm font-bold">
                    {course.chapterCount} chương
                  </span>
                </div>
                <div className="inline-flex min-w-0 items-center gap-2">
                  <PlayCircle
                    className="h-6 w-6 shrink-0 text-slate-500"
                    aria-hidden="true"
                  />
                  <span className="truncate text-sm font-bold">
                    {course.lessonCount} bài học
                  </span>
                </div>
              </div>
              {isLockedCourse ? (
                <div className="student-mobile-border mt-5 grid min-w-0 gap-3 rounded-2xl border border-sky-100 bg-sky-50/80 p-3 dark:border-[var(--theme-primary-border)] dark:bg-[var(--theme-primary-soft)] sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-center">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase text-slate-500 dark:text-[var(--theme-text-muted)]">
                      Giá khóa học
                    </p>
                    <div className="mt-1 min-w-0">
                      <p className="text-2xl font-black leading-none text-sky-600 dark:text-sky-300">
                        {formatVnd(coursePrice)}
                      </p>
                      {hasDiscountPrice ? (
                        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1">
                          <p className="text-lg font-bold text-slate-500 line-through dark:text-[var(--theme-text-muted)]">
                            {formatVnd(course.originalPriceVnd)}
                          </p>
                          <span className="ml-1 inline-flex min-h-6 items-center rounded-full bg-rose-50 px-2 text-xs font-black text-rose-600 ring-1 ring-rose-100 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-400/20">
                            Giảm {discountPercent}%
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleMockPurchase()}
                    disabled={mockPurchaseMutation.isPending}
                    className="student-learn-cta-3d inline-flex min-h-11 w-full min-w-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-sky-500 px-4 text-sm font-black text-white transition hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100 disabled:cursor-wait disabled:opacity-70"
                  >
                    <ShoppingCart className="h-5 w-5 shrink-0" aria-hidden="true" />
                    {mockPurchaseMutation.isPending ? "Đang mua" : "Mua ngay"}
                  </button>
                </div>
              ) : null}
            </div>
          </section>

          {shouldShowLearningProgress ? (
            <StudentCourseDetailProgressCard course={course} detail={detail} />
          ) : null}

          <section className="rounded-[1.35rem] bg-white/86 p-4 dark:bg-[var(--theme-surface)]">
            <div className="mb-4 flex min-w-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-950 dark:border-[var(--theme-border)] dark:text-[var(--theme-text-strong)]">
                <Calculator className="h-6 w-6" aria-hidden="true" />
              </span>
              <h2 className="min-w-0 flex-1 truncate text-xl font-extrabold text-slate-800 dark:text-[var(--theme-text)]">
                Nội dung lộ trình
              </h2>
              <p className="student-course-count-text hidden shrink-0 text-sm font-black sm:block">
                {course.chapterCount} chương · {course.lessonCount} bài học
              </p>
            </div>
            <div className="grid gap-3">
              {detail.chapters.length > 0 ? (
                detail.chapters.map((chapter) => (
                  <StudentCourseChapterCard
                    key={chapter.id}
                    chapter={chapter}
                    continueLessonActionLabel={continueLessonCopy.actionLabel}
                    continueLessonId={detail.continueLessonId}
                    expanded={expandedChapterIds.includes(chapter.id)}
                    onToggle={() => handleToggleChapter(chapter)}
                    showProgress={shouldShowLearningProgress}
                  />
                ))
              ) : (
                <div className="student-mobile-border rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-5 text-sm font-semibold leading-6 text-slate-500 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface-muted)] dark:text-[var(--theme-text-muted)]">
                  Khóa học này chưa có chương học nào.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Bạn thử lại sau ít phút nhé.";
}
