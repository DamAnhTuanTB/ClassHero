import { Difficulty, QuestionType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  generatedFlashcardOutputSchema,
  generatedQuizOutputSchema,
  generatedTestOutputSchema,
} from "#api/modules/ai/types/lesson-content-generation.types";
import {
  assertGeneratedContent,
  copiesSourceVerbatim,
  mapGeneratedQuestion,
} from "#api/modules/ai/utils/lesson-content-generation-mapper";

const chunkId = "11111111-1111-4111-8111-111111111111";
const common = {
  difficulty: Difficulty.MEDIUM,
  prompt: "Câu hỏi được diễn đạt mới dựa trên kiến thức buổi học?",
  hint: "Nhớ lại định nghĩa nền tảng.",
  explanation: "Lời giải đối chiếu trực tiếp với định nghĩa đã học.",
  sourceChunkIds: [chunkId],
};

const questions = [
  {
    ...common,
    questionType: QuestionType.MULTIPLE_CHOICE,
    options: [
      { id: "A", text: "Phương án A" },
      { id: "B", text: "Phương án B" },
    ],
    correctOptionIds: ["A"],
  },
  { ...common, questionType: QuestionType.TRUE_FALSE, correctAnswer: true },
  {
    ...common,
    questionType: QuestionType.MULTI_STATEMENT_TRUE_FALSE,
    statements: [
      { id: "S1", text: "Mệnh đề thứ nhất", value: true },
      { id: "S2", text: "Mệnh đề thứ hai", value: false },
    ],
  },
  {
    ...common,
    questionType: QuestionType.TEXT_INPUT,
    acceptedAnswers: ["đáp án"],
    caseSensitive: false,
    exactMatch: true,
    keywords: [],
  },
];

describe("M9.3 generation schemas, mappings and guards", () => {
  it("validates and maps every quiz question type to the M6 JSON shape", () => {
    const parsed = generatedQuizOutputSchema.parse({ title: "Quiz tổng hợp", questions });
    const mapped = parsed.questions.map(mapGeneratedQuestion);

    expect(mapped.map((item) => item.questionType)).toEqual(Object.values(QuestionType));
    expect(mapped[0]).toMatchObject({ correctAnswerJson: ["A"] });
    expect(mapped[1]).toMatchObject({ correctAnswerJson: true, optionsJson: null });
    expect(mapped[2]?.correctAnswerJson).toEqual([
      { statementId: "S1", value: true },
      { statementId: "S2", value: false },
    ]);
    expect(mapped[3]).toMatchObject({
      correctAnswerJson: ["đáp án"],
      gradingConfigJson: { caseSensitive: false, exactMatch: true, keywords: [] },
    });
  });

  it("accepts all four test types and all three flashcard difficulties", () => {
    expect(
      generatedTestOutputSchema.parse({ title: "Test tổng hợp", questions }).questions,
    ).toHaveLength(4);
    const cards = [Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD].map(
      (difficulty) => ({
        difficulty,
        front: `Mặt trước ${difficulty}`,
        back: `Mặt sau ${difficulty}`,
        explanation: `Giải thích ${difficulty}`,
        sourceChunkIds: [chunkId],
      }),
    );
    expect(
      generatedFlashcardOutputSchema.parse({ title: "Flashcard", cards }).cards,
    ).toHaveLength(3);
  });

  it("rejects malformed type-specific answers and unexpected fields", () => {
    expect(() =>
      generatedQuizOutputSchema.parse({
        title: "Sai",
        questions: [
          { ...common, questionType: QuestionType.TRUE_FALSE, correctAnswer: "true" },
        ],
      }),
    ).toThrow();
    expect(() =>
      generatedFlashcardOutputSchema.parse({
        title: "Sai",
        cards: [
          {
            difficulty: Difficulty.EASY,
            front: "A",
            back: "B",
            explanation: "C",
            sourceChunkIds: [chunkId],
            hint: "legacy",
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects chunk references outside retrieval and 12-token verbatim copies", () => {
    expect(() =>
      assertGeneratedContent({
        items: [
          {
            sourceChunkIds: ["22222222-2222-4222-8222-222222222222"],
            text: "Nội dung mới",
          },
        ],
        allowedChunkIds: new Set([chunkId]),
        contextTexts: ["Nội dung nguồn"],
      }),
    ).toThrow(/AI_SOURCE_REFERENCE_INVALID/);

    const source = "một hai ba bốn năm sáu bảy tám chín mười mười một mười hai mười ba";
    expect(copiesSourceVerbatim(source, [source])).toBe(true);
    expect(copiesSourceVerbatim("Cách hỏi hoàn toàn mới", [source])).toBe(false);
  });
});
