import { resolve } from "node:path";
import { stemFigureLatexSourceSchema } from "@learning-path/shared";
import { config as loadEnv } from "dotenv";
import { describe, expect, it } from "vitest";

import { OpenAiProvider } from "#api/modules/ai/providers/openai.provider";
import type {
  AiOutputSchema,
  AiStructuredInput,
} from "#api/modules/ai/types/ai-text.types";
import { StemFigureRepairService } from "#api/modules/stem-figures/services/stem-figure-repair.service";
import type { StemFigureGenerationBrief } from "#api/modules/stem-figures/types/stem-figure-generation.types";

loadEnv({ path: resolve(process.cwd(), ".env"), override: false, quiet: true });
loadEnv({ path: resolve(process.cwd(), "../../.env"), override: false, quiet: true });

const runLiveTest = process.env.RUN_OPENAI_SUMMARY_TARGETED_FIGURE_LIVE_TEST === "1";
const maximumBudgetVnd = 5_000;

describe.skipIf(!runLiveTest)("Summary targeted figure live contract", () => {
  it("edits the current problem and solution figures without textbook images", async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is required for the live test.");

    const model = process.env.OPENAI_SUMMARY_TARGETED_FIGURE_LIVE_MODEL ?? "gpt-5.6-luna";
    const provider = new OpenAiProvider({
      apiKey,
      requestTimeoutMs: 300_000,
      generationRequestTimeoutMs: 300_000,
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
      embeddingDimensions: Number(process.env.OPENAI_EMBEDDING_DIMENSIONS ?? 1536),
      chatModel: model,
      structuredModel: model,
    });
    const usage = { calls: 0, input: 0, cachedInput: 0, output: 0 };
    const promptVersions: string[] = [];
    const service = new StemFigureRepairService(
      {
        generateStructured: async <TOutput>(
          _context: unknown,
          input: AiStructuredInput,
          schema: AiOutputSchema<TOutput>,
        ) => {
          if (usage.calls >= 2) throw new Error("Live-call guard exceeded two requests.");
          const result = await provider.generateStructured(
            { ...input, model, reasoningEffort: "medium", maxTokens: 3_000 },
            schema,
          );
          usage.calls += 1;
          usage.input += result.usage?.promptTokens ?? 0;
          usage.cachedInput += result.usage?.cachedInputTokens ?? 0;
          usage.output += result.usage?.completionTokens ?? 0;
          promptVersions.push(input.promptVersion);
          return result;
        },
      } as never,
      { get: () => 300_000 } as never,
    );

    const [questionSource, solutionSource] = await Promise.all([
      service.createNew(buildInput("QUESTION", 0)),
      service.createNew(buildInput("SOLUTION", 1)),
    ]);

    expect(stemFigureLatexSourceSchema.safeParse(questionSource).success).toBe(true);
    expect(stemFigureLatexSourceSchema.safeParse(solutionSource).success).toBe(true);
    expect(questionSource).not.toMatch(/\{\$?H\$?\}|AH/iu);
    expect(solutionSource).toMatch(/\{\$?H\$?\}|AH/iu);
    expect(promptVersions).toHaveLength(2);
    expect(promptVersions.every((version) => version.includes("edit-current-source"))).toBe(
      true,
    );

    const estimatedCostVnd = estimateLunaCostVnd(usage);
    console.info(
      `[SUMMARY TARGETED FIGURE LIVE] ${JSON.stringify({
        model,
        usage,
        promptVersions,
        estimatedCostVnd,
        questionSourceLength: questionSource.length,
        solutionSourceLength: solutionSource.length,
      })}`,
    );
    expect(usage.calls).toBe(2);
    expect(estimatedCostVnd).toBeLessThanOrEqual(maximumBudgetVnd);
  }, 600_000);
});

function buildInput(targetMode: "QUESTION" | "SOLUTION", figureIndex: 0 | 1) {
  return {
    figureId: `00000000-0000-4000-8000-00000000000${figureIndex + 1}`,
    revisionId: `00000000-0000-4000-8000-00000000001${figureIndex + 1}`,
    aiGenerationId: null,
    backgroundJobId: `00000000-0000-4000-8000-00000000002${figureIndex + 1}`,
    jobAttempt: 1,
    subject: { key: "MATH", name: "Toán", slug: "toan" },
    brief: buildBrief(targetMode),
    referenceImages: [],
  } as const;
}

function buildBrief(targetMode: "QUESTION" | "SOLUTION"): StemFigureGenerationBrief {
  const isQuestion = targetMode === "QUESTION";
  return {
    figurePlanContractVersion: 3,
    figureOrigin: "GENERATED_FROM_BRIEF",
    targetGrade: 8,
    blockPath: "sections.0.blocks.0",
    blockContent:
      isQuestion
        ? {
            type: "example",
            problem: "Cho tam giác ABC vuông tại A. Tính khoảng cách từ A đến BC.",
          }
        : {
            type: "example",
            problem: "Cho tam giác ABC vuông tại A. Tính khoảng cách từ A đến BC.",
            solution:
              "Kẻ đường cao AH vuông góc với BC tại H. Dùng hệ thức AB·AC = AH·BC để xác định AH.",
          },
    sourceReferences: [],
    referenceAssets: [],
    referenceImageMode: "CURRENT_ONLY",
    currentLatexSource: isQuestion ? QUESTION_SOURCE : SOLUTION_SOURCE,
    adminInstructions: isQuestion
      ? "Dịch nhãn A lên thêm một chút để tách khỏi hai cạnh; không đổi hình học hoặc các nhãn khác."
      : "Dịch nhãn H xuống thêm một chút để tách khỏi cạnh BC; giữ nguyên đường cao AH và toàn bộ hình học.",
    targetMode,
  };
}

const QUESTION_SOURCE = String.raw`\begin{tikzpicture}[line cap=round,line join=round]
\coordinate (A) at (1,2);
\coordinate (B) at (0,0);
\coordinate (C) at (4,0);
\draw (A) -- (B) -- (C) -- cycle;
\fill (A) circle (1.2pt) node[above] {$A$};
\fill (B) circle (1.2pt) node[below left] {$B$};
\fill (C) circle (1.2pt) node[below right] {$C$};
\end{tikzpicture}`;

const SOLUTION_SOURCE = String.raw`\begin{tikzpicture}[line cap=round,line join=round]
\coordinate (A) at (1,2);
\coordinate (B) at (0,0);
\coordinate (C) at (4,0);
\coordinate (H) at (1,0);
\draw (A) -- (B) -- (C) -- cycle;
\draw (A) -- (H);
\draw (1,0.18) -- (1.18,0.18) -- (1.18,0);
\fill (A) circle (1.2pt) node[above] {$A$};
\fill (B) circle (1.2pt) node[below left] {$B$};
\fill (C) circle (1.2pt) node[below right] {$C$};
\fill (H) circle (1.2pt) node[below] {$H$};
\end{tikzpicture}`;

function estimateLunaCostVnd(usage: {
  input: number;
  cachedInput: number;
  output: number;
}) {
  const cachedInput = Math.min(usage.input, usage.cachedInput);
  const uncachedInput = Math.max(0, usage.input - cachedInput);
  const costUsd =
    (uncachedInput / 1_000_000) * 0.2 +
    (cachedInput / 1_000_000) * 0.02 +
    (usage.output / 1_000_000) * 1.2;
  return Math.round(costUsd * 27_200);
}
