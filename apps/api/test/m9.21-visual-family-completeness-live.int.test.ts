import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { describe, expect, it } from "vitest";

import { OpenAiProvider } from "#api/modules/ai/providers/openai.provider";
import {
  buildQuizFigureRefinementInput,
  generatedQuizFigureRefinementSchema,
  QUIZ_FIGURE_EXTENSION_MARKER,
  type QuizFigurePlan,
} from "#api/modules/quiz-figures/types/quiz-figure-generation.types";
import { buildQuizFigureRefinementImageDataUrl } from "#api/modules/quiz-figures/utils/quiz-figure-refinement-image";
import { assertQuizFigureLatexSource } from "#api/modules/quiz-figures/utils/quiz-figure-source-policy";

loadEnv({ path: resolve(process.cwd(), "../../.env"), override: false, quiet: true });

const runLiveTest = process.env.RUN_OPENAI_VISUAL_FAMILY_COMPLETENESS_LIVE_TESTS === "1";

type VisualCompletenessCase = {
  label: string;
  subject: {
    key: "MATH" | "PHYSICS" | "CHEMISTRY" | "GENERAL";
    name: string;
    slug: string;
  };
  targetGrade: number;
  problem: string;
  currentSource: string;
  expectedSourcePatterns: RegExp[];
};

const cases: VisualCompletenessCase[] = [
  {
    label: "math-parabola",
    subject: { key: "MATH", name: "Toán", slug: "toan" },
    targetGrade: 9,
    problem:
      "Cho hàm số y = 1/2 x^2 và đồ thị minh họa trên hệ trục Oxy. Quan sát đồ thị để đánh giá các mệnh đề về giá trị hàm số và điểm thuộc đồ thị.",
    currentSource: questionSource([
      "% Candidate thiếu gốc tọa độ, vạch đơn vị và điểm đặc trưng.",
      "\\draw[->] (-4,0) -- (4,0) node[right] {$x$};",
      "\\draw[->] (0,-.5) -- (0,5) node[above] {$y$};",
      "\\draw[domain=-3:3,smooth,variable=\\x,thick] plot ({\\x},{.5*\\x*\\x});",
    ]),
    expectedSourcePatterns: [/\{\$O\$\}/u, /foreach|node\[[^\]]*\].*\{\$?[12]/u],
  },
  {
    label: "physics-velocity-time",
    subject: { key: "PHYSICS", name: "Vật lý", slug: "vat-ly" },
    targetGrade: 10,
    problem:
      "Đồ thị vận tốc - thời gian của một vật: tại t = 0 s, v = 0 m/s; vận tốc tăng đều đến 4 m/s ở t = 2 s rồi giữ không đổi đến t = 5 s.",
    currentSource: questionSource([
      "% Candidate thiếu đơn vị, vạch chia và điểm đổi chế độ chuyển động.",
      "\\draw[->] (0,0) -- (6,0) node[right] {$t$};",
      "\\draw[->] (0,0) -- (0,5) node[above] {$v$};",
      "\\draw[thick] (0,0) -- (2,4) -- (5,4);",
    ]),
    expectedSourcePatterns: [/m\/s|\\mathrm\{m\/s\}/u, /2/u, /5/u],
  },
  {
    label: "chemistry-energy-profile",
    subject: { key: "CHEMISTRY", name: "Hóa học", slug: "hoa-hoc" },
    targetGrade: 10,
    problem:
      "Đường biểu diễn năng lượng của phản ứng cho thấy chất phản ứng ban đầu ở mức năng lượng 2, trạng thái chuyển tiếp đạt mức 5 và sản phẩm ở mức 1. Hãy quan sát hình để nhận biết diễn biến năng lượng.",
    currentSource: questionSource([
      "% Candidate chỉ có đường cong, thiếu trục, nhãn pha và các mức đặc trưng.",
      "\\draw[thick,smooth] plot coordinates {(0,2) (1.5,2.2) (3,5) (4.5,1.4) (6,1)};",
    ]),
    expectedSourcePatterns: [/N[aă]ng\s*lượng|E/u, /Sản phẩm|SP/u, /5/u],
  },
  {
    label: "general-bar-chart",
    subject: { key: "GENERAL", name: "Khoa học tổng hợp", slug: "khoa-hoc-tong-hop" },
    targetGrade: 6,
    problem:
      "Biểu đồ cột thể hiện số cây trồng được của ba lớp 6A, 6B, 6C lần lượt là 10, 15, 20 cây. Học sinh quan sát biểu đồ để so sánh số lượng.",
    currentSource: questionSource([
      "% Candidate thiếu tên trục, vạch chia, đơn vị và nhãn cột.",
      "\\fill[blue!45] (0.7,0) rectangle (1.5,2);",
      "\\fill[blue!45] (2.2,0) rectangle (3,3);",
      "\\fill[blue!45] (3.7,0) rectangle (4.5,4);",
    ]),
    expectedSourcePatterns: [/6A/u, /6B/u, /6C/u, /cây|Cây/u],
  },
];

describe.skipIf(!runLiveTest)("M9.21 visual-family completeness live regression", () => {
  it("repairs missing essentials across the four subject-owned visual policies", async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is required for the live test.");

    const model =
      process.env.OPENAI_VISUAL_FAMILY_COMPLETENESS_LIVE_MODEL ?? "gpt-5.6-luna";
    const provider = new OpenAiProvider({
      apiKey,
      requestTimeoutMs: 180_000,
      generationRequestTimeoutMs: 180_000,
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
      embeddingDimensions: Number(process.env.OPENAI_EMBEDDING_DIMENSIONS ?? 1536),
      chatModel: model,
      structuredModel: model,
    });
    const artifactDirectory =
      process.env.OPENAI_VISUAL_FAMILY_COMPLETENESS_LIVE_OUTPUT_DIR ??
      "/tmp/visual-family-completeness-live";
    const usage = { calls: 0, input: 0, cachedInput: 0, output: 0 };
    await mkdir(artifactDirectory, { recursive: true });

    for (const testCase of cases) {
      const currentRender = await renderQuizFigure(
        testCase.currentSource,
        testCase.subject.key,
      );
      expect(currentRender.ok, `${testCase.label}: current source did not render`).toBe(
        true,
      );
      if (!currentRender.svg)
        throw new Error(`${testCase.label}: renderer returned no current SVG.`);

      const plan: QuizFigurePlan = {
        version: 1,
        role: "QUESTION",
        problem: testCase.problem,
      };
      const currentImageDataUrl = await buildQuizFigureRefinementImageDataUrl(
        Buffer.from(currentRender.svg),
      );
      const input = buildQuizFigureRefinementInput({
        subject: testCase.subject,
        plan,
        targetGrade: testCase.targetGrade,
        currentLatexSource: testCase.currentSource,
        currentImageDataUrl,
      });
      const result = await provider.generateStructured(
        { ...input, model, maxTokens: 3_000 },
        generatedQuizFigureRefinementSchema,
      );
      const refinedSource = result.data.latexSource;

      assertQuizFigureLatexSource(refinedSource, { requireExtensionMarker: true });
      expect(refinedSource).not.toBe(testCase.currentSource);
      for (const pattern of testCase.expectedSourcePatterns)
        expect(refinedSource).toMatch(pattern);

      const refinedRender = await renderQuizFigure(refinedSource, testCase.subject.key);
      expect(
        refinedRender.ok,
        `${testCase.label}: ${refinedRender.code ?? "render failed"}: ${refinedRender.log}`,
      ).toBe(true);
      if (!refinedRender.svg)
        throw new Error(`${testCase.label}: renderer returned no refined SVG.`);

      await Promise.all([
        writeFile(resolve(artifactDirectory, `${testCase.label}.tex`), refinedSource),
        writeFile(resolve(artifactDirectory, `${testCase.label}.svg`), refinedRender.svg),
      ]);

      usage.calls += 1;
      usage.input += result.usage?.promptTokens ?? 0;
      usage.cachedInput += result.usage?.cachedInputTokens ?? 0;
      usage.output += result.usage?.completionTokens ?? 0;
      console.info(
        `[VISUAL COMPLETENESS LIVE] ${JSON.stringify({
          label: testCase.label,
          subject: testCase.subject.key,
          model: result.model,
          promptVersion: input.promptVersion,
          promptTokens: result.usage?.promptTokens ?? null,
          cachedInputTokens: result.usage?.cachedInputTokens ?? null,
          completionTokens: result.usage?.completionTokens ?? null,
          latencyMs: result.latencyMs ?? null,
          renderDurationMs: refinedRender.durationMs ?? null,
        })}`,
      );
    }

    expect(usage.calls).toBe(4);
    console.info(`[VISUAL COMPLETENESS LIVE TOTAL] ${JSON.stringify(usage)}`);
  }, 1_200_000);
});

function questionSource(body: string[]) {
  return [
    "\\begin{tikzpicture}[scale=.9,line cap=round,line join=round]",
    ...body,
    QUIZ_FIGURE_EXTENSION_MARKER,
    "\\end{tikzpicture}",
  ].join("\n");
}

async function renderQuizFigure(latexSource: string, subjectKey: string) {
  const response = await fetch("http://127.0.0.1:8080/render", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.TEX_RENDERER_TOKEN ?? "local-tex-renderer-token"}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ latexSource, subjectKey }),
  });
  return (await response.json()) as {
    ok?: boolean;
    svg?: string;
    code?: string;
    log?: string;
    durationMs?: number;
  };
}
