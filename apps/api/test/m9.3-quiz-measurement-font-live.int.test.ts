import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { describe, expect, it } from "vitest";

import { OpenAiProvider } from "#api/modules/ai/providers/openai.provider";
import {
  buildQuestionFigureInput,
  generatedQuizQuestionFigureSchema,
} from "#api/modules/quiz-figures/types/quiz-figure-generation.types";

loadEnv({ path: resolve(process.cwd(), "../../.env"), override: false, quiet: true });

const runLiveTest = process.env.RUN_OPENAI_QUIZ_FIGURE_FONT_LIVE_TESTS === "1";

describe.skipIf(!runLiveTest)("Quiz measurement-label font live regression", () => {
  it("wraps a literal value and unit in the same math font scope and compiles it", async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is required for the live test.");

    const model = process.env.OPENAI_QUIZ_FIGURE_LIVE_MODEL ?? "gpt-5.6-luna";
    const provider = new OpenAiProvider({
      apiKey,
      requestTimeoutMs: 120_000,
      generationRequestTimeoutMs: 120_000,
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
      embeddingDimensions: Number(process.env.OPENAI_EMBEDDING_DIMENSIONS ?? 1536),
      chatModel: model,
      structuredModel: model,
    });
    const input = buildQuestionFigureInput({
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      targetGrade: 8,
      plan: {
        version: 1,
        role: "QUESTION",
        problem: "Cho hình vuông ABCD có cạnh bằng 10 cm.",
      },
    });
    const result = await provider.generateStructured(
      { ...input, model, maxTokens: 4_000 },
      generatedQuizQuestionFigureSchema,
    );
    const source = result.data.latexSource;

    expect(source).toMatch(/\\mathrm\s*\{\s*10\s*\\,\s*cm\s*\}/u);
    expect(source).not.toMatch(/10\s*\\,\s*\\mathrm\s*\{\s*cm\s*\}/u);

    const response = await fetch("http://127.0.0.1:8080/render", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.TEX_RENDERER_TOKEN ?? "local-tex-renderer-token"}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ latexSource: source, subjectKey: "MATH" }),
    });
    const render = (await response.json()) as {
      ok?: boolean;
      code?: string;
      log?: string;
      durationMs?: number;
      rendererVersion?: string;
    };
    expect(render.ok, `${render.code ?? "render failed"}: ${render.log ?? ""}`).toBe(true);

    console.info(
      `[QUIZ FONT LIVE] ${JSON.stringify({
        model: result.model,
        promptVersion: input.promptVersion,
        promptTokens: result.usage?.promptTokens ?? null,
        cachedInputTokens: result.usage?.cachedInputTokens ?? null,
        completionTokens: result.usage?.completionTokens ?? null,
        totalTokens: result.usage?.totalTokens ?? null,
        latencyMs: result.latencyMs ?? null,
        renderDurationMs: render.durationMs ?? null,
        rendererVersion: render.rendererVersion ?? null,
        literalLabel: source.match(/\\mathrm\s*\{\s*10\s*\\,\s*cm\s*\}/u)?.[0] ?? null,
      })}`,
    );
  }, 150_000);
});
