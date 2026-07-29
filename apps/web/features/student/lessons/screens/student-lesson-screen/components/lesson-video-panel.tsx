"use client";

import dynamic from "next/dynamic";
import { ExternalLink, VideoOff } from "lucide-react";
import type { CustomVideoSettings } from "@/components/shared/custom-youtube-player";
import type { StudentLesson } from "@/features/student/lessons/types/student-lesson-types";

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

  return (
    <section
      aria-label="Video bài giảng"
      className="relative -mx-2 mt-0 w-[calc(100%+1rem)] overflow-hidden border-y border-sky-100 bg-black sm:mx-0 sm:mt-3 sm:w-full sm:rounded-[1.5rem] sm:border dark:border-[var(--theme-border)]"
    >
      {videoUrl ? (
        isYoutubeVideo ? (
          <CustomYoutubePlayer
            videoUrl={videoUrl}
            settings={
              lesson.customVideoSettings as CustomVideoSettings | null | undefined
            }
            startButtonVariant="student"
            title={lesson.title}
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
        <div className="p-4 sm:p-5">
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface-soft)]">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-slate-400 shadow-sm dark:bg-[var(--theme-surface)] dark:text-[var(--theme-text-muted)]">
              <VideoOff className="h-6 w-6" aria-hidden="true" />
            </span>
            <p className="text-sm font-bold text-slate-500 dark:text-[var(--theme-text-muted)]">
              Bài học này chưa có video.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
