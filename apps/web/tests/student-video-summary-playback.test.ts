import assert from "node:assert/strict";
import test from "node:test";
import {
  createActiveVideoSummaryBlockLocationStore,
  createVideoPlaybackSecondStore,
  findActiveVideoSummaryBlockLocation,
  getPlaybackVideoSummaryBlockEndSecond,
  getPlaybackVideoSummaryBlockDisplayNumber,
} from "@/features/student/lessons/utils/video-summary-playback";

const sections = [
  {
    blocks: [{ startSeconds: 24 }, { startSeconds: 32 }],
  },
  {
    blocks: [{ startSeconds: 127 }, {}],
  },
];

test("chưa chọn khối trước mốc thời gian đầu tiên", () => {
  assert.equal(findActiveVideoSummaryBlockLocation(sections, 23), null);
});

test("chọn đúng khối tại mốc bắt đầu và trong khoảng của khối", () => {
  assert.deepEqual(findActiveVideoSummaryBlockLocation(sections, 24), {
    blockIndex: 0,
    sectionIndex: 0,
  });
  assert.deepEqual(findActiveVideoSummaryBlockLocation(sections, 31.9), {
    blockIndex: 0,
    sectionIndex: 0,
  });
});

test("tính mốc kết thúc khối theo cue kế tiếp và điểm cắt video", () => {
  assert.equal(
    getPlaybackVideoSummaryBlockEndSecond(
      sections,
      { blockIndex: 0, sectionIndex: 0 },
      200,
    ),
    32,
  );
  assert.equal(
    getPlaybackVideoSummaryBlockEndSecond(
      sections,
      { blockIndex: 0, sectionIndex: 1 },
      140,
    ),
    140,
  );
  assert.equal(
    getPlaybackVideoSummaryBlockEndSecond(
      sections,
      { blockIndex: 0, sectionIndex: 0 },
      28,
    ),
    28,
  );
});

test("đổi sang khối tiếp theo tại đúng ranh giới", () => {
  assert.deepEqual(findActiveVideoSummaryBlockLocation(sections, 32), {
    blockIndex: 1,
    sectionIndex: 0,
  });
});

test("giữ khối cuối cùng đến hết video và bỏ qua block không có timestamp", () => {
  assert.deepEqual(findActiveVideoSummaryBlockLocation(sections, 3600), {
    blockIndex: 0,
    sectionIndex: 1,
  });
});

test("đánh lại số ví dụ từ 1 trong cửa sổ video sau khi cắt", () => {
  const numberedSections = [
    {
      blocks: [
        { type: "knowledge", startSeconds: 0 },
        { type: "example", startSeconds: 20 },
      ],
    },
    {
      blocks: [
        { type: "example", startSeconds: 40 },
        { type: "knowledge", startSeconds: 60 },
        { type: "example", startSeconds: 80 },
        { type: "example", startSeconds: 120 },
      ],
    },
  ];

  assert.equal(
    getPlaybackVideoSummaryBlockDisplayNumber(
      numberedSections,
      { blockIndex: 2, sectionIndex: 1 },
      60,
      150,
    ),
    1,
  );
  assert.equal(
    getPlaybackVideoSummaryBlockDisplayNumber(
      numberedSections,
      { blockIndex: 3, sectionIndex: 1 },
      60,
      150,
    ),
    2,
  );
});

test("không tự thêm số cho bài chỉ có một ví dụ", () => {
  assert.equal(
    getPlaybackVideoSummaryBlockDisplayNumber(
      [{ blocks: [{ type: "example", startSeconds: 10 }] }],
      { blockIndex: 0, sectionIndex: 0 },
      0,
    ),
    undefined,
  );
});

test("store giữ thời gian lẻ để không làm trễ cue trong cùng một giây", () => {
  const store = createVideoPlaybackSecondStore();
  let notificationCount = 0;
  const unsubscribe = store.subscribe(() => {
    notificationCount += 1;
  });

  store.setPlaybackTime(0.2);
  store.setPlaybackTime(0.2);
  store.setPlaybackTime(0.9);
  store.setPlaybackTime(1);
  store.setPlaybackTime(1.8);

  assert.equal(store.getSnapshot(), 1.8);
  assert.equal(notificationCount, 4);
  unsubscribe();
});

test("store active đổi đúng cue lẻ nhưng giữ snapshot khi vẫn cùng khối", () => {
  const playbackStore = createVideoPlaybackSecondStore();
  const activeStore = createActiveVideoSummaryBlockLocationStore(
    [
      {
        blocks: [{ startSeconds: 216 }, { startSeconds: 226.75 }],
      },
    ],
    playbackStore,
  );
  playbackStore.setPlaybackTime(216);
  const firstLocation = activeStore.getSnapshot();

  playbackStore.setPlaybackTime(226.7);
  assert.strictEqual(activeStore.getSnapshot(), firstLocation);

  playbackStore.setPlaybackTime(226.75);
  assert.deepEqual(activeStore.getSnapshot(), {
    blockIndex: 1,
    sectionIndex: 0,
  });
});
