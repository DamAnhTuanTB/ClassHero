import { multipleChoiceOptionsSchema, textInputGradingSchema, correctAnswerSchema } from "../src/modules/quiz/types/quiz.types";
import { describe, it, expect } from "vitest";

describe("M6.1 Quiz Schema Validation", () => {
  describe("multipleChoiceOptionsSchema", () => {
    it("should validate valid options array", () => {
      const options = [
        { id: "A", richText: { type: "doc", content: [] } },
        { id: "B", richText: { type: "doc", content: [{ type: "text", text: "Answer" }] } },
      ];
      const result = multipleChoiceOptionsSchema.safeParse(options);
      expect(result.success).toBe(true);
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
      }
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
});
