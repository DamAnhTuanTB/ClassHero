import { resolve } from "node:path";
import { Difficulty, QuestionType } from "@prisma/client";
import { config as loadEnv } from "dotenv";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { OpenAiProvider } from "#api/modules/ai/providers/openai.provider";
import { lessonSummaryProviderTransportOutputSchema } from "#api/modules/ai/types/lesson-summary.types";
import type {
  AiOutputSchema,
  AiStructuredInput,
  AiTokenUsage,
} from "#api/modules/ai/types/ai-text.types";
import { isAiProviderOutputError } from "#api/modules/ai/utils/ai-output-validation";
import { buildLessonSummaryStructuredInput } from "#api/modules/ai/utils/lesson-summary-prompt";
import {
  getGeneratedQuizOutputSchema,
  type QuizGenerationJobInput,
} from "#api/modules/quiz/types/quiz-generation.types";
import { buildQuizStructuredInput } from "#api/modules/quiz/utils/quiz-generation-prompt";

const liveEnv: NodeJS.ProcessEnv = { ...process.env };
loadEnv({
  path: resolve(process.cwd(), "../../.env"),
  override: false,
  processEnv: liveEnv,
  quiet: true,
});

const runLiveTest = liveEnv.RUN_OPENAI_EXPLICIT_CACHE_LIVE_TESTS === "1";
const MODEL = "gpt-5.6-luna";
const MAX_OUTPUT_TOKENS = 64;
const MAX_BUDGET_VND = 10_000;
const FX_RATE_VND_PER_USD = 25_000;
const ZERO_USAGE_FALLBACK_INPUT_TOKENS = 100_000;

describe.skipIf(!runLiveTest)("OpenAI GPT-5.6 explicit prompt cache live", () => {
  it("reuses the stable Summary and Quiz system prefixes", async () => {
    const apiKey = liveEnv.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is required for the live test.");
    const provider = new OpenAiProvider({
      apiKey,
      requestTimeoutMs: 120_000,
      generationRequestTimeoutMs: 120_000,
      embeddingModel: liveEnv.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
      embeddingDimensions: Number(liveEnv.OPENAI_EMBEDDING_DIMENSIONS ?? 1536),
      chatModel: MODEL,
      structuredModel: MODEL,
    });
    const measurements: LiveMeasurement[] = [];

    for (const variant of ["A", "B"] as const) {
      const packet = await createOnePagePdf(
        `Summary source ${variant}: a rectangle has opposite sides equal.`,
      );
      const request = buildLessonSummaryStructuredInput({
        lessonId: `live-summary-${variant}`,
        lessonTitle: `Rectangle properties ${variant}`,
        targetGrade: 6,
        subject: { key: "MATH", name: "Toán", slug: "toan" },
        documentIds: [`live-document-summary-${variant}`],
        sourceHash: `live-summary-source-${variant}`,
        packet: {
          filename: `summary-${variant}.pdf`,
          bytes: packet,
          modelManifest: {
            version: 1,
            pages: [
              {
                packetPageNumber: 1,
                sourceKey: `summary-${variant}`,
                documentTitle: `Summary ${variant}`,
                sourcePdfPageNumber: 1,
                printedPageLabel: "1",
              },
            ],
          },
        },
        configuration: {
          style: "concise",
          styleInstructions: "",
          length: "short",
          targetWordCount: null,
          extraInstructions: "",
          schemaReferenceStrategy: "ref_v2",
          promptCacheKeyEnabled: true,
          promptCacheRetention: "in_memory",
        },
      });
      measurements.push(
        await measureStructuredCall(
          provider,
          `summary-${variant}`,
          request,
          lessonSummaryProviderTransportOutputSchema,
        ),
      );
      assertBudget(measurements);
    }

    const quizSchema = getGeneratedQuizOutputSchema({
      subjectKey: "MATH",
      targetGrade: 6,
      questionCount: 1,
      questionTypes: [QuestionType.TRUE_FALSE],
      difficulty: Difficulty.EASY,
    });
    for (const variant of ["A", "B"] as const) {
      const packet = await createOnePagePdf(
        `Quiz source ${variant}: a rectangle has four right angles.`,
      );
      const configuration: QuizGenerationJobInput = {
        requestDraftId: "00000000-0000-4000-8000-000000000099",
        requestHash: "b".repeat(64),
        packetHash: "c".repeat(64),
        manifestHash: "d".repeat(64),
        targetQuizSetId: null,
        documentIds: [`live-document-quiz-${variant}`],
        sourceHash: `live-quiz-source-${variant}`,
        targetGrade: 6,
        subjectKey: "MATH",
        subjectName: "Toán",
        subjectSlug: "toan",
        questionCount: 1,
        difficulty: Difficulty.EASY,
        difficultyCounts: null,
        questionTypes: [QuestionType.TRUE_FALSE],
        style: "concise",
        styleInstructions: "",
        extraInstructions: "",
        systemInstructions: "",
        userPrompt: "",
        schemaReferenceStrategy: "ref_v2",
        promptCacheKeyEnabled: true,
        promptCacheRetention: "in_memory",
        maxOutputTokens: 12_000,
      };
      const request = buildQuizStructuredInput({
        lessonId: `live-quiz-${variant}`,
        lessonTitle: `Rectangle quiz ${variant}`,
        sourceHash: configuration.sourceHash,
        documentIds: configuration.documentIds,
        packet: { filename: `quiz-${variant}.pdf`, bytes: packet },
        configuration,
      });
      measurements.push(
        await measureStructuredCall(provider, `quiz-${variant}`, request, quizSchema),
      );
      assertBudget(measurements);
    }

    const summarySecond = measurements.find((item) => item.id === "summary-B")!;
    const quizSecond = measurements.find((item) => item.id === "quiz-B")!;
    expect(summarySecond.usage.cachedInputTokens ?? 0).toBeGreaterThan(0);
    expect(quizSecond.usage.cachedInputTokens ?? 0).toBeGreaterThan(0);
    console.info(
      `[OPENAI EXPLICIT CACHE LIVE] ${JSON.stringify({
        model: MODEL,
        measurements,
        estimatedTotalVnd: estimateTotalVnd(measurements),
      })}`,
    );
  }, 480_000);
});

type LiveMeasurement = {
  id: string;
  providerRequestId: string | null;
  usage: AiTokenUsage;
};

async function measureStructuredCall<TOutput>(
  provider: OpenAiProvider,
  id: string,
  request: AiStructuredInput,
  schema: AiOutputSchema<TOutput>,
): Promise<LiveMeasurement> {
  try {
    const output = await provider.generateStructured(
      {
        ...request,
        model: MODEL,
        reasoningEffort: "low",
        maxTokens: MAX_OUTPUT_TOKENS,
      },
      schema,
    );
    if (!output.usage) throw new Error(`Live request ${id} returned no usage.`);
    return {
      id,
      providerRequestId: output.providerRequestId ?? null,
      usage: output.usage,
    };
  } catch (error) {
    if (!isAiProviderOutputError(error) || !error.details.usage) throw error;
    return {
      id,
      providerRequestId: error.details.providerRequestId ?? null,
      usage: error.details.usage,
    };
  }
}

async function createOnePagePdf(text: string) {
  const document = await PDFDocument.create();
  const page = document.addPage([360, 240]);
  const font = await document.embedFont(StandardFonts.Helvetica);
  page.drawText(text, { x: 24, y: 180, size: 11, font, maxWidth: 312 });
  return Buffer.from(await document.save());
}

function estimateTotalVnd(measurements: LiveMeasurement[]) {
  const totalUsd = measurements.reduce((sum, item) => {
    const reportedPromptTokens = Math.max(0, item.usage.promptTokens ?? 0);
    const promptTokens =
      reportedPromptTokens === 0
        ? ZERO_USAGE_FALLBACK_INPUT_TOKENS
        : reportedPromptTokens;
    const cachedTokens = Math.max(0, item.usage.cachedInputTokens ?? 0);
    const reportedCacheWriteTokens = Math.max(0, item.usage.cacheWriteInputTokens ?? 0);
    const cacheWriteTokens =
      reportedPromptTokens === 0 ? promptTokens : reportedCacheWriteTokens;
    const uncachedTokens = Math.max(0, promptTokens - cachedTokens - cacheWriteTokens);
    const outputTokens = Math.max(0, item.usage.completionTokens ?? 0);
    return (
      sum +
      (uncachedTokens * 0.2 + cacheWriteTokens * 0.25 + cachedTokens * 0.02) / 1_000_000 +
      (outputTokens * 1.2) / 1_000_000
    );
  }, 0);
  return Math.ceil(totalUsd * FX_RATE_VND_PER_USD);
}

function assertBudget(measurements: LiveMeasurement[]) {
  expect(estimateTotalVnd(measurements)).toBeLessThanOrEqual(MAX_BUDGET_VND);
}
