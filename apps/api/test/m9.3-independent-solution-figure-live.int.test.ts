import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { Difficulty, QuestionType } from "@prisma/client";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { OpenAiProvider } from "#api/modules/ai/providers/openai.provider";
import {
  buildSolutionFigureInput,
  generatedQuizSolutionFigureSchema,
} from "#api/modules/quiz-figures/types/quiz-figure-generation.types";
import { assertQuizFigureLatexSource } from "#api/modules/quiz-figures/utils/quiz-figure-source-policy";
import {
  getGeneratedQuizOutputSchema,
  QUIZ_PROMPT_VERSIONS,
  QUIZ_SCHEMA_VERSION,
} from "#api/modules/quiz/types/quiz-generation.types";
import {
  buildQuizPrompt,
  buildQuizSubjectSystemPrompt,
} from "#api/modules/quiz/utils/quiz-generation-prompt";

loadEnv({ path: resolve(process.cwd(), "../../.env"), override: false, quiet: true });

const runLiveTest = process.env.RUN_OPENAI_INDEPENDENT_SOLUTION_FIGURE_LIVE_TEST === "1";
const maximumBudgetVnd = 10_000;

describe.skipIf(!runLiveTest)("independent Quiz solution-figure live contract", () => {
  it("decides with two booleans, then draws a full solution source without a question base", async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is required for the live test.");

    const model =
      process.env.OPENAI_INDEPENDENT_SOLUTION_FIGURE_LIVE_MODEL ?? "gpt-5.6-luna";
    const provider = new OpenAiProvider({
      apiKey,
      requestTimeoutMs: 300_000,
      generationRequestTimeoutMs: 300_000,
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
      embeddingDimensions: Number(process.env.OPENAI_EMBEDDING_DIMENSIONS ?? 1536),
      chatModel: model,
      structuredModel: model,
    });
    const subject = { key: "MATH", name: "Toán", slug: "toan" } as const;
    const sourcePdf = await buildAuxiliaryAltitudeLessonPdf();
    const phaseOneResult = await provider.generateStructured(
      {
        model,
        systemPrompt: buildQuizSubjectSystemPrompt(subject),
        userPrompt: [
          buildQuizPrompt({
            lessonTitle: "Đường cao phụ trong tam giác",
            questionCount: 1,
            difficulty: Difficulty.MEDIUM,
            questionTypes: [QuestionType.MULTIPLE_CHOICE],
            targetGrade: 8,
            subject,
          }),
          "- Ràng buộc regression: problem phải nêu tam giác ABC nhưng chưa nêu điểm H hoặc đường AH; solution phải dựng chân đường cao H trên BC, nêu AH vuông góc BC và thật sự dùng AH trong mạch giải.",
        ].join("\n"),
        inputFiles: [
          {
            filename: "auxiliary-altitude-lesson.pdf",
            mimeType: "application/pdf",
            fileData: sourcePdf.toString("base64"),
            detail: "high",
          },
        ],
        outputName: "quiz_independent_solution_figure_phase_one_live",
        promptVersion: QUIZ_PROMPT_VERSIONS.MATH,
        schemaVersion: QUIZ_SCHEMA_VERSION,
        schemaReferenceStrategy: "ref_v2",
        promptCache: {
          namespace: "quiz",
          keyEnabled: true,
          retention: "in_memory",
        },
        reasoningEffort: "medium",
        maxTokens: 6_000,
      },
      getGeneratedQuizOutputSchema({
        subjectKey: "MATH",
        targetGrade: 8,
        questionCount: 1,
        questionTypes: [QuestionType.MULTIPLE_CHOICE],
        difficulty: Difficulty.MEDIUM,
      }),
    );
    const question = phaseOneResult.data.questions[0]!;

    expect(Object.keys(question.figure).sort()).toEqual([
      "requiresQuestionFigure",
      "solutionFigure",
    ]);
    expect(question.figure.solutionFigure).toBe(true);
    expect(question.explanation.problem).not.toMatch(/\bH\b|AH/iu);
    expect(question.explanation.solution).toMatch(/\bH\b|AH/iu);

    const solutionInput = buildSolutionFigureInput({
      subject,
      targetGrade: 8,
      plan: {
        version: 2,
        role: "SOLUTION",
        problem: question.explanation.problem,
        solution: question.explanation.solution,
      },
    });
    expect(solutionInput.inputImages).toBeUndefined();
    expect(solutionInput.userPrompt).not.toContain("questionLatexSource");
    expect(solutionInput.userPrompt).not.toContain("questionBaseRevisionId");

    const phaseTwoResult = await provider.generateStructured(
      { ...solutionInput, model, maxTokens: 5_000 },
      generatedQuizSolutionFigureSchema,
    );
    assertQuizFigureLatexSource(phaseTwoResult.data.latexSource);
    expect(phaseTwoResult.data.latexSource).toMatch(/(?:AH|\(H\)|\{H\})/u);

    const estimatedCostVnd =
      estimateLunaCostVnd(phaseOneResult.usage) +
      estimateLunaCostVnd(phaseTwoResult.usage);
    expect(estimatedCostVnd).toBeLessThanOrEqual(maximumBudgetVnd);
    console.info(
      `[QUIZ INDEPENDENT SOLUTION FIGURE LIVE] ${JSON.stringify({
        model,
        phaseOneUsage: phaseOneResult.usage ?? null,
        phaseTwoUsage: phaseTwoResult.usage ?? null,
        estimatedCostVnd,
        figureDecision: question.figure,
      })}`,
    );
  }, 600_000);
});

async function buildAuxiliaryAltitudeLessonPdf() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText(
    "Lesson: auxiliary altitude in a triangle. A solver may construct a perpendicular altitude from a vertex to the opposite side and use right triangles to derive lengths or areas. The construction must be stated in the solution when it is not given in the problem.",
    { x: 48, y: 780, size: 11, font, maxWidth: 500, lineHeight: 16 },
  );
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

function estimateLunaCostVnd(
  usage:
    | {
        promptTokens?: number;
        cachedInputTokens?: number;
        cacheWriteInputTokens?: number;
        completionTokens?: number;
      }
    | undefined,
) {
  if (!usage) return 0;
  const promptTokens = usage.promptTokens ?? 0;
  const cachedInputTokens = Math.min(promptTokens, usage.cachedInputTokens ?? 0);
  const cacheWriteInputTokens = Math.min(
    Math.max(0, promptTokens - cachedInputTokens),
    usage.cacheWriteInputTokens ?? 0,
  );
  const uncachedInputTokens = Math.max(
    0,
    promptTokens - cachedInputTokens - cacheWriteInputTokens,
  );
  const outputTokens = usage.completionTokens ?? 0;
  const costUsd =
    (uncachedInputTokens / 1_000_000) * 0.2 +
    (cachedInputTokens / 1_000_000) * 0.02 +
    (cacheWriteInputTokens / 1_000_000) * 0.25 +
    (outputTokens / 1_000_000) * 1.2;
  return Math.round(costUsd * 27_200);
}
