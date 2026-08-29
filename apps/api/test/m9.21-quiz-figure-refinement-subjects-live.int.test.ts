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
  process.env.RUN_OPENAI_QUIZ_FIGURE_REFINEMENT_SUBJECTS_LIVE_TESTS === "1";

type SubjectScenario = {
  subject: { key: "PHYSICS" | "CHEMISTRY" | "GENERAL"; name: string; slug: string };
  exactQuestionSource: string;
  plans: [QuizFigurePlan, QuizFigurePlan, QuizFigurePlan];
  currentSources: [string, string, string];
};

const scenarios: SubjectScenario[] = [
  {
    subject: { key: "PHYSICS", name: "Vật lý", slug: "vat-ly" },
    exactQuestionSource: source([
      "\\draw[thick] (0,0) rectangle (2,1);",
      "\\node at (1,.5) {A};",
      "\\draw[->,thick] (2.1,.5) -- (4,.5) node[right] {$\\vec v$};",
    ]),
    plans: [
      {
        version: 1,
        role: "QUESTION",
        problem:
          "Vật A chuyển động thẳng sang phải với vận tốc v. Hình phải thể hiện vector vận tốc hướng sang phải.",
      },
      {
        version: 1,
        role: "SOLUTION",
        mode: "EXTEND_QUESTION",
        problem: "Vật A đang chuyển động sang phải và nhanh dần đều.",
        solution: "Gia tốc cùng hướng chuyển động nên vector gia tốc hướng sang phải.",
        addedObjects: ["Vector gia tốc a đặt tại vật A"],
        clarifiedRelations: ["Vector a cùng hướng với vector v"],
      },
      {
        version: 1,
        role: "SOLUTION",
        mode: "REDRAW_AS_MODEL",
        problem: "Một vật nằm trên mặt phẳng ngang, chịu trọng lực P và phản lực N.",
        solution: "Mô hình lực có P thẳng đứng xuống và N thẳng đứng lên, cùng giá.",
        modelingGoal: "Vẽ sơ đồ lực tối giản đúng phương và chiều.",
        modeledObjects: ["Vật A", "Mặt phẳng ngang", "Vector P", "Vector N"],
        clarifiedRelations: ["P hướng xuống", "N hướng lên", "P và N cùng giá"],
      },
    ],
    currentSources: [
      source([
        "\\draw[thick] (0,0) rectangle (2,1);",
        "\\node at (1,.5) {A};",
        "% Sai: vector vận tốc hướng sang trái.",
        "\\draw[->,thick] (-.1,.5) -- (-2,.5) node[left] {$\\vec v$};",
      ]),
      extendedSource(
        source([
          "\\draw[thick] (0,0) rectangle (2,1);",
          "\\node at (1,.5) {A};",
          "\\draw[->,thick] (2.1,.5) -- (4,.5) node[right] {$\\vec v$};",
        ]),
        "% Sai: gia tốc ngược hướng vận tốc.\n\\draw[->,red,thick] (0,.25) -- (-1.5,.25) node[left] {$\\vec a$};",
      ),
      redrawSource("% Sai: chưa có sơ đồ lực.\n\\draw[thick] (0,0) rectangle (3,2);"),
    ],
  },
  {
    subject: { key: "CHEMISTRY", name: "Hóa học", slug: "hoa-hoc" },
    exactQuestionSource: source([
      "\\draw[thick] (0,0) -- (.4,2.4) -- (1.6,2.4) -- (2,0) -- cycle;",
      "\\draw[blue] (.2,.7) -- (1.8,.7);",
      "\\node at (1,.4) {HCl};",
    ]),
    plans: [
      {
        version: 1,
        role: "QUESTION",
        problem: "Bình tam giác chứa dung dịch HCl. Hình phải ghi đúng nhãn HCl trong bình.",
      },
      {
        version: 1,
        role: "SOLUTION",
        mode: "EXTEND_QUESTION",
        problem: "Cho CaCO3 vào bình chứa HCl, khí CO2 thoát ra.",
        solution: "Minh họa bọt khí CO2 sinh ra trong dung dịch và thoát lên khỏi miệng bình.",
        addedObjects: ["Các bọt khí trong bình", "Mũi tên khí CO2 thoát lên"],
        clarifiedRelations: ["CO2 đi từ dung dịch lên khỏi miệng bình"],
      },
      {
        version: 1,
        role: "SOLUTION",
        mode: "REDRAW_AS_MODEL",
        problem: "Phản ứng 2H2 + O2 tạo thành 2H2O.",
        solution: "Mô hình hạt phải bảo toàn 4 nguyên tử H và 2 nguyên tử O.",
        modelingGoal: "Vẽ mô hình hạt trước và sau phản ứng, phân biệt H và O.",
        modeledObjects: ["Hai phân tử H2", "Một phân tử O2", "Hai phân tử H2O"],
        clarifiedRelations: ["Bảo toàn số nguyên tử H và O qua mũi tên phản ứng"],
      },
    ],
    currentSources: [
      source([
        "\\draw[thick] (0,0) -- (.4,2.4) -- (1.6,2.4) -- (2,0) -- cycle;",
        "\\draw[blue] (.2,.7) -- (1.8,.7);",
        "% Sai: nhãn hóa chất không khớp đề.",
        "\\node at (1,.4) {NaOH};",
      ]),
      extendedSource(
        source([
          "\\draw[thick] (0,0) -- (.4,2.4) -- (1.6,2.4) -- (2,0) -- cycle;",
          "\\draw[blue] (.2,.7) -- (1.8,.7);",
          "\\node at (1,.4) {HCl};",
        ]),
        "% Sai: mũi tên khí hướng xuống.\n\\draw[->,red] (1,1) -- (1,-1) node[below] {CO2};",
      ),
      redrawSource("% Sai: chưa có mô hình hạt.\n\\draw[thick] (0,0) rectangle (4,2);"),
    ],
  },
  {
    subject: { key: "GENERAL", name: "Môn khác", slug: "mon-khac" },
    exactQuestionSource: source([
      "\\node[draw] (A) at (0,0) {Tiếp nhận};",
      "\\node[draw] (B) at (3,0) {Xử lý};",
      "\\node[draw] (C) at (6,0) {Kết quả};",
      "\\draw[->] (A) -- (B);",
      "\\draw[->] (B) -- (C);",
    ]),
    plans: [
      {
        version: 1,
        role: "QUESTION",
        problem: "Quy trình gồm Tiếp nhận, sau đó Xử lý, cuối cùng cho ra Kết quả.",
      },
      {
        version: 1,
        role: "SOLUTION",
        mode: "EXTEND_QUESTION",
        problem: "Quy trình Tiếp nhận - Xử lý - Kết quả có bước phản hồi khi kết quả chưa đạt.",
        solution: "Thêm nhánh Phản hồi từ Kết quả quay lại Xử lý.",
        addedObjects: ["Nhãn Phản hồi"],
        clarifiedRelations: ["Mũi tên từ Kết quả quay lại Xử lý"],
      },
      {
        version: 1,
        role: "SOLUTION",
        mode: "REDRAW_AS_MODEL",
        problem: "Nước bốc hơi, ngưng tụ thành mây rồi mưa trở lại mặt đất.",
        solution: "Mô hình chu trình phải thể hiện đúng ba quá trình và chiều tuần hoàn.",
        modelingGoal: "Vẽ sơ đồ chu trình nước tối giản.",
        modeledObjects: ["Mặt đất", "Hơi nước", "Mây"],
        clarifiedRelations: ["Bốc hơi", "Ngưng tụ", "Mưa"],
      },
    ],
    currentSources: [
      source([
        "% Sai: thứ tự mũi tên bị đảo.",
        "\\node[draw] (A) at (0,0) {Tiếp nhận};",
        "\\node[draw] (B) at (3,0) {Xử lý};",
        "\\node[draw] (C) at (6,0) {Kết quả};",
        "\\draw[->] (C) -- (B);",
        "\\draw[->] (B) -- (A);",
      ]),
      extendedSource(
        source([
          "\\node[draw] (A) at (0,0) {Tiếp nhận};",
          "\\node[draw] (B) at (3,0) {Xử lý};",
          "\\node[draw] (C) at (6,0) {Kết quả};",
          "\\draw[->] (A) -- (B);",
          "\\draw[->] (B) -- (C);",
        ]),
        "% Sai: phản hồi quay về Tiếp nhận.\n\\draw[->,red,bend left=45] (C) to node[above] {Phản hồi} (A);",
      ),
      redrawSource("% Sai: chưa có chu trình.\n\\draw[thick] (0,0) rectangle (4,2);"),
    ],
  },
];

describe.skipIf(!runLiveTest)("M9.21 Quiz figure refinement live subject matrix", () => {
  it("refines PHYSICS, CHEMISTRY and GENERAL across QUESTION, EXTEND and REDRAW", async () => {
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

    for (const scenario of scenarios) {
      const exactImage = await imageDataUrl(`${scenario.subject.key} exact base`);
      for (const [index, mode] of ["QUESTION", "EXTEND", "REDRAW"].entries()) {
        const currentSource = scenario.currentSources[index];
        const currentImage = await imageDataUrl(`${scenario.subject.key} ${mode} wrong`);
        const isExtension = mode === "EXTEND";
        const input = buildQuizFigureRefinementInput({
          subject: scenario.subject,
          plan: scenario.plans[index],
          targetGrade: 8,
          currentLatexSource: currentSource,
          currentImageDataUrl: currentImage,
          ...(isExtension
            ? {
                exactQuestionLatexSource: scenario.exactQuestionSource,
                exactQuestionImageDataUrl: exactImage,
              }
            : {}),
        });
        expect(JSON.parse(input.userPrompt).currentLatexSource).toBe(currentSource);

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
          ? applyQuizSolutionExtension(scenario.exactQuestionSource, result.data.extensionLatex)
          : result.data.latexSource;

        assertQuizFigureLatexSource(refinedSource, {
          requireExtensionMarker: mode !== "REDRAW",
        });
        expect(refinedSource).not.toBe(currentSource);
        if (isExtension) {
          expect(result.data.extensionLatex).not.toMatch(
            /\\begin\s*\{\s*(?:tikzpicture|circuitikz)\s*\}/u,
          );
          expect(
            refinedSource.startsWith(
              scenario.exactQuestionSource.split(QUIZ_FIGURE_EXTENSION_MARKER)[0],
            ),
          ).toBe(true);
        }
        const render = await renderQuizFigure(refinedSource, scenario.subject.key);
        expect(
          render.ok,
          `${scenario.subject.key}/${mode}: ${render.code ?? "render failed"}: ${render.log}`,
        ).toBe(true);
        if (!render.svg) {
          throw new Error(`${scenario.subject.key}/${mode}: renderer did not return SVG.`);
        }
        const artifactName = `${scenario.subject.key.toLowerCase()}-${mode.toLowerCase()}`;
        await Promise.all([
          writeFile(resolve(artifactDirectory, `${artifactName}.tex`), refinedSource),
          writeFile(resolve(artifactDirectory, `${artifactName}.svg`), render.svg),
        ]);

        usage.calls += 1;
        usage.input += result.usage?.promptTokens ?? 0;
        usage.cachedInput += result.usage?.cachedInputTokens ?? 0;
        usage.output += result.usage?.completionTokens ?? 0;
        console.info(
          `[QUIZ REFINEMENT SUBJECT LIVE] ${JSON.stringify({
            subject: scenario.subject.key,
            mode,
            model: result.model,
            promptVersion: input.promptVersion,
            promptTokens: result.usage?.promptTokens ?? null,
            cachedInputTokens: result.usage?.cachedInputTokens ?? null,
            completionTokens: result.usage?.completionTokens ?? null,
            latencyMs: result.latencyMs ?? null,
            renderDurationMs: render.durationMs ?? null,
          })}`,
        );
      }
    }
    console.info(`[QUIZ REFINEMENT SUBJECT LIVE TOTAL] ${JSON.stringify(usage)}`);
  }, 1_200_000);
});

function source(body: string[]) {
  return ["\\begin{tikzpicture}[scale=1]", ...body, QUIZ_FIGURE_EXTENSION_MARKER, "\\end{tikzpicture}"].join(
    "\n",
  );
}

function extendedSource(base: string, extension: string) {
  return base.replace(
    QUIZ_FIGURE_EXTENSION_MARKER,
    `${QUIZ_FIGURE_EXTENSION_MARKER}\n${extension}`,
  );
}

function redrawSource(body: string) {
  return ["\\begin{tikzpicture}[scale=1]", body, "\\end{tikzpicture}"].join("\n");
}

async function imageDataUrl(label: string) {
  const escaped = label.replace(/[&<>"']/gu, "");
  return buildQuizFigureRefinementImageDataUrl(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="220"><rect x="20" y="20" width="460" height="180" fill="white" stroke="black" stroke-width="3"/><text x="40" y="115" font-size="22">${escaped}</text></svg>`,
    ),
  );
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
