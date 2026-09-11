import { resolveVisibleVideoTimelineIndexes } from "@/lib/video-player-time";

type TimedVideoSummaryBlock = {
  type?: string;
  startSeconds?: number;
};

type VideoSummarySection = {
  blocks: readonly TimedVideoSummaryBlock[];
};

export type ActiveVideoSummaryBlockLocation = {
  blockIndex: number;
  sectionIndex: number;
};

export function getPlaybackVideoSummaryBlockEndSecond(
  sections: readonly VideoSummarySection[],
  location: ActiveVideoSummaryBlockLocation,
  playbackEndTimeInSeconds?: number,
): number | undefined {
  const startSeconds =
    sections[location.sectionIndex]?.blocks[location.blockIndex]?.startSeconds;
  if (
    typeof startSeconds !== "number" ||
    !Number.isFinite(startSeconds) ||
    startSeconds < 0
  ) {
    return undefined;
  }

  const nextStartSeconds = sections
    .flatMap((section) => section.blocks)
    .map((block) => block.startSeconds)
    .filter(
      (seconds): seconds is number =>
        typeof seconds === "number" && Number.isFinite(seconds) && seconds > startSeconds,
    )
    .sort((first, second) => first - second)[0];
  const playbackEndSeconds =
    typeof playbackEndTimeInSeconds === "number" &&
    Number.isFinite(playbackEndTimeInSeconds) &&
    playbackEndTimeInSeconds >= startSeconds
      ? playbackEndTimeInSeconds
      : undefined;

  if (nextStartSeconds === undefined) return playbackEndSeconds;
  if (playbackEndSeconds === undefined) return nextStartSeconds;
  return Math.min(nextStartSeconds, playbackEndSeconds);
}

export function getPlaybackVideoSummaryBlockDisplayNumber(
  sections: readonly VideoSummarySection[],
  location: ActiveVideoSummaryBlockLocation,
  playbackStartTimeInSeconds: number,
  playbackEndTimeInSeconds = Number.MAX_SAFE_INTEGER,
): number | undefined {
  const targetBlock = sections[location.sectionIndex]?.blocks[location.blockIndex];
  if (!targetBlock?.type) return undefined;

  const totalBlocksOfType = sections.reduce(
    (total, section) =>
      total + section.blocks.filter((block) => block.type === targetBlock.type).length,
    0,
  );
  const shouldShowNumber =
    targetBlock.type === "exercise" ||
    (targetBlock.type === "example" && totalBlocksOfType > 1);
  if (!shouldShowNumber) return undefined;

  const timelineBlocks = sections.flatMap((section, sectionIndex) =>
    section.blocks.map((block, blockIndex) => ({
      block,
      blockIndex,
      sectionIndex,
    })),
  );
  const visibleTimelineIndexes = new Set(
    resolveVisibleVideoTimelineIndexes(
      timelineBlocks.map(({ block }) => block.startSeconds),
      playbackStartTimeInSeconds,
      playbackEndTimeInSeconds,
    ),
  );
  let displayNumber = 0;
  for (const [timelineIndex, timelineBlock] of timelineBlocks.entries()) {
    if (!visibleTimelineIndexes.has(timelineIndex)) continue;
    if (timelineBlock.block.type === targetBlock.type) displayNumber += 1;
    if (
      timelineBlock.sectionIndex === location.sectionIndex &&
      timelineBlock.blockIndex === location.blockIndex
    ) {
      return displayNumber || undefined;
    }
  }

  return undefined;
}

export type VideoPlaybackSecondStore = {
  getSnapshot: () => number;
  setPlaybackTime: (timeInSeconds: number) => void;
  subscribe: (listener: () => void) => () => void;
};

export type ActiveVideoSummaryBlockLocationStore = {
  getSnapshot: () => ActiveVideoSummaryBlockLocation | null;
  subscribe: (listener: () => void) => () => void;
};

export function createVideoPlaybackSecondStore(): VideoPlaybackSecondStore {
  let playbackTime = 0;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => playbackTime,
    setPlaybackTime: (timeInSeconds) => {
      if (!Number.isFinite(timeInSeconds)) return;
      const nextTime = Math.max(0, timeInSeconds);
      if (nextTime === playbackTime) return;

      playbackTime = nextTime;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function createActiveVideoSummaryBlockLocationStore(
  sections: readonly VideoSummarySection[],
  playbackStore: VideoPlaybackSecondStore,
  sourceStartTimeOffsetSeconds = 0,
): ActiveVideoSummaryBlockLocationStore {
  let cachedLocation = findActiveVideoSummaryBlockLocation(
    sections,
    playbackStore.getSnapshot() + sourceStartTimeOffsetSeconds,
  );

  return {
    getSnapshot: () => {
      const nextLocation = findActiveVideoSummaryBlockLocation(
        sections,
        playbackStore.getSnapshot() + sourceStartTimeOffsetSeconds,
      );
      if (isSameVideoSummaryBlockLocation(cachedLocation, nextLocation)) {
        return cachedLocation;
      }

      cachedLocation = nextLocation;
      return cachedLocation;
    },
    subscribe: playbackStore.subscribe,
  };
}

export function findActiveVideoSummaryBlockLocation(
  sections: readonly VideoSummarySection[],
  playbackSeconds: number,
): ActiveVideoSummaryBlockLocation | null {
  if (!Number.isFinite(playbackSeconds) || playbackSeconds < 0) return null;

  let activeLocation: ActiveVideoSummaryBlockLocation | null = null;
  let activeStartSeconds = Number.NEGATIVE_INFINITY;

  sections.forEach((section, sectionIndex) => {
    section.blocks.forEach((block, blockIndex) => {
      const startSeconds = block.startSeconds;
      if (
        typeof startSeconds !== "number" ||
        !Number.isFinite(startSeconds) ||
        startSeconds < 0 ||
        startSeconds > playbackSeconds ||
        startSeconds <= activeStartSeconds
      ) {
        return;
      }

      activeStartSeconds = startSeconds;
      activeLocation = { blockIndex, sectionIndex };
    });
  });

  return activeLocation;
}

function isSameVideoSummaryBlockLocation(
  first: ActiveVideoSummaryBlockLocation | null,
  second: ActiveVideoSummaryBlockLocation | null,
) {
  return (
    first === second ||
    (first?.blockIndex === second?.blockIndex &&
      first?.sectionIndex === second?.sectionIndex)
  );
}
