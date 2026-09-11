import { expect, test } from "@playwright/test";

import {
  applyLessonSummaryBlockEditorValues,
  createLessonSummaryBlockEditorValues,
} from "@/features/admin/ai-generation/utils/lesson-summary-block-editor";

test.describe("lesson summary block Tiptap editor", () => {
  test("normalizes three-point angles before showing them in Tiptap", () => {
    const values = createLessonSummaryBlockEditorValues({
      type: "theorem",
      title: "Tổng hai góc đối",
      content: String.raw`Ta có $m\angle DAB+m\widehat{BCD}=180^\circ$.`,
    });

    expect(values.content).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Ta có " },
            {
              type: "inlineMath",
              attrs: {
                latex: String.raw`\widehat{DAB}+\widehat{BCD}=180^\circ`,
              },
            },
            { type: "text", text: "." },
          ],
        },
      ],
    });
  });

  test("preserves the original raw block when normalized editor content is unchanged", () => {
    const block = {
      type: "theorem" as const,
      title: "Tổng hai góc đối",
      content: String.raw`Ta có $\angle DAB+\angle BCD=180^\circ$.`,
      sourcePageNumbers: [71],
    };

    expect(
      applyLessonSummaryBlockEditorValues(
        block,
        createLessonSummaryBlockEditorValues(block),
      ),
    ).toEqual(block);
  });

  test("shows and updates the original-video start time for timed blocks", () => {
    const block = {
      type: "knowledge" as const,
      title: "Hệ hai phương trình bậc nhất",
      content: "Nội dung kiến thức.",
      startSeconds: 75.25,
    };
    const values = createLessonSummaryBlockEditorValues(block);

    expect(values.startTimeEnabled).toBe(true);
    expect(values.startTime).toBe("1:15");
    expect(applyLessonSummaryBlockEditorValues(block, values)).toEqual(block);
    expect(
      applyLessonSummaryBlockEditorValues(
        block,
        {
          ...values,
          originalStartTime: "1:02:03",
        },
        { preferOriginalStartTime: true },
      ),
    ).toMatchObject({ startSeconds: 3_723 });
  });

  test("edits the original time while preserving the derived post-cut time", () => {
    const block = {
      type: "knowledge" as const,
      title: "Hệ hai phương trình bậc nhất",
      content: "Nội dung kiến thức.",
      startSeconds: 2_026.5,
    };
    const values = createLessonSummaryBlockEditorValues(block, {
      startTimeOffsetSeconds: 5,
    });

    expect(values.startTime).toBe("33:41");
    expect(
      applyLessonSummaryBlockEditorValues(block, values, {
        startTimeOffsetSeconds: 5,
      }),
    ).toEqual(block);
    expect(
      applyLessonSummaryBlockEditorValues(
        block,
        { ...values, originalStartTime: "34:05" },
        { preferOriginalStartTime: true, startTimeOffsetSeconds: 5 },
      ),
    ).toMatchObject({ startSeconds: 2_045 });
  });

  test("edits original time directly for a hidden video block", () => {
    const block = {
      type: "knowledge" as const,
      title: "Khối ẩn",
      content: "Nội dung ngoài khoảng phát.",
      startSeconds: 1_700,
    };
    const values = createLessonSummaryBlockEditorValues(block, {
      isVideoTimelineHidden: true,
      startTimeOffsetSeconds: 1_800,
    });

    expect(values.startTime).toBe("0:00");
    expect(values.originalStartTime).toBe("28:20");
    expect(
      applyLessonSummaryBlockEditorValues(
        block,
        { ...values, originalStartTime: "30:08" },
        {
          isVideoTimelineHidden: true,
          startTimeOffsetSeconds: 1_800,
        },
      ),
    ).toMatchObject({ startSeconds: 1_808 });
  });

  test("does not add a start time to ordinary lesson-summary blocks", () => {
    const block = {
      type: "knowledge" as const,
      title: "Hệ hai phương trình bậc nhất",
      content: "Nội dung kiến thức.",
    };
    const values = createLessonSummaryBlockEditorValues(block);

    expect(values.startTimeEnabled).toBe(false);
    expect(values.startTime).toBe("");
    expect(applyLessonSummaryBlockEditorValues(block, values)).toEqual(block);
  });

  test("preserves an unchanged hypothesis/conclusion statement", () => {
    const block = {
      type: "example" as const,
      problem: "Chứng minh hai góc bằng nhau.",
      solution: "Dùng các giả thiết đã cho.",
      answer: "Hai góc bằng nhau.",
      isGeometry: true,
      geometryStatement: {
        hypotheses: ["Tam giác $ABC$ cân tại $A$.", "Điểm $M$ là trung điểm."],
        conclusions: [String.raw`$\widehat{ABM}=\widehat{ACM}$.`],
      },
    };

    expect(
      applyLessonSummaryBlockEditorValues(
        block,
        createLessonSummaryBlockEditorValues(block),
        { updateGeometryStatement: true },
      ),
    ).toEqual(block);
  });

  test("removes the hypothesis/conclusion statement for a math block", () => {
    const block = {
      type: "example" as const,
      problem: "Chứng minh hai góc bằng nhau.",
      solution: "Dùng các giả thiết đã cho.",
      answer: "Hai góc bằng nhau.",
      isGeometry: true,
      geometryStatement: {
        hypotheses: ["Tam giác $ABC$ cân tại $A$."],
        conclusions: [String.raw`$\widehat{ABC}=\widehat{ACB}$.`],
      },
    };
    const removedValues = {
      ...createLessonSummaryBlockEditorValues(block),
      geometryStatementEnabled: false,
    };
    const removed = applyLessonSummaryBlockEditorValues(block, removedValues, {
      updateGeometryStatement: true,
    });

    expect(removed).not.toHaveProperty("geometryStatement");
    expect(removed.isGeometry).toBe(false);
  });

  test("does not alter GT/KL data when the subject does not support the control", () => {
    const block = {
      type: "example" as const,
      problem: "Bài toán.",
      solution: "Lời giải.",
      answer: "Đáp án.",
      geometryStatement: {
        hypotheses: ["Dữ kiện"],
        conclusions: ["Kết quả"],
      },
    };
    const values = {
      ...createLessonSummaryBlockEditorValues(block),
      geometryStatementEnabled: false,
    };

    expect(applyLessonSummaryBlockEditorValues(block, values)).toEqual(block);
  });
});
