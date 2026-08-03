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
  buildFlashcardPrompt,
  buildQuizPrompt,
  buildTestPrompt,
  LESSON_CONTENT_SYSTEM_PROMPT,
} from "#api/modules/ai/utils/lesson-content-generation-prompt";

loadEnv({ path: resolve(process.cwd(), "../../.env"), override: false });
const runLiveTest = process.env.RUN_OPENAI_LIVE_TESTS === "1";
const chunkIds = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
];
const contextChunks = [
  {
    id: chunkIds[0]!,
    content: "Số hữu tỉ là số viết được dưới dạng a/b, trong đó a và b là số nguyên, b khác 0. Hai phân số biểu diễn cùng số hữu tỉ khi tích chéo bằng nhau.",
  },
  {
    id: chunkIds[1]!,
    content: "Muốn cộng hai số hữu tỉ, quy đồng mẫu số rồi cộng tử số. Phép cộng có tính chất giao hoán và kết hợp. Số đối của a/b là -a/b.",
  },
];

describe.skipIf(!runLiveTest)("M9.3 expanded OpenAI live matrix", () => {
  it("covers mixed + every individual quiz/test type and every flashcard difficulty", async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is required for M9.3 live tests.");
    const provider = new OpenAiProvider({
      apiKey,
      requestTimeoutMs: 90_000,
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
      embeddingDimensions: Number(process.env.OPENAI_EMBEDDING_DIMENSIONS ?? 1536),
      chatModel: process.env.OPENAI_CHAT_MODEL ?? "gpt-4.1-mini",
      structuredModel: process.env.OPENAI_STRUCTURED_MODEL ?? "gpt-4.1-mini",
    });
    const usage = { input: 0, output: 0, total: 0, calls: 0 };
    const allTypes = Object.values(QuestionType);
    const typeCases = [allTypes, ...allTypes.map((type) => [type])];

    for (const [index, questionTypes] of typeCases.entries()) {
      const count = questionTypes.length;
      const result = await provider.generateStructured({
        systemPrompt: LESSON_CONTENT_SYSTEM_PROMPT,
        userPrompt: buildQuizPrompt({ lessonTitle: "Số hữu tỉ", questionCount: count, difficulty: Difficulty.MEDIUM, questionTypes }),
        contextChunks,
        outputName: `m9_3_quiz_${index}`,
        promptVersion: LESSON_CONTENT_PROMPT_VERSION,
        schemaVersion: LESSON_CONTENT_SCHEMA_VERSION,
        maxTokens: questionTypes.length === 4 ? 2_800 : 1_100,
      }, generatedQuizOutputSchema);
      expect(result.data.questions).toHaveLength(count);
      expect(new Set(result.data.questions.map((item) => item.questionType))).toEqual(new Set(questionTypes));
      recordUsage(usage, result, `quiz-${questionTypes.join("+")}`);
    }

    for (const [index, questionTypes] of typeCases.entries()) {
      const count = questionTypes.length;
      const result = await provider.generateStructured({
        systemPrompt: LESSON_CONTENT_SYSTEM_PROMPT,
        userPrompt: buildTestPrompt({
          lessonTitle: "Số hữu tỉ", questionCount: count, durationSeconds: 600,
          difficultyRatio: { easy: 0, medium: 1, hard: 0 }, questionTypes,
        }),
        contextChunks,
        outputName: `m9_3_test_${index}`,
        promptVersion: LESSON_CONTENT_PROMPT_VERSION,
        schemaVersion: LESSON_CONTENT_SCHEMA_VERSION,
        maxTokens: questionTypes.length === 4 ? 2_800 : 1_100,
      }, generatedTestOutputSchema);
      expect(result.data.questions).toHaveLength(count);
      expect(new Set(result.data.questions.map((item) => item.questionType))).toEqual(new Set(questionTypes));
      recordUsage(usage, result, `test-${questionTypes.join("+")}`);
    }

    for (const [index, difficulty] of [Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD].entries()) {
      const result = await provider.generateStructured({
        systemPrompt: LESSON_CONTENT_SYSTEM_PROMPT,
        userPrompt: buildFlashcardPrompt({ lessonTitle: "Số hữu tỉ", cardCount: 1, difficulty }),
        contextChunks,
        outputName: `m9_3_flashcard_${index}`,
        promptVersion: LESSON_CONTENT_PROMPT_VERSION,
        schemaVersion: LESSON_CONTENT_SCHEMA_VERSION,
        maxTokens: 800,
      }, generatedFlashcardOutputSchema);
      expect(result.data.cards).toHaveLength(1);
      expect(result.data.cards[0]?.difficulty).toBe(difficulty);
      recordUsage(usage, result, `flashcard-${difficulty}`);
    }

    const estimatedUsd = usage.input * 0.4 / 1_000_000 + usage.output * 1.6 / 1_000_000;
    console.info(`[M9.3 LIVE TOTAL] calls=${usage.calls} inputTokens=${usage.input} outputTokens=${usage.output} totalTokens=${usage.total} estimatedUsd=${estimatedUsd.toFixed(6)}`);
    expect(usage.calls).toBe(13);
    expect(usage.total).toBeGreaterThan(0);
  }, 600_000);
});

function recordUsage(
  totals: { input: number; output: number; total: number; calls: number },
  result: { model: string; usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number }; latencyMs?: number },
  label: string,
) {
  totals.calls += 1;
  totals.input += result.usage?.promptTokens ?? 0;
  totals.output += result.usage?.completionTokens ?? 0;
  totals.total += result.usage?.totalTokens ?? 0;
  console.info(`[M9.3 LIVE] case=${label} model=${result.model} inputTokens=${result.usage?.promptTokens ?? "unknown"} outputTokens=${result.usage?.completionTokens ?? "unknown"} latencyMs=${result.latencyMs ?? "unknown"}`);
}
