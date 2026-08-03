import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { describe, expect, it } from "vitest";

import { OpenAiProvider } from "#api/modules/ai/providers/openai.provider";

loadEnv({ path: resolve(process.cwd(), "../../.env"), override: false });

const runLiveTest = process.env.RUN_OPENAI_LIVE_TESTS === "1";

describe.skipIf(!runLiveTest)("M5.1 OpenAI live smoke", () => {
  it("creates a real 1536-dimensional embedding and reports usage", async () => {
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
    const result = await provider.createEmbedding({
      texts: ["Kiểm tra tích hợp embedding thật cho hệ thống học theo lộ trình."],
    });

    expect(result.model).toBe("text-embedding-3-small");
    expect(result.dimensions).toBe(1536);
    expect(result.vectors).toHaveLength(1);
    expect(result.vectors[0]).toHaveLength(1536);
    expect(result.vectors[0]?.every(Number.isFinite)).toBe(true);
    expect(result.usage?.promptTokens).toBeGreaterThan(0);

    console.info(
      `[M5 LIVE] model=${result.model} dimensions=${result.dimensions} ` +
        `promptTokens=${result.usage?.promptTokens ?? "unknown"} ` +
        `totalTokens=${result.usage?.totalTokens ?? "unknown"}`,
    );
  });
});
