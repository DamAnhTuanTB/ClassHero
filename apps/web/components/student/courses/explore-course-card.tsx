import {
  ArrowRight,
  CalendarDays,
  Crown,
  GraduationCap,
  LockKeyhole,
  Play,
  PlayCircle,
  Star,
} from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { CourseIllustration } from "@/components/student/courses/course-illustration";
import { CourseMetaRow } from "@/components/student/courses/course-meta-row";
import { CourseProgressBar } from "@/components/student/courses/course-progress-bar";
import { CourseStatusBadge } from "@/components/student/courses/course-status-badge";
import type { StudentCourse } from "@/features/student/shared/student-courses-types";
import {
  formatVnd,
  getCoursePrice,
} from "@/features/student/shared/utils/student-courses-utils";
import { getStudentCourseAccentStyle } from "@/features/student/shared/utils/student-course-accent-palette";
import { cn } from "@/lib/utils";

export function ExploreCourseCard({
  accentCount = 1,
  accentIndex = 0,
  course,
  onPrefetch,
  targetAudienceGrade,
  targetAudienceName,
  targetAudienceCode,
}: {
  accentCount?: number;
  accentIndex?: number;
  course: StudentCourse;
  onPrefetch?: (slug: string) => void;
  targetAudienceGrade?: number | null;
  targetAudienceName?: string;
  targetAudienceCode?: string;
}) {
  const isEnrolled = course.access === "completed" || course.access === "enrolled";
  const isUnderMaintenance = course.isUnderMaintenance === true;
  const isStudying = course.access === "enrolled" && !isUnderMaintenance;
  const hasFreeTrial = !isEnrolled && typeof course.trialLessonCount === "number";
  const ctaLabel =
    course.access === "completed" && !isUnderMaintenance
      ? "Xem lại"
      : isEnrolled && !isUnderMaintenance
        ? "Vào học"
        : "Chi tiết";
  const isCurrentLessonInProgress = course.nextLesson?.kind === "inProgress";
  const nextLessonLabel =
    course.nextLesson?.kind === "first"
      ? "Buổi học đầu tiên"
      : course.nextLesson?.kind === "last"
        ? "Buổi học cuối cùng"
        : isCurrentLessonInProgress
          ? "Buổi học đang học"
          : "Buổi học tiếp theo";
  const nextLessonCtaLabel = isCurrentLessonInProgress ? "Học tiếp" : "Vào học";
  const coursePrice = getCoursePrice(course);
  const discountPercent =
    typeof course.salePriceVnd === "number" &&
    course.salePriceVnd < course.originalPriceVnd
      ? Math.round(
          ((course.originalPriceVnd - course.salePriceVnd) / course.originalPriceVnd) *
            100,
        )
      : 0;
  const progressMarkerLeft =
    typeof course.progressPercent === "number"
      ? Math.min(Math.max(course.progressPercent, 0), 100)
      : 0;
  const progressStyle =
    typeof course.progressPercent === "number"
      ? ({
          "--student-progress-marker": `calc(${progressMarkerLeft}% - 1.25rem * (${progressMarkerLeft} / 100))`,
          "--student-progress-value": `${course.progressPercent}%`,
        } as CSSProperties)
      : undefined;
  const displayedTargetAudienceGrade = targetAudienceGrade ?? course.grade;
  const displayedTargetAudienceName =
    targetAudienceName ?? course.targetAudienceNames[0] ?? course.targetAudienceName;

  return (
    <Link
      id={course.slug}
      href={`/student/courses/${course.slug}`}
      onFocus={() => onPrefetch?.(course.slug)}
      onPointerEnter={() => onPrefetch?.(course.slug)}
      onTouchStart={() => onPrefetch?.(course.slug)}
      aria-label={`Xem chi tiết ${course.title}`}
      style={getStudentCourseAccentStyle({
        accentCount,
        accentIndex,
        targetAudienceCode,
        targetAudienceGrade: displayedTargetAudienceGrade,
        targetAudienceName: displayedTargetAudienceName,
      })}
      className="group relative block min-w-0 cursor-pointer overflow-hidden rounded-[1.75rem] border border-transparent bg-white p-4 pl-6 shadow-none transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100 dark:border-transparent dark:bg-[var(--theme-surface)] sm:p-3.5 sm:pl-[22px]"
    >
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-2 rounded-l-[1.75rem] bg-[var(--student-course-accent)] dark:bg-[var(--student-course-accent-dark)]",
        )}
        aria-hidden="true"
      />
      <div className="grid min-w-0 grid-cols-1 gap-1.5">
        <div className="min-w-0">
          {course.thumbnailImageUrl ? (
            <img
              src={course.thumbnailImageUrl}
              alt={`Ảnh khóa học ${course.title}`}
              loading="lazy"
              decoding="async"
              className="aspect-[3/2] h-auto min-h-0 w-full rounded-2xl object-cover"
            />
          ) : (
            <CourseIllustration
              tone={course.tone}
              visualTone={course.access === "locked" ? "blue" : undefined}
              className="aspect-[3/2] h-auto min-h-0 w-full"
            />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span
              data-grade={displayedTargetAudienceGrade}
              className={cn(
                "student-grade-label inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-transparent bg-[var(--student-course-audience-bg)] px-2.5 py-1.5 text-sm font-extrabold leading-none text-[var(--student-course-audience-text)] dark:bg-[var(--student-course-audience-dark-bg)] dark:text-[var(--student-course-audience-dark-text)] lg:px-3 lg:py-1.5 lg:text-xs",
              )}
            >
              <GraduationCap
                className="h-3.5 w-3.5 shrink-0 lg:h-4 lg:w-4"
                aria-hidden="true"
              />
              {displayedTargetAudienceName}
            </span>
            <span className="ml-auto shrink-0">
              <CourseStatusBadge
                access={course.access}
                isUnderMaintenance={isUnderMaintenance}
              />
            </span>
          </div>
          <h2 className="student-soft-bold-text mt-0.5 line-clamp-2 text-lg font-extrabold leading-snug text-slate-600 dark:text-[var(--theme-text-strong)] sm:text-lg">
            {course.title}
          </h2>
          <p className="mt-0 text-[15px] leading-6 text-slate-500 dark:text-[var(--theme-text-muted)] sm:mt-0.5 sm:text-sm sm:leading-6">
            {course.description}
          </p>
          <div className="mt-0.5">
            <CourseMetaRow course={course} />
          </div>
        </div>
      </div>

      {isStudying && course.nextLesson && typeof course.progressPercent === "number" ? (
        <div className="student-course-progress-panel student-mobile-border mt-1.5 rounded-2xl border border-sky-200/80 p-2.5 dark:border-[var(--theme-primary-border)]">
          <div className="grid min-w-0 gap-1.5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="student-progress-label shrink-0 text-[15px] font-bold text-sky-700 dark:text-sky-300 lg:text-sm">
                Tiến độ
              </span>
              <span className="student-progress-accent-text shrink-0 text-[17px] font-extrabold text-sky-600 dark:text-sky-300 lg:text-base">
                {course.progressPercent}%
              </span>
              <div className="relative h-4 min-w-0 flex-1">
                <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full bg-slate-400/60 dark:bg-[var(--theme-surface-muted)]">
                  <div
                    className="student-progress-animated-fill h-full rounded-full bg-sky-500 dark:bg-sky-400"
                    style={progressStyle}
                  />
                </div>
                <span
                  className="student-progress-animated-marker student-progress-star-marker absolute top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-sky-100 text-sky-700 shadow-sm dark:bg-sky-100 dark:text-sky-700"
                  style={progressStyle}
                >
                  <Star className="h-4 w-4 fill-current" aria-hidden="true" />
                </span>
              </div>
            </div>

            <div className="student-next-lesson-box student-mobile-border grid min-w-0 grid-cols-1 items-center gap-2.5 rounded-xl border border-sky-200/80 bg-sky-50 px-2.5 py-2.5 sm:gap-1.5 sm:py-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="student-progress-accent-text flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-sky-600 shadow-[0_8px_18px_-8px_rgb(2_132_199_/_55%),0_3px_7px_-4px_rgb(3_105_161_/_45%)] dark:bg-[var(--theme-surface)] dark:text-sky-300">
                  <CalendarDays className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="student-progress-accent-text text-sm font-bold leading-4 text-sky-600 dark:text-sky-300 sm:text-sm sm:leading-5">
                    {nextLessonLabel}
                  </p>
                  <p className="student-soft-bold-text mt-1 line-clamp-2 text-base font-extrabold leading-5 text-slate-600 dark:text-[var(--theme-text-strong)] sm:text-base sm:leading-6">
                    {course.nextLesson.title}
                  </p>
                </div>
              </div>

              <span className="student-learn-cta-3d inline-flex min-h-11 w-full min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-sky-500 px-3 text-[17px] font-extrabold text-white transition hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100 sm:text-base">
                <Play className="h-5 w-5 shrink-0 fill-current" aria-hidden="true" />
                {nextLessonCtaLabel}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <>
          {isUnderMaintenance ? (
            <div className="student-mobile-border mt-1.5 flex min-w-0 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-sm font-black leading-5 text-amber-700 dark:border-[var(--theme-warning-border)] dark:bg-[var(--theme-warning-bg)] dark:text-[var(--theme-warning-text)]">
              <LockKeyhole className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 break-words">Khóa học đang được bảo trì</span>
            </div>
          ) : null}
          <div
            className={cn(
              "student-mobile-border mt-2 rounded-xl border px-2.5 py-3",
              isUnderMaintenance
                ? "border-amber-200 bg-amber-50/75 dark:border-[var(--theme-warning-border)] dark:bg-[var(--theme-warning-bg)]"
                : isEnrolled
                  ? "border-slate-200 bg-white dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)]"
                  : "student-course-price-box border border-sky-200/80 bg-sky-50/70 dark:border-[var(--theme-primary-border)] dark:bg-[var(--theme-primary-soft)]",
            )}
          >
            <div
              className={cn(
                "grid min-w-0 grid-cols-1",
                !isEnrolled && !isUnderMaintenance ? "gap-2" : "gap-3",
              )}
            >
              {isUnderMaintenance ? (
                <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-amber-600 shadow-sm dark:bg-[var(--theme-surface)] dark:text-[var(--theme-warning-text)]">
                    <LockKeyhole className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="grid min-w-0 gap-0.5">
                    <p className="truncate text-sm font-bold text-amber-700 dark:text-[var(--theme-warning-text)] sm:text-sm">
                      Nội dung tạm khóa
                    </p>
                    <p className="truncate text-sm font-extrabold leading-tight text-slate-700 dark:text-[var(--theme-text)] sm:text-base">
                      Chờ lớp học mở lại
                    </p>
                  </div>
                </div>
              ) : isEnrolled && typeof course.progressPercent === "number" ? (
                <CourseProgressBar value={course.progressPercent} />
              ) : (
                <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                  <span className="student-course-price-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-sky-600 shadow-sm dark:bg-[var(--theme-surface)] dark:text-sky-300">
                    <LockKeyhole className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="grid min-w-0 gap-0.5">
                    <div className="flex w-fit max-w-full min-w-0 flex-nowrap items-center gap-1.5">
                      <p className="shrink-0 text-sm font-bold text-sky-700 dark:text-sky-300 sm:text-sm">
                        Giá khóa học
                      </p>
                      {discountPercent > 0 ? (
                        <span
                          className="inline-flex h-5 shrink-0 items-center rounded-md border border-rose-200 bg-rose-50 px-1.5 text-[11px] font-black leading-none tracking-wide shadow-sm dark:border-rose-300/40 dark:bg-rose-500/20"
                          style={{
                            color: "var(--student-discount-badge-text)",
                            WebkitTextFillColor: "var(--student-discount-badge-text)",
                          }}
                        >
                          Giảm {discountPercent}%
                        </span>
                      ) : null}
                    </div>
                    <p
                      className="truncate text-lg font-extrabold leading-tight sm:text-lg"
                      style={{
                        color: "var(--student-sale-price-text)",
                        WebkitTextFillColor: "var(--student-sale-price-text)",
                      }}
                    >
                      {formatVnd(coursePrice)}
                    </p>
                    {discountPercent > 0 ? (
                      <p className="-mt-0.5 truncate text-sm font-semibold leading-tight text-slate-500 dark:text-[var(--theme-text-muted)] sm:text-base">
                        <span className="line-through">
                          {formatVnd(course.originalPriceVnd)}
                        </span>
                      </p>
                    ) : null}
                  </div>
                </div>
              )}

              <span
                className={cn(
                  "inline-flex min-h-11 w-full min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-[17px] font-extrabold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 sm:px-4 sm:text-base",
                  isEnrolled && !isUnderMaintenance
                    ? "student-learn-cta-3d bg-sky-500 text-white hover:bg-sky-600 focus-visible:ring-sky-100"
                    : "student-detail-cta-outline border border-sky-400/70 bg-white text-sky-700 hover:border-sky-500/80 hover:bg-sky-50 focus-visible:ring-sky-100 dark:border-[var(--theme-primary-border)] dark:bg-[var(--theme-surface)] dark:text-sky-300",
                )}
              >
                {isEnrolled && !isUnderMaintenance ? (
                  <>
                    <Play className="h-5 w-5 shrink-0 fill-current" aria-hidden="true" />
                    {ctaLabel}
                  </>
                ) : (
                  <>
                    {ctaLabel}
                    <ArrowRight
                      className="h-6 w-6 shrink-0 sm:h-5 sm:w-5"
                      aria-hidden="true"
                    />
                  </>
                )}
              </span>
            </div>
          </div>

          {hasFreeTrial ? (
            <div className="student-course-trial-box student-mobile-border mt-1.5 grid min-w-0 grid-cols-1 items-center gap-1.5 rounded-xl border border-amber-200/80 bg-amber-50 p-2.5 dark:border-[var(--theme-warning-border)] dark:bg-[var(--theme-warning-bg)]">
              <div className="flex min-w-0 items-center gap-2">
                <span className="student-course-trial-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-amber-500 shadow-sm dark:bg-[var(--theme-surface)] dark:text-[var(--theme-warning-text)]">
                  <Crown className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold leading-5 text-amber-700 dark:text-[var(--theme-warning-text)] sm:text-sm sm:leading-5">
                    Học thử miễn phí
                  </p>
                  <p className="student-soft-bold-text truncate text-sm font-extrabold text-slate-600 dark:text-[var(--theme-text-strong)]">
                    {course.trialLessonCount} buổi học
                  </p>
                </div>
              </div>

              <span className="student-trial-cta-3d inline-flex min-h-10 w-full min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-amber-400 px-3 text-[17px] font-extrabold text-white transition hover:bg-amber-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-100 sm:text-base">
                <PlayCircle
                  className="h-6 w-6 shrink-0 sm:h-5 sm:w-5"
                  aria-hidden="true"
                />
                Học thử
              </span>
            </div>
          ) : null}
        </>
      )}
    </Link>
  );
}
