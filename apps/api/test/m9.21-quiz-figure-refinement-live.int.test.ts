import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { describe, expect, it } from "vitest";

import { OpenAiProvider } from "#api/modules/ai/providers/openai.provider";
import {
  buildQuizFigureRefinementInput,
  generatedQuizFigureRefinementSchema,
  generatedQuizSolutionExtensionSchema,
  QUIZ_FIGURE_EXTENSION_MARKER,
  type QuizFigurePlan,
} from "#api/modules/quiz-figures/types/quiz-figure-generation.types";
import { buildQuizFigureRefinementImageDataUrl } from "#api/modules/quiz-figures/utils/quiz-figure-refinement-image";
import {
  applyQuizSolutionExtension,
  assertQuizFigureLatexSource,
} from "#api/modules/quiz-figures/utils/quiz-figure-source-policy";

loadEnv({ path: resolve(process.cwd(), "../../.env"), override: false, quiet: true });

const runLiveTest = process.env.RUN_OPENAI_QUIZ_FIGURE_REFINEMENT_LIVE_TESTS === "1";
const subject = { key: "MATH", name: "Toán", slug: "toan" } as const;

const exactQuestionSource = [
  "\\begin{tikzpicture}[scale=1]",
  "\\coordinate (A) at (0,0);",
  "\\coordinate (B) at (4,0);",
  "\\coordinate (C) at (1,3);",
  "\\draw[thick] (A) -- (B) -- (C) -- cycle;",
  "\\node[below left] at (A) {A};",
  "\\node[below right] at (B) {B};",
  "\\node[above] at (C) {C};",
  QUIZ_FIGURE_EXTENSION_MARKER,
  "\\end{tikzpicture}",
].join("\n");

const wrongQuestionSource = [
  "\\begin{tikzpicture}[scale=1]",
  "\\coordinate (A) at (0,0);",
  "\\coordinate (B) at (3,0);",
  "\\coordinate (C) at (3,4);",
  "\\draw[thick] (A) -- (B) -- (C) -- cycle;",
  "\\draw (2.7,0) -- (2.7,0.3) -- (3,0.3);",
  "\\node[below] at (A) {A};",
  "\\node[below] at (B) {B};",
  "\\node[right] at (C) {C};",
  QUIZ_FIGURE_EXTENSION_MARKER,
  "\\end{tikzpicture}",
].join("\n");

const wrongExtendedSource = exactQuestionSource.replace(
  QUIZ_FIGURE_EXTENSION_MARKER,
  [
    QUIZ_FIGURE_EXTENSION_MARKER,
    "% Sai: dựng đường cao từ B xuống AC thay vì từ A xuống BC.",
    "\\coordinate (K) at (0.4,1.2);",
    "\\draw[dashed] (B) -- (K);",
    "\\node[left] at (K) {K};",
  ].join("\n"),
);

const wrongRedrawSource = [
  "\\begin{tikzpicture}[scale=1]",
  "% Sai: source cũ chỉ vẽ một hình chữ nhật, không mô hình hóa quãng đường.",
  "\\draw[thick] (0,0) rectangle (4,2);",
  "\\node at (2,1) {15};",
  "\\end{tikzpicture}",
].join("\n");

const wrongQuestionSvg = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="300"><path d="M40 250L240 250L240 50Z" fill="none" stroke="black" stroke-width="3"/><path d="M220 250L220 230L240 230" fill="none" stroke="black"/><text x="25" y="275">A</text><text x="245" y="275">B</text><text x="250" y="50">C</text></svg>',
);
const exactQuestionSvg = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="300"><path d="M40 250L300 250L105 45Z" fill="none" stroke="black" stroke-width="3"/><text x="25" y="275">A</text><text x="305" y="275">B</text><text x="100" y="35">C</text></svg>',
);
const wrongExtendedSvg = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="300"><path d="M40 250L300 250L105 45Z" fill="none" stroke="black" stroke-width="3"/><path d="M300 250L65 170" fill="none" stroke="red" stroke-dasharray="7 5"/><text x="25" y="275">A</text><text x="305" y="275">B</text><text x="100" y="35">C</text><text x="50" y="165">K</text></svg>',
);
const wrongRedrawSvg = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="220"><rect x="40" y="35" width="270" height="145" fill="none" stroke="black" stroke-width="3"/><text x="165" y="115">15</text></svg>',
);

describe.skipIf(!runLiveTest)("M9.21 Quiz figure refinement live matrix", () => {
  it("refines QUESTION, EXTEND and REDRAW while retaining the current TikZ audit source", async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is required for the live test.");

    const model = process.env.OPENAI_QUIZ_FIGURE_REFINEMENT_LIVE_MODEL ?? "gpt-5.6-luna";
    const provider = new OpenAiProvider({
      apiKey,
      requestTimeoutMs: 180_000,
      generationRequestTimeoutMs: 180_000,
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
      embeddingDimensions: Number(process.env.OPENAI_EMBEDDING_DIMENSIONS ?? 1536),
      chatModel: model,
      structuredModel: model,
    });
    const exactImage = await buildQuizFigureRefinementImageDataUrl(exactQuestionSvg);
    const cases: Array<{
      label: "QUESTION" | "EXTEND" | "REDRAW";
      plan: QuizFigurePlan;
      currentSource: string;
      currentSvg: Buffer;
    }> = [
      {
        label: "QUESTION",
        plan: {
          version: 1,
          role: "QUESTION",
          problem:
            "Cho tam giác ABC vuông tại A, AB = 3 cm và AC = 4 cm. Hình phải đặt dấu vuông tại A, không phải tại B.",
        },
        currentSource: wrongQuestionSource,
        currentSvg: wrongQuestionSvg,
      },
      {
        label: "EXTEND",
        plan: {
          version: 1,
          role: "SOLUTION",
          mode: "EXTEND_QUESTION",
          problem: "Cho tam giác ABC. Gọi H là chân đường vuông góc kẻ từ A xuống BC.",
          solution: "Dựng AH vuông góc BC tại H để dùng hai tam giác vuông ABH và ACH.",
          addedObjects: ["Điểm H thuộc đoạn BC", "Đường cao AH"],
          clarifiedRelations: ["AH vuông góc BC tại H"],
        },
        currentSource: wrongExtendedSource,
        currentSvg: wrongExtendedSvg,
      },
      {
        label: "REDRAW",
        plan: {
          version: 1,
          role: "SOLUTION",
          mode: "REDRAW_AS_MODEL",
          problem:
            "Một người đi 9 km về hướng đông rồi 12 km về hướng bắc. Tính khoảng cách từ điểm xuất phát đến điểm cuối.",
          solution:
            "Mô hình hóa hai chặng đường thành hai cạnh vuông góc dài 9 km và 12 km; khoảng cách cần tìm là cạnh huyền dài 15 km.",
          modelingGoal: "Vẽ mô hình tam giác vuông của quãng đường và cạnh huyền cần tìm.",
          modeledObjects: ["Điểm xuất phát O", "Điểm đổi hướng A", "Điểm cuối B"],
          clarifiedRelations: ["OA vuông góc AB", "OA = 9 km", "AB = 12 km", "OB = 15 km"],
        },
        currentSource: wrongRedrawSource,
        currentSvg: wrongRedrawSvg,
      },
    ];
    const usage = { calls: 0, input: 0, cachedInput: 0, output: 0 };
    const artifactDirectory =
      process.env.OPENAI_QUIZ_FIGURE_REFINEMENT_LIVE_OUTPUT_DIR ??
      "/tmp/quiz-figure-refinement-live";
    await mkdir(artifactDirectory, { recursive: true });

    for (const liveCase of cases) {
      const currentImage = await buildQuizFigureRefinementImageDataUrl(liveCase.currentSvg);
      const isExtension = liveCase.label === "EXTEND";
      const input = buildQuizFigureRefinementInput({
        subject,
        plan: liveCase.plan,
        targetGrade: 8,
        currentLatexSource: liveCase.currentSource,
        currentImageDataUrl: currentImage,
        ...(isExtension
          ? {
              exactQuestionLatexSource: exactQuestionSource,
              exactQuestionImageDataUrl: exactImage,
            }
          : {}),
      });
      expect(JSON.parse(input.userPrompt).currentLatexSource).toBe(liveCase.currentSource);

      const result = isExtension
        ? await provider.generateStructured(
            { ...input, model, maxTokens: 4_000 },
            generatedQuizSolutionExtensionSchema,
          )
        : await provider.generateStructured(
            { ...input, model, maxTokens: 4_000 },
            generatedQuizFigureRefinementSchema,
          );
      const source = isExtension
        ? applyQuizSolutionExtension(exactQuestionSource, result.data.extensionLatex)
        : result.data.latexSource;

      assertQuizFigureLatexSource(source, {
        requireExtensionMarker: liveCase.label === "QUESTION" || isExtension,
      });
      expect(source).not.toBe(liveCase.currentSource);
      if (liveCase.label === "QUESTION") {
        expect(source).toContain(QUIZ_FIGURE_EXTENSION_MARKER);
        expect(source).toMatch(/\bA\b/u);
        expect(source).toMatch(/\bB\b/u);
        expect(source).toMatch(/\bC\b/u);
      } else if (isExtension) {
        expect(result.data.extensionLatex).not.toMatch(
          /\\begin\s*\{\s*(?:tikzpicture|circuitikz)\s*\}/u,
        );
        expect(result.data.extensionLatex).toMatch(/\bH\b/u);
        expect(source.startsWith(exactQuestionSource.split(QUIZ_FIGURE_EXTENSION_MARKER)[0])).toBe(
          true,
        );
      } else {
        expect(source).toMatch(/(?:9|9\s*\\,\s*km)/u);
        expect(source).toMatch(/(?:12|12\s*\\,\s*km)/u);
        expect(source).toMatch(/(?:15|15\s*\\,\s*km)/u);
      }

      const render = await renderQuizFigure(source);
      expect(render.ok, `${liveCase.label}: ${render.code ?? "render failed"}: ${render.log}`).toBe(
        true,
      );
      if (!render.svg) throw new Error(`${liveCase.label}: renderer did not return SVG.`);
      await Promise.all([
        writeFile(resolve(artifactDirectory, `math-plane-${liveCase.label.toLowerCase()}.tex`), source),
        writeFile(resolve(artifactDirectory, `math-plane-${liveCase.label.toLowerCase()}.svg`), render.svg),
      ]);

      usage.calls += 1;
      usage.input += result.usage?.promptTokens ?? 0;
      usage.cachedInput += result.usage?.cachedInputTokens ?? 0;
      usage.output += result.usage?.completionTokens ?? 0;
      console.info(
        `[QUIZ REFINEMENT LIVE] ${JSON.stringify({
          case: liveCase.label,
          model: result.model,
          promptVersion: input.promptVersion,
          schemaVersion: input.schemaVersion,
          promptTokens: result.usage?.promptTokens ?? null,
          cachedInputTokens: result.usage?.cachedInputTokens ?? null,
          completionTokens: result.usage?.completionTokens ?? null,
          latencyMs: result.latencyMs ?? null,
          renderDurationMs: render.durationMs ?? null,
          sourceLength: source.length,
        })}`,
      );
    }

    console.info(`[QUIZ REFINEMENT LIVE TOTAL] ${JSON.stringify(usage)}`);
  }, 600_000);
});

async function renderQuizFigure(latexSource: string) {
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
    durationMs?: number;
  };
}
