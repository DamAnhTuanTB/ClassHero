import {
  ArrowRight,
  CalendarDays,
  Crown,
  Globe2,
  LockKeyhole,
  PlayCircle,
  Star,
  Video,
} from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { CourseIllustration } from "@/components/student/courses/course-illustration";
import { CourseMetaRow } from "@/components/student/courses/course-meta-row";
import { CourseProgressBar } from "@/components/student/courses/course-progress-bar";
import { CourseStatusBadge } from "@/components/student/courses/course-status-badge";
import { CourseSubjectBadge } from "@/components/student/courses/course-subject-badge";
import type { StudentCourse } from "@/features/student/shared/student-courses-types";
import {
  formatVnd,
  getCoursePrice,
  getGradeTextClass,
} from "@/features/student/shared/utils/student-courses-utils";
import { cn } from "@/lib/utils";

const courseAccentStripClassBySlug: Record<string, string> = {
  "hoa-9-on-thi": "bg-orange-500 dark:bg-orange-400",
  "toan-7-nang-cao": "bg-indigo-500 dark:bg-indigo-400",
  "toan-7-nen-tang": "bg-sky-500 dark:bg-sky-400",
  "toan-7-tang-toc": "bg-cyan-500 dark:bg-cyan-400",
  "vat-ly-8-nhap-mon-trial": "bg-emerald-500 dark:bg-emerald-400",
};

const fallbackCourseAccentStripClasses = [
  "bg-sky-500 dark:bg-sky-400",
  "bg-indigo-500 dark:bg-indigo-400",
  "bg-cyan-500 dark:bg-cyan-400",
  "bg-teal-600 dark:bg-teal-400",
  "bg-emerald-500 dark:bg-emerald-400",
  "bg-orange-500 dark:bg-orange-400",
  "bg-rose-500 dark:bg-rose-400",
];

function getCourseAccentStripClass(course: StudentCourse) {
  const mappedClass = courseAccentStripClassBySlug[course.slug];

  if (mappedClass) {
    return mappedClass;
  }

  const hash = Array.from(course.id).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );

  return (
    fallbackCourseAccentStripClasses[hash % fallbackCourseAccentStripClasses.length] ??
    "bg-blue-600 dark:bg-blue-400"
  );
}

export function ExploreCourseCard({ course }: { course: StudentCourse }) {
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
      ? "Bài học đầu tiên"
      : course.nextLesson?.kind === "last"
        ? "Bài học cuối cùng"
        : isCurrentLessonInProgress
          ? "Bài học đang học"
          : "Bài học tiếp theo";
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
      ? Math.min(Math.max(course.progressPercent, 4), 96)
      : 0;
  const progressStyle =
    typeof course.progressPercent === "number"
      ? ({
          "--student-progress-marker": `${progressMarkerLeft}%`,
          "--student-progress-value": `${course.progressPercent}%`,
        } as CSSProperties)
      : undefined;

  return (
    <Link
      id={course.slug}
      href={`/student/courses/${course.slug}`}
      aria-label={`Xem chi tiết ${course.title}`}
      className="group relative block min-w-0 cursor-pointer overflow-hidden rounded-[1.75rem] border border-transparent bg-white p-4 pl-5 shadow-none transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100 dark:border-transparent dark:bg-[var(--theme-surface)] sm:p-6 sm:pl-7"
    >
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-2 rounded-l-[1.75rem]",
          getCourseAccentStripClass(course),
        )}
        aria-hidden="true"
      />
      <div className="grid min-w-0 grid-cols-[40%_minmax(0,1fr)] gap-3">
        {course.thumbnailImageUrl ? (
          <img
            src={course.thumbnailImageUrl}
            alt={`Ảnh khóa học ${course.title}`}
            loading="lazy"
            decoding="async"
            className="aspect-square h-auto min-h-0 w-full rounded-2xl object-cover"
          />
        ) : (
          <CourseIllustration
            tone={course.tone}
            visualTone={course.access === "locked" ? "blue" : undefined}
            className="h-auto min-h-0 w-full"
          />
        )}
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
              <CourseSubjectBadge subject={course.subject} />
              <span
                data-grade={course.grade}
                className={cn(
                  "student-grade-label shrink-0 whitespace-nowrap text-xs font-extrabold lg:text-sm",
                  getGradeTextClass(course.grade),
                )}
              >
                Lớp {course.grade}
              </span>
            </div>
            <span className="ml-auto shrink-0">
              <CourseStatusBadge
                access={course.access}
                isUnderMaintenance={isUnderMaintenance}
              />
            </span>
          </div>
          <h2 className="student-soft-bold-text mt-2 line-clamp-2 text-base font-extrabold leading-snug text-slate-600 dark:text-[var(--theme-text-strong)] sm:text-lg">
            {course.title}
          </h2>
          <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-[var(--theme-text-muted)] sm:mt-2 sm:text-sm sm:leading-6">
            {course.description}
          </p>
          <div className="mt-3">
            <CourseMetaRow course={course} />
          </div>
        </div>
      </div>

      {!isEnrolled ? (
        <p className="mt-3 flex min-w-0 flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-center text-xs font-semibold leading-5 text-slate-700 dark:text-[var(--theme-text)] sm:gap-x-2 sm:text-base sm:leading-6">
          <span className="font-semibold text-slate-500 dark:text-[var(--theme-text-muted)]">
            Hình thức:
          </span>{" "}
          <span className="inline-flex min-w-0 items-center gap-1">
            <Video
              className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-300 sm:h-5 sm:w-5"
              aria-hidden="true"
            />
            <span>Học online trực tiếp</span>
          </span>
          <span className="shrink-0 text-slate-400 dark:text-[var(--theme-text-muted)]">
            +
          </span>
          <span className="inline-flex shrink-0 items-center gap-1">
            <Globe2
              className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300 sm:h-5 sm:w-5"
              aria-hidden="true"
            />
            Website
          </span>
        </p>
      ) : null}

      {isStudying && course.nextLesson && typeof course.progressPercent === "number" ? (
        <div className="student-course-progress-panel student-mobile-border mt-3 rounded-2xl border border-sky-200/80 p-3 dark:border-[var(--theme-primary-border)]">
          <div className="grid min-w-0 gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="student-progress-label shrink-0 text-xs font-bold text-sky-700 dark:text-sky-300 lg:text-[15px]">
                Tiến độ
              </span>
              <span className="student-progress-accent-text shrink-0 text-sm font-extrabold text-sky-600 dark:text-sky-300 lg:text-[17px]">
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
                  className="student-progress-animated-marker student-progress-star-marker absolute top-1/2 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-sky-50 text-sky-600 shadow-sm dark:bg-sky-50 dark:text-sky-600"
                  style={progressStyle}
                >
                  <Star className="h-4 w-4 fill-current" aria-hidden="true" />
                </span>
              </div>
            </div>

            <div className="student-next-lesson-box student-mobile-border grid min-w-0 grid-cols-1 items-center gap-3 rounded-xl border border-sky-200/80 bg-sky-50 p-3 sm:grid-cols-[minmax(0,1fr)_8.25rem]">
              <div className="flex min-w-0 items-center gap-2">
                <span className="student-progress-accent-text flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-sky-600 shadow-[0_8px_18px_-8px_rgb(2_132_199_/_55%),0_3px_7px_-4px_rgb(3_105_161_/_45%)] dark:bg-[var(--theme-surface)] dark:text-sky-300">
                  <CalendarDays className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="student-progress-accent-text text-[11px] font-bold leading-4 text-sky-600 dark:text-sky-300 sm:text-sm sm:leading-5">
                    {nextLessonLabel}
                  </p>
                  <p className="student-soft-bold-text line-clamp-2 text-sm font-extrabold leading-5 text-slate-600 dark:text-[var(--theme-text-strong)] sm:text-base sm:leading-6">
                    {course.nextLesson.title}
                  </p>
                </div>
              </div>

              <span className="student-learn-cta-3d inline-flex min-h-10 w-full min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-sky-500 px-3 text-sm font-extrabold text-white transition hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100">
                <PlayCircle
                  className="h-6 w-6 shrink-0 sm:h-5 sm:w-5"
                  aria-hidden="true"
                />
                {nextLessonCtaLabel}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <>
          {isUnderMaintenance ? (
            <div className="student-mobile-border mt-3 flex min-w-0 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-black leading-5 text-amber-700 dark:border-[var(--theme-warning-border)] dark:bg-[var(--theme-warning-bg)] dark:text-[var(--theme-warning-text)]">
              <LockKeyhole className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 break-words">
                Khóa học đang được bảo trì
              </span>
            </div>
          ) : null}
          <div
            className={cn(
              "student-mobile-border mt-3 rounded-xl border p-3",
              isUnderMaintenance
                ? "border-amber-200 bg-amber-50/75 dark:border-[var(--theme-warning-border)] dark:bg-[var(--theme-warning-bg)]"
                : isEnrolled
                ? "border-slate-100 bg-white dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)]"
                : "student-course-price-box border border-emerald-200/80 bg-emerald-50/70 dark:border-[var(--theme-success-border)] dark:bg-[var(--theme-success-bg)]",
            )}
          >
            <div className="grid min-w-0 gap-3 min-[400px]:grid-cols-[minmax(0,1fr)_6.75rem] min-[400px]:items-center sm:grid-cols-[minmax(0,1fr)_8.25rem]">
              {isUnderMaintenance ? (
                <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-amber-600 shadow-sm dark:bg-[var(--theme-surface)] dark:text-[var(--theme-warning-text)]">
                    <LockKeyhole className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="grid min-w-0 gap-0.5">
                    <p className="truncate text-xs font-bold text-amber-700 dark:text-[var(--theme-warning-text)] sm:text-sm">
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
                  <span className="student-course-price-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm dark:bg-[var(--theme-surface)] dark:text-[var(--theme-success-text)]">
                    <LockKeyhole className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="grid min-w-0 gap-0.5">
                    <div className="flex w-fit max-w-full min-w-0 flex-nowrap items-center gap-1.5">
                      <p className="shrink-0 text-xs font-bold text-emerald-700 dark:text-[var(--theme-success-text)] sm:text-sm">
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
                      className="truncate text-base font-extrabold leading-tight sm:text-lg"
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
                  "inline-flex min-h-10 w-full min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 sm:px-4",
                  isEnrolled && !isUnderMaintenance
                    ? "student-learn-cta-3d bg-sky-500 text-white hover:bg-sky-600 focus-visible:ring-sky-100"
                    : "student-detail-cta-outline border border-emerald-400/70 bg-white text-emerald-700 hover:border-emerald-500/80 hover:bg-emerald-50 focus-visible:ring-emerald-100 dark:border-[var(--theme-success-border)] dark:bg-[var(--theme-surface)] dark:text-[var(--theme-success-text)]",
                )}
              >
                {ctaLabel}
                {isEnrolled && !isUnderMaintenance ? (
                  <PlayCircle
                    className="h-6 w-6 shrink-0 sm:h-5 sm:w-5"
                    aria-hidden="true"
                  />
                ) : (
                  <ArrowRight
                    className="h-6 w-6 shrink-0 sm:h-5 sm:w-5"
                    aria-hidden="true"
                  />
                )}
              </span>
            </div>
          </div>

          {hasFreeTrial ? (
            <div className="student-course-trial-box student-mobile-border mt-2 grid min-w-0 grid-cols-[minmax(0,1fr)_6.75rem] items-center gap-3 rounded-xl border border-amber-200/80 bg-amber-50 p-3 dark:border-[var(--theme-warning-border)] dark:bg-[var(--theme-warning-bg)] sm:grid-cols-[minmax(0,1fr)_8.25rem]">
              <div className="flex min-w-0 items-center gap-2">
                <span className="student-course-trial-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-amber-500 shadow-sm dark:bg-[var(--theme-surface)] dark:text-[var(--theme-warning-text)]">
                  <Crown className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-bold leading-4 text-amber-700 dark:text-[var(--theme-warning-text)] sm:text-sm sm:leading-5">
                    Học thử miễn phí
                  </p>
                  <p className="student-soft-bold-text truncate text-sm font-extrabold text-slate-600 dark:text-[var(--theme-text-strong)]">
                    {course.trialLessonCount} bài học
                  </p>
                </div>
              </div>

              <span className="student-trial-cta-3d inline-flex min-h-9 w-full min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-amber-400 px-3 text-sm font-extrabold text-white transition hover:bg-amber-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-100">
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
