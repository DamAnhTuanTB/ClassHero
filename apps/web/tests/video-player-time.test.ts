import assert from "node:assert/strict";
import test from "node:test";

import {
  formatVideoTime,
  hasCompleteVideoTimelineSectionCoverage,
  isVideoSourceTimeInPlaybackWindow,
  renumberVideoPlaybackChapters,
  resolveVideoPlaybackChapters,
  resolveVideoPlaybackOffsetTime,
  resolveVideoPlaybackTime,
  resolveVideoPlaybackTranscriptSegments,
  resolveVideoPlaybackWindow,
  resolveVideoSourceBounds,
  resolveVisibleVideoTimelineIndexes,
  resolveVisibleVideoTimelineSectionIndexes,
} from "@/lib/video-player-time";

test("quy đổi đúng mốc bắt đầu và kết thúc trong video gốc", () => {
  assert.deepEqual(
    resolveVideoSourceBounds({
      sourceDurationInSeconds: 10 * 60,
      startTimeInSeconds: 60,
      endTimeCutInSeconds: 60,
    }),
    {
      startTimeInSeconds: 60,
      endTimeInSeconds: 9 * 60,
    },
  );
});

test("giới hạn mốc gốc trong thời lượng nguồn và định dạng an toàn", () => {
  assert.deepEqual(
    resolveVideoSourceBounds({
      sourceDurationInSeconds: 120,
      startTimeInSeconds: 150,
      endTimeCutInSeconds: 30,
    }),
    {
      startTimeInSeconds: 120,
      endTimeInSeconds: 120,
    },
  );
  assert.equal(formatVideoTime(60), "1:00");
  assert.equal(formatVideoTime(9 * 60), "9:00");
  assert.equal(formatVideoTime(Number.NaN), "0:00");
});

test("timeline sau cắt bắt đầu từ 0 và dùng đúng thời lượng còn lại", () => {
  const playbackWindow = resolveVideoPlaybackWindow({
    sourceDurationInSeconds: 10 * 60,
    startTimeInSeconds: 2 * 60,
    endTimeCutInSeconds: 2.5 * 60,
  });

  assert.deepEqual(playbackWindow, {
    startTimeInSeconds: 2 * 60,
    endTimeInSeconds: 7.5 * 60,
    durationInSeconds: 5.5 * 60,
  });
  assert.equal(resolveVideoPlaybackTime(2 * 60, playbackWindow), 0);
  assert.equal(resolveVideoPlaybackTime(3 * 60, playbackWindow), 60);
  assert.equal(resolveVideoPlaybackTime(8 * 60, playbackWindow), 5.5 * 60);
});

test("dịch chapter nguồn sang timeline sau cắt và giữ chapter đang diễn ra", () => {
  const playbackWindow = resolveVideoPlaybackWindow({
    sourceDurationInSeconds: 100,
    startTimeInSeconds: 20,
    endTimeCutInSeconds: 20,
  });

  assert.equal(resolveVideoPlaybackOffsetTime(40, 20), 20);
  assert.deepEqual(
    resolveVideoPlaybackChapters(
      [
        { time: 0, title: "Giới thiệu" },
        { time: 15, title: "Phần đang học" },
        { time: 40, title: "Phần tiếp theo" },
        { time: 80, title: "Ngoài đoạn phát" },
      ],
      playbackWindow,
    ),
    [
      { time: 0, title: "Phần đang học" },
      { time: 20, title: "Phần tiếp theo" },
    ],
  );
});

test("loại transcript trước đoạn cắt thay vì dồn nhiều cue về 0:00", () => {
  assert.deepEqual(
    resolveVideoPlaybackTranscriptSegments(
      [
        { time: 0, endTime: 4, text: "Intro" },
        { time: 5, endTime: 7, text: "Bắt đầu" },
        { time: 8.5, endTime: 10, text: "Nội dung" },
        { time: 12, endTime: 13, text: "Outro đã cắt" },
      ],
      5,
      12,
    ),
    [
      { time: 0, endTime: 2, text: "Bắt đầu" },
      { time: 3.5, endTime: 5, text: "Nội dung" },
    ],
  );
});

test("phân loại timestamp nguồn ở trong và ngoài khoảng phát", () => {
  const playbackWindow = {
    startTimeInSeconds: 5,
    endTimeInSeconds: 78,
  };

  assert.equal(isVideoSourceTimeInPlaybackWindow(4.999, playbackWindow), false);
  assert.equal(isVideoSourceTimeInPlaybackWindow(5, playbackWindow), true);
  assert.equal(isVideoSourceTimeInPlaybackWindow(77.999, playbackWindow), true);
  assert.equal(isVideoSourceTimeInPlaybackWindow(78, playbackWindow), false);
});

test("giữ block bị cắt một phần tại mốc 0 và các block phía sau", () => {
  assert.deepEqual(
    resolveVisibleVideoTimelineIndexes([0, 104, 159, 1_560, 1_560, 1_840], 1_800, 1_900),
    [3, 4, 5],
  );
  assert.equal(resolveVideoPlaybackOffsetTime(1_560, 1_800), 0);
  assert.equal(resolveVideoPlaybackOffsetTime(1_840, 1_800), 40);
});

test("xác nhận đủ đề mục lớn khi mỗi section còn ít nhất một block hiển thị", () => {
  assert.equal(
    hasCompleteVideoTimelineSectionCoverage(
      [
        { blocks: [{ startSeconds: 0 }, { startSeconds: 120 }] },
        { blocks: [{ startSeconds: 240 }] },
        { blocks: [{ startSeconds: 360 }] },
      ],
      100,
      500,
    ),
    true,
  );
});

test("thiếu đề mục lớn khi một section bị cắt hoàn toàn", () => {
  assert.equal(
    hasCompleteVideoTimelineSectionCoverage(
      [
        { blocks: [{ startSeconds: 0 }, { startSeconds: 120 }] },
        { blocks: [{ startSeconds: 180 }, { startSeconds: 240 }] },
        { blocks: [{ startSeconds: 360 }] },
      ],
      200,
      500,
    ),
    false,
  );
});

test("coi section rỗng là chưa đủ đề mục lớn", () => {
  assert.equal(
    hasCompleteVideoTimelineSectionCoverage(
      [{ blocks: [{ startSeconds: 0 }] }, { blocks: [] }],
      0,
      500,
    ),
    false,
  );
});

test("trả section còn hiển thị theo đúng thứ tự để đánh số lại từ 1", () => {
  assert.deepEqual(
    resolveVisibleVideoTimelineSectionIndexes(
      [
        { blocks: [{ startSeconds: 0 }, { startSeconds: 120 }] },
        { blocks: [{ startSeconds: 180 }, { startSeconds: 240 }] },
        { blocks: [{ startSeconds: 360 }] },
      ],
      200,
      500,
    ),
    [1, 2],
  );
});

test("đánh số lại chapter sau cắt từ 1 và bỏ số thứ tự nguồn", () => {
  assert.deepEqual(
    renumberVideoPlaybackChapters([
      { time: 0, title: "4. Vận dụng" },
      { time: 60, title: "5) Ôn tập" },
      { time: 120, title: "Mở rộng" },
    ]),
    [
      { time: 0, title: "1. Vận dụng" },
      { time: 60, title: "2. Ôn tập" },
      { time: 120, title: "3. Mở rộng" },
    ],
  );
});
