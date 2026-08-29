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

const runLiveTest =
  process.env.RUN_OPENAI_QUIZ_FIGURE_REFINEMENT_MATH_VISUALS_LIVE_TESTS === "1";
const subject = { key: "MATH", name: "Toán", slug: "toan" } as const;

type MathVisualCase = {
  label: string;
  family: "ALGEBRA" | "GEOMETRY";
  mode: "QUESTION" | "EXTEND" | "REDRAW";
  plan: QuizFigurePlan;
  currentSource: string;
  exactQuestionSource?: string;
  requiredTokens: string[];
};

const mathVisualCases: MathVisualCase[] = [
  {
    label: "graph-coordinate-system",
    family: "ALGEBRA",
    mode: "QUESTION",
    plan: {
      version: 1,
      role: "QUESTION",
      problem:
        "Trong hệ trục Oxy, vẽ đồ thị hàm số y = x đi qua O(0;0) và A(2;2). Candidate hiện tại vẽ sai thành y = -x.",
    },
    currentSource: questionSource([
      "\\draw[->] (-3,0)--(3,0) node[right] {$x$};",
      "\\draw[->] (0,-3)--(0,3) node[above] {$y$};",
      "\\draw[red,thick] (-2,2)--(2,-2) node[right] {$y=-x$};",
      "\\fill (0,0) circle (1.5pt) node[below left] {$O$};",
    ]),
    requiredTokens: ["x", "y", "O", "2"],
  },
  {
    label: "number-line-interval",
    family: "ALGEBRA",
    mode: "EXTEND",
    plan: {
      version: 1,
      role: "SOLUTION",
      mode: "EXTEND_QUESTION",
      problem: "Biểu diễn tập nghiệm 1 <= x < 4 trên đường số.",
      solution: "Tô đoạn từ 1 đến 4, đóng tại 1 và mở tại 4.",
      addedObjects: ["Phần đường số từ 1 đến 4", "Điểm đóng tại 1", "Điểm mở tại 4"],
      clarifiedRelations: ["1 được lấy", "4 không được lấy"],
    },
    exactQuestionSource: questionSource([
      "\\draw[->] (-2.5,0)--(5.5,0) node[right] {$x$};",
      "\\foreach \\x in {-2,-1,0,1,2,3,4,5} \\draw (\\x,.12)--(\\x,-.12) node[below] {\\x};",
    ]),
    currentSource: extendedSource(
      questionSource([
        "\\draw[->] (-2.5,0)--(5.5,0) node[right] {$x$};",
        "\\foreach \\x in {-2,-1,0,1,2,3,4,5} \\draw (\\x,.12)--(\\x,-.12) node[below] {\\x};",
      ]),
      "% Sai: tô từ -1 đến 2.\n\\draw[blue,very thick] (-1,0)--(2,0);",
    ),
    requiredTokens: ["1", "4"],
  },
  {
    label: "inequality-solution-region",
    family: "ALGEBRA",
    mode: "REDRAW",
    plan: {
      version: 1,
      role: "SOLUTION",
      mode: "REDRAW_AS_MODEL",
      problem: "Biểu diễn miền nghiệm x >= 0, y >= 0 và x + y <= 4.",
      solution: "Miền nghiệm là tam giác kể cả biên có các đỉnh O(0;0), A(4;0), B(0;4).",
      modelingGoal: "Vẽ hệ trục, ba đường biên và tô đúng miền tam giác trong góc phần tư thứ nhất.",
      modeledObjects: ["Hệ trục Oxy", "Đường x=0", "Đường y=0", "Đường x+y=4"],
      clarifiedRelations: ["Tô miền x>=0, y>=0, x+y<=4 và giữ cả biên"],
    },
    currentSource: redrawSource([
      "% Sai: chỉ có hình vuông, không có hệ trục hay miền nghiệm.",
      "\\draw[thick] (0,0) rectangle (4,4);",
    ]),
    requiredTokens: ["x", "y", "4"],
  },
  {
    label: "variation-table",
    family: "ALGEBRA",
    mode: "QUESTION",
    plan: {
      version: 1,
      role: "QUESTION",
      problem:
        "Bảng biến thiên của y=x^2: khi x đi từ -infinity đến 0, y giảm từ +infinity xuống 0; khi x đi từ 0 đến +infinity, y tăng từ 0 lên +infinity.",
    },
    currentSource: questionSource([
      "\\draw (0,0) rectangle (7,2.5); \\draw (0,1.2)--(7,1.2); \\draw (1.2,0)--(1.2,2.5);",
      "\\node at (.6,1.85) {$x$}; \\node at (.6,.6) {$y$};",
      "\\node at (2,1.85) {$-\\infty$}; \\node at (4.1,1.85) {$0$}; \\node at (6.2,1.85) {$+\\infty$};",
      "% Sai: cả hai nhánh đều tăng.",
      "\\draw[->,red] (2,.3)--(3.8,.9); \\draw[->,red] (4.3,.3)--(6.1,.9);",
    ]),
    requiredTokens: ["0", "x", "y"],
  },
  {
    label: "sign-table",
    family: "ALGEBRA",
    mode: "EXTEND",
    plan: {
      version: 1,
      role: "SOLUTION",
      mode: "EXTEND_QUESTION",
      problem: "Lập bảng xét dấu của f(x)=(x+1)(x-2).",
      solution: "f dương trên (-infinity,-1), âm trên (-1,2), dương trên (2,+infinity), bằng 0 tại -1 và 2.",
      addedObjects: ["Dấu +, -, + trên ba khoảng", "Hai giá trị 0 tại -1 và 2"],
      clarifiedRelations: ["Đổi dấu qua mỗi nghiệm đơn -1 và 2"],
    },
    exactQuestionSource: questionSource([
      "\\draw (0,0) rectangle (8,2.2); \\draw (0,1.1)--(8,1.1); \\draw (1.4,0)--(1.4,2.2);",
      "\\node at (.7,1.65) {$x$}; \\node at (.7,.55) {$f(x)$};",
      "\\node at (2,1.65) {$-\\infty$}; \\node at (3.5,1.65) {$-1$}; \\node at (5.3,1.65) {$2$}; \\node at (7.2,1.65) {$+\\infty$};",
    ]),
    currentSource: extendedSource(
      questionSource([
        "\\draw (0,0) rectangle (8,2.2); \\draw (0,1.1)--(8,1.1); \\draw (1.4,0)--(1.4,2.2);",
        "\\node at (.7,1.65) {$x$}; \\node at (.7,.55) {$f(x)$};",
        "\\node at (2,1.65) {$-\\infty$}; \\node at (3.5,1.65) {$-1$}; \\node at (5.3,1.65) {$2$}; \\node at (7.2,1.65) {$+\\infty$};",
      ]),
      "% Sai: dấu giữa hai nghiệm là dương.\n\\node[red] at (2.7,.55) {$+$}; \\node[red] at (4.4,.55) {$+$}; \\node[red] at (6.3,.55) {$+$};",
    ),
    requiredTokens: ["-1", "2"],
  },
  {
    label: "data-table",
    family: "ALGEBRA",
    mode: "REDRAW",
    plan: {
      version: 1,
      role: "SOLUTION",
      mode: "REDRAW_AS_MODEL",
      problem: "Bảng dữ liệu có ba giá trị: A=2, B=5, C=3.",
      solution: "Trình bày đúng ba cột A, B, C và đúng các giá trị tương ứng 2, 5, 3.",
      modelingGoal: "Vẽ lại bảng dữ liệu dễ đọc, không đổi thứ tự hoặc giá trị.",
      modeledObjects: ["Cột A", "Cột B", "Cột C"],
      clarifiedRelations: ["A=2", "B=5", "C=3"],
    },
    currentSource: redrawSource([
      "% Sai: B và C bị đổi giá trị.",
      "\\draw (0,0) grid[xstep=2,ystep=1] (6,2);",
      "\\node at (1,1.5) {A}; \\node at (3,1.5) {B}; \\node at (5,1.5) {C};",
      "\\node at (1,.5) {2}; \\node at (3,.5) {3}; \\node at (5,.5) {5};",
    ]),
    requiredTokens: ["A", "B", "C", "2", "5", "3"],
  },
  {
    label: "bar-chart",
    family: "ALGEBRA",
    mode: "QUESTION",
    plan: {
      version: 1,
      role: "QUESTION",
      problem: "Biểu đồ cột phải thể hiện A=2, B=5 và C=3 trên cùng trục tung có mốc từ 0 đến 5.",
    },
    currentSource: questionSource([
      "\\draw[->] (0,0)--(7,0); \\draw[->] (0,0)--(0,6);",
      "% Sai: chiều cao A và B bị hoán đổi.",
      "\\fill[blue!40] (1,0) rectangle (2,5); \\fill[blue!40] (3,0) rectangle (4,2); \\fill[blue!40] (5,0) rectangle (6,3);",
      "\\node at (1.5,-.35) {A}; \\node at (3.5,-.35) {B}; \\node at (5.5,-.35) {C};",
    ]),
    requiredTokens: ["A", "B", "C", "2", "5", "3"],
  },
  {
    label: "mapping-schematic",
    family: "ALGEBRA",
    mode: "EXTEND",
    plan: {
      version: 1,
      role: "SOLUTION",
      mode: "EXTEND_QUESTION",
      problem: "Sơ đồ ánh xạ f(x)=x^2 từ tập {-2,-1,1,2} sang tập {1,4}.",
      solution: "Nối -2 và 2 tới 4; nối -1 và 1 tới 1.",
      addedObjects: ["Bốn mũi tên ánh xạ"],
      clarifiedRelations: ["-2->4", "2->4", "-1->1", "1->1"],
    },
    exactQuestionSource: questionSource([
      "\\node[draw,ellipse,minimum width=2cm,minimum height=4cm] (D) at (0,0) {};",
      "\\node[draw,ellipse,minimum width=2cm,minimum height=3cm] (R) at (5,0) {};",
      "\\foreach \\y/\\v in {1.2/-2,.4/-1,-.4/1,-1.2/2} \\node (d\\v) at (0,\\y) {$\\v$};",
      "\\node (r1) at (5,.7) {$1$}; \\node (r4) at (5,-.7) {$4$};",
    ]),
    currentSource: extendedSource(
      questionSource([
        "\\node[draw,ellipse,minimum width=2cm,minimum height=4cm] (D) at (0,0) {};",
        "\\node[draw,ellipse,minimum width=2cm,minimum height=3cm] (R) at (5,0) {};",
        "\\foreach \\y/\\v in {1.2/-2,.4/-1,-.4/1,-1.2/2} \\node (d\\v) at (0,\\y) {$\\v$};",
        "\\node (r1) at (5,.7) {$1$}; \\node (r4) at (5,-.7) {$4$};",
      ]),
      "% Sai: tất cả phần tử đều nối tới 1.\n\\draw[->,red] (0,1.2)--(5,.7); \\draw[->,red] (0,.4)--(5,.7); \\draw[->,red] (0,-.4)--(5,.7); \\draw[->,red] (0,-1.2)--(5,.7);",
    ),
    requiredTokens: ["1", "2", "4"],
  },
  {
    label: "coordinate-geometry",
    family: "GEOMETRY",
    mode: "REDRAW",
    plan: {
      version: 1,
      role: "SOLUTION",
      mode: "REDRAW_AS_MODEL",
      problem: "Trong Oxy, đường tròn tâm I(1;2), bán kính 2 và điểm A(3;2) thuộc đường tròn.",
      solution: "Vẽ đúng tâm I, bán kính IA nằm ngang dài 2 và điểm A trên đường tròn.",
      modelingGoal: "Dựng mô hình tọa độ kiểm chứng A thuộc đường tròn.",
      modeledObjects: ["Hệ trục Oxy", "I(1;2)", "Đường tròn bán kính 2", "A(3;2)"],
      clarifiedRelations: ["IA=2", "A thuộc đường tròn"],
    },
    currentSource: redrawSource([
      "% Sai: A không nằm trên đường tròn.",
      "\\draw[->] (-2,0)--(5,0) node[right] {$x$}; \\draw[->] (0,-1)--(0,5) node[above] {$y$};",
      "\\draw (1,2) circle (2); \\fill (1,2) circle (1.5pt) node[above] {$I$}; \\fill (4,4) circle (1.5pt) node[right] {$A$};",
    ]),
    requiredTokens: ["I", "A", "2"],
  },
  {
    label: "spatial-geometry",
    family: "GEOMETRY",
    mode: "QUESTION",
    plan: {
      version: 1,
      role: "QUESTION",
      problem:
        "Cho hình chóp S.ABC có đáy ABC là tam giác; SA vuông góc với mặt phẳng (ABC). Hình phải phân biệt cạnh thấy/khuất và đặt dấu vuông tại A giữa SA với đáy.",
    },
    currentSource: questionSource([
      "% Sai: S nối vuông góc xuống B thay vì A.",
      "\\coordinate (A) at (0,0); \\coordinate (B) at (4,0); \\coordinate (C) at (1.2,1.5); \\coordinate (S) at (4,3);",
      "\\draw[thick] (A)--(B)--(C)--cycle; \\draw[thick] (S)--(A) (S)--(B) (S)--(C);",
      "\\node[below] at (A) {A}; \\node[below] at (B) {B}; \\node[left] at (C) {C}; \\node[above] at (S) {S};",
    ]),
    requiredTokens: ["S", "A", "B", "C"],
  },
];

describe.skipIf(!runLiveTest)("M9.21 Quiz Math visual refinement live coverage", () => {
  it("covers algebra visuals and geometry visuals across all refinement contracts", async () => {
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
    const usage = { calls: 0, input: 0, cachedInput: 0, output: 0 };
    const artifactDirectory =
      process.env.OPENAI_QUIZ_FIGURE_REFINEMENT_LIVE_OUTPUT_DIR ??
      "/tmp/quiz-figure-refinement-live";
    await mkdir(artifactDirectory, { recursive: true });

    expect(new Set(mathVisualCases.filter((item) => item.family === "ALGEBRA").map((item) => item.mode))).toEqual(
      new Set(["QUESTION", "EXTEND", "REDRAW"]),
    );
    expect(new Set(mathVisualCases.filter((item) => item.family === "GEOMETRY").map((item) => item.mode))).toEqual(
      new Set(["QUESTION", "REDRAW"]),
    );

    for (const liveCase of mathVisualCases) {
      const currentImage = await renderAsImage(liveCase.currentSource);
      const isExtension = liveCase.mode === "EXTEND";
      const exactImage = isExtension
        ? await renderAsImage(liveCase.exactQuestionSource!)
        : undefined;
      const input = buildQuizFigureRefinementInput({
        subject,
        plan: liveCase.plan,
        targetGrade: 8,
        currentLatexSource: liveCase.currentSource,
        currentImageDataUrl: currentImage,
        ...(isExtension
          ? {
              exactQuestionLatexSource: liveCase.exactQuestionSource!,
              exactQuestionImageDataUrl: exactImage!,
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
      const refinedSource = isExtension
        ? applyQuizSolutionExtension(liveCase.exactQuestionSource!, result.data.extensionLatex)
        : result.data.latexSource;

      assertQuizFigureLatexSource(refinedSource, {
        requireExtensionMarker: liveCase.mode !== "REDRAW",
      });
      expect(refinedSource).not.toBe(liveCase.currentSource);
      for (const token of liveCase.requiredTokens) expect(refinedSource).toContain(token);
      if (isExtension) {
        expect(result.data.extensionLatex).not.toMatch(
          /\\begin\s*\{\s*(?:tikzpicture|circuitikz)\s*\}/u,
        );
        expect(
          refinedSource.startsWith(
            liveCase.exactQuestionSource!.split(QUIZ_FIGURE_EXTENSION_MARKER)[0],
          ),
        ).toBe(true);
      }
      const rendered = await render(refinedSource);
      expect(
        rendered.ok,
        `${liveCase.label}: ${rendered.code ?? "render failed"}: ${rendered.log}`,
      ).toBe(
        true,
      );
      if (!rendered.svg) throw new Error(`${liveCase.label}: renderer did not return SVG.`);
      const artifactName = `math-${liveCase.label}`;
      await Promise.all([
        writeFile(resolve(artifactDirectory, `${artifactName}.tex`), refinedSource),
        writeFile(resolve(artifactDirectory, `${artifactName}.svg`), rendered.svg),
      ]);

      usage.calls += 1;
      usage.input += result.usage?.promptTokens ?? 0;
      usage.cachedInput += result.usage?.cachedInputTokens ?? 0;
      usage.output += result.usage?.completionTokens ?? 0;
      console.info(
        `[QUIZ MATH VISUAL LIVE] ${JSON.stringify({
          case: liveCase.label,
          family: liveCase.family,
          mode: liveCase.mode,
          model: result.model,
          promptTokens: result.usage?.promptTokens ?? null,
          cachedInputTokens: result.usage?.cachedInputTokens ?? null,
          completionTokens: result.usage?.completionTokens ?? null,
          latencyMs: result.latencyMs ?? null,
          renderDurationMs: rendered.durationMs ?? null,
        })}`,
      );
    }
    console.info(`[QUIZ MATH VISUAL LIVE TOTAL] ${JSON.stringify(usage)}`);
  }, 1_200_000);
});

function questionSource(body: string[]) {
  return ["\\begin{tikzpicture}[scale=.9]", ...body, QUIZ_FIGURE_EXTENSION_MARKER, "\\end{tikzpicture}"].join(
    "\n",
  );
}

function extendedSource(base: string, extension: string) {
  return base.replace(
    QUIZ_FIGURE_EXTENSION_MARKER,
    `${QUIZ_FIGURE_EXTENSION_MARKER}\n${extension}`,
  );
}

function redrawSource(body: string[]) {
  return ["\\begin{tikzpicture}[scale=.9]", ...body, "\\end{tikzpicture}"].join("\n");
}

async function renderAsImage(latexSource: string) {
  const result = await render(latexSource);
  expect(result.ok, `${result.code ?? "render failed"}: ${result.log}`).toBe(true);
  if (!result.svg) throw new Error("Renderer did not return SVG.");
  return buildQuizFigureRefinementImageDataUrl(Buffer.from(result.svg));
}

async function render(latexSource: string) {
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
