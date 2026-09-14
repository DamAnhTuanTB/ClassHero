import { useState, useMemo, useSyncExternalStore, type ComponentProps } from "react";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { LessonSummaryTableOfContents } from "@/components/common/content/lesson-summary-table-of-contents";
import { TiptapContentView } from "@/components/common/content/tiptap-content-view";
import {
  DEFAULT_CUSTOM_VIDEO_SETTINGS,
  type CustomVideoSettings,
} from "@/components/shared/custom-youtube-player";
import type { StudentLesson } from "@/features/student/lessons/types/student-lesson-types";
import {
  createActiveVideoSummaryBlockLocationStore,
  getPlaybackVideoSummaryBlockEndSecond,
  getPlaybackVideoSummaryBlockDisplayNumber,
  type VideoPlaybackSecondStore,
} from "@/features/student/lessons/utils/video-summary-playback";
import {
  hasCompleteVideoTimelineSectionCoverage,
  resolveVisibleVideoTimelineSectionIndexes,
} from "@/lib/video-player-time";
import { SummaryBlockRenderer } from "./summary-block-renderer";

export type LessonSummarySubTab = "video" | "theory" | "exercises";
type VideoSummaryViewMode = "all" | "segment";
type SummaryBlockData = ComponentProps<typeof SummaryBlockRenderer>["data"];

export function LessonSummaryPanel({
  hasVideoPlaybackStarted,
  lesson,
  onActiveSubTabChange,
  onVideoSeek,
  playbackStore,
  videoPlaybackEndTimeInSeconds,
}: {
  hasVideoPlaybackStarted: boolean;
  lesson: StudentLesson;
  onActiveSubTabChange?: (subTab: LessonSummarySubTab) => void;
  onVideoSeek: (seconds: number) => void;
  playbackStore: VideoPlaybackSecondStore;
  videoPlaybackEndTimeInSeconds?: number;
}) {
  const content = lesson.summary?.contentJson;
  const isBlocksFormat = content?.type === "lesson_summary_blocks";
  const summaryData =
    content?.type === "lesson_summary_blocks" && content.data
      ? (content.data as SummaryBlockData)
      : null;
  const videoSummaryContent = lesson.videoSummary?.contentJson;
  const videoSummaryData =
    videoSummaryContent?.type === "lesson_summary_blocks" && videoSummaryContent.data
      ? (videoSummaryContent.data as SummaryBlockData)
      : null;
  const videoSettings = lesson.customVideoSettings as
    CustomVideoSettings | null | undefined;
  const videoStartTimeOffsetSeconds = videoSettings?.isDisabled
    ? 0
    : (videoSettings?.startTimeInSeconds ??
      DEFAULT_CUSTOM_VIDEO_SETTINGS.startTimeInSeconds);

  const [activeSubTab, setActiveSubTab] = useState<LessonSummarySubTab>("video");
  const [videoViewMode, setVideoViewMode] = useState<VideoSummaryViewMode>("all");

  const activeVideoSummaryBlockLocationStore = useMemo(
    () =>
      createActiveVideoSummaryBlockLocationStore(
        videoSummaryData?.sections ?? [],
        playbackStore,
        videoStartTimeOffsetSeconds,
      ),
    [playbackStore, videoStartTimeOffsetSeconds, videoSummaryData],
  );
  const activeVideoSummaryBlockLocation = useSyncExternalStore(
    activeVideoSummaryBlockLocationStore.subscribe,
    activeVideoSummaryBlockLocationStore.getSnapshot,
    activeVideoSummaryBlockLocationStore.getSnapshot,
  );

  const visibleVideoSummarySectionIndexes = useMemo(
    () =>
      videoSummaryData
        ? resolveVisibleVideoTimelineSectionIndexes(
            videoSummaryData.sections,
            videoStartTimeOffsetSeconds,
            videoPlaybackEndTimeInSeconds,
          )
        : [],
    [videoPlaybackEndTimeInSeconds, videoStartTimeOffsetSeconds, videoSummaryData],
  );
  const visibleVideoSummaryData = useMemo<SummaryBlockData | null>(() => {
    if (!videoSummaryData) return null;

    return {
      ...videoSummaryData,
      sections: visibleVideoSummarySectionIndexes.map((sourceIndex, index) => ({
        ...videoSummaryData.sections[sourceIndex]!,
        order: index + 1,
      })),
    };
  }, [videoSummaryData, visibleVideoSummarySectionIndexes]);

  const hasCompleteVideoSummarySectionCoverage = useMemo(
    () =>
      Boolean(
        videoSummaryData?.objectives?.length &&
        hasCompleteVideoTimelineSectionCoverage(
          videoSummaryData.sections,
          videoStartTimeOffsetSeconds,
          videoPlaybackEndTimeInSeconds,
        ),
      ),
    [videoPlaybackEndTimeInSeconds, videoStartTimeOffsetSeconds, videoSummaryData],
  );

  const activeVideoSummaryData = useMemo<SummaryBlockData | null>(() => {
    if (!hasVideoPlaybackStarted || !videoSummaryData) return null;

    const location = activeVideoSummaryBlockLocation;
    if (!location) return null;

    const section = videoSummaryData.sections[location.sectionIndex];
    const block = section?.blocks[location.blockIndex];
    if (!section || !block) return null;
    const displayNumber = getPlaybackVideoSummaryBlockDisplayNumber(
      videoSummaryData.sections,
      location,
      videoStartTimeOffsetSeconds,
      videoPlaybackEndTimeInSeconds,
    );
    const videoSegmentEndSeconds = getPlaybackVideoSummaryBlockEndSecond(
      videoSummaryData.sections,
      location,
      videoPlaybackEndTimeInSeconds,
    );
    const visibleSectionOrder =
      visibleVideoSummarySectionIndexes.indexOf(location.sectionIndex) + 1;

    return {
      ...videoSummaryData,
      objectives: [],
      sections: [
        {
          ...section,
          order: Math.max(1, visibleSectionOrder),
          blocks: [{ ...block, displayNumber, videoSegmentEndSeconds }],
        },
      ],
    };
  }, [
    activeVideoSummaryBlockLocation,
    hasVideoPlaybackStarted,
    videoPlaybackEndTimeInSeconds,
    videoStartTimeOffsetSeconds,
    videoSummaryData,
    visibleVideoSummarySectionIndexes,
  ]);

  const filteredData = useMemo(() => {
    if (!summaryData) return null;
    return {
      ...summaryData,
      sections: summaryData.sections
        .map((section) => ({
          ...section,
          blocks: section.blocks.filter((block) =>
            activeSubTab === "theory"
              ? block.type !== "exercise"
              : block.type === "exercise",
          ),
        }))
        .filter((section) => section.blocks.length > 0),
    };
  }, [summaryData, activeSubTab]);

  const theorySections = useMemo(() => {
    if (!summaryData) return [];
    return summaryData.sections
      .map((section) => ({
        ...section,
        blocks: section.blocks.filter((block) => block.type !== "exercise"),
      }))
      .filter((section) => section.blocks.length > 0);
  }, [summaryData]);

  const exerciseTocItems = useMemo(() => {
    if (!summaryData) return undefined;
    const items: Array<{ title: string; anchorId: string; order?: number }> = [];
    let exerciseCount = 1;

    // Simulate the filtering that happens when activeSubTab === "exercises"
    // so we can compute the exact same idx and bIdx that SummaryBlockRenderer will use
    const exercisesSections = summaryData.sections
      .map((section) => ({
        ...section,
        blocks: section.blocks.filter((block) => block.type === "exercise"),
      }))
      .filter((section) => section.blocks.length > 0);

    exercisesSections.forEach((section, idx) => {
      section.blocks.forEach((_block, bIdx) => {
        items.push({
          title: `Bài tập ${exerciseCount}`,
          anchorId: `block-${idx}-${bIdx}`,
          order: exerciseCount,
        });
        exerciseCount++;
      });
    });
    return items;
  }, [summaryData]);

  const hasVideoSummaryDocument = Boolean(
    videoSummaryContent?.type === "doc" && videoSummaryContent.content?.length,
  );
  const hasSummaryDocument = Boolean(content?.type === "doc" && content.content?.length);
  const hasTheoryData = isBlocksFormat ? theorySections.length > 0 : hasSummaryDocument;
  const hasExerciseData = isBlocksFormat
    ? Boolean(exerciseTocItems?.length)
    : hasSummaryDocument;

  const hasTableOfContents = Boolean(
    visibleVideoSummaryData?.sections.length ||
    theorySections.length ||
    exerciseTocItems?.length,
  );

  const scrollToSummaryAnchor = (anchorId: string) => {
    window.setTimeout(() => {
      document
        .getElementById(anchorId)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const selectActiveSubTab = (subTab: LessonSummarySubTab) => {
    setActiveSubTab(subTab);
    onActiveSubTabChange?.(subTab);
  };

  return (
    <section className="rounded-[1.5rem] border border-sky-100 bg-white p-4 shadow-[0_20px_50px_-42px_rgb(2_132_199_/_60%)] dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            <BookOpen className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-black text-slate-950 dark:text-[var(--theme-text-strong)] sm:text-xl">
              Kiến thức
            </h2>
          </div>
        </div>

        {hasTableOfContents ? (
          <LessonSummaryTableOfContents
            accentTrigger
            desktopBorderless
            alwaysShowLabel
            hasObjectives={false}
            sections={
              activeSubTab === "video"
                ? (visibleVideoSummaryData?.sections ?? [])
                : activeSubTab === "theory"
                  ? theorySections
                  : []
            }
            customItems={activeSubTab === "exercises" ? exerciseTocItems : undefined}
            navigationTabs={[
              { id: "video", label: "Video" },
              { id: "theory", label: "Lý thuyết" },
              { id: "exercises", label: "Bài tập" },
            ]}
            activeNavigationTab={activeSubTab}
            onNavigationTabChange={(tabId) => {
              if (tabId === "video" || tabId === "theory" || tabId === "exercises") {
                selectActiveSubTab(tabId);
              }
            }}
            sectionLabel={activeSubTab === "video" ? "Video" : "Lý thuyết"}
            title="Mục lục"
            buttonClassName="h-9 w-auto px-2.5 text-xs sm:h-10 sm:px-3 sm:text-sm"
            anchorPrefix={activeSubTab === "video" ? "student-video-summary" : undefined}
            onSectionClick={(id, section) => {
              if (activeSubTab === "video" && section) {
                const startSeconds =
                  section.startSeconds ??
                  section.blocks?.find((block) => Number.isFinite(block.startSeconds))
                    ?.startSeconds;
                if (Number.isFinite(startSeconds)) {
                  onVideoSeek(Math.max(0, startSeconds! - videoStartTimeOffsetSeconds));
                }

                scrollToSummaryAnchor(
                  videoViewMode === "segment"
                    ? "student-video-summary-active-section-0"
                    : id,
                );
                return;
              }

              scrollToSummaryAnchor(id);
            }}
            onCustomItemClick={(id) => {
              scrollToSummaryAnchor(id);
            }}
          />
        ) : null}
      </div>

      <div
        className={cn(
          "mt-3 flex flex-col gap-3 sm:mt-4",
          activeSubTab === "video" ? "mb-0" : "mb-2",
        )}
      >
        <div className="flex w-full items-center gap-1 rounded-full border border-slate-200 bg-slate-100/80 p-1.5 dark:border-slate-700 dark:bg-slate-800/50">
          <button
            type="button"
            onClick={() => selectActiveSubTab("video")}
            className={cn(
              "flex-1 min-w-0 truncate rounded-full px-2 py-2 text-center text-[15px] font-bold transition-all sm:px-6 sm:py-2.5 sm:text-[17px]",
              activeSubTab === "video"
                ? "bg-white text-sky-700 shadow-[0_1px_3px_rgba(0,0,0,0.1)] dark:bg-slate-700 dark:text-sky-400"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:text-slate-300 dark:hover:bg-slate-700/50",
            )}
          >
            Video
          </button>
          <button
            type="button"
            onClick={() => selectActiveSubTab("theory")}
            className={cn(
              "flex-1 min-w-0 truncate rounded-full px-2 py-2 text-center text-[15px] font-bold transition-all sm:px-6 sm:py-2.5 sm:text-[17px]",
              activeSubTab === "theory"
                ? "bg-white text-sky-700 shadow-[0_1px_3px_rgba(0,0,0,0.1)] dark:bg-slate-700 dark:text-sky-400"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:text-slate-300 dark:hover:bg-slate-700/50",
            )}
          >
            Lý thuyết
          </button>
          <button
            type="button"
            onClick={() => selectActiveSubTab("exercises")}
            className={cn(
              "flex-1 min-w-0 truncate rounded-full px-2 py-2 text-center text-[15px] font-bold transition-all sm:px-6 sm:py-2.5 sm:text-[17px]",
              activeSubTab === "exercises"
                ? "bg-white text-sky-700 shadow-[0_1px_3px_rgba(0,0,0,0.1)] dark:bg-slate-700 dark:text-sky-400"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:text-slate-300 dark:hover:bg-slate-700/50",
            )}
          >
            Bài tập
          </button>
        </div>
      </div>

      {activeSubTab === "video" && videoSummaryData ? (
        <div
          className="mt-2 mb-2 grid grid-cols-2 rounded-full border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-700 dark:bg-slate-800/50"
          role="group"
          aria-label="Chế độ xem Tổng quan video"
        >
          {(
            [
              { id: "all", label: "Tất cả" },
              { id: "segment", label: "Từng phần" },
            ] as const
          ).map((mode) => {
            const isActive = videoViewMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => setVideoViewMode(mode.id)}
                className={cn(
                  "cursor-pointer rounded-full border border-transparent px-3 py-1.5 text-xs font-bold transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 sm:py-2 sm:text-sm",
                  isActive
                    ? "bg-white text-sky-700 shadow-sm dark:bg-slate-700 dark:text-sky-400"
                    : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700/50 dark:hover:text-slate-300",
                )}
              >
                {mode.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {activeSubTab === "video" ? (
        visibleVideoSummaryData && visibleVideoSummaryData.sections.length > 0 ? (
          videoViewMode === "all" ? (
            <SummaryBlockRenderer
              anchorPrefix="student-video-summary"
              className="mt-0 pt-0 [&_[data-video-start-label-prefix]]:hidden"
              data={visibleVideoSummaryData}
              hideTitle
              hideObjectives={!hasCompleteVideoSummarySectionCoverage}
              objectivesLabel="Kiến thức bài giảng"
              onVideoSeek={onVideoSeek}
              videoStartTimeOffsetSeconds={videoStartTimeOffsetSeconds}
              videoEndTimeSeconds={videoPlaybackEndTimeInSeconds}
              filterVideoTimelineByPlaybackWindow
              viewMode="UI_ONLY"
            />
          ) : activeVideoSummaryData ? (
            <SummaryBlockRenderer
              anchorPrefix="student-video-summary-active"
              className="mt-0 pt-0"
              data={activeVideoSummaryData}
              hideObjectives
              hideTitle
              onVideoSeek={onVideoSeek}
              videoStartTimeOffsetSeconds={videoStartTimeOffsetSeconds}
              videoEndTimeSeconds={videoPlaybackEndTimeInSeconds}
              filterVideoTimelineByPlaybackWindow
              preserveDisplayNumbers
              viewMode="UI_ONLY"
            />
          ) : (
            <div className="rounded-xl border border-dashed border-sky-200 bg-sky-50/70 px-4 py-5 text-center text-sm font-semibold leading-6 text-slate-500 dark:border-sky-500/25 dark:bg-sky-950/20 dark:text-slate-400">
              Nội dung tương ứng sẽ hiển thị khi video được phát.
            </div>
          )
        ) : hasVideoSummaryDocument ? (
          <TiptapContentView
            content={
              videoSummaryContent?.type === "doc" ? videoSummaryContent : undefined
            }
            className="mt-0 pt-0"
          />
        ) : (
          <p className="mt-3 text-center text-sm font-semibold leading-6 text-slate-500 dark:text-[var(--theme-text-muted)] sm:mt-4 lg:text-base lg:leading-7">
            Chưa có bản tóm tắt video.
          </p>
        )
      ) : !hasTheoryData && activeSubTab === "theory" ? (
        <p className="mt-3 text-center text-sm font-semibold leading-6 text-slate-500 dark:text-[var(--theme-text-muted)] sm:mt-4 lg:text-base lg:leading-7">
          Chưa có bản lý thuyết sách giáo khoa.
        </p>
      ) : !hasExerciseData && activeSubTab === "exercises" ? (
        <p className="mt-3 text-center text-sm font-semibold leading-6 text-slate-500 dark:text-[var(--theme-text-muted)] sm:mt-4 lg:text-base lg:leading-7">
          Chưa có bài tập mẫu.
        </p>
      ) : lesson.summary ? (
        isBlocksFormat ? (
          filteredData ? (
            <SummaryBlockRenderer
              data={filteredData}
              displayTitle={lesson.title}
              hideTitle
              viewMode="UI_ONLY"
              hideObjectives={activeSubTab === "exercises"}
              hideSectionHeadings={activeSubTab === "exercises"}
              className="mt-2 pt-0 sm:pt-2"
              onVideoSeek={onVideoSeek}
            />
          ) : null
        ) : (
          <TiptapContentView
            content={content?.type === "doc" ? content : undefined}
            className="mt-3 sm:mt-4"
          />
        )
      ) : (
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600 dark:text-[var(--theme-text-muted)] sm:mt-4 lg:text-base lg:leading-7">
          Bài học này chưa có bản kiến thức trọng tâm.
        </p>
      )}
    </section>
  );
}
