import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { describe, expect, it } from "vitest";

import { OpenAiProvider } from "#api/modules/ai/providers/openai.provider";
import { lessonSummaryProviderTransportOutputSchema } from "#api/modules/ai/types/lesson-summary.types";
import { buildLessonSummaryStructuredInput } from "#api/modules/ai/utils/lesson-summary-prompt";

const liveEnv: NodeJS.ProcessEnv = { ...process.env };
loadEnv({
  path: resolve(process.cwd(), "../../.env"),
  override: false,
  processEnv: liveEnv,
  quiet: true,
});

const runLiveTest = liveEnv.RUN_OPENAI_PROMPT_CACHE_LIVE_TESTS === "1";
const liveRunId = (liveEnv.M9_2_PROMPT_CACHE_LIVE_RUN_ID ?? "run")
  .trim()
  .replace(/[^a-zA-Z0-9_-]/gu, "-");
const cases = [
  {
    id: "grade-3-commutative",
    grade: 3,
    title: "Tính chất giao hoán của phép cộng",
    content: "Khi đổi chỗ các số hạng trong một tổng thì tổng không thay đổi: $a+b=b+a$.",
  },
  {
    id: "grade-8-square-sum",
    grade: 8,
    title: "Bình phương của một tổng",
    content: "$(a+b)^2=a^2+2ab+b^2$.",
  },
  {
    id: "grade-7-angle-sum",
    grade: 7,
    title: "Tổng ba góc của một tam giác",
    content: "Tổng ba góc của một tam giác bằng $180^\\circ$.",
  },
] as const;

describe.skipIf(!runLiveTest)("M9.2 OpenAI prompt cache live", () => {
  it("reuses the stable Summary prefix across different lesson inputs", async () => {
    const apiKey = liveEnv.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is required for the live test.");
    const provider = new OpenAiProvider({
      apiKey,
      requestTimeoutMs: 120_000,
      embeddingModel: liveEnv.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
      embeddingDimensions: Number(liveEnv.OPENAI_EMBEDDING_DIMENSIONS ?? 1536),
      chatModel: liveEnv.OPENAI_CHAT_MODEL ?? "gpt-4.1",
      structuredModel: liveEnv.OPENAI_STRUCTURED_MODEL ?? "gpt-4.1",
    });
    const artifactDirectory = resolve(
      process.cwd(),
      "../../tmp/m9-2-prompt-cache-live-comparison",
      liveRunId,
    );
    mkdirSync(artifactDirectory, { recursive: true });
    const measurements = [];

    for (const liveCase of cases) {
      const chunks = [
        {
          id: `chunk-${liveCase.id}`,
          content: liveCase.content,
          metadata: { caseId: liveCase.id, preserved: true },
        },
      ];
      const request = buildLessonSummaryStructuredInput({
        lessonId: `lesson-${liveCase.id}`,
        lessonTitle: liveCase.title,
        targetGrade: liveCase.grade,
        subject: { key: "MATH", name: "Toán", slug: "toan" },
        documentIds: [`document-${liveCase.id}`],
        sourceHash: `source-${liveCase.id}`,
        chunks,
        configuration: {
          style: "student_friendly",
          styleInstructions: "",
          length: "concise",
          targetWordCount: null,
          extraInstructions: "",
          schemaReferenceStrategy: "ref_v2",
          promptCacheKeyEnabled: true,
          promptCacheRetention: "24h",
        },
      });
      const result = await provider.generateStructured(
        {
          ...request,
          model: "gpt-5.4",
          reasoningEffort: "medium",
          maxTokens: 8_000,
        },
        lessonSummaryProviderTransportOutputSchema,
      );
      const promptTokens = result.usage?.promptTokens ?? 0;
      const cachedInputTokens = result.usage?.cachedInputTokens ?? 0;
      const measurement = {
        caseId: liveCase.id,
        providerRequestId: result.providerRequestId ?? null,
        model: result.model,
        usage: result.usage ?? null,
        latencyMs: result.latencyMs ?? null,
        uncachedInputTokens: Math.max(0, promptTokens - cachedInputTokens),
        cacheHitRatio: promptTokens === 0 ? 0 : cachedInputTokens / promptTokens,
      };
      measurements.push(measurement);
      writeFileSync(
        resolve(artifactDirectory, `${liveCase.id}.json`),
        `${JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            source: liveCase,
            requestMetadata: request.metadata,
            ...measurement,
            providerOutput: result.data,
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
    }

    expect(measurements.every((measurement) => measurement.usage)).toBe(true);
    expect(
      measurements.slice(1).some((measurement) => measurement.cacheHitRatio >= 0.5),
    ).toBe(true);
    writeFileSync(
      resolve(artifactDirectory, "comparison.json"),
      `${JSON.stringify(
        { generatedAt: new Date().toISOString(), measurements },
        null,
        2,
      )}\n`,
      "utf8",
    );
  }, 480_000);
});
