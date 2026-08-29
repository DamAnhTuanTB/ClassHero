import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { describe, expect, it } from "vitest";

import { OpenAiProvider } from "#api/modules/ai/providers/openai.provider";
import {
  buildQuestionFigureInput,
  generatedQuizQuestionFigureSchema,
} from "#api/modules/quiz-figures/types/quiz-figure-generation.types";
import { assertQuizFigureLatexSource } from "#api/modules/quiz-figures/utils/quiz-figure-source-policy";

loadEnv({ path: resolve(process.cwd(), "../../.env"), override: false, quiet: true });

const runLiveTest = process.env.RUN_OPENAI_QUIZ_VISIBLE_IDENTIFIER_LIVE_TESTS === "1";

describe("Quiz visible-identifier live assertion helper", () => {
  it("distinguishes internal coordinate names from learner-visible labels", () => {
    const source = [
      "\\coordinate (A) at (0,0);",
      "\\coordinate (B) at (1,0);",
      "\\node[below] at (A) {$P$};",
      "\\fill (B) circle (1pt) node[above] {$Q$};",
      "\\path (A) -- (B) node[midway] {$R$};",
    ].join("\n");

    expect(extractVisibleSingleLetterIdentifiers(source)).toEqual(["P", "Q", "R"]);
  });
});

describe.skipIf(!runLiveTest)("Quiz visible-identifier authority live regression", () => {
  it("keeps unnamed rectangle vertices unlabeled while retaining stated dimensions", async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is required for the live test.");

    const model = process.env.OPENAI_QUIZ_FIGURE_LIVE_MODEL ?? "gpt-5.6-luna";
    const provider = new OpenAiProvider({
      apiKey,
      requestTimeoutMs: 180_000,
      generationRequestTimeoutMs: 180_000,
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
        problem:
          "Một khung cửa hình chữ nhật có chiều rộng 5 m và chiều dài 12 m. Tính bán kính đường tròn đi qua bốn đỉnh của khung cửa.",
      },
    });
    const result = await provider.generateStructured(
      { ...input, model, maxTokens: 3_000 },
      generatedQuizQuestionFigureSchema,
    );
    const source = result.data.latexSource;

    assertQuizFigureLatexSource(source);
    expect(source).toMatch(/(?:5|5\s*\\,\s*m)/u);
    expect(source).toMatch(/(?:12|12\s*\\,\s*m)/u);
    expect(source).not.toMatch(
      /\bnode(?:\s*\[[^\]]*\])?(?:\s+at\s*\([^)]*\))?\s*\{\s*\$?\s*[A-Z]\s*\$?\s*\}/u,
    );

    const estimatedCostVnd = estimateLunaCostVnd(result.usage);
    expect(estimatedCostVnd).toBeLessThanOrEqual(5_000);
    console.info(
      `[QUIZ VISIBLE IDENTIFIER LIVE] ${JSON.stringify({
        model: result.model,
        promptVersion: input.promptVersion,
        usage: result.usage ?? null,
        estimatedCostVnd,
      })}`,
    );
  }, 240_000);

  it("renders every explicitly named vertex without inventing another identifier", async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is required for the live test.");

    const model = process.env.OPENAI_QUIZ_FIGURE_LIVE_MODEL ?? "gpt-5.6-luna";
    const provider = new OpenAiProvider({
      apiKey,
      requestTimeoutMs: 180_000,
      generationRequestTimeoutMs: 180_000,
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
        problem:
          "Cho tam giác PQR vuông tại P, biết PQ = 6 cm và PR = 8 cm. Tính độ dài cạnh QR.",
      },
    });
    const result = await provider.generateStructured(
      { ...input, model, maxTokens: 3_000 },
      generatedQuizQuestionFigureSchema,
    );
    const source = result.data.latexSource;

    assertQuizFigureLatexSource(source);
    expect(extractVisibleSingleLetterIdentifiers(source)).toEqual(["P", "Q", "R"]);

    const estimatedCostVnd = estimateLunaCostVnd(result.usage);
    expect(estimatedCostVnd).toBeLessThanOrEqual(5_000);
    console.info(
      `[QUIZ NAMED IDENTIFIER LIVE] ${JSON.stringify({
        model: result.model,
        promptVersion: input.promptVersion,
        usage: result.usage ?? null,
        estimatedCostVnd,
        visibleIdentifiers: extractVisibleSingleLetterIdentifiers(source),
      })}`,
    );
  }, 240_000);
});

function extractVisibleSingleLetterIdentifiers(source: string) {
  const identifiers = [
    ...source.matchAll(
      /\bnode(?:\s*\[[^\]]*\])?(?:\s+at\s*\([^)]*\))?\s*\{\s*\$?\s*([A-Z])\s*\$?\s*\}/gu,
    ),
  ].map((match) => match[1]);
  return [...new Set(identifiers)].sort();
}

function estimateLunaCostVnd(
  usage:
    | {
        promptTokens?: number;
        cachedInputTokens?: number;
        completionTokens?: number;
      }
    | undefined,
) {
  if (!usage) return 0;
  const promptTokens = usage.promptTokens ?? 0;
  const cachedInputTokens = Math.min(promptTokens, usage.cachedInputTokens ?? 0);
  const uncachedInputTokens = Math.max(0, promptTokens - cachedInputTokens);
  const outputTokens = usage.completionTokens ?? 0;
  const costUsd =
    (uncachedInputTokens / 1_000_000) * 0.2 +
    (cachedInputTokens / 1_000_000) * 0.02 +
    (outputTokens / 1_000_000) * 1.2;
  return Math.round(costUsd * 27_200);
}
