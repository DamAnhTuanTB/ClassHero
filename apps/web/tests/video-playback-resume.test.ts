import assert from "node:assert/strict";
import test from "node:test";
import {
  getVideoProgressStorageKey,
  getVideoResumePromptLines,
  parseStoredVideoProgress,
  resolveVideoResumePosition,
} from "@/lib/video-playback-resume";

test("hiển thị lời nhắc tiếp tục thành hai dòng", () => {
  assert.deepEqual(getVideoResumePromptLines(20 * 60 + 3), [
    "Bạn đã xem đến mốc thời gian 20:03.",
    "Nhấn để tiếp tục học.",
  ]);
});

test("chỉ resume tiến độ có ý nghĩa và xem lại từ đầu nếu đã ở cuối video", () => {
  assert.equal(resolveVideoResumePosition(null, 100), null);
  assert.equal(resolveVideoResumePosition(0.9, 100), null);
  assert.equal(resolveVideoResumePosition(42.25, 100), 42.25);
  assert.equal(resolveVideoResumePosition(98, 100), null);
});

test("cache trình duyệt tách theo học sinh, lesson và phiên bản timeline", () => {
  const firstKey = getVideoProgressStorageKey({
    lessonId: "lesson-1",
    timelineVersion: "timeline-a",
    userId: "student-1",
  });
  const secondKey = getVideoProgressStorageKey({
    lessonId: "lesson-1",
    timelineVersion: "timeline-a",
    userId: "student-2",
  });

  assert.notEqual(firstKey, secondKey);
  assert.deepEqual(
    parseStoredVideoProgress(
      JSON.stringify({
        positionSeconds: 42.5,
        savedAt: "2026-09-11T03:00:00.000Z",
      }),
    ),
    {
      positionSeconds: 42.5,
      savedAt: "2026-09-11T03:00:00.000Z",
    },
  );
  assert.equal(parseStoredVideoProgress('{"positionSeconds":-1}'), null);
});
