import { describe, expect, it } from "vitest";
import {
  extractYoutubeVideoId,
  getPlaybackChapters,
  normalizeTranscriptSegments,
  readVideoChapters,
  resolveVideoPlaybackWindow,
  toTimestampedTranscriptSegments,
} from "#api/modules/learning-paths/services/youtube-transcript.service";

describe("M3.8 YouTube video transcript", () => {
  it("extracts supported YouTube video IDs", () => {
    expect(extractYoutubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
    expect(extractYoutubeVideoId("https://youtu.be/dQw4w9WgXcQ?t=3")).toBe("dQw4w9WgXcQ");
    expect(extractYoutubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
    expect(extractYoutubeVideoId("https://example.com/dQw4w9WgXcQ")).toBeNull();
  });

  it("normalizes transcript segments chronologically and removes empty duplicates", () => {
    expect(
      normalizeTranscriptSegments([
        { offset: 6.4, duration: 1, lang: "vi", text: "  Đoạn sau  " },
        { offset: 0, duration: 1, lang: "vi", text: "Chào các em" },
        { offset: 1, duration: 1, lang: "vi", text: "\n" },
        { offset: 6.5, duration: 1, lang: "vi", text: "Đoạn sau" },
      ]),
    ).toEqual([
      { endTime: 1, time: 0, text: "Chào các em" },
      { endTime: 7.4, time: 6.4, text: "Đoạn sau" },
    ]);
  });

  it("keeps the complete source transcript so the UI can disable trimmed cues", () => {
    expect(
      normalizeTranscriptSegments([
        { offset: 4.9, duration: 1, lang: "vi", text: "Phần intro" },
        { offset: 5, duration: 1, lang: "vi", text: "Bắt đầu bài học" },
        { offset: 77.9, duration: 1, lang: "vi", text: "Kết bài" },
        { offset: 78, duration: 1, lang: "vi", text: "Phần bị cắt cuối" },
      ]),
    ).toEqual([
      { endTime: 5.9, time: 4.9, text: "Phần intro" },
      { endTime: 6, time: 5, text: "Bắt đầu bài học" },
      { endTime: 78.9, time: 77.9, text: "Kết bài" },
      { endTime: 79, time: 78, text: "Phần bị cắt cuối" },
    ]);
  });

  it("resolves the same default trim window as the custom player", () => {
    expect(resolveVideoPlaybackWindow(null, 100)).toEqual({
      startTime: 5,
      endTime: 78,
    });
    expect(
      resolveVideoPlaybackWindow({ startTimeInSeconds: 12, endTimeCutInSeconds: 8 }, 100),
    ).toEqual({
      startTime: 12,
      endTime: 92,
    });
    expect(resolveVideoPlaybackWindow({ isDisabled: true }, 100)).toEqual({
      startTime: 0,
      endTime: 100,
    });
    expect(
      resolveVideoPlaybackWindow(
        { startTimeInSeconds: 80, endTimeCutInSeconds: 20 },
        100,
      ),
    ).toBeNull();
  });

  it("preserves each YouTube cue offset and duration", () => {
    expect(
      toTimestampedTranscriptSegments([
        { offset: 5.275, duration: 2.125, lang: "vi", text: "Hai đơn thức" },
        { offset: 7.425, duration: 2.755, lang: "vi", text: "có cùng phần biến." },
      ]),
    ).toEqual([
      { endTime: 7.4, time: 5.275, text: "Hai đơn thức" },
      { endTime: 10.18, time: 7.425, text: "có cùng phần biến." },
    ]);
  });

  it("does not split a long YouTube cue into estimated word timestamps", () => {
    expect(
      toTimestampedTranscriptSegments([
        {
          offset: 0,
          duration: 10,
          lang: "vi",
          text: "một hai ba bốn năm sáu bảy tám chín mười",
        },
      ]),
    ).toEqual([
      {
        endTime: 10,
        time: 0,
        text: "một hai ba bốn năm sáu bảy tám chín mười",
      },
    ]);
  });

  it("keeps distinct consecutive cues instead of merging their text", () => {
    expect(
      toTimestampedTranscriptSegments([
        {
          offset: 0,
          duration: 5,
          lang: "vi",
          text: "Xin chào tất cả các bạn",
        },
        {
          offset: 5,
          duration: 5,
          lang: "vi",
          text: "tất cả các bạn đến với bài học",
        },
      ]),
    ).toEqual([
      {
        endTime: 5,
        time: 0,
        text: "Xin chào tất cả các bạn",
      },
      {
        endTime: 10,
        time: 5,
        text: "tất cả các bạn đến với bài học",
      },
    ]);
  });

  it("maps source chapters to the trimmed timeline and keeps the active chapter", () => {
    const chapters = readVideoChapters({
      chapters: [
        { time: 0, title: "Giới thiệu" },
        { time: 15, title: "1. Đơn thức" },
        { time: 40, title: "2. Đơn thức đồng dạng" },
        { time: 90, title: "Ngoài khoảng phát" },
      ],
    });

    expect(getPlaybackChapters(chapters, { startTime: 20, endTime: 80 })).toEqual([
      { time: 0, title: "1. Đơn thức" },
      { time: 20, title: "2. Đơn thức đồng dạng" },
    ]);
  });
});
