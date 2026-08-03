import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { describe, expect, it } from "vitest";

import { OpenAiProvider } from "#api/modules/ai/providers/openai.provider";
import {
  LESSON_SUMMARY_PROMPT_VERSION,
  LESSON_SUMMARY_SCHEMA_VERSION,
  lessonSummaryOutputSchema,
} from "#api/modules/ai/types/lesson-summary.types";
import {
  buildLessonSummaryUserPrompt,
  LESSON_SUMMARY_SYSTEM_PROMPT,
} from "#api/modules/ai/utils/lesson-summary-prompt";

loadEnv({ path: resolve(process.cwd(), "../../.env"), override: false });

const runLiveTest = process.env.RUN_OPENAI_LIVE_TESTS === "1";

describe.skipIf(!runLiveTest)("M9.2 OpenAI lesson summary live smoke", () => {
  it("returns a schema-valid Vietnamese lesson summary from sample chunks", async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required for the live smoke test.");
    }
    const provider = new OpenAiProvider({
      apiKey,
      requestTimeoutMs: 60_000,
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
      embeddingDimensions: Number(process.env.OPENAI_EMBEDDING_DIMENSIONS ?? 1536),
      chatModel: process.env.OPENAI_CHAT_MODEL ?? "gpt-4.1-mini",
      structuredModel: process.env.OPENAI_STRUCTURED_MODEL ?? "gpt-4.1-mini",
    });

    const result = await provider.generateStructured(
      {
        systemPrompt: LESSON_SUMMARY_SYSTEM_PROMPT,
        userPrompt: buildLessonSummaryUserPrompt({
          lessonTitle: "Số hữu tỉ",
          style: "student_friendly",
        }),
        contextChunks: [
          {
            id: "sample-chunk-1",
            content:
              "Số hữu tỉ là số viết được dưới dạng a/b với a, b là số nguyên và b khác 0. Ví dụ 1/2 và -3/4 là số hữu tỉ.",
          },
        ],
        outputName: "lesson_summary_live",
        promptVersion: LESSON_SUMMARY_PROMPT_VERSION,
        schemaVersion: LESSON_SUMMARY_SCHEMA_VERSION,
        maxTokens: 700,
      },
      lessonSummaryOutputSchema,
    );

    expect(result.data.sections.length).toBeGreaterThan(0);
    expect(result.data.reviewQuestions.length).toBeGreaterThan(0);
    expect(result.usage?.totalTokens).toBeGreaterThan(0);
    console.info(
      `[M9.2 LIVE] model=${result.model} inputTokens=${result.usage?.promptTokens ?? "unknown"} ` +
        `outputTokens=${result.usage?.completionTokens ?? "unknown"} totalTokens=${result.usage?.totalTokens ?? "unknown"} ` +
        `latencyMs=${result.latencyMs ?? "unknown"}`,
    );
  }, 60_000);
});
