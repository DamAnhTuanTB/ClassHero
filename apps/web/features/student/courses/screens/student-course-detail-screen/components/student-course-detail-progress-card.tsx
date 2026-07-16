import { Goal, Play, Star } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import type {
  StudentCourse,
  StudentCourseDetail,
} from "@/features/student/shared/student-courses-types";
import { getStudentCourseContinueLessonCopy } from "@/features/student/shared/utils/student-course-continue-lesson";

export function StudentCourseDetailProgressCard({
  course,
  detail,
}: {
  course: StudentCourse;
  detail: StudentCourseDetail;
}) {
  const progress = course.progressPercent ?? 0;
  const markerLeft = Math.min(Math.max(progress, 4), 96);
  const progressStyle = {
    "--student-progress-marker": `${markerLeft}%`,
    "--student-progress-value": `${progress}%`,
  } as CSSProperties;
  const lessonCopy = getStudentCourseContinueLessonCopy(detail.continueLessonKind);

  return (
    <section className="student-course-detail-progress-card rounded-[1.1rem] bg-white/88 p-4 dark:bg-[var(--theme-surface)]">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center text-red-500 dark:text-red-300">
          <Goal className="h-7 w-7" strokeWidth={3} aria-hidden="true" />
        </span>
        <h2 className="min-w-0 flex-1 truncate text-lg font-extrabold text-slate-800 dark:text-[var(--theme-text)]">
          Tiến độ của bạn
        </h2>
        <p className="shrink-0 text-4xl font-black leading-none text-sky-500 dark:text-sky-300">
          {progress}%
        </p>
      </div>

      <div className="relative mt-5 h-5 w-full">
        <div className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 overflow-hidden rounded-full bg-slate-200 dark:bg-[var(--theme-surface-muted)]">
          <div
            className="student-progress-animated-fill h-full rounded-full bg-sky-500 dark:bg-sky-400"
            style={progressStyle}
          />
        </div>
        <span
          className="student-progress-animated-marker student-progress-star-marker absolute top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-sky-50 text-sky-600 shadow-sm dark:bg-sky-50 dark:text-sky-600"
          style={progressStyle}
        >
          <Star className="h-5 w-5 fill-current" aria-hidden="true" />
        </span>
      </div>

      <div className="mt-4 break-words">
        <p className="text-sm font-black leading-5 text-sky-500 dark:text-sky-300">
          {lessonCopy.prefix}
        </p>
        <p className="mt-0.5 text-xl font-black leading-7 text-slate-800 dark:text-[var(--theme-text)]">
          {detail.continueLessonTitle}
        </p>
      </div>

      <div className="mt-5">
        <Link
          href={`/student/lessons/${detail.continueLessonId}`}
          className="student-learn-cta-3d inline-flex min-h-14 w-full min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-sky-500 px-4 text-lg font-black text-white transition hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100"
        >
          <Play className="h-7 w-7 shrink-0 fill-current" aria-hidden="true" />
          {lessonCopy.actionLabel}
        </Link>
      </div>
    </section>
  );
}
