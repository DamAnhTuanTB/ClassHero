import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { describe, expect, it } from "vitest";

import { OpenAiProvider } from "#api/modules/ai/providers/openai.provider";
import {
  buildQuestionFigureInput,
  generatedQuizQuestionFigureSchema,
} from "#api/modules/quiz-figures/types/quiz-figure-generation.types";
import { assertQuizFigureLatexSource } from "#api/modules/quiz-figures/utils/quiz-figure-source-policy";
import {
  applyStemFigureQuickAction,
  type StemFigureQuickAction,
} from "../../web/lib/stem-figure-source-actions";

loadEnv({ path: resolve(process.cwd(), "../../.env"), override: false, quiet: true });

const runLiveTest = process.env.RUN_OPENAI_M9_23_QUICK_ACTIONS_LIVE_TESTS === "1";
const model = process.env.OPENAI_M9_23_LIVE_MODEL ?? "gpt-5.6-luna";
const budgetVnd = 10_000;

const actions: StemFigureQuickAction[] = [
  "REMOVE_LENGTH_LABELS",
  "REMOVE_ANGLE_MEASUREMENTS",
  "REMOVE_NUMERIC_LABELS",
  "REMOVE_DASHED_PATHS",
  "SET_LINE_WEIGHT_THIN",
  "SET_LINE_WEIGHT_NORMAL",
  "SET_LINE_WEIGHT_BOLD",
  "SET_PRIMARY_LABEL_SIZE_SMALL",
  "SET_PRIMARY_LABEL_SIZE_NORMAL",
  "SET_PRIMARY_LABEL_SIZE_LARGE",
  "SET_SECONDARY_LABEL_SIZE_TINY",
  "SET_SECONDARY_LABEL_SIZE_SMALL",
  "SET_SECONDARY_LABEL_SIZE_NORMAL",
  "SCALE_DOWN",
  "SCALE_UP",
];

const liveCases = [
  {
    label: "math-geometry-grade-8",
    subject: { key: "MATH", name: "Toán", slug: "toan" } as const,
    targetGrade: 8,
    problem:
      "Vẽ tam giác ABC vuông tại A, AB = 6 cm, AC = 8 cm và góc B bằng 53°. Hiển thị tên điểm, hai nhãn độ dài, số đo góc và một đường cao nét đứt từ A xuống BC.",
  },
  {
    label: "math-algebra-grade-10",
    subject: { key: "MATH", name: "Toán", slug: "toan" } as const,
    targetGrade: 10,
    problem:
      "Trong hệ trục Oxy, vẽ đồ thị y=x^2 trên đoạn [-2,2], ghi các mốc số -2, 0, 2 và vẽ hai đường gióng nét đứt từ điểm (2,4) về hai trục.",
  },
  {
    label: "physics-circuit-grade-8",
    subject: { key: "PHYSICS", name: "Vật lý", slug: "vat-ly" } as const,
    targetGrade: 8,
    problem:
      "Vẽ mạch kín đơn giản gồm nguồn 6 V, điện trở R và ampe kế A mắc nối tiếp. Ghi 6 V, R, A, chiều dòng điện I và thêm một đường tham chiếu nét đứt bên dưới mạch.",
  },
  {
    label: "chemistry-structure-grade-10",
    subject: { key: "CHEMISTRY", name: "Hóa học", slug: "hoa-hoc" } as const,
    targetGrade: 10,
    problem:
      "Vẽ công thức cấu tạo ethanol CH3-CH2-OH bằng các node C, H, O rõ ràng, ghi hệ số 2 ở cạnh phản ứng minh họa và thêm một mũi tên nét đứt chỉ liên kết hiđro. Không đổi ký hiệu nguyên tố.",
  },
] as const;

describe.skipIf(!runLiveTest)("M9.23 bounded OpenAI quick-action live matrix", () => {
  it("generates four cross-subject figures and compiles every deterministic edit", async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is required for the live test.");

    const provider = new OpenAiProvider({
      apiKey,
      requestTimeoutMs: 180_000,
      generationRequestTimeoutMs: 180_000,
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
      embeddingDimensions: Number(process.env.OPENAI_EMBEDDING_DIMENSIONS ?? 1536),
      chatModel: model,
      structuredModel: model,
    });
    const artifactDirectory = resolve(
      process.cwd(),
      process.env.OPENAI_M9_23_LIVE_OUTPUT_DIR ??
        "../../.codex/artifacts/m9-23-live-openai",
    );
    await mkdir(artifactDirectory, { recursive: true });

    const totals = {
      calls: 0,
      cachedInputTokens: 0,
      completionTokens: 0,
      costVnd: 0,
      promptTokens: 0,
      renders: 0,
    };
    for (const liveCase of liveCases) {
      const input = buildQuestionFigureInput({
        subject: liveCase.subject,
        targetGrade: liveCase.targetGrade,
        plan: { version: 1, role: "QUESTION", problem: liveCase.problem },
      });
      const result = await provider.generateStructured(
        { ...input, model, maxTokens: 2_500 },
        generatedQuizQuestionFigureSchema,
      );
      const source = result.data.latexSource;
      assertQuizFigureLatexSource(source);

      const costVnd = estimateLunaCostVnd(result.usage);
      totals.calls += 1;
      totals.promptTokens += result.usage?.promptTokens ?? 0;
      totals.cachedInputTokens += result.usage?.cachedInputTokens ?? 0;
      totals.completionTokens += result.usage?.completionTokens ?? 0;
      totals.costVnd += costVnd;
      expect(totals.costVnd).toBeLessThanOrEqual(budgetVnd);

      await writeFile(
        resolve(artifactDirectory, `${liveCase.label}-original.tex`),
        source,
      );
      for (const action of actions) {
        const transformed = applyStemFigureQuickAction(source, action);
        const rendered = await renderFigure(transformed.source, liveCase.subject.key);
        expect(
          rendered.ok,
          `${liveCase.label}/${action}: ${rendered.code ?? "UNKNOWN"}\n${rendered.log ?? ""}`,
        ).toBe(true);
        totals.renders += 1;
      }
      console.info(
        `[M9.23 OPENAI LIVE] ${JSON.stringify({
          case: liveCase.label,
          model: result.model,
          promptVersion: input.promptVersion,
          usage: result.usage ?? null,
          costVnd,
          cumulativeCostVnd: totals.costVnd,
        })}`,
      );
    }

    expect(totals.calls).toBe(4);
    expect(totals.renders).toBe(60);
    expect(totals.costVnd).toBeLessThanOrEqual(budgetVnd);
    console.info(`[M9.23 OPENAI LIVE TOTAL] ${JSON.stringify(totals)}`);
  }, 600_000);
});

async function renderFigure(latexSource: string, subjectKey: string) {
  const response = await fetch(
    new URL("/render", process.env.TEX_RENDERER_URL ?? "http://127.0.0.1:8080"),
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.TEX_RENDERER_TOKEN ?? "local-tex-renderer-token"}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ latexSource, subjectKey }),
    },
  );
  return (await response.json()) as { code?: string; log?: string; ok?: boolean };
}

function estimateLunaCostVnd(
  usage:
    | { cachedInputTokens?: number; completionTokens?: number; promptTokens?: number }
    | undefined,
) {
  if (!usage) return 0;
  const promptTokens = usage.promptTokens ?? 0;
  const cachedInputTokens = Math.min(promptTokens, usage.cachedInputTokens ?? 0);
  const uncachedInputTokens = Math.max(0, promptTokens - cachedInputTokens);
  const completionTokens = usage.completionTokens ?? 0;
  const costUsd =
    (uncachedInputTokens / 1_000_000) * 0.2 +
    (cachedInputTokens / 1_000_000) * 0.02 +
    (completionTokens / 1_000_000) * 1.2;
  return Math.round(costUsd * 27_200);
}
