import { describe, expect, it } from "vitest";

import { lessonSummaryOutputSchema } from "#api/modules/ai/types/lesson-summary.types";
import { mapLessonSummaryToTiptap } from "#api/modules/ai/utils/lesson-summary-mapper";
import { buildLessonSummaryStructuredInput } from "#api/modules/ai/utils/lesson-summary-prompt";
import { buildAiUserPrompt } from "#api/modules/ai/utils/ai-prompt";

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

  it("supports disabled optional sections and builds the exact configurable prompt", () => {
    const parsed = lessonSummaryOutputSchema.parse({
      ...validSummary,
      sections: validSummary.sections.map((section) => ({
        ...section,
        keyFormulas: [],
        examples: [],
      })),
      commonMistakes: [],
      reviewQuestions: [],
    });
    const document = mapLessonSummaryToTiptap(parsed);
    expect(JSON.stringify(document)).not.toContain("Câu hỏi ôn tập");

    const request = buildLessonSummaryStructuredInput({
      lessonId: "lesson-1",
      lessonTitle: "Số hữu tỉ",
      documentIds: ["document-1"],
      sourceHash: "source-hash",
      chunks: [{ id: "chunk-1", content: "Nội dung tài liệu thực tế" }],
      configuration: {
        style: "academic",
        styleInstructions: "",
        length: "detailed",
        targetWordCount: 350,
        focus: "Định nghĩa",
        includeFormulas: false,
        includeExamples: false,
        includeCommonMistakes: false,
        contentSections: [],
        reviewQuestionCount: 0,
        extraInstructions: "Dùng tiêu đề ngắn",
      },
    });
    const fullInput = buildAiUserPrompt(request);

    expect(request.userPrompt).toContain("học thuật");
    expect(request.userPrompt).toContain("khoảng 350 từ");
    expect(request.userPrompt).toContain("Không tạo câu hỏi ôn tập");
    expect(request.userPrompt).toContain("Dùng tiêu đề ngắn");
    expect(fullInput).toContain("<context_chunks>");
    expect(fullInput).toContain("Nội dung tài liệu thực tế");
  });

  it("uses editable admin prompts and keeps context in the final provider input", () => {
    const request = buildLessonSummaryStructuredInput({
      lessonId: "lesson-1",
      lessonTitle: "Số hữu tỉ",
      documentIds: ["document-1"],
      sourceHash: "source-hash",
      chunks: [{ id: "chunk-1", content: "Nội dung nguồn" }],
      configuration: {
        style: "student_friendly",
        styleInstructions: "Dễ hiểu cho học sinh khối 7",
        length: "standard",
        targetWordCount: null,
        focus: "",
        includeFormulas: true,
        includeExamples: true,
        includeCommonMistakes: true,
        contentSections: ["FORMULAS", "EXAMPLES", "COMMON_MISTAKES"],
        reviewQuestionCount: 0,
        extraInstructions: "",
      },
      systemInstructions: "SYSTEM DO ADMIN SỬA",
      userPrompt: "USER DO ADMIN SỬA",
    });

    expect(request.systemPrompt).toBe("SYSTEM DO ADMIN SỬA");
    expect(request.userPrompt).toBe("USER DO ADMIN SỬA");
    expect(buildAiUserPrompt(request)).toContain("<context_chunks>");
    expect(buildAiUserPrompt(request)).toContain("Nội dung nguồn");
  });
});
