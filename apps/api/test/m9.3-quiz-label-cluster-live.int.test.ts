import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { describe, expect, it } from "vitest";

import { OpenAiProvider } from "#api/modules/ai/providers/openai.provider";
import {
  buildQuestionFigureInput,
  buildQuizFigureRefinementInput,
  generatedQuizFigureRefinementSchema,
  generatedQuizQuestionFigureSchema,
  QUIZ_FIGURE_EXTENSION_MARKER,
} from "#api/modules/quiz-figures/types/quiz-figure-generation.types";
import { buildQuizFigureRefinementImageDataUrl } from "#api/modules/quiz-figures/utils/quiz-figure-refinement-image";
import { assertQuizFigureLatexSource } from "#api/modules/quiz-figures/utils/quiz-figure-source-policy";

loadEnv({ path: resolve(process.cwd(), "../../.env"), override: false, quiet: true });

const runLiveTest = process.env.RUN_OPENAI_QUIZ_LABEL_CLUSTER_LIVE_TESTS === "1";
const subject = { key: "MATH", name: "Toán", slug: "toan" } as const;
const problem =
  "Cho một nửa đường tròn tâm O có đường kính nằm ngang. Một hình chữ nhật có chiều dài 6 m và chiều rộng 3 m được đặt đối xứng trên đường kính sao cho hai đỉnh trên nằm trên cung nửa đường tròn. Vẽ hình minh họa, ghi tên tâm O tại đúng điểm tâm và ghi số đo 6 m trên cạnh đáy của hình chữ nhật. Bố trí các nhãn rõ ràng, đúng đối tượng.";

const crowdedCandidateSource = [
  "\\begin{tikzpicture}[scale=1]",
  "\\coordinate (L) at (-4.2426,0);",
  "\\coordinate (R) at (4.2426,0);",
  "\\coordinate (A) at (-3,0);",
  "\\coordinate (B) at (3,0);",
  "\\coordinate (C) at (3,3);",
  "\\coordinate (D) at (-3,3);",
  "\\coordinate (O) at (0,0);",
  "\\draw[thick] (L) -- (R);",
  "\\draw[thick] (R) arc[start angle=0,end angle=180,radius=4.2426];",
  "\\draw[thick] (A) -- (B) -- (C) -- (D) -- cycle;",
  "\\fill (O) circle (1.4pt);",
  "\\node[below=2pt] at (O) {$O$};",
  "\\path (A) -- (B) node[midway,below=18pt,font=\\small] {$\\mathrm{6\\,m}$};",
  "\\path (A) -- (D) node[midway,left,font=\\small] {$\\mathrm{3\\,m}$};",
  QUIZ_FIGURE_EXTENSION_MARKER,
  "\\end{tikzpicture}",
].join("\n");

describe("Quiz label-cluster live assertion helper", () => {
  it("recognizes standalone and path-attached point labels", () => {
    expectPointAndMeasurementOnOppositeSides(
      "\\node[anchor=south west] at (O) {$O$};\n" +
        "\\draw (A)--(B) node[midway,below] {$\\mathrm{6\\,m}$};",
    );
    expectPointAndMeasurementOnOppositeSides(
      "\\fill (O) circle (1pt) node[above right] {$O$};\n" +
        "\\draw (A)--(B) node[midway,below] {$\\mathrm{6\\,m}$};",
    );
  });
});

describe.skipIf(!runLiveTest)(
  "Quiz point/measurement label-cluster live regression",
  () => {
    it("separates a measurement label from a nearby point label when the opposite side is free", async () => {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OPENAI_API_KEY is required for the live test.");

      const model = process.env.OPENAI_QUIZ_FIGURE_LIVE_MODEL ?? "gpt-5.6-luna";
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
        process.env.OPENAI_QUIZ_LABEL_CLUSTER_LIVE_OUTPUT_DIR ??
        "/tmp/quiz-label-cluster-live";
      await mkdir(artifactDirectory, { recursive: true });

      const createInput = buildQuestionFigureInput({
        subject,
        targetGrade: 8,
        plan: { version: 1, role: "QUESTION", problem },
      });
      const created = await provider.generateStructured(
        { ...createInput, model, maxTokens: 4_000 },
        generatedQuizQuestionFigureSchema,
      );
      assertQuizFigureLatexSource(created.data.latexSource);
      await writeFile(
        resolve(artifactDirectory, "created.tex"),
        created.data.latexSource,
      );
      expect(created.data.latexSource).toMatch(/(?:6|6\s*\\,\s*m)/u);
      expect(created.data.latexSource).toMatch(/\bO\b/u);
      expectPointAndMeasurementOnOppositeSides(created.data.latexSource);
      const createdRender = await renderQuizFigure(created.data.latexSource);
      expect(createdRender.ok, createdRender.log ?? createdRender.code).toBe(true);
      if (!createdRender.svg) throw new Error("Created figure did not return SVG.");

      const candidateRender = await renderQuizFigure(crowdedCandidateSource);
      expect(candidateRender.ok, candidateRender.log ?? candidateRender.code).toBe(true);
      if (!candidateRender.svg) throw new Error("Candidate figure did not return SVG.");
      const candidateImageDataUrl = await buildQuizFigureRefinementImageDataUrl(
        Buffer.from(candidateRender.svg),
      );
      const refinementInput = buildQuizFigureRefinementInput({
        subject,
        targetGrade: 8,
        plan: { version: 1, role: "QUESTION", problem },
        currentLatexSource: crowdedCandidateSource,
        currentImageDataUrl: candidateImageDataUrl,
      });
      const refined = await provider.generateStructured(
        { ...refinementInput, model, maxTokens: 4_000 },
        generatedQuizFigureRefinementSchema,
      );
      assertQuizFigureLatexSource(refined.data.latexSource);
      await writeFile(
        resolve(artifactDirectory, "refined.tex"),
        refined.data.latexSource,
      );
      expect(refined.data.latexSource).not.toBe(crowdedCandidateSource);
      expect(refined.data.latexSource).toMatch(/(?:6|6\s*\\,\s*m)/u);
      expect(refined.data.latexSource).toMatch(/\bO\b/u);
      expectPointAndMeasurementOnOppositeSides(refined.data.latexSource);
      const refinedRender = await renderQuizFigure(refined.data.latexSource);
      expect(refinedRender.ok, refinedRender.log ?? refinedRender.code).toBe(true);
      if (!refinedRender.svg) throw new Error("Refined figure did not return SVG.");

      const createdCostVnd = estimateLunaCostVnd(created.usage);
      const refinedCostVnd = estimateLunaCostVnd(refined.usage);
      const usageSummary = {
        model,
        calls: 2,
        createPromptVersion: createInput.promptVersion,
        refinementPromptVersion: refinementInput.promptVersion,
        createdUsage: created.usage ?? null,
        refinedUsage: refined.usage ?? null,
        estimatedCostVnd: createdCostVnd + refinedCostVnd,
        artifactDirectory,
      };
      await Promise.all([
        writeFile(resolve(artifactDirectory, "created.tex"), created.data.latexSource),
        writeFile(resolve(artifactDirectory, "created.svg"), createdRender.svg),
        writeFile(resolve(artifactDirectory, "candidate.tex"), crowdedCandidateSource),
        writeFile(resolve(artifactDirectory, "candidate.svg"), candidateRender.svg),
        writeFile(resolve(artifactDirectory, "refined.tex"), refined.data.latexSource),
        writeFile(resolve(artifactDirectory, "refined.svg"), refinedRender.svg),
        writeFile(
          resolve(artifactDirectory, "usage.json"),
          `${JSON.stringify(usageSummary, null, 2)}\n`,
        ),
      ]);

      console.info(`[QUIZ LABEL CLUSTER LIVE] ${JSON.stringify(usageSummary)}`);
    }, 420_000);
  },
);

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

function expectPointAndMeasurementOnOppositeSides(source: string) {
  const nodeCommands = source
    .split(";")
    .filter((command) => /\bnode\s*\[/iu.test(command));
  const pointOptions = extractNodeOptions(
    nodeCommands.find((command) => /\{\s*\$?\s*O\s*\$?\s*\}/u.test(command)),
  );
  const measurementOptions = extractNodeOptions(
    nodeCommands.find((command) => /\\mathrm\s*\{\s*6\s*\\,\s*m/iu.test(command)),
  );
  expect(pointOptions, "Point O must use an explicit above/below side.").toBeTruthy();
  expect(
    measurementOptions,
    "The 6 m measurement must use an explicit above/below side.",
  ).toBeTruthy();
  expect(resolveVerticalSide(pointOptions!)).not.toBe(
    resolveVerticalSide(measurementOptions!),
  );
}

function extractNodeOptions(command: string | undefined) {
  return command?.match(/\bnode\s*\[([^\]]*)\]/iu)?.[1];
}

function resolveVerticalSide(options: string) {
  if (/\babove\b/iu.test(options)) return "ABOVE";
  if (/\bbelow\b/iu.test(options)) return "BELOW";
  if (/anchor\s*=\s*south/iu.test(options)) return "ABOVE";
  if (/anchor\s*=\s*north/iu.test(options)) return "BELOW";
  return "UNKNOWN";
}
