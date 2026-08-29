import {
  multiStatementCorrectAnswerSchema,
  multiStatementOptionsSchema,
  multipleChoiceOptionsSchema,
  textInputCorrectAnswerSchema,
  textInputGradingSchema,
  correctAnswerSchema,
} from "../src/modules/quiz/types/quiz.types";
import { tiptapContentSchema } from "@learning-path/shared";
import { QuizQuestionContentDto } from "../src/modules/quiz/dto/quiz-question-content.dto";
import { plainToInstance } from "class-transformer";
import { describe, it, expect } from "vitest";

describe("M6.1 Quiz Schema Validation", () => {
  describe("multipleChoiceOptionsSchema", () => {
    it("should preserve option objects during DTO implicit conversion", () => {
      const dto = plainToInstance(
        QuizQuestionContentDto,
        {
          questionType: "MULTIPLE_CHOICE",
          difficulty: "MEDIUM",
          questionJson: {
            type: "doc",
            content: [{ type: "paragraph" }],
          },
          optionsJson: [
            {
              id: "option-a",
              richText: {
                type: "doc",
                content: [
                  {
                    type: "paragraph",
                    attrs: { indent: null, textAlign: null },
                    content: [{ type: "text", text: "Màu vàng" }],
                  },
                ],
              },
            },
            {
              id: "option-b",
              richText: {
                type: "doc",
                content: [
                  {
                    type: "paragraph",
                    attrs: { indent: null, textAlign: null },
                    content: [{ type: "text", text: "Màu đỏ" }],
                  },
                ],
              },
            },
          ],
          correctAnswerJson: ["option-a"],
        },
        { enableImplicitConversion: true },
      );

      expect(dto.optionsJson?.some(Array.isArray)).toBe(false);
      expect(multipleChoiceOptionsSchema.safeParse(dto.optionsJson).success).toBe(true);
    });

    it("should validate valid options array", () => {
      const options = [
        { id: "A", richText: { type: "doc", content: [] } },
        {
          id: "B",
          richText: { type: "doc", content: [{ type: "text", text: "Answer" }] },
        },
        { id: "C", richText: { type: "doc", content: [] } },
        { id: "D", richText: { type: "doc", content: [] } },
        { id: "E", richText: { type: "doc", content: [] } },
      ];
      const result = multipleChoiceOptionsSchema.safeParse(options);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(5);
      }
    });

    it("should fail if less than 2 options", () => {
      const options = [{ id: "A", richText: { type: "doc" } }];
      const result = multipleChoiceOptionsSchema.safeParse(options);
      expect(result.success).toBe(false);
    });
  });

  describe("textInputGradingSchema", () => {
    it("should provide defaults", () => {
      const result = textInputGradingSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.caseSensitive).toBe(false);
        expect(result.data.exactMatch).toBe(true);
        expect(result.data.numericComparison).toBe(false);
      }
    });
  });

  describe("textInputCorrectAnswerSchema", () => {
    it("accepts exactly one canonical answer", () => {
      expect(textInputCorrectAnswerSchema.safeParse(["0.5"]).success).toBe(true);
      expect(textInputCorrectAnswerSchema.safeParse([]).success).toBe(false);
      expect(textInputCorrectAnswerSchema.safeParse(["0.5", "1/2"]).success).toBe(false);
    });
  });

  describe("multi-statement true/false schemas", () => {
    const statements = [
      {
        id: "statement-a",
        richText: {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "A" }] }],
        },
      },
      {
        id: "statement-b",
        richText: {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "B" }] }],
        },
      },
    ];

    it("should validate at least two rich-content statements", () => {
      expect(multiStatementOptionsSchema.safeParse(statements).success).toBe(true);
      expect(multiStatementOptionsSchema.safeParse(statements.slice(0, 1)).success).toBe(
        false,
      );
    });

    it("should validate one boolean answer mapping per statement", () => {
      const answers = [
        { statementId: "statement-a", value: true },
        { statementId: "statement-b", value: false },
      ];
      expect(multiStatementCorrectAnswerSchema.safeParse(answers).success).toBe(true);
      expect(correctAnswerSchema.safeParse(answers).success).toBe(true);
    });
  });

  describe("correctAnswerSchema", () => {
    it("should validate true/false answers", () => {
      expect(correctAnswerSchema.safeParse(true).success).toBe(true);
      expect(correctAnswerSchema.safeParse(false).success).toBe(true);
    });

    it("should validate string arrays for multiple choice / fill in blank", () => {
      expect(correctAnswerSchema.safeParse(["A", "C"]).success).toBe(true);
      expect(correctAnswerSchema.safeParse(["Hà Nội", "Thu đô"]).success).toBe(true);
    });

    it("should fail on empty array", () => {
      expect(correctAnswerSchema.safeParse([]).success).toBe(false);
    });

    it("should fail on non-string items in array", () => {
      expect(correctAnswerSchema.safeParse(["A", 1]).success).toBe(false);
    });
  });

  describe("rich quiz content", () => {
    it("should accept formatting, tables, editable images and scientific formulas", () => {
      const content = {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: {
              level: 2,
              textAlign: "center",
              indent: 2,
            },
            content: [
              {
                type: "text",
                text: "Bài toán",
                marks: [
                  { type: "bold" },
                  { type: "textStyle", attrs: { color: "#2563eb" } },
                ],
              },
            ],
          },
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [
                      { type: "text", text: "Định luật II Newton: " },
                      {
                        type: "inlineMath",
                        attrs: { latex: "\\vec{F}=m\\vec{a}" },
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            type: "blockMath",
            attrs: {
              latex: "\\ce{H2SO4 + 2NaOH -> Na2SO4 + 2H2O}",
            },
          },
          {
            type: "image",
            attrs: {
              fileId: "file-question-image",
              src: "https://cdn.example.com/question.webp",
              alt: "Sơ đồ thí nghiệm",
              alignment: "center",
              baseWidthPercent: 60,
              widthPercent: 72.5,
              sourceWidth: 1600,
              sourceHeight: 900,
              cropTop: 5,
              cropRight: 10,
              cropBottom: 4,
              cropLeft: 8,
            },
          },
          {
            type: "table",
            content: [
              {
                type: "tableRow",
                content: [
                  {
                    type: "tableHeader",
                    attrs: {
                      colspan: 1,
                      rowspan: 1,
                      colwidth: [180],
                      cellHeight: 52,
                    },
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "Đại lượng" }],
                      },
                    ],
                  },
                  {
                    type: "tableHeader",
                    attrs: {
                      colspan: 1,
                      rowspan: 1,
                      colwidth: [220],
                      cellHeight: 52,
                    },
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "Giá trị" }],
                      },
                    ],
                  },
                ],
              },
              {
                type: "tableRow",
                content: [
                  {
                    type: "tableCell",
                    attrs: {
                      colspan: 2,
                      rowspan: 1,
                      colwidth: [180, 220],
                      cellHeight: 64,
                    },
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "Ô đã gộp" }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      expect(tiptapContentSchema.safeParse(content).success).toBe(true);
    });
  });
});
