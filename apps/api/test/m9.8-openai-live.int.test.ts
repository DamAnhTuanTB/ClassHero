import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { Difficulty, QuestionType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { OpenAiProvider } from "#api/modules/ai/providers/openai.provider";
import {
  generatedFlashcardOutputSchema,
  generatedQuizOutputSchema,
  generatedTestOutputSchema,
  LESSON_CONTENT_PROMPT_VERSION,
  LESSON_CONTENT_SCHEMA_VERSION,
} from "#api/modules/ai/types/lesson-content-generation.types";
import {
  LESSON_SUMMARY_PROMPT_VERSION,
  LESSON_SUMMARY_SCHEMA_VERSION,
  lessonSummaryOutputSchema,
} from "#api/modules/ai/types/lesson-summary.types";
import {
  buildFlashcardPrompt,
  buildQuizPrompt,
  buildTestPrompt,
  LESSON_CONTENT_SYSTEM_PROMPT,
} from "#api/modules/ai/utils/lesson-content-generation-prompt";
import {
  buildLessonSummaryUserPrompt,
  LESSON_SUMMARY_SYSTEM_PROMPT,
} from "#api/modules/ai/utils/lesson-summary-prompt";

loadEnv({ path: resolve(process.cwd(), "../../.env"), override: false });
const runLiveTest = process.env.RUN_OPENAI_LIVE_TESTS === "1";
const chunkIds = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
];
const contextChunks = [
  {
    id: chunkIds[0]!,
    content:
      "Số hữu tỉ là số viết được dưới dạng a/b, trong đó a và b là số nguyên, b khác 0. Hai phân số bằng nhau khi tích chéo bằng nhau.",
  },
  {
    id: chunkIds[1]!,
    content:
      "Muốn cộng hai số hữu tỉ, quy đồng mẫu số rồi cộng tử số. Phép cộng có tính giao hoán, kết hợp; số đối của a/b là -a/b.",
  },
];

describe.skipIf(!runLiveTest)("M9.8 OpenAI live UI coverage matrix", () => {
  it("covers summary, every question form, difficulty and test ratio in eight paid calls", async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is required for M9.8 live tests.");
    const provider = new OpenAiProvider({
      apiKey,
      requestTimeoutMs: 90_000,
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
      embeddingDimensions: Number(process.env.OPENAI_EMBEDDING_DIMENSIONS ?? 1536),
      chatModel: process.env.OPENAI_CHAT_MODEL ?? "gpt-4.1-mini",
      structuredModel: process.env.OPENAI_STRUCTURED_MODEL ?? "gpt-4.1-mini",
    });
    const usage = { calls: 0, input: 0, output: 0, total: 0 };
    const allQuestionTypes = Object.values(QuestionType);

    const summary = await provider.generateStructured(
      {
        systemPrompt: LESSON_SUMMARY_SYSTEM_PROMPT,
        userPrompt: buildLessonSummaryUserPrompt({
          lessonTitle: "Số hữu tỉ",
          configuration: {
            style: "student_friendly",
            styleInstructions: "",
            length: "standard",
            targetWordCount: null,
            focus: "",
            includeFormulas: true,
            includeExamples: true,
            includeCommonMistakes: true,
            contentSections: ["FORMULAS", "EXAMPLES", "COMMON_MISTAKES"],
            reviewQuestionCount: 5,
            extraInstructions: "",
          },
        }),
        contextChunks,
        outputName: "m9_8_summary",
        promptVersion: LESSON_SUMMARY_PROMPT_VERSION,
        schemaVersion: LESSON_SUMMARY_SCHEMA_VERSION,
        maxTokens: 900,
      },
      lessonSummaryOutputSchema,
    );
    expect(summary.data.sections.length).toBeGreaterThan(0);
    expect(summary.data.objectives.length).toBeGreaterThan(0);
    expect(summary.data.reviewQuestions.length).toBeGreaterThan(0);
    record(usage, summary, "summary-student-friendly");

    for (const quizCase of [
      {
        label: "quiz-all-types-mixed",
        count: 4,
        difficulty: Difficulty.MIXED,
        types: allQuestionTypes,
      },
      {
        label: "quiz-hard-mc-and-text",
        count: 2,
        difficulty: Difficulty.HARD,
        types: [QuestionType.MULTIPLE_CHOICE, QuestionType.TEXT_INPUT],
      },
    ]) {
      const output = await provider.generateStructured(
        {
          systemPrompt: LESSON_CONTENT_SYSTEM_PROMPT,
          userPrompt: buildQuizPrompt({
            lessonTitle: "Số hữu tỉ",
            questionCount: quizCase.count,
            difficulty: quizCase.difficulty,
            questionTypes: quizCase.types,
          }),
          contextChunks,
          outputName: quizCase.label.replaceAll("-", "_"),
          promptVersion: LESSON_CONTENT_PROMPT_VERSION,
          schemaVersion: LESSON_CONTENT_SCHEMA_VERSION,
          maxTokens: quizCase.count === 4 ? 2_800 : 1_600,
        },
        generatedQuizOutputSchema,
      );
      expect(output.data.questions).toHaveLength(quizCase.count);
      expect(new Set(output.data.questions.map((item) => item.questionType))).toEqual(
        new Set(quizCase.types),
      );
      if (quizCase.difficulty !== Difficulty.MIXED) {
        expect(
          output.data.questions.every((item) => item.difficulty === quizCase.difficulty),
        ).toBe(true);
      }
      record(usage, output, quizCase.label);
    }

    for (const difficulty of [Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD]) {
      const output = await provider.generateStructured(
        {
          systemPrompt: LESSON_CONTENT_SYSTEM_PROMPT,
          userPrompt: buildFlashcardPrompt({
            lessonTitle: "Số hữu tỉ",
            cardCount: 2,
            difficulty,
          }),
          contextChunks,
          outputName: `m9_8_flashcard_${difficulty.toLowerCase()}`,
          promptVersion: LESSON_CONTENT_PROMPT_VERSION,
          schemaVersion: LESSON_CONTENT_SCHEMA_VERSION,
          maxTokens: 1_200,
        },
        generatedFlashcardOutputSchema,
      );
      expect(output.data.cards).toHaveLength(2);
      expect(output.data.cards.every((card) => card.difficulty === difficulty)).toBe(
        true,
      );
      expect(output.data.cards.every((card) => card.sourceChunkIds.length > 0)).toBe(
        true,
      );
      record(usage, output, `flashcard-${difficulty}`);
    }

    for (const testCase of [
      {
        label: "test-all-types-balanced",
        count: 4,
        ratio: { easy: 0.25, medium: 0.5, hard: 0.25 },
        types: allQuestionTypes,
      },
      {
        label: "test-three-difficulties",
        count: 3,
        ratio: { easy: 1 / 3, medium: 1 / 3, hard: 1 / 3 },
        types: [
          QuestionType.MULTIPLE_CHOICE,
          QuestionType.TRUE_FALSE,
          QuestionType.TEXT_INPUT,
        ],
      },
    ]) {
      const output = await provider.generateStructured(
        {
          systemPrompt: LESSON_CONTENT_SYSTEM_PROMPT,
          userPrompt: buildTestPrompt({
            lessonTitle: "Số hữu tỉ",
            questionCount: testCase.count,
            durationSeconds: 1_200,
            difficultyRatio: testCase.ratio,
            questionTypes: testCase.types,
          }),
          contextChunks,
          outputName: testCase.label.replaceAll("-", "_"),
          promptVersion: LESSON_CONTENT_PROMPT_VERSION,
          schemaVersion: LESSON_CONTENT_SCHEMA_VERSION,
          maxTokens: testCase.count === 4 ? 2_800 : 2_200,
        },
        generatedTestOutputSchema,
      );
      expect(output.data.questions).toHaveLength(testCase.count);
      expect(new Set(output.data.questions.map((item) => item.questionType))).toEqual(
        new Set(testCase.types),
      );
      expect(output.data.questions.every((item) => item.sourceChunkIds.length > 0)).toBe(
        true,
      );
      record(usage, output, testCase.label);
    }

    const estimatedUsd =
      (usage.input * 0.4) / 1_000_000 + (usage.output * 1.6) / 1_000_000;
    console.info(
      `[M9.8 LIVE TOTAL] calls=${usage.calls} inputTokens=${usage.input} ` +
        `outputTokens=${usage.output} totalTokens=${usage.total} ` +
        `estimatedUsd=${estimatedUsd.toFixed(6)}`,
    );
    expect(usage.calls).toBe(8);
    expect(usage.total).toBeGreaterThan(0);
  }, 600_000);
});

function record(
  totals: { calls: number; input: number; output: number; total: number },
  result: {
    model: string;
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
    latencyMs?: number;
  },
  label: string,
) {
  totals.calls += 1;
  totals.input += result.usage?.promptTokens ?? 0;
  totals.output += result.usage?.completionTokens ?? 0;
  totals.total += result.usage?.totalTokens ?? 0;
  console.info(
    `[M9.8 LIVE] case=${label} model=${result.model} ` +
      `inputTokens=${result.usage?.promptTokens ?? "unknown"} ` +
      `outputTokens=${result.usage?.completionTokens ?? "unknown"} ` +
      `latencyMs=${result.latencyMs ?? "unknown"}`,
  );
}
