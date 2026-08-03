import { describe, expect, it } from "vitest";

import { lessonSummaryOutputSchema } from "#api/modules/ai/types/lesson-summary.types";
import { mapLessonSummaryToTiptap } from "#api/modules/ai/utils/lesson-summary-mapper";

const validSummary = {
  title: "Số hữu tỉ",
  objectives: ["Nhận biết số hữu tỉ"],
  sections: [
    {
      heading: "Khái niệm",
      content: "Số hữu tỉ viết được dưới dạng phân số.",
      keyFormulas: ["x = \\frac{a}{b}, b \\ne 0"],
      examples: ["\\frac{1}{2} là số hữu tỉ."],
    },
  ],
  commonMistakes: ["Quên điều kiện b khác 0."],
  reviewQuestions: ["Số hữu tỉ là gì?"],
};

describe("M9.2 lesson summary schema and Tiptap mapper", () => {
  it("validates structured output and maps every learning section", () => {
    const parsed = lessonSummaryOutputSchema.parse(validSummary);
    const document = mapLessonSummaryToTiptap(parsed);

    expect(document.type).toBe("doc");
    expect(document.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "heading", attrs: { level: 1 } }),
        expect.objectContaining({ type: "bulletList" }),
      ]),
    );
    expect(JSON.stringify(document)).toContain("Câu hỏi ôn tập");
    expect(JSON.stringify(document)).toContain("\\\\frac{a}{b}");
  });

  it("rejects incomplete or oversized structured output", () => {
    expect(() =>
      lessonSummaryOutputSchema.parse({
        ...validSummary,
        objectives: [],
      }),
    ).toThrow();
    expect(() =>
      lessonSummaryOutputSchema.parse({
        ...validSummary,
        unexpected: true,
      }),
    ).toThrow();
  });
});
