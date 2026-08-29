import { resolve } from "node:path";
import { QuestionType } from "@prisma/client";
import { config as loadEnv } from "dotenv";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { OpenAiProvider } from "#api/modules/ai/providers/openai.provider";
import {
  singleQuizSolutionRefinementOutputSchema,
  textInputQuizSolutionRegenerationOutputSchema,
} from "#api/modules/quiz/types/quiz-solution-refinement.types";
import {
  buildQuizSolutionRefinementInput,
  buildQuizSolutionRegenerationInput,
} from "#api/modules/quiz/utils/quiz-solution-refinement-prompt";

loadEnv({ path: resolve(process.cwd(), "../../.env"), override: false, quiet: true });

const runLiveTest =
  process.env.RUN_OPENAI_QUIZ_SOLUTION_REFINEMENT_LIVE_TESTS === "1";
const model = "gpt-5.6-luna";
const usdToVnd = 25_500;
const inputUsdPerMillion = 0.2;
const outputUsdPerMillion = 1.2;

describe.skipIf(!runLiveTest)("M9.24 Quiz solution actions live", () => {
  it("refines a correct solution without changing the locked answer", async () => {
    const provider = createProvider();
    const request = buildQuizSolutionRefinementInput({
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      targetGrade: 7,
      question: {
        questionType: QuestionType.TEXT_INPUT,
        problem: "Giải phương trình $2(x-1)=8$.",
        options: [],
        correctAnswer: ["5"],
        currentHint: "Chia hai vế cho 2.",
        currentSolution: "$2(x-1)=8$, nên $x=5$.",
      },
      adminInstructions:
        "Trình bày đủ phép biến đổi tương đương, mỗi bước chính thành một đoạn rõ ràng.",
    });
    const result = await provider.generateStructured(
      { ...request, model, maxTokens: 1_200 },
      singleQuizSolutionRefinementOutputSchema,
    );
    const compact = result.data.solution.replaceAll(" ", "");
    const estimatedVnd = estimateVnd(result.usage);

    expect(compact).toContain("x=5");
    expect(compact).toContain("x-1");
    expect(compact).toMatch(/(?:\\frac\{8\}\{2\}|2x-2)/u);
    expect(result.data.solution).not.toMatch(/^(?:Lời giải|Đáp án)\s*:/iu);
    expect(estimatedVnd).toBeLessThanOrEqual(5_000);
    console.info(
      `[M9.24 REFINE LIVE] model=${model} estimatedVnd=${estimatedVnd.toFixed(2)} ` +
        `solution=${JSON.stringify(result.data.solution)}`,
    );
  }, 180_000);

  it("regenerates answer, hint and solution from the problem plus its figure", async () => {
    const provider = createProvider();
    const questionImageDataUrl = await buildSemicircleQuestionImage();
    const request = buildQuizSolutionRegenerationInput({
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      targetGrade: 9,
      question: {
        questionType: QuestionType.TEXT_INPUT,
        problem:
          "Một khung hình chữ nhật rộng 8 m, cao 3 m có cạnh đáy nằm trên đường kính của một mái vòm nửa đường tròn và hai đỉnh trên nằm trên cung. Tính bán kính mái vòm.",
        options: [],
        correctAnswer: ["25/6"],
        currentHint: "Gợi ý cũ sai.",
        currentSolution: "Lời giải cũ sai và không được gửi cho model.",
      },
      adminInstructions: "Đối chiếu dữ kiện trong hình trước khi lập phương trình.",
      questionImageDataUrl,
    });

    expect(request.inputImages).toEqual([
      { imageUrl: questionImageDataUrl, detail: "high" },
    ]);
    expect(request.userPrompt).not.toContain("25/6");
    expect(request.userPrompt).not.toContain("Gợi ý cũ sai");
    expect(request.userPrompt).not.toContain("Lời giải cũ sai");

    const result = await provider.generateStructured(
      { ...request, model, maxTokens: 1_500 },
      textInputQuizSolutionRegenerationOutputSchema,
    );
    const estimatedVnd = estimateVnd(result.usage);

    expect(result.data.correctAnswer).toBe("5");
    expect(result.data.hint.length).toBeGreaterThan(0);
    expect(result.data.solution.replaceAll(" ", "")).toMatch(/R=5/u);
    expect(estimatedVnd).toBeLessThanOrEqual(5_000);
    console.info(
      `[M9.24 REGENERATE LIVE] model=${model} estimatedVnd=${estimatedVnd.toFixed(2)} ` +
        `answer=${result.data.correctAnswer} hint=${JSON.stringify(result.data.hint)} ` +
        `solution=${JSON.stringify(result.data.solution)}`,
    );
  }, 180_000);
});

function createProvider() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for the live test.");
  return new OpenAiProvider({
    apiKey,
    requestTimeoutMs: 120_000,
    generationRequestTimeoutMs: 120_000,
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
    embeddingDimensions: Number(process.env.OPENAI_EMBEDDING_DIMENSIONS ?? 1536),
    chatModel: model,
    structuredModel: model,
  });
}

function estimateVnd(
  usage: { promptTokens?: number; completionTokens?: number } | null | undefined,
) {
  return (
    (((usage?.promptTokens ?? 0) * inputUsdPerMillion +
      (usage?.completionTokens ?? 0) * outputUsdPerMillion) /
      1_000_000) *
    usdToVnd
  );
}

async function buildSemicircleQuestionImage() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="900" height="520" viewBox="0 0 900 520">
      <rect width="900" height="520" fill="white"/>
      <path d="M200 430 A250 250 0 0 1 700 430" fill="none" stroke="black" stroke-width="5"/>
      <line x1="200" y1="430" x2="700" y2="430" stroke="black" stroke-width="5"/>
      <rect x="250" y="280" width="400" height="150" fill="none" stroke="black" stroke-width="5"/>
      <circle cx="450" cy="430" r="7" fill="black"/>
      <text x="430" y="465" font-size="30" font-family="Arial">O</text>
      <text x="415" y="500" font-size="30" font-family="Arial">8 m</text>
      <text x="665" y="335" font-size="30" font-family="Arial">3 m</text>
    </svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}
