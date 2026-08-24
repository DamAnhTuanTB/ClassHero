import { Difficulty, QuestionType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  buildCurrentQuizQuestionJson,
  replaceQuizGenerationQuestionOutput,
  updateQuizGenerationQuestionOutput,
} from "#api/modules/quiz/utils/quiz-generation-output";

describe("M9.8 mutable Quiz generation output", () => {
  it("replaces one question in the single mutable generation snapshot", () => {
    const output = {
      questions: [
        { questionType: "TRUE_FALSE", explanation: { problem: "Câu cũ" } },
        { questionType: "TEXT_INPUT", explanation: { problem: "Giữ nguyên" } },
      ],
      generationMeta: { requestedCount: 2 },
    };
    const replacement = {
      questionType: "TRUE_FALSE",
      explanation: { problem: "Câu đã sửa trực tiếp từ JSON" },
    };

    const result = replaceQuizGenerationQuestionOutput(output, 0, replacement);

    expect(result?.questions[0]).toEqual(replacement);
    expect(result?.questions[1]).toEqual(output.questions[1]);
    expect(result?.generationMeta).toEqual(output.generationMeta);
    expect(output.questions[0]).toEqual({
      questionType: "TRUE_FALSE",
      explanation: { problem: "Câu cũ" },
    });
  });

  it("replaces the edited question while preserving provider-only fields", () => {
    const rawProviderQuestionJson = {
      questionType: "MULTIPLE_CHOICE",
      difficulty: "EASY",
      hint: "Gợi ý gốc",
      figure: {
        questionFigure: null,
        solutionFigureMode: "NONE",
        solutionFigurePlan: null,
      },
      options: [
        { id: "A", text: "Phương án gốc" },
        { id: "B", text: "Phương án B" },
      ],
      explanation: {
        problem: "Câu hỏi gốc",
        solution: "Lời giải gốc",
        answer: "A. Phương án gốc",
        isGeometry: false,
        geometryStatement: null,
      },
      correctOptionId: "A",
    };

    const originalOutput = {
      questions: [rawProviderQuestionJson, { questionType: "TRUE_FALSE" }],
      generationMeta: { requestedCount: 2 },
    };
    const result = updateQuizGenerationQuestionOutput(originalOutput, 0, {
      questionType: QuestionType.MULTIPLE_CHOICE,
      difficulty: Difficulty.HARD,
      questionJson: tiptapText("Câu hỏi đã sửa abc"),
      optionsJson: [
        { id: "A", richText: tiptapText("Phương án A mới") },
        {
          id: "B",
          richText: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "inlineMath", attrs: { latex: "x^2" } }],
              },
            ],
          },
        },
      ],
      correctAnswerJson: ["B"],
      hintJson: tiptapText("Gợi ý mới"),
      sourceMetadataJson: {
        aiGenerationId: "generation-1",
        generationQuestionIndex: 0,
      },
      explanation: { contentJson: tiptapText("Lời giải admin đã sửa") },
    });

    expect(result?.questions[0]).toMatchObject({
      questionType: "MULTIPLE_CHOICE",
      difficulty: "HARD",
      hint: "Gợi ý mới",
      options: [
        { id: "A", text: "Phương án A mới" },
        { id: "B", text: "$x^2$" },
      ],
      correctOptionId: "B",
      explanation: {
        problem: "Câu hỏi đã sửa abc",
        solution: "Lời giải admin đã sửa",
        answer: "B. $x^2$",
      },
    });
    expect(result?.questions[0]).toHaveProperty("figure", rawProviderQuestionJson.figure);
    expect(result?.questions[1]).toEqual({ questionType: "TRUE_FALSE" });
    expect(result?.generationMeta).toEqual({ requestedCount: 2 });
    expect(rawProviderQuestionJson.explanation.problem).toBe("Câu hỏi gốc");
  });

  it("does not create an output when lineage points outside generated questions", () => {
    const result = updateQuizGenerationQuestionOutput({ questions: [] }, 4, {
      questionType: QuestionType.TRUE_FALSE,
      difficulty: Difficulty.EASY,
      questionJson: tiptapText("Mệnh đề"),
      optionsJson: null,
      correctAnswerJson: true,
      hintJson: null,
      sourceMetadataJson: null,
      explanation: null,
    });

    expect(result).toBeNull();
  });

  it("rebuilds multi-statement values from the current grading data", () => {
    const result = buildCurrentQuizQuestionJson(
      {
        questionType: QuestionType.MULTI_STATEMENT_TRUE_FALSE,
        difficulty: Difficulty.MEDIUM,
        questionJson: tiptapText("Đề dẫn đã sửa"),
        optionsJson: [
          { id: "a", richText: tiptapText("Mệnh đề a mới") },
          { id: "b", richText: tiptapText("Mệnh đề b mới") },
        ],
        correctAnswerJson: [
          { statementId: "a", value: false },
          { statementId: "b", value: true },
        ],
        hintJson: null,
        sourceMetadataJson: {
          aiGenerationId: "generation-2",
          generationQuestionIndex: 1,
        },
        explanation: { contentJson: tiptapText("Lời giải chung đã sửa") },
      },
      {
        questionType: "MULTI_STATEMENT_TRUE_FALSE",
        difficulty: "MEDIUM",
        hint: "Gợi ý cũ",
        statements: [
          { id: "a", text: "Mệnh đề a cũ", value: true },
          { id: "b", text: "Mệnh đề b cũ", value: false },
        ],
        explanation: {
          problem: "Đề dẫn cũ",
          statementSolutions: [
            { statementId: "a", solution: "Lời giải a cũ" },
            { statementId: "b", solution: "Lời giải b cũ" },
          ],
        },
        figure: {
          questionFigure: null,
          solutionFigureMode: "NONE",
          solutionFigurePlan: null,
        },
      },
    );

    expect(result).toMatchObject({
      hint: null,
      statements: [
        { id: "a", text: "Mệnh đề a mới", value: false },
        { id: "b", text: "Mệnh đề b mới", value: true },
      ],
      explanation: {
        problem: "Đề dẫn đã sửa",
        solution: "Lời giải chung đã sửa",
        answer: "a) Sai.\nb) Đúng.",
      },
    });
    expect(result?.explanation).not.toHaveProperty("statementSolutions");
  });

  it("keeps every current accepted answer when a text-input question was expanded", () => {
    const result = buildCurrentQuizQuestionJson(
      {
        questionType: QuestionType.TEXT_INPUT,
        difficulty: Difficulty.EASY,
        questionJson: tiptapText("Nhập kết quả."),
        optionsJson: null,
        correctAnswerJson: ["1/2", "0.5"],
        hintJson: null,
        sourceMetadataJson: {
          aiGenerationId: "generation-3",
          generationQuestionIndex: 2,
        },
        explanation: { contentJson: tiptapText("Hai cách viết tương đương.") },
      },
      {
        questionType: "TEXT_INPUT",
        difficulty: "EASY",
        hint: "Gợi ý cũ",
        correctAnswer: "1/2",
        explanation: {
          problem: "Đề cũ",
          solution: "Lời giải cũ",
          answer: "1/2",
        },
        figure: {
          questionFigure: null,
          solutionFigureMode: "NONE",
          solutionFigurePlan: null,
        },
      },
    );

    expect(result).toMatchObject({
      correctAnswer: ["1/2", "0.5"],
      explanation: {
        problem: "Nhập kết quả.",
        solution: "Hai cách viết tương đương.",
        answer: "1/2\n0.5",
      },
    });
  });
});

function tiptapText(text: string) {
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
