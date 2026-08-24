import { QuestionType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  assertCompleteStudentAnswer,
  createPendingAnswerJson,
  gradeUnansweredQuestion,
  gradeQuestionAnswer,
  isPendingAnswerJson,
  validateStudentAnswerDraft,
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

  it("grades every skipped multi-statement item with zero points and no selection", () => {
    const result = gradeUnansweredQuestion({
      questionType: QuestionType.MULTI_STATEMENT_TRUE_FALSE,
      correctAnswerJson: [
        { statementId: "a", value: true },
        { statementId: "b", value: false },
      ],
    });

    expect(result).toEqual({
      isCorrect: false,
      pointsAwarded: 0,
      statementResults: [
        {
          statementId: "a",
          selectedValue: null,
          correctValue: true,
          isCorrect: false,
          pointsAwarded: 0,
        },
        {
          statementId: "b",
          selectedValue: null,
          correctValue: false,
          isCorrect: false,
          pointsAwarded: 0,
        },
      ],
    });
  });

  it("normalizes text input automatically without admin grading flags", () => {
    const result = gradeQuestionAnswer({
      questionType: QuestionType.TEXT_INPUT,
      answerJson: "  Hà Nội  ",
      correctAnswerJson: ["hà nội"],
      optionsJson: null,
      gradingConfigJson: { caseSensitive: true, exactMatch: false },
    });

    expect(result.isCorrect).toBe(true);
  });

  it("does not use the removed partial-match grading behavior", () => {
    const result = gradeQuestionAnswer({
      questionType: QuestionType.TEXT_INPUT,
      answerJson: "Thủ đô Hà Nội",
      correctAnswerJson: ["Hà Nội"],
      optionsJson: null,
      gradingConfigJson: { exactMatch: false },
    });

    expect(result.isCorrect).toBe(false);
  });

  it("ignores legacy answer variants after the first canonical answer", () => {
    const result = gradeQuestionAnswer({
      questionType: QuestionType.TEXT_INPUT,
      answerJson: "0.5",
      correctAnswerJson: ["1/3", "0.5"],
      optionsJson: null,
      gradingConfigJson: null,
    });

    expect(result.isCorrect).toBe(false);
  });

  it.each(["1/2", "2/4", "0.5", "0.50", "0,5", "5e-1", "\\frac{1}{2}"])(
    "grades the numeric answer %s by value",
    (answerJson) => {
      const result = gradeQuestionAnswer({
        questionType: QuestionType.TEXT_INPUT,
        answerJson,
        correctAnswerJson: ["0.5"],
        optionsJson: null,
        gradingConfigJson: null,
      });

      expect(result.isCorrect).toBe(true);
    },
  );

  it.each(["1.4", "1,4", "1.40", "14/10", "\\frac{7}{5}"])(
    "grades the equivalent rounded numeric answer %s by value",
    (answerJson) => {
      const result = gradeQuestionAnswer({
        questionType: QuestionType.TEXT_INPUT,
        answerJson,
        correctAnswerJson: ["1.4"],
        optionsJson: null,
        gradingConfigJson: null,
      });

      expect(result.isCorrect).toBe(true);
    },
  );

  it("does not accept invalid or different numeric values", () => {
    for (const answerJson of ["1/0", "0.51", "một phần hai"]) {
      const result = gradeQuestionAnswer({
        questionType: QuestionType.TEXT_INPUT,
        answerJson,
        correctAnswerJson: ["0.5"],
        optionsJson: null,
        gradingConfigJson: null,
      });
      expect(result.isCorrect).toBe(false);
    }
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

  it("accepts partial drafts without counting incomplete questions as answered", () => {
    const optionsJson = [
      { id: "a", richText: documentWithText("A") },
      { id: "b", richText: documentWithText("B") },
    ];

    expect(
      validateStudentAnswerDraft({
        questionType: QuestionType.MULTI_STATEMENT_TRUE_FALSE,
        answerJson: [{ statementId: "a", value: true }],
        optionsJson,
      }),
    ).toEqual({ isAnswered: false });
    expect(
      validateStudentAnswerDraft({
        questionType: QuestionType.MULTI_STATEMENT_TRUE_FALSE,
        answerJson: [
          { statementId: "a", value: true },
          { statementId: "b", value: false },
        ],
        optionsJson,
      }),
    ).toEqual({ isAnswered: true });
    expect(
      validateStudentAnswerDraft({
        questionType: QuestionType.TEXT_INPUT,
        answerJson: "-2.5",
        optionsJson: null,
      }),
    ).toEqual({ isAnswered: true });
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
