import { QuestionType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  assertCompleteStudentAnswer,
  createPendingAnswerJson,
  gradeQuestionAnswer,
  isPendingAnswerJson,
} from "#api/common/assessment/question-grading";

describe("M7 assessment grading", () => {
  it("grades multiple choice with exact selected option set", () => {
    const result = gradeQuestionAnswer({
      questionType: QuestionType.MULTIPLE_CHOICE,
      answerJson: ["B", "A"],
      correctAnswerJson: ["A", "B"],
      optionsJson: [
        { id: "A", richText: documentWithText("A") },
        { id: "B", richText: documentWithText("B") },
      ],
      gradingConfigJson: null,
      effectivePoints: 2,
    });

    expect(result).toEqual({
      isCorrect: true,
      pointsAwarded: 2,
      statementResults: null,
    });
  });

  it("keeps partial points for multi-statement true false", () => {
    const result = gradeQuestionAnswer({
      questionType: QuestionType.MULTI_STATEMENT_TRUE_FALSE,
      answerJson: [
        { statementId: "a", value: true },
        { statementId: "b", value: true },
        { statementId: "c", value: false },
      ],
      correctAnswerJson: [
        { statementId: "a", value: true },
        { statementId: "b", value: false },
        { statementId: "c", value: false },
      ],
      optionsJson: [
        { id: "a", richText: documentWithText("A") },
        { id: "b", richText: documentWithText("B") },
        { id: "c", richText: documentWithText("C") },
      ],
      gradingConfigJson: null,
      effectivePoints: 3,
    });

    expect(result.isCorrect).toBe(false);
    expect(result.pointsAwarded).toBe(2);
    expect(result.statementResults?.map((entry) => entry.isCorrect)).toEqual([
      true,
      false,
      true,
    ]);
  });

  it("normalizes text input according to grading configuration", () => {
    const result = gradeQuestionAnswer({
      questionType: QuestionType.TEXT_INPUT,
      answerJson: "  Hà Nội  ",
      correctAnswerJson: ["hà nội"],
      optionsJson: null,
      gradingConfigJson: {
        caseSensitive: false,
        exactMatch: true,
      },
    });

    expect(result.isCorrect).toBe(true);
  });

  it("requires every statement before an answer can be checked", () => {
    expect(() =>
      assertCompleteStudentAnswer({
        questionType: QuestionType.MULTI_STATEMENT_TRUE_FALSE,
        answerJson: [{ statementId: "a", value: true }],
        optionsJson: [
          { id: "a", richText: documentWithText("A") },
          { id: "b", richText: documentWithText("B") },
        ],
      }),
    ).toThrowError();
  });

  it("recognizes internal pending answer placeholders", () => {
    expect(isPendingAnswerJson(createPendingAnswerJson())).toBe(true);
    expect(isPendingAnswerJson(["A"])).toBe(false);
  });
});

function documentWithText(text: string) {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text }],
      },
    ],
  };
}
