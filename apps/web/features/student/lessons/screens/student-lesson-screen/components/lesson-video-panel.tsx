"use client";

import dynamic from "next/dynamic";
import {
  CircleAlert,
  BookOpenCheck,
  ExternalLink,
  RefreshCcw,
  VideoOff,
} from "lucide-react";
import { useCallback, useState } from "react";
import type { CustomVideoSettings } from "@/components/shared/custom-youtube-player";
import type { StudentLesson } from "@/features/student/lessons/types/student-lesson-types";
import { cn } from "@/lib/utils";

const CustomYoutubePlayer = dynamic(() =>
  import("@/components/shared/custom-youtube-player").then(
    (module) => module.CustomYoutubePlayer,
  ),
);

export function LessonVideoPanel({
  lesson,
}: {
  lesson: Pick<StudentLesson, "customVideoSettings" | "title" | "videoUrl">;
}) {
  const videoUrl = lesson.videoUrl?.trim() ?? "";
  const isYoutubeVideo =
    videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be");
  const [failedVideoUrl, setFailedVideoUrl] = useState<string | null>(null);
  const [reloadAttempt, setReloadAttempt] = useState(0);
  const hasVideoError = Boolean(videoUrl) && failedVideoUrl === videoUrl;
  const handleVideoError = useCallback(() => {
    setFailedVideoUrl(videoUrl);
  }, [videoUrl]);

  function handleRetryVideo() {
    setFailedVideoUrl(null);
    setReloadAttempt((current) => current + 1);
  }

  return (
    <section
      aria-label="Video bài giảng"
      className={cn(
        "relative -mx-2 mt-0 w-[calc(100%+1rem)] overflow-hidden border-y border-sky-100 sm:mx-0 sm:mt-3 sm:w-full sm:rounded-[1.5rem] sm:border dark:border-[var(--theme-border)]",
        videoUrl && !hasVideoError
          ? "bg-black"
          : "bg-white/80 dark:bg-[var(--theme-surface)]",
      )}
    >
      {hasVideoError ? (
        <div className="p-3 sm:p-5">
          <div
            role="alert"
            className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl border border-rose-200/90 bg-gradient-to-br from-rose-50 via-white to-amber-50 px-5 text-center shadow-[inset_0_1px_0_rgb(255_255_255_/_90%),0_18px_45px_-38px_rgb(225_29_72_/_55%)] dark:border-rose-400/20 dark:from-rose-950/35 dark:via-[var(--theme-surface-soft)] dark:to-amber-950/20 dark:shadow-[0_18px_45px_-38px_rgb(225_29_72_/_25%)] sm:px-8"
          >
            <span
              aria-hidden="true"
              className="absolute -left-10 top-1/4 h-32 w-32 rounded-full bg-rose-300/20 blur-3xl dark:bg-rose-500/10"
            />
            <span
              aria-hidden="true"
              className="absolute -right-10 bottom-1/4 h-32 w-32 rounded-full bg-amber-300/20 blur-3xl dark:bg-amber-500/10"
            />

            <div className="relative z-10 flex max-w-md flex-col items-center">
              <span className="grid h-16 w-16 place-items-center rounded-2xl border border-rose-200 bg-white text-rose-600 shadow-[0_14px_30px_-22px_rgb(225_29_72_/_75%)] dark:border-rose-400/20 dark:bg-[var(--theme-surface)] dark:text-rose-300 sm:h-20 sm:w-20">
                <CircleAlert className="h-8 w-8 sm:h-9 sm:w-9" aria-hidden="true" />
              </span>
              <p className="mt-4 text-base font-black text-slate-800 dark:text-[var(--theme-text-strong)] sm:mt-5 sm:text-xl">
                Không tải được video
              </p>
              <p className="mt-1.5 text-xs font-semibold leading-5 text-slate-500 dark:text-[var(--theme-text-muted)] sm:text-sm sm:leading-6">
                Kết nối tới video đang gặp sự cố. Bạn thử tải lại nhé.
              </p>
              <button
                type="button"
                onClick={handleRetryVideo}
                className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-sky-600 px-4 text-sm font-black text-white shadow-[0_4px_0_rgb(3_105_161)] transition enabled:hover:bg-sky-500 active:translate-y-[3px] active:shadow-[0_1px_0_rgb(3_105_161)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 dark:bg-sky-600 dark:shadow-[0_4px_0_rgb(7_89_133)] dark:focus-visible:ring-sky-500/30"
              >
                <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                Thử tải lại
              </button>
            </div>
          </div>
        </div>
      ) : videoUrl ? (
        isYoutubeVideo ? (
          <CustomYoutubePlayer
            key={`${videoUrl}-${reloadAttempt}`}
            videoUrl={videoUrl}
            settings={
              lesson.customVideoSettings as CustomVideoSettings | null | undefined
            }
            startButtonVariant="student"
            title={lesson.title}
            onError={handleVideoError}
          />
        ) : (
          <div className="p-4 sm:p-5">
            <a
              href={videoUrl}
              target="_blank"
              rel="noreferrer"
              className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-2xl bg-slate-950 px-6 text-center text-white transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-300"
            >
              <span className="grid h-14 w-14 place-items-center rounded-full bg-white/15">
                <ExternalLink className="h-7 w-7" aria-hidden="true" />
              </span>
              <span className="text-sm font-black">Mở video bài giảng</span>
            </a>
          </div>
        )
      ) : (
        <div className="p-3 sm:p-5">
          <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50 via-white to-violet-100/80 px-5 text-center shadow-[inset_0_1px_0_rgb(255_255_255_/_85%),0_18px_45px_-38px_rgb(2_132_199_/_70%)] dark:border-sky-400/20 dark:from-sky-950/45 dark:via-[var(--theme-surface-soft)] dark:to-violet-950/35 dark:shadow-[0_18px_45px_-38px_rgb(2_132_199_/_25%)] sm:px-8">
            <span
              aria-hidden="true"
              className="absolute -left-8 top-1/4 h-28 w-28 rounded-full bg-sky-300/25 blur-3xl dark:bg-sky-500/10"
            />
            <span
              aria-hidden="true"
              className="absolute -right-8 bottom-1/4 h-32 w-32 rounded-full bg-violet-300/30 blur-3xl dark:bg-violet-500/10"
            />

            <div className="relative z-10 flex max-w-md flex-col items-center">
              <span className="student-mobile-border grid h-16 w-20 place-items-center rounded-[1.35rem] border border-sky-200 bg-white text-sky-600 shadow-[0_14px_30px_-20px_rgb(2_132_199_/_80%)] dark:border-sky-400/20 dark:bg-[var(--theme-surface)] dark:text-sky-300 sm:h-20 sm:w-24">
                <VideoOff className="h-8 w-8 sm:h-9 sm:w-9" aria-hidden="true" />
              </span>

              <p className="mt-4 text-base font-black text-slate-800 dark:text-[var(--theme-text-strong)] sm:mt-5 sm:text-xl">
                Bài học chưa có video
              </p>
              <p className="mt-1.5 text-xs font-semibold leading-5 text-slate-500 dark:text-[var(--theme-text-muted)] sm:text-sm sm:leading-6">
                Bạn vẫn có thể làm Quiz, học Flashcard và hoàn thành Bài thi.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
