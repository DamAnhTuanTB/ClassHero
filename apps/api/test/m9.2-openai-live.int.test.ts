import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { describe, expect, it } from "vitest";

import { OpenAiProvider } from "#api/modules/ai/providers/openai.provider";
import { lessonSummaryProviderOutputSchema } from "#api/modules/ai/types/lesson-summary.types";
import { mapLessonSummaryProviderOutput } from "#api/modules/ai/utils/lesson-summary-mapper";
import { buildLessonSummaryStructuredInput } from "#api/modules/ai/utils/lesson-summary-prompt";

loadEnv({ path: resolve(process.cwd(), "../../.env"), override: false });

const runLiveTest = process.env.RUN_OPENAI_LIVE_TESTS === "1";
const chunks = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    content:
      "Số hữu tỉ là số viết được dưới dạng a/b với a, b là số nguyên và b khác 0. Ví dụ: Số 1/2 là một số hữu tỉ.",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    content:
      "Bài 1. Viết số 0,25 dưới dạng phân số. Bài 2. Một chiếc áo giá 200 000 đồng được giảm 25%. Tính giá chiếc áo sau khi giảm.",
  },
];

describe.skipIf(!runLiveTest)("M9.2 OpenAI lesson summary live smoke", () => {
  it("returns the provider contract and maps it to the persisted contract", async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required for the live smoke test.");
    }
    const provider = new OpenAiProvider({
      apiKey,
      requestTimeoutMs: 120_000,
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
      embeddingDimensions: Number(process.env.OPENAI_EMBEDDING_DIMENSIONS ?? 1536),
      chatModel: process.env.OPENAI_CHAT_MODEL ?? "gpt-4.1",
      structuredModel: process.env.OPENAI_STRUCTURED_MODEL ?? "gpt-4.1",
    });
    const request = buildLessonSummaryStructuredInput({
      lessonId: "lesson-live",
      lessonTitle: "Số hữu tỉ",
      documentIds: ["document-live"],
      sourceHash: "live-source",
      chunks,
      configuration: {
        style: "student_friendly",
        styleInstructions: "",
        length: "standard",
        targetWordCount: null,
        extraInstructions: "",
      },
    });

    const result = await provider.generateStructured(
      request,
      lessonSummaryProviderOutputSchema,
    );
    const summary = mapLessonSummaryProviderOutput({
      lessonId: "lesson-live",
      output: result.data,
      contextChunks: chunks,
    });

    expect(summary.sections.at(-1)).toMatchObject({
      displayHeading: "Bài tập vận dụng",
      blocks: [
        expect.objectContaining({ type: "example" }),
        expect.objectContaining({ type: "example" }),
      ],
    });
    expect(result.usage?.totalTokens).toBeGreaterThan(0);
    console.info(
      `[M9.2 LIVE] model=${result.model} inputTokens=${result.usage?.promptTokens ?? "unknown"} ` +
        `outputTokens=${result.usage?.completionTokens ?? "unknown"} totalTokens=${result.usage?.totalTokens ?? "unknown"} ` +
        `latencyMs=${result.latencyMs ?? "unknown"}`,
    );
  }, 150_000);
});
