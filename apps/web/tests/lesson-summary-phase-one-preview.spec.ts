import { expect, test } from "@playwright/test";

import type { AdminLessonSummaryContent } from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import {
  applyPhaseOneLayoutOperation,
  applyPhaseOneBlockPreview,
  applyPhaseOneBlocksPreview,
} from "@/features/admin/ai-generation/utils/lesson-summary-phase-one-preview";

test("xóa block khỏi raw và đánh lại block path trước khi lưu", () => {
  const result = applyPhaseOneLayoutOperation(
    {
      "sections.0.blocks.0": { title: "A" },
      "sections.0.blocks.1": { title: "B" },
      "sections.1.blocks.0": { title: "C" },
    },
    { type: "DELETE_BLOCK", sectionIndex: 0, blockIndex: 0 },
  );

  expect(result).toEqual({
    "sections.0.blocks.0": { title: "B" },
    "sections.1.blocks.0": { title: "C" },
  });
});

test("xóa heading thì gộp raw block vào section trước và đánh lại mọi path sau đó", () => {
  const result = applyPhaseOneLayoutOperation(
    {
      "sections.0.blocks.0": { title: "A" },
      "sections.1.blocks.0": { title: "B" },
      "sections.1.blocks.1": { title: "C" },
      "sections.2.blocks.0": { title: "D" },
    },
    { type: "MERGE_SECTION", sectionIndex: 1 },
  );

  expect(result).toEqual({
    "sections.0.blocks.0": { title: "A" },
    "sections.0.blocks.1": { title: "B" },
    "sections.0.blocks.2": { title: "C" },
    "sections.1.blocks.0": { title: "D" },
  });
});

test("cập nhật preview lý thuyết từ raw mà không mutate content đã lưu", () => {
  const content = createContent();
  const result = applyPhaseOneBlockPreview(content, "sections.0.blocks.0", {
    type: "property",
    title: "Tính chất mới",
    content: "Nội dung mới",
    sourcePageNumbers: [1],
    figures: [],
  });

  expect(readBlock(result, 0)).toMatchObject({
    type: "property",
    title: "Tính chất mới",
    content: "Nội dung mới",
  });
  expect(readBlock(result, 0).figures).toEqual(readBlock(content, 0).figures);
  expect(readBlock(content, 0)).toMatchObject({
    type: "knowledge",
    title: "Kiến thức cũ",
  });
});

test("cập nhật realtime nhiều block raw cho preview song song", () => {
  const result = applyPhaseOneBlocksPreview(createContent(), {
    "sections.0.blocks.0": {
      type: "knowledge",
      title: "Kiến thức mới",
      content: "Nội dung mới",
      sourcePageNumbers: [1],
      figures: [],
    },
    "sections.0.blocks.1": {
      type: "example",
      problem: "Đề bài mới",
      solution: "Lời giải mới",
      answer: "Đáp án mới",
      sourcePageNumbers: [1],
      origin: "SOURCE_ADAPTED",
      figures: [],
    },
  });

  expect(readBlock(result, 0).title).toBe("Kiến thức mới");
  expect(readBlock(result, 1)).toMatchObject({
    problem: "Đề bài mới",
    solution: "Lời giải mới",
    answer: "Đáp án mới",
  });
});

function createContent(): AdminLessonSummaryContent {
  return {
    type: "lesson_summary_blocks",
    version: 3,
    data: {
      sections: [
        {
          displayHeading: "Đề mục",
          blocks: [
            {
              type: "knowledge",
              title: "Kiến thức cũ",
              content: "Nội dung cũ",
              figures: [{ kind: "TEX_FIGURE", figureId: "figure-1" }],
            },
            {
              type: "example",
              problem: "Đề cũ",
              solution: "Lời giải cũ",
              answer: "Đáp án cũ",
              figures: [],
            },
          ],
        },
      ],
    },
  };
}

function readBlock(content: AdminLessonSummaryContent, blockIndex: number) {
  const data = content.type === "lesson_summary_blocks" ? content.data : {};
  return (
    data as {
      sections: Array<{ blocks: Array<Record<string, unknown>> }>;
    }
  ).sections[0]!.blocks[blockIndex]!;
}
