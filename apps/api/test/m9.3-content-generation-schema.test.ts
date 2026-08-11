import { Difficulty, QuestionType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  generatedFlashcardOutputSchema,
  generatedQuizOutputSchema,
  generatedTestOutputSchema,
} from "#api/modules/ai/types/lesson-content-generation.types";
import { lessonSummaryStandardExerciseTransportSchema } from "#api/modules/ai/types/lesson-summary.types";
import {
  assertGeneratedContent,
  copiesSourceVerbatim,
  mapGeneratedQuestion,
  toTiptap,
} from "#api/modules/ai/utils/lesson-content-generation-mapper";
import {
  buildAiStructuredTextFormat,
  estimateAiStructuredInputTokens,
} from "#api/modules/ai/utils/ai-structured-output-format";

const chunkId = "11111111-1111-4111-8111-111111111111";
const common = {
  difficulty: Difficulty.MEDIUM,
  hint: "Nhớ lại định nghĩa nền tảng.",
  example: {
    type: "example" as const,
    exampleKind: "STANDARD_EXERCISE" as const,
    problem: "Câu hỏi được diễn đạt mới dựa trên kiến thức buổi học?",
    solution: "Dùng định nghĩa đã học.\nĐối chiếu dữ kiện và chọn kết quả phù hợp.",
    answer: "Kết quả đúng theo định nghĩa.",
    geometryStatement: null,
    diagramSpec: null,
  },
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
  it("maps provider math delimiters to native Tiptap math nodes", () => {
    expect(
      toTiptap("Tính $0,25+\\dfrac{5}{12}$.\n\\[x^2=16\\]\nSuy ra \\(x=4\\)."),
    ).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Tính " },
            { type: "inlineMath", attrs: { latex: "0,25+\\dfrac{5}{12}" } },
            { type: "text", text: "." },
          ],
        },
        { type: "blockMath", attrs: { latex: "x^2=16" } },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Suy ra " },
            { type: "inlineMath", attrs: { latex: "x=4" } },
            { type: "text", text: "." },
          ],
        },
      ],
    });
  });

  it("includes the structured output schema in preview token estimates", () => {
    const estimate = estimateAiStructuredInputTokens({
      systemPrompt: "system",
      inputPrompt: "prompt",
      structuredTextFormat: buildAiStructuredTextFormat(
        generatedQuizOutputSchema,
        "generated_quiz",
      ),
    });

    expect(estimate.schemaTokens).toBeGreaterThan(estimate.promptTokens);
    expect(estimate.estimatedTokens).toBe(estimate.promptTokens + estimate.schemaTokens);
  });

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

  it("uses the exact M9.2 EXAMPLE schema and keeps diagramSpec inside example", () => {
    const providerExample = {
      ...common.example,
      diagramSpec: {
        kind: "INTENT" as const,
        intent: {
          intentVersion: 1 as const,
          grade: 7,
          difficulty: "SIMPLE" as const,
          caption: "Hai tam giác vuông có chung cạnh huyền",
          family: "PLANE_GEOMETRY" as const,
          archetype: "RIGHT_TRIANGLE_CONGRUENCE" as const,
          variant: "SHARED_HYPOTENUSE_LEG" as const,
          pointLabels: ["A", "B", "C", "D"],
          measures: [],
        },
      },
    };
    const summaryExample =
      lessonSummaryStandardExerciseTransportSchema.parse(providerExample);
    const quiz = generatedQuizOutputSchema.parse({
      title: "Quiz dùng chung ExampleCore",
      questions: [{ ...questions[0], example: providerExample }],
    });

    expect(quiz.questions[0]?.example).toEqual(summaryExample);
    expect(quiz.questions[0]).not.toHaveProperty("sourceChunkIds");
    expect(quiz.questions[0]).not.toHaveProperty("diagramSpec");
    expect(quiz.questions[0]?.example.diagramSpec).toEqual(summaryExample.diagramSpec);
  });

  it("accepts all four test types and all three flashcard difficulties", () => {
    const testQuestions = questions.map(({ hint: _hint, ...question }) => ({
      ...question,
      sourceChunkIds: [chunkId],
    }));
    expect(
      generatedTestOutputSchema.parse({
        title: "Test tổng hợp",
        questions: testQuestions,
      }).questions,
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

  it("keeps the written solution when a provider returns an incompatible diagram intent", () => {
    const parsed = generatedQuizOutputSchema.parse({
      title: "Quiz hình học",
      questions: [
        {
          ...questions[0],
          example: {
            ...common.example,
            diagramSpec: {
              kind: "INTENT",
              intent: {
                intentVersion: 1,
                grade: 7,
                difficulty: "MEDIUM",
                caption: "Hai tam giác vuông",
                family: "PLANE_GEOMETRY",
                archetype: "RIGHT_TRIANGLE_CONGRUENCE",
                variant: "GENERAL",
                pointLabels: ["A", "B", "C", "D", "E", "F"],
                measures: [],
              },
            },
          },
        },
      ],
    });

    expect(mapGeneratedQuestion(parsed.questions[0]!)).toMatchObject({
      explanationDiagramSpecJson: null,
      recoveryIssues: [
        expect.objectContaining({
          classification: "REVIEWABLE",
          code: "DIAGRAM_CANNOT_RENDER",
        }),
      ],
    });
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
