export type VideoSourceBounds = {
  startTimeInSeconds: number;
  endTimeInSeconds: number;
};

export type VideoPlaybackWindow = VideoSourceBounds & {
  durationInSeconds: number;
};

export type VideoTimelineChapter = {
  time: number;
  title: string;
};

export type VideoTimelineSegment = {
  time: number;
  endTime?: number;
  text: string;
};

export function resolveVideoSourceBounds(input: {
  sourceDurationInSeconds: number;
  startTimeInSeconds: number;
  endTimeCutInSeconds: number;
}): VideoSourceBounds {
  const sourceDuration = toNonNegativeFinite(input.sourceDurationInSeconds);
  const configuredStart = toNonNegativeFinite(input.startTimeInSeconds);
  const endCut = toNonNegativeFinite(input.endTimeCutInSeconds);
  const startTimeInSeconds =
    sourceDuration > 0 ? Math.min(configuredStart, sourceDuration) : configuredStart;
  const endTimeInSeconds =
    sourceDuration > 0
      ? Math.max(startTimeInSeconds, sourceDuration - endCut)
      : startTimeInSeconds;

  return { startTimeInSeconds, endTimeInSeconds };
}

export function resolveVideoPlaybackWindow(input: {
  sourceDurationInSeconds: number;
  startTimeInSeconds: number;
  endTimeCutInSeconds: number;
}): VideoPlaybackWindow {
  const sourceBounds = resolveVideoSourceBounds(input);

  return {
    ...sourceBounds,
    durationInSeconds: Math.max(
      0,
      sourceBounds.endTimeInSeconds - sourceBounds.startTimeInSeconds,
    ),
  };
}

export function resolveVideoPlaybackTime(
  sourceTimeInSeconds: number,
  playbackWindow: VideoPlaybackWindow,
) {
  const safeSourceTime = toNonNegativeFinite(sourceTimeInSeconds);
  const clampedSourceTime = Math.max(
    playbackWindow.startTimeInSeconds,
    Math.min(safeSourceTime, playbackWindow.endTimeInSeconds),
  );

  return clampedSourceTime - playbackWindow.startTimeInSeconds;
}

export function resolveVideoPlaybackOffsetTime(
  sourceTimeInSeconds: number,
  playbackStartTimeInSeconds: number,
) {
  return Math.max(
    0,
    toNonNegativeFinite(sourceTimeInSeconds) -
      toNonNegativeFinite(playbackStartTimeInSeconds),
  );
}

export function isVideoSourceTimeInPlaybackWindow(
  sourceTimeInSeconds: number,
  playbackWindow: VideoSourceBounds,
) {
  return (
    Number.isFinite(sourceTimeInSeconds) &&
    sourceTimeInSeconds >= playbackWindow.startTimeInSeconds &&
    sourceTimeInSeconds < playbackWindow.endTimeInSeconds
  );
}

export function resolveVideoPlaybackChapters(
  chapters: readonly VideoTimelineChapter[],
  playbackWindow: VideoPlaybackWindow,
) {
  const sortedChapters = chapters
    .filter(
      (chapter) =>
        Number.isFinite(chapter.time) && chapter.time >= 0 && chapter.title.trim(),
    )
    .map((chapter) => ({ ...chapter, title: chapter.title.trim() }))
    .sort((first, second) => first.time - second.time);
  const chapterAtPlaybackStart = sortedChapters
    .filter((chapter) => chapter.time <= playbackWindow.startTimeInSeconds)
    .at(-1);
  const chaptersInsideWindow = sortedChapters.filter(
    (chapter) =>
      chapter.time > playbackWindow.startTimeInSeconds &&
      chapter.time < playbackWindow.endTimeInSeconds,
  );

  return [
    ...(chapterAtPlaybackStart ? [{ ...chapterAtPlaybackStart, time: 0 }] : []),
    ...chaptersInsideWindow.map((chapter) => ({
      ...chapter,
      time: resolveVideoPlaybackOffsetTime(
        chapter.time,
        playbackWindow.startTimeInSeconds,
      ),
    })),
  ];
}

export function resolveVideoPlaybackTranscriptSegments(
  segments: readonly VideoTimelineSegment[],
  playbackStartTimeInSeconds: number,
  playbackEndTimeInSeconds = Number.MAX_SAFE_INTEGER,
) {
  const playbackStart = toNonNegativeFinite(playbackStartTimeInSeconds);
  const playbackEnd = Math.max(
    playbackStart,
    toNonNegativeFinite(playbackEndTimeInSeconds),
  );

  return segments
    .filter(
      (segment) =>
        Number.isFinite(segment.time) &&
        segment.time >= playbackStart &&
        segment.time < playbackEnd &&
        segment.text.trim(),
    )
    .sort((first, second) => first.time - second.time)
    .map((segment) => ({
      ...(segment.endTime !== undefined
        ? {
            endTime: resolveVideoPlaybackOffsetTime(segment.endTime, playbackStart),
          }
        : {}),
      time: resolveVideoPlaybackOffsetTime(segment.time, playbackStart),
      text: segment.text,
    }));
}

export function resolveVisibleVideoTimelineIndexes(
  sourceTimesInSeconds: readonly (number | undefined)[],
  playbackStartTimeInSeconds: number,
  playbackEndTimeInSeconds = Number.MAX_SAFE_INTEGER,
) {
  const playbackStart = toNonNegativeFinite(playbackStartTimeInSeconds);
  const playbackEnd = Math.max(
    playbackStart,
    toNonNegativeFinite(playbackEndTimeInSeconds),
  );
  const latestTimeAtStart = sourceTimesInSeconds.reduce<number | null>(
    (latestTime, sourceTime) =>
      typeof sourceTime === "number" &&
      Number.isFinite(sourceTime) &&
      sourceTime >= 0 &&
      sourceTime <= playbackStart &&
      (latestTime === null || sourceTime > latestTime)
        ? sourceTime
        : latestTime,
    null,
  );

  return sourceTimesInSeconds.flatMap((sourceTime, index) => {
    if (typeof sourceTime !== "number" || !Number.isFinite(sourceTime)) {
      return [index];
    }
    if (latestTimeAtStart !== null && sourceTime === latestTimeAtStart) {
      return [index];
    }
    return sourceTime > playbackStart && sourceTime < playbackEnd ? [index] : [];
  });
}

export function resolveVisibleVideoTimelineSectionIndexes(
  sections: readonly {
    blocks: readonly { startSeconds?: number }[];
  }[],
  playbackStartTimeInSeconds: number,
  playbackEndTimeInSeconds = Number.MAX_SAFE_INTEGER,
) {
  const timelineBlocks = sections.flatMap((section, sectionIndex) =>
    section.blocks.map((block) => ({
      sectionIndex,
      startSeconds: block.startSeconds,
    })),
  );
  const visibleSectionIndexes = new Set(
    resolveVisibleVideoTimelineIndexes(
      timelineBlocks.map((block) => block.startSeconds),
      playbackStartTimeInSeconds,
      playbackEndTimeInSeconds,
    ).map((blockIndex) => timelineBlocks[blockIndex]!.sectionIndex),
  );

  return sections.flatMap((_section, sectionIndex) =>
    visibleSectionIndexes.has(sectionIndex) ? [sectionIndex] : [],
  );
}

export function hasCompleteVideoTimelineSectionCoverage(
  sections: readonly {
    blocks: readonly { startSeconds?: number }[];
  }[],
  playbackStartTimeInSeconds: number,
  playbackEndTimeInSeconds = Number.MAX_SAFE_INTEGER,
) {
  if (sections.length === 0) return false;

  return (
    resolveVisibleVideoTimelineSectionIndexes(
      sections,
      playbackStartTimeInSeconds,
      playbackEndTimeInSeconds,
    ).length === sections.length
  );
}

export function renumberVideoPlaybackChapters(chapters: readonly VideoTimelineChapter[]) {
  return chapters.map((chapter, index) => ({
    ...chapter,
    title: `${index + 1}. ${chapter.title.replace(/^\s*\d+\s*(?:[.)\-:]\s*|\s+)/u, "").trim()}`,
  }));
}

export function formatVideoTime(seconds: number) {
  const safeSeconds = toNonNegativeFinite(seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = Math.floor(safeSeconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function toNonNegativeFinite(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}
