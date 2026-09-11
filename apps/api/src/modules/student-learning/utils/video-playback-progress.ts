import { createHash } from "node:crypto";

type VideoTimelineSettings = {
  endTimeCutInSeconds?: unknown;
  isDisabled?: unknown;
  startTimeInSeconds?: unknown;
};

const DEFAULT_VIDEO_START_SECONDS = 5;
const DEFAULT_VIDEO_END_CUT_SECONDS = 22;

function readNonNegativeSeconds(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, value)
    : fallback;
}

export function buildVideoTimelineVersion(
  videoUrl: string | null | undefined,
  customVideoSettings: unknown,
) {
  const normalizedVideoUrl = videoUrl?.trim() ?? "";
  if (!normalizedVideoUrl) return null;

  const settings =
    typeof customVideoSettings === "object" && customVideoSettings !== null
      ? (customVideoSettings as VideoTimelineSettings)
      : {};
  const timelineIdentity = {
    endTimeCutInSeconds: readNonNegativeSeconds(
      settings.endTimeCutInSeconds,
      DEFAULT_VIDEO_END_CUT_SECONDS,
    ),
    isDisabled: settings.isDisabled === true,
    startTimeInSeconds: readNonNegativeSeconds(
      settings.startTimeInSeconds,
      DEFAULT_VIDEO_START_SECONDS,
    ),
    videoUrl: normalizedVideoUrl,
  };

  return createHash("sha256").update(JSON.stringify(timelineIdentity)).digest("hex");
}

export function serializeVideoPlaybackProgress(
  timelineVersion: string | null,
  progress: {
    lastPositionSeconds: number;
    timelineVersion: string;
    updatedAt: Date;
  } | null,
) {
  const isCurrentTimeline =
    timelineVersion !== null && progress?.timelineVersion === timelineVersion;

  return {
    lastPositionSeconds: isCurrentTimeline ? progress.lastPositionSeconds : null,
    timelineVersion,
    updatedAt: isCurrentTimeline ? progress.updatedAt : null,
  };
}
