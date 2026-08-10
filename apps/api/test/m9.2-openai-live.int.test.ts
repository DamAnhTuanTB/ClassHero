import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { describe, expect, it } from "vitest";

import { OpenAiProvider } from "#api/modules/ai/providers/openai.provider";
import {
  lessonSummaryOutputSchema,
  lessonSummaryProviderTransportOutputSchema,
} from "#api/modules/ai/types/lesson-summary.types";
import { mapLessonSummaryProviderOutput } from "#api/modules/ai/utils/lesson-summary-mapper";
import { buildLessonSummaryStructuredInput } from "#api/modules/ai/utils/lesson-summary-prompt";
import { recoverLessonSummaryProviderOutput } from "#api/modules/ai/utils/lesson-summary-recovery";

loadEnv({ path: resolve(process.cwd(), "../../.env"), override: false });

const runLiveTest = process.env.RUN_OPENAI_LIVE_TESTS === "1";
const chunks = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    content:
      "Bài 15. Ba trường hợp bằng nhau của tam giác vuông. Nếu hai cạnh góc vuông của tam giác vuông này lần lượt bằng hai cạnh góc vuông của tam giác vuông kia thì hai tam giác vuông đó bằng nhau. Nếu cạnh huyền và một cạnh góc vuông tương ứng bằng nhau thì hai tam giác vuông bằng nhau.",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    content:
      "Ví dụ. Cho tam giác ABC vuông tại B và tam giác ADC vuông tại D. Biết AB = AD và AC là cạnh huyền chung. Chứng minh tam giác ABC bằng tam giác ADC. Bài tập vận dụng. Hai thanh giằng tạo thành hai tam giác vuông có cạnh huyền và một cạnh góc vuông tương ứng bằng nhau. Chứng minh hai khung bằng nhau.",
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
      lessonTitle: "Bài 15: Ba trường hợp bằng nhau của tam giác vuông",
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
      {
        ...request,
        model: "gpt-5.4",
        reasoningEffort: "medium",
      },
      lessonSummaryProviderTransportOutputSchema,
    );
    const recovery = recoverLessonSummaryProviderOutput({
      output: result.data,
      contextChunks: chunks,
    });
    const summary = mapLessonSummaryProviderOutput({
      lessonId: "lesson-live",
      output: recovery.output,
      contextChunks: chunks,
      reviewIssuesByPath: recovery.reviewIssuesByPath,
      rootReviewIssues: recovery.rootReviewIssues,
    });

    expect(summary.sections.at(-1)).toMatchObject({
      displayHeading: "Bài tập vận dụng",
      blocks: [
        expect.objectContaining({ type: "example" }),
        expect.objectContaining({ type: "example" }),
      ],
    });
    expect(() => lessonSummaryOutputSchema.parse(summary)).not.toThrow();
    expect(result.usage?.totalTokens).toBeGreaterThan(0);
    const issueCount = summary.sections.reduce(
      (total, section) =>
        total +
        section.blocks.reduce(
          (blockTotal, block) => blockTotal + (block.reviewIssues?.length ?? 0),
          0,
        ),
      summary.reviewIssues?.length ?? 0,
    );
    const artifactDirectory = resolve(
      process.cwd(),
      "../../tmp/m9-2-partial-review-live",
    );
    mkdirSync(artifactDirectory, { recursive: true });
    writeFileSync(
      resolve(artifactDirectory, "live-bai-15.json"),
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          provider: result.provider,
          model: result.model,
          usage: result.usage ?? null,
          latencyMs: result.latencyMs ?? null,
          providerOutput: result.data,
          summary,
          issueCount,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    console.info(
      `[M9.2 LIVE] model=${result.model} inputTokens=${result.usage?.promptTokens ?? "unknown"} ` +
        `outputTokens=${result.usage?.completionTokens ?? "unknown"} totalTokens=${result.usage?.totalTokens ?? "unknown"} ` +
        `latencyMs=${result.latencyMs ?? "unknown"} reviewIssues=${issueCount}`,
    );
  }, 150_000);
});
