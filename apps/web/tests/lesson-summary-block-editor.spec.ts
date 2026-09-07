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
      content: String.raw`Ta có $\angle DAB+\angle BCD=180^\circ$.`,
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
