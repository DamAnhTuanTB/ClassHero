import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { AiProviderName } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { OpenAiProvider } from "#api/modules/ai/providers/openai.provider";

loadEnv({ path: resolve(process.cwd(), "../../.env"), override: false });

const runLiveTest = process.env.RUN_OPENAI_LIVE_TESTS === "1";

describe.skipIf(!runLiveTest)("M9.1 OpenAI structured output live smoke", () => {
  it("returns a small schema-validated response and reports billable usage", async () => {
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
    const schema = z.object({
      status: z.literal("ok"),
      value: z.literal(2),
    });
    const result = await provider.generateStructured(
      {
        systemPrompt: "Return only the requested structured result.",
        userPrompt: "Confirm the smoke test with status ok and integer value 2.",
        outputName: "m9_1_live_smoke",
        promptVersion: "m9.1-live-v1",
        schemaVersion: "m9.1-live-v1",
        maxTokens: 80,
      },
      schema,
    );

    expect(result.data).toEqual({ status: "ok", value: 2 });
    expect(result.provider).toBe(AiProviderName.OPENAI);
    expect(result.usage?.totalTokens).toBeGreaterThan(0);
    console.info(
      `[M9.1 LIVE] model=${result.model} inputTokens=${result.usage?.promptTokens ?? "unknown"} ` +
        `outputTokens=${result.usage?.completionTokens ?? "unknown"} totalTokens=${result.usage?.totalTokens ?? "unknown"} ` +
        `latencyMs=${result.latencyMs ?? "unknown"}`,
    );
  });
});
