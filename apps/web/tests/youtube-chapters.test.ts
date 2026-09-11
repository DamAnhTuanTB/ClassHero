import assert from "node:assert/strict";
import test from "node:test";
import { normalizeYoutubeChapterTitles } from "@/lib/youtube-chapters";

test("removes source ordinals because chapter order is stored separately", () => {
  assert.deepEqual(
    normalizeYoutubeChapterTitles([
      { time: 926, title: "2. Hệ hai phương trình bậc nhất hai ẩn" },
      { time: 0, title: "Giới thiệu" },
      { time: 153, title: "1. Phương trình bậc nhất hai ẩn" },
    ]),
    [
      { time: 0, title: "Giới thiệu" },
      { time: 153, title: "Phương trình bậc nhất hai ẩn" },
      { time: 926, title: "Hệ hai phương trình bậc nhất hai ẩn" },
    ],
  );
});

test("keeps title content and normalizes common ordinal separators", () => {
  assert.deepEqual(
    normalizeYoutubeChapterTitles([
      { time: 0, title: "  0) Mở đầu  " },
      { time: 10, title: "4 - Ví dụ 2 biến" },
      { time: 20, title: "Tổng kết chương 1" },
      { time: 30, title: "1.000 năm lịch sử" },
    ]).map((chapter) => chapter.title),
    ["Mở đầu", "Ví dụ 2 biến", "Tổng kết chương 1", "1.000 năm lịch sử"],
  );
});
