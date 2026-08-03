"use client";

import {
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  Calculator,
  GraduationCap,
  Home,
  Loader2,
  LockKeyhole,
  PlayCircle,
  ShoppingCart,
} from "lucide-react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { StudentCourseChapterCard } from "@/features/student/courses/screens/student-course-detail-screen/components/student-course-chapter-card";
import { StudentCourseDetailHeroArt } from "@/features/student/courses/screens/student-course-detail-screen/components/student-course-detail-hero-art";
import { StudentCourseDetailProgressCard } from "@/features/student/courses/screens/student-course-detail-screen/components/student-course-detail-progress-card";
import { StudentCourseLessonRow } from "@/features/student/courses/screens/student-course-detail-screen/components/student-course-lesson-row";
import { StudentCourseMobileBrandBar } from "@/features/student/courses/screens/student-course-detail-screen/components/student-course-mobile-brand-bar";
import { StudentCoursesHeader } from "@/components/student/courses/student-courses-header";
import { EmptyCourseState } from "@/components/student/courses/empty-course-state";
import { StudentFullScreenState } from "@/components/student/student-full-screen-state";
import {
  studentLearningPathsQueryKey,
  useStudentCourseDetailQuery,
  useStudentMockPurchaseMutation,
} from "@/features/student/shared/hooks/use-student-courses-query";
import { useCreatePaymentMutation } from "@/features/student/payments/hooks/use-student-payment";
import { rememberPaymentCheckoutHistory } from "@/features/student/payments/utils/payment-checkout-history";
import type { StudentCourseDetailChapter } from "@/features/student/shared/student-courses-types";
import type { StudentCourseDetailResult } from "@/features/student/shared/types/student-course-api-results";
import {
  formatVnd,
  getCoursePrice,
} from "@/features/student/shared/utils/student-courses-utils";
import { getStudentCourseAudienceStyle } from "@/features/student/shared/utils/student-course-audience-palette";
import { getStudentCourseAccentStyle } from "@/features/student/shared/utils/student-course-accent-palette";
import { getStudentCourseContinueLessonCopy } from "@/features/student/shared/utils/student-course-continue-lesson";
import { cn } from "@/lib/utils";
import type { AppThemeMode } from "@/lib/theme-store";

export function StudentCourseDetailScreen({
  initialData,
  initialThemeMode,
  slug,
}: {
  initialData?: StudentCourseDetailResult | null;
  initialThemeMode: AppThemeMode;
  slug: string;
}) {
  const queryClient = useQueryClient();
  const [isNavigatingToCheckout, setIsNavigatingToCheckout] = useState(false);
  const [bfCacheKey, setBfCacheKey] = useState(0);
  const {
    isAuthHydrated,
    query: courseDetailQuery,
    session,
  } = useStudentCourseDetailQuery(slug, initialData);
  const mockPurchaseMutation = useStudentMockPurchaseMutation(slug);
  const createPaymentMutation = useCreatePaymentMutation();
  const refetchCourseDetail = courseDetailQuery.refetch;
  const course = courseDetailQuery.data?.course;
  const detail = courseDetailQuery.data?.detail;
  const isInitialPending =
    courseDetailQuery.data === undefined &&
    (!isAuthHydrated || courseDetailQuery.isLoading);
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

  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setIsNavigatingToCheckout(false);
        setBfCacheKey((prev) => prev + 1);
        void Promise.all([
          refetchCourseDetail(),
          queryClient.invalidateQueries({
            queryKey: studentLearningPathsQueryKey(session?.user.id),
          }),
        ]);
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [queryClient, refetchCourseDetail, session?.user.id]);

  if (isInitialPending) {
    return (
      <main
        aria-busy="true"
        className="min-h-screen px-4 py-4 sm:px-6 lg:px-8"
        data-theme={initialThemeMode}
        style={{ background: "var(--student-screen-bg)" }}
      >
        <div className="hidden lg:block">
          <StudentCoursesHeader
            title="Đang tải khóa học"
            initialThemeMode={initialThemeMode}
          />
        </div>
        <div className="mx-auto grid min-h-[calc(100svh-6rem)] w-full max-w-3xl place-items-center">
          <EmptyCourseState
            isLoading
            loadingVariant="detail"
            title="Đang tải khóa học"
            description="ClassHero đang lấy thông tin chương học và buổi học mới nhất."
          />
        </div>
      </main>
    );
  }

  if (!course || !detail || courseDetailQuery.isError) {
    return (
      <StudentFullScreenState
        initialThemeMode={initialThemeMode}
        title="Chưa tìm thấy khóa học này"
        description="Bạn quay lại danh sách học tập để chọn khóa học đang học nhé."
        action={
          <div className="grid w-full gap-3 sm:grid-cols-2">
            <Link
              href="/student/courses"
              className="student-learn-cta-3d inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-sky-500 px-5 text-sm font-black text-white transition hover:bg-sky-600"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Về danh sách khóa học
            </Link>
            <Link
              href="/student/explore"
              className="student-learn-cta-3d-emerald inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-emerald-500 px-5 text-sm font-black text-white transition hover:bg-emerald-400"
            >
              <Home className="h-4 w-4" aria-hidden="true" />
              Về Trang chủ
            </Link>
          </div>
        }
      />
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
  const CourseStatusIcon = isCourseUnderMaintenance
    ? LockKeyhole
    : course.access === "locked"
      ? LockKeyhole
      : course.access === "completed"
        ? BadgeCheck
        : PlayCircle;
  const courseStatusLabel = isCourseUnderMaintenance
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

  async function handlePurchase() {
    try {
      const result = await createPaymentMutation.mutateAsync(courseId);

      if (result.checkoutUrl) {
        setIsNavigatingToCheckout(true);
        rememberPaymentCheckoutHistory(result.id);
        window.location.assign(result.checkoutUrl);
      } else {
        toast.error("Không thể tạo liên kết thanh toán");
      }
    } catch (error) {
      toast.error("Chưa tạo được đơn thanh toán", {
        description: getErrorMessage(error),
      });
    }
  }

  async function handleMockPurchase() {
    try {
      const result = await mockPurchaseMutation.mutateAsync(courseId);

      toast.success(
        result.mode === "ALREADY_ENROLLED"
          ? "Bạn đã có quyền học khóa này"
          : "Mua khóa học thành công",
        {
          description: "ClassHero đã mở quyền học cho bạn.",
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
      data-student-course-detail="true"
      data-theme={initialThemeMode}
      style={{ background: "var(--student-screen-bg)" }}
    >
      <div className="hidden lg:block">
        <StudentCoursesHeader title={course.title} initialThemeMode={initialThemeMode} />
      </div>
      <div className="mx-auto grid max-w-3xl gap-4 lg:gap-6">
        <div className="min-w-0 space-y-4">
          <StudentCourseMobileBrandBar />

          <section className="overflow-hidden rounded-[1.35rem] bg-white p-4 dark:bg-[var(--theme-surface)] lg:p-5">
            <StudentCourseDetailHeroArt
              thumbnailImageUrl={course.thumbnailImageUrl}
              title={course.title}
            />
            <div className="pt-3">
              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
                <span
                  style={getStudentCourseAudienceStyle({
                    fallbackHue: 205,
                    targetAudienceGrade: course.grade,
                    targetAudienceName: course.targetAudienceName,
                  })}
                  className="inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-[var(--student-course-audience-bg)] px-2.5 text-xs font-black text-[var(--student-course-audience-text)] dark:bg-[var(--student-course-audience-dark-bg)] dark:text-[var(--student-course-audience-dark-text)] sm:gap-2 sm:px-3 sm:text-sm"
                >
                  <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                  {course.targetAudienceName}
                </span>
                <span
                  className={cn(
                    "inline-flex min-h-9 min-w-0 items-center justify-self-end gap-1.5 whitespace-nowrap rounded-xl border px-2.5 text-xs font-black sm:gap-2 sm:px-3 sm:text-sm",
                    isCourseUnderMaintenance
                      ? "border-amber-100 bg-amber-50 text-amber-700 dark:border-[var(--theme-warning-border)] dark:bg-[var(--theme-warning-bg)] dark:text-[var(--theme-warning-text)]"
                      : course.access === "locked"
                        ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/15 dark:text-rose-300"
                        : course.access === "completed"
                          ? "border-emerald-100 bg-emerald-50 text-emerald-600 dark:border-[var(--theme-success-border)] dark:bg-[var(--theme-success-bg)] dark:text-[var(--theme-success-text)]"
                          : "border-sky-100 bg-sky-50 text-sky-600 dark:border-[var(--theme-primary-border)] dark:bg-[var(--theme-primary-soft)] dark:text-sky-300",
                  )}
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center text-current">
                    <CourseStatusIcon
                      className="h-5 w-5 fill-none"
                      strokeWidth={2.25}
                      aria-hidden="true"
                    />
                  </span>
                  {courseStatusLabel}
                </span>
              </div>
              <h1 className="student-soft-bold-text mt-2 text-2xl font-black leading-tight text-slate-950 dark:text-[var(--theme-text-strong)] sm:text-3xl">
                {course.title}
              </h1>
              {isCourseUnderMaintenance ? (
                <div className="mt-3 inline-flex min-h-9 max-w-full items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 text-sm font-black leading-5 text-amber-700 dark:border-[var(--theme-warning-border)] dark:bg-[var(--theme-warning-bg)] dark:text-[var(--theme-warning-text)]">
                  <LockKeyhole className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 break-words">Khóa học đang được bảo trì</span>
                </div>
              ) : null}
              <p
                className={cn(
                  "text-base font-medium leading-7 text-slate-600 dark:text-[var(--theme-text-muted)]",
                  isCourseUnderMaintenance ? "mt-3" : "mt-1",
                )}
              >
                Khóa học giúp bạn nắm vững kiến thức trọng tâm, rèn luyện kỹ năng giải bài
                tập và tự tin bứt phá điểm số.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-3 text-slate-700 dark:text-[var(--theme-text)]">
                <div className="inline-flex min-w-0 items-center gap-2">
                  <BookOpen
                    className="student-chapter-icon h-6 w-6 shrink-0 text-emerald-800 dark:text-emerald-300"
                    aria-hidden="true"
                  />
                  <span className="truncate text-sm font-bold">
                    {course.chapterCount} chương
                  </span>
                </div>
                <div className="inline-flex min-w-0 items-center gap-2">
                  <PlayCircle
                    className="student-progress-accent-text h-6 w-6 shrink-0 text-sky-600 dark:text-sky-300"
                    aria-hidden="true"
                  />
                  <span className="truncate text-sm font-bold">
                    {course.lessonCount} buổi học
                  </span>
                </div>
              </div>
              {isLockedCourse ? (
                <div className="student-mobile-border mt-5 grid min-w-0 gap-3 rounded-2xl border border-sky-100 bg-sky-50/80 p-3 dark:border-[var(--theme-primary-border)] dark:bg-[var(--theme-primary-soft)] md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
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
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      key={`btn-buy-${bfCacheKey}`}
                      type="button"
                      onClick={() => void handlePurchase()}
                      disabled={createPaymentMutation.isPending || isNavigatingToCheckout}
                      className="student-learn-cta-3d inline-flex min-h-11 w-full min-w-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-sky-500 px-4 text-sm font-black text-white transition hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100 disabled:opacity-70"
                    >
                      {createPaymentMutation.isPending || isNavigatingToCheckout ? (
                        <Loader2
                          className="h-5 w-5 shrink-0 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <ShoppingCart className="h-5 w-5 shrink-0" aria-hidden="true" />
                      )}
                      {createPaymentMutation.isPending || isNavigatingToCheckout
                        ? "Đang tạo đơn"
                        : "Mua ngay"}
                    </button>
                    <button
                      key={`btn-mock-${bfCacheKey}`}
                      type="button"
                      onClick={() => void handleMockPurchase()}
                      disabled={mockPurchaseMutation.isPending || isNavigatingToCheckout}
                      className="inline-flex min-h-11 w-full min-w-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-100 disabled:opacity-70 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface-muted)] dark:text-[var(--theme-text-muted)] dark:hover:bg-[var(--theme-surface)]"
                    >
                      {mockPurchaseMutation.isPending ? (
                        <Loader2
                          className="h-5 w-5 shrink-0 animate-spin"
                          aria-hidden="true"
                        />
                      ) : null}
                      Mua test (dev)
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          {shouldShowLearningProgress ? (
            <StudentCourseDetailProgressCard course={course} detail={detail} />
          ) : null}

          <section className="rounded-[1.35rem] bg-white/86 p-4 dark:bg-[var(--theme-surface)] lg:p-5">
            <div className="mb-4 flex min-w-0 items-center gap-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-sky-200 bg-sky-50 text-sky-600 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-300">
                <Calculator className="h-6 w-6" aria-hidden="true" />
              </span>
              <h2 className="min-w-0 flex-1 truncate text-xl font-extrabold text-slate-800 dark:text-[var(--theme-text)]">
                Nội dung khóa học
              </h2>
              <p className="student-course-count-text hidden shrink-0 text-sm font-black sm:block">
                {course.chapterCount} chương · {course.lessonCount} buổi học
              </p>
            </div>
            <div className="grid gap-3">
              {detail.chapters.length > 0 ? (
                detail.chapters.map((chapter, chapterIndex) =>
                  chapter.isStandaloneGroup ? (
                    <ul
                      key={chapter.id}
                      style={getStudentCourseAccentStyle({
                        accentCount: detail.chapters.length,
                        accentIndex: chapterIndex,
                      })}
                      className="student-mobile-border student-curriculum-accent-card relative overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)]"
                    >
                      {chapter.lessons.map((lesson, lessonIndex) => (
                        <StudentCourseLessonRow
                          key={lesson.id}
                          continueLessonActionLabel={continueLessonCopy.actionLabel}
                          continueLessonId={detail.continueLessonId}
                          lesson={lesson}
                          showSeparator={lessonIndex > 0}
                        />
                      ))}
                    </ul>
                  ) : (
                    <StudentCourseChapterCard
                      key={chapter.id}
                      accentCount={detail.chapters.length}
                      accentIndex={chapterIndex}
                      chapter={chapter}
                      continueLessonActionLabel={continueLessonCopy.actionLabel}
                      continueLessonId={detail.continueLessonId}
                      expanded={expandedChapterIds.includes(chapter.id)}
                      onToggle={() => handleToggleChapter(chapter)}
                      showProgress={shouldShowLearningProgress}
                    />
                  ),
                )
              ) : (
                <div className="student-mobile-border rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-5 text-sm font-semibold leading-6 text-slate-500 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface-muted)] dark:text-[var(--theme-text-muted)]">
                  Khóa học này chưa có chương hoặc buổi học nào.
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
