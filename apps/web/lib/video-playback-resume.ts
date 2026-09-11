import { formatVideoTime } from "@/lib/video-player-time";

const MINIMUM_RESUME_SECONDS = 1;
const END_OF_VIDEO_GUARD_SECONDS = 2;

export function resolveVideoResumePosition(
  positionSeconds: number | null | undefined,
  durationInSeconds?: number,
) {
  if (
    typeof positionSeconds !== "number" ||
    !Number.isFinite(positionSeconds) ||
    positionSeconds < MINIMUM_RESUME_SECONDS
  ) {
    return null;
  }

  if (
    typeof durationInSeconds === "number" &&
    Number.isFinite(durationInSeconds) &&
    durationInSeconds > 0 &&
    positionSeconds >= durationInSeconds - END_OF_VIDEO_GUARD_SECONDS
  ) {
    return null;
  }

  return Math.max(0, positionSeconds);
}

export function getVideoResumePromptLines(positionSeconds: number) {
  return [
    `Bạn đã xem đến mốc thời gian ${formatVideoTime(positionSeconds)}.`,
    "Nhấn để tiếp tục học.",
  ] as const;
}

export function getVideoProgressStorageKey({
  lessonId,
  timelineVersion,
  userId,
}: {
  lessonId: string;
  timelineVersion: string;
  userId: string;
}) {
  return `classhero.student.video-progress.v1:${userId}:${lessonId}:${timelineVersion}`;
}

export type StoredVideoProgress = {
  positionSeconds: number;
  savedAt: string;
};

export function parseStoredVideoProgress(
  value: string | null,
): StoredVideoProgress | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<StoredVideoProgress>;
    if (
      typeof parsed.positionSeconds !== "number" ||
      !Number.isFinite(parsed.positionSeconds) ||
      parsed.positionSeconds < 0 ||
      typeof parsed.savedAt !== "string" ||
      !Number.isFinite(Date.parse(parsed.savedAt))
    ) {
      return null;
    }

    return {
      positionSeconds: parsed.positionSeconds,
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
}
