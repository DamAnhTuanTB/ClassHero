import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { describe, expect, it } from "vitest";

import { autoRepairReversedInteriorAnglePics } from "#api/common/ai/tikz-angle-auto-repair";
import { OpenAiProvider } from "#api/modules/ai/providers/openai.provider";
import type { AiOutputSchema, AiStructuredInput } from "#api/modules/ai/types/ai-text.types";
import { StemFigureRepairService } from "#api/modules/stem-figures/services/stem-figure-repair.service";
import type { StemFigureGenerationBrief } from "#api/modules/stem-figures/types/stem-figure-generation.types";
import {
  buildQuestionFigureInput,
  generatedQuizQuestionFigureSchema,
} from "#api/modules/quiz-figures/types/quiz-figure-generation.types";
import {
  assertQuizFigureLatexSource,
  autoRepairQuizFigureLatexSource,
} from "#api/modules/quiz-figures/utils/quiz-figure-source-policy";

loadEnv({ path: resolve(process.cwd(), "../../.env"), override: false, quiet: true });

const runLiveTest = process.env.RUN_OPENAI_ANGLE_AUTO_REPAIR_LIVE_TESTS === "1";
const liveTarget = process.env.OPENAI_ANGLE_AUTO_REPAIR_TARGET ?? "both";
const outputDirectory =
  process.env.OPENAI_ANGLE_AUTO_REPAIR_OUTPUT_DIR ??
  "/tmp/ai-angle-orientation-auto-repair-live";
const subject = { key: "MATH", name: "Toán", slug: "toan" } as const;
const problem =
  "Tứ giác lồi ABCD nội tiếp một đường tròn, có góc DAB = 74°, góc BCD = 106°, góc ABC = 88° và góc CDA = 92°. Vẽ đầy đủ tứ giác, đường tròn ngoại tiếp và đánh dấu bốn góc đã cho; các góc có giá trị khác nhau phải dùng marker cung khác nhau.";

describe.skipIf(!runLiveTest)("Math angle orientation and auto-repair live smoke", () => {
  it("generates, normalizes and compiles Quiz and Summary figures", async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is required for the live test.");

    const model = process.env.OPENAI_ANGLE_AUTO_REPAIR_MODEL ?? "gpt-5.6-luna";
    const provider = new OpenAiProvider({
      apiKey,
      requestTimeoutMs: 180_000,
      generationRequestTimeoutMs: 180_000,
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
      embeddingDimensions: Number(process.env.OPENAI_EMBEDDING_DIMENSIONS ?? 1536),
      chatModel: model,
      structuredModel: model,
    });
    await mkdir(outputDirectory, { recursive: true });

    const quizPlan = { version: 1 as const, role: "QUESTION" as const, problem };
    const quizInput = buildQuestionFigureInput({
      subject,
      targetGrade: 9,
      plan: quizPlan,
    });
    const quizOutput = await provider.generateStructured(
      { ...quizInput, model, maxTokens: 4_000 },
      generatedQuizQuestionFigureSchema,
    );
    const quizRepair = autoRepairQuizFigureLatexSource({
      source: quizOutput.data.latexSource,
      subjectKey: subject.key,
      authorityText: JSON.stringify(quizPlan),
    });
    assertQuizFigureLatexSource(quizRepair.source);
    expectNoRemainingDetectableReflexInteriorAngles(quizRepair.source, problem);
    expectDistinctVisibleAngleMarkers(quizRepair.source, 4);
    const quizRender = await renderFigure(quizRepair.source);
    expect(quizRender.ok, quizRender.log ?? quizRender.code).toBe(true);
    const quizUsageSummary = {
      model,
      calls: 1,
      quizPromptVersion: quizInput.promptVersion,
      quizAutoRepairCount: quizRepair.changes.length,
      quizUsage: quizOutput.usage ?? null,
      estimatedCostVnd: estimateLunaCostVnd(quizOutput.usage),
      outputDirectory,
    };
    expect(quizUsageSummary.estimatedCostVnd).toBeLessThanOrEqual(5_000);
    await Promise.all([
      writeFile(resolve(outputDirectory, "quiz-raw.tex"), quizOutput.data.latexSource),
      writeFile(resolve(outputDirectory, "quiz-final.tex"), quizRepair.source),
      writeFile(resolve(outputDirectory, "quiz.svg"), quizRender.svg ?? ""),
      writeFile(
        resolve(outputDirectory, "quiz-usage.json"),
        `${JSON.stringify(quizUsageSummary, null, 2)}\n`,
      ),
    ]);
    if (liveTarget === "quiz") {
      console.info(`[ANGLE AUTO-REPAIR LIVE] ${JSON.stringify(quizUsageSummary)}`);
      return;
    }

    let rawStemSource = "";
    let stemUsage: typeof quizOutput.usage;
    const stemService = new StemFigureRepairService(
      {
        generateStructured: async <TOutput>(
          _context: unknown,
          input: AiStructuredInput,
          schema: AiOutputSchema<TOutput>,
        ) => {
          const result = await provider.generateStructured(
            { ...input, model, maxTokens: 4_000 },
            schema,
          );
          rawStemSource = (result.data as { latexSource: string }).latexSource;
          stemUsage = result.usage;
          return result;
        },
      } as never,
      { get: () => 180_000 } as never,
    );
    const stemBrief: StemFigureGenerationBrief = {
      figurePlanContractVersion: 3,
      figureOrigin: "GENERATED_FROM_BRIEF",
      targetGrade: 9,
      blockPath: "sections[0].blocks[0]",
      blockContent: { type: "knowledge", title: "Góc của tứ giác nội tiếp", content: problem },
      sourceReferences: [],
      referenceAssets: [],
      referenceImageMode: "NONE",
      adminInstructions: null,
    };
    const stemSource = await stemService.createNew({
      figureId: "00000000-0000-4000-8000-000000000101",
      revisionId: "00000000-0000-4000-8000-000000000102",
      aiGenerationId: null,
      backgroundJobId: "00000000-0000-4000-8000-000000000103",
      jobAttempt: 1,
      subject,
      brief: stemBrief,
      referenceImages: [],
    });
    expectNoRemainingDetectableReflexInteriorAngles(stemSource, problem);
    expectDistinctVisibleAngleMarkers(stemSource, 4);
    const stemRender = await renderFigure(stemSource);
    expect(stemRender.ok, stemRender.log ?? stemRender.code).toBe(true);

    const rawStemRepair = autoRepairReversedInteriorAnglePics({
      source: rawStemSource,
      authorityText: problem,
    });
    const usageSummary = {
      model,
      calls: 2,
      quizPromptVersion: quizInput.promptVersion,
      quizAutoRepairCount: quizRepair.changes.length,
      stemAutoRepairCount: rawStemRepair.changes.length,
      quizUsage: quizOutput.usage ?? null,
      stemUsage: stemUsage ?? null,
      estimatedCostVnd:
        estimateLunaCostVnd(quizOutput.usage) + estimateLunaCostVnd(stemUsage),
      outputDirectory,
    };
    expect(usageSummary.estimatedCostVnd).toBeLessThanOrEqual(5_000);
    await Promise.all([
      writeFile(resolve(outputDirectory, "quiz-raw.tex"), quizOutput.data.latexSource),
      writeFile(resolve(outputDirectory, "quiz-final.tex"), quizRepair.source),
      writeFile(resolve(outputDirectory, "quiz.svg"), quizRender.svg ?? ""),
      writeFile(resolve(outputDirectory, "summary-raw.tex"), rawStemSource),
      writeFile(resolve(outputDirectory, "summary-final.tex"), stemSource),
      writeFile(resolve(outputDirectory, "summary.svg"), stemRender.svg ?? ""),
      writeFile(
        resolve(outputDirectory, "usage.json"),
        `${JSON.stringify(usageSummary, null, 2)}\n`,
      ),
    ]);
    console.info(`[ANGLE AUTO-REPAIR LIVE] ${JSON.stringify(usageSummary)}`);
  }, 420_000);
});

function expectNoRemainingDetectableReflexInteriorAngles(source: string, authority: string) {
  expect(
    autoRepairReversedInteriorAnglePics({ source, authorityText: authority }).changes,
  ).toHaveLength(0);
}

function expectDistinctVisibleAngleMarkers(source: string, expectedGroups: number) {
  const groups = new Map<string, string[]>();
  const picPattern = /\\pic\s*(?:\[([^\]]*)\])?\s*\{angle\s*=\s*([^}]+)\}/g;
  for (const match of source.matchAll(picPattern)) {
    const options = (match[1] ?? "")
      .replace(/angle radius\s*=\s*[^,\]]+/gi, "")
      .replace(/angle eccentricity\s*=\s*[^,\]]+/gi, "")
      .replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .sort()
      .join(",");
    const triple = (match[2] ?? "").replace(/\s+/g, "");
    groups.set(triple, [...(groups.get(triple) ?? []), options]);
  }
  expect(groups.size).toBe(expectedGroups);
  const markerSignatures = [...groups.values()].map(
    (options) => `${options.length}:${[...new Set(options)].sort().join("+")}`,
  );
  expect(new Set(markerSignatures).size).toBe(expectedGroups);
}

async function renderFigure(latexSource: string) {
  const response = await fetch("http://127.0.0.1:8080/render", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.TEX_RENDERER_TOKEN ?? "local-tex-renderer-token"}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ latexSource, subjectKey: "MATH" }),
  });
  return (await response.json()) as {
    ok?: boolean;
    svg?: string;
    code?: string;
    log?: string;
  };
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
