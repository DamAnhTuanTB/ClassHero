import { describe, expect, it } from "vitest";
import {
  buildVideoTimelineVersion,
  serializeVideoPlaybackProgress,
} from "#api/modules/student-learning/utils/video-playback-progress";

describe("M15.1 video playback progress", () => {
  it("keeps the version stable for non-timeline UI settings", () => {
    const base = buildVideoTimelineVersion(" https://youtu.be/demo ", {
      startTimeInSeconds: 5,
      endTimeCutInSeconds: 22,
      hasWatermark: true,
    });
    const changedWatermark = buildVideoTimelineVersion("https://youtu.be/demo", {
      startTimeInSeconds: 5,
      endTimeCutInSeconds: 22,
      hasWatermark: false,
    });

    expect(base).toBe(changedWatermark);
    expect(buildVideoTimelineVersion("https://youtu.be/demo", null)).toBe(base);
  });

  it("invalidates saved progress when the source or playback cuts change", () => {
    const base = buildVideoTimelineVersion("https://youtu.be/demo", {
      startTimeInSeconds: 5,
      endTimeCutInSeconds: 22,
    });

    expect(
      buildVideoTimelineVersion("https://youtu.be/another", {
        startTimeInSeconds: 5,
        endTimeCutInSeconds: 22,
      }),
    ).not.toBe(base);
    expect(
      buildVideoTimelineVersion("https://youtu.be/demo", {
        startTimeInSeconds: 10,
        endTimeCutInSeconds: 22,
      }),
    ).not.toBe(base);
  });

  it("returns only progress that belongs to the current timeline", () => {
    const updatedAt = new Date("2026-09-11T03:00:00.000Z");
    const progress = {
      lastPositionSeconds: 1203,
      timelineVersion: "current",
      updatedAt,
    };

    expect(serializeVideoPlaybackProgress("current", progress)).toEqual({
      lastPositionSeconds: 1203,
      timelineVersion: "current",
      updatedAt,
    });
    expect(serializeVideoPlaybackProgress("changed", progress)).toEqual({
      lastPositionSeconds: null,
      timelineVersion: "changed",
      updatedAt: null,
    });
  });
});
