import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { Difficulty, QuestionType } from "@prisma/client";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { OpenAiProvider } from "#api/modules/ai/providers/openai.provider";
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

const runLiveTest = process.env.RUN_OPENAI_QUIZ_DEDUP_LIVE_TESTS === "1";
const roundCount = Math.min(
  5,
  Math.max(1, Number(process.env.OPENAI_QUIZ_DEDUP_LIVE_ROUNDS ?? 3)),
);
const reasoningEffort =
  process.env.OPENAI_QUIZ_DEDUP_LIVE_REASONING_EFFORT === "high" ? "high" : "medium";
const questionTypes = [
  QuestionType.MULTIPLE_CHOICE,
  QuestionType.TRUE_FALSE,
  QuestionType.MULTI_STATEMENT_TRUE_FALSE,
  QuestionType.TEXT_INPUT,
];

describe.skipIf(!runLiveTest)("Quiz existing-question dedup live regression", () => {
  it("keeps consecutive generations diverse, source-grounded and type-compatible", async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is required for the live test.");

    const model = process.env.OPENAI_QUIZ_TEXT_LIVE_MODEL ?? "gpt-5.6-luna";
    const provider = new OpenAiProvider({
      apiKey,
      requestTimeoutMs: 300_000,
      generationRequestTimeoutMs: 300_000,
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
      embeddingDimensions: Number(process.env.OPENAI_EMBEDDING_DIMENSIONS ?? 1536),
      chatModel: model,
      structuredModel: model,
    });
    const sourcePath = resolve(
      process.cwd(),
      "test/file-test/Toan-7-Tap-1-300ppi-OCR-16-trang-dau.pdf",
    );
    const sourcePdf = await selectLessonPages(readFileSync(sourcePath));
    const existingQuestionReferences = [
      JSON.stringify([QuestionType.TEXT_INPUT, "Tìm số đối của số hữu tỉ $-0,75$."]),
      JSON.stringify([
        QuestionType.MULTIPLE_CHOICE,
        "Trong các số sau, số nào là số hữu tỉ?",
        ["$\\sqrt{2}$", "$\\pi$", "$-3,5$", "$\\sqrt{3}$"],
      ]),
      JSON.stringify([
        QuestionType.TRUE_FALSE,
        "Số hữu tỉ $-2,5$ nhỏ hơn số hữu tỉ $-2,125$.",
      ]),
      JSON.stringify([
        QuestionType.MULTI_STATEMENT_TRUE_FALSE,
        "Một bể có $\\frac{3}{4}$ m³ nước. Người ta lấy ra $\\frac{2}{5}$ m³ rồi thêm vào $\\frac{1}{10}$ m³ nước.",
        [
          "Sau khi lấy ra, bể còn $\\frac{7}{20}$ m³ nước.",
          "Sau khi thêm vào, bể có $\\frac{9}{20}$ m³ nước.",
          "Lượng nước cuối cùng nhỏ hơn lúc đầu.",
        ],
      ]),
    ];
    const seenProblems = new Set(
      existingQuestionReferences.map((reference) => {
        const parsed = JSON.parse(reference) as [QuestionType, string];
        return normalizeProblem(parsed[1]);
      }),
    );
    const rounds: Array<Record<string, unknown>> = [];
    let estimatedCostVnd = 0;
    let abstractDirectCheckShellCount = 0;
    let sequentialStateUpdateShellCount = 0;

    for (let round = 1; round <= roundCount; round += 1) {
      const result = await provider.generateStructured(
        {
          model,
          systemPrompt: buildQuizSubjectSystemPrompt({
            key: "MATH",
            name: "Toán",
            slug: "toan",
          }),
          userPrompt: buildQuizPrompt({
            lessonTitle: "Số hữu tỉ: nhận biết, biểu diễn, so sánh và phép tính",
            questionCount: 4,
            difficulty: Difficulty.MEDIUM,
            questionTypes,
            targetGrade: 7,
            subject: { key: "MATH", name: "Toán", slug: "toan" },
            existingQuestionReferences,
          }),
          inputFiles: [
            {
              filename: "toan-7-so-huu-ti.pdf",
              mimeType: "application/pdf",
              fileData: sourcePdf.toString("base64"),
              detail: "high",
            },
          ],
          outputName: "quiz_existing_question_dedup_live",
          promptVersion: QUIZ_PROMPT_VERSIONS.MATH,
          schemaVersion: QUIZ_SCHEMA_VERSION,
          schemaReferenceStrategy: "ref_v2",
          promptCache: {
            namespace: "quiz",
            keyEnabled: true,
            retention: "in_memory",
          },
          reasoningEffort,
          maxTokens: 8_000,
        },
        getGeneratedQuizOutputSchema({
          subjectKey: "MATH",
          targetGrade: 7,
          questionCount: 4,
          questionTypes,
          difficulty: Difficulty.MEDIUM,
        }),
      );

      expect(result.data.questions).toHaveLength(4);
      expect(
        new Set(result.data.questions.map((question) => question.questionType)),
      ).toEqual(new Set(questionTypes));
      console.info(
        `[QUIZ EXISTING QUESTION DEDUP LIVE ROUND ${round}] ${JSON.stringify({ usage: result.usage ?? null, questions: result.data.questions })}`,
      );

      const generatedForLog: Array<Record<string, unknown>> = [];
      for (const question of result.data.questions) {
        const problem = question.explanation.problem;
        const normalizedProblem = normalizeProblem(problem);
        expect(seenProblems.has(normalizedProblem)).toBe(false);
        expect(matchesKnownSourceCopyRegression(problem)).toBe(false);
        seenProblems.add(normalizedProblem);

        if (question.questionType === QuestionType.TRUE_FALSE) {
          expect(problem).not.toMatch(/đúng hay sai|đánh giá mệnh đề/iu);
        }
        if (question.questionType === QuestionType.TEXT_INPUT) {
          expect(question.correctAnswer).toMatch(/^-?(?:\d+(?:\.\d+)?|\d+\/\d+)$/u);
        }
        if (question.questionType === QuestionType.MULTI_STATEMENT_TRUE_FALSE) {
          if (usesAbstractDirectCheckShell(problem)) {
            abstractDirectCheckShellCount += 1;
          }
          if (usesSequentialStateUpdateShell(problem)) {
            sequentialStateUpdateShellCount += 1;
          }
          for (const [
            index,
            statementSolution,
          ] of question.explanation.statementSolutions.entries()) {
            const statement = question.statements[index]!;
            expect(statementSolution.statementId).toBe(statement.id);
            expect(readStatementConclusion(statementSolution.solution)).toBe(
              statement.value ? "đúng" : "sai",
            );
          }
        }

        existingQuestionReferences.push(serializeQuestionReference(question));
        generatedForLog.push({
          questionType: question.questionType,
          problem,
          hint: question.hint,
          ...(question.explanation && "solution" in question.explanation
            ? { solution: question.explanation.solution }
            : {}),
          ...(question.explanation && "statementSolutions" in question.explanation
            ? { statementSolutions: question.explanation.statementSolutions }
            : {}),
          ...("options" in question
            ? { options: question.options.map((option) => option.text) }
            : {}),
          ...("correctOptionId" in question
            ? { correctOptionId: question.correctOptionId }
            : {}),
          ...("statements" in question
            ? {
                statements: question.statements.map((statement) => ({
                  text: statement.text,
                  value: statement.value,
                })),
              }
            : {}),
          ...("correctAnswer" in question
            ? { correctAnswer: question.correctAnswer }
            : {}),
        });
      }

      const roundCostVnd = estimateLunaCostVnd(result.usage);
      estimatedCostVnd += roundCostVnd;
      rounds.push({
        round,
        model: result.model,
        usage: result.usage ?? null,
        estimatedCostVnd: roundCostVnd,
        questions: generatedForLog,
      });
    }

    const report = {
      model,
      reasoningEffort,
      promptVersion: QUIZ_PROMPT_VERSIONS.MATH,
      sourcePath,
      rounds,
      abstractDirectCheckShellCount,
      sequentialStateUpdateShellCount,
      estimatedCostVnd,
    };
    console.info(`[QUIZ EXISTING QUESTION DEDUP LIVE] ${JSON.stringify(report)}`);
    expect(sequentialStateUpdateShellCount).toBe(0);
    expect(estimatedCostVnd).toBeLessThanOrEqual(10_000);
  }, 900_000);
});

type GeneratedQuestion = ReturnType<
  typeof getGeneratedQuizOutputSchema
>["_output"]["questions"][number];

function serializeQuestionReference(question: GeneratedQuestion) {
  const contentTexts =
    "options" in question
      ? question.options.map((option) => option.text)
      : "statements" in question
        ? question.statements.map((statement) => statement.text)
        : [];
  return JSON.stringify([
    question.questionType,
    question.explanation.problem,
    ...(contentTexts.length > 0 ? [contentTexts] : []),
  ]);
}

function normalizeProblem(value: string) {
  return value.replace(/\s+/gu, " ").trim().toLocaleLowerCase("vi");
}

function usesSequentialStateUpdateShell(problem: string) {
  const normalized = normalizeProblem(problem);
  const hasSequence = /sau đó|rồi|tiếp theo|cuối cùng/u.test(normalized);
  const hasStateUpdate = /tăng|giảm|thêm|lấy ra|bán|nhập|đi lên|đi xuống|bơm|dùng/u.test(
    normalized,
  );
  return hasSequence && hasStateUpdate;
}

function matchesKnownSourceCopyRegression(problem: string) {
  const normalized = normalizeProblem(problem).replaceAll(".", ",");
  return (
    normalized.includes("khoai tây") &&
    ["100", "11", "6,6", "0,3", "75,1"].every((token) => normalized.includes(token))
  );
}

function readStatementConclusion(solution: string) {
  const match = solution.trim().match(/\s(đúng|sai)\.?$/iu);
  return match?.[1]?.toLocaleLowerCase("vi") ?? null;
}

function usesAbstractDirectCheckShell(problem: string) {
  const normalized = normalizeProblem(problem).replaceAll("$", "");
  return /^cho (?:các số hữu tỉ )?[a-z]\s*=/u.test(normalized);
}

async function selectLessonPages(sourceBytes: Buffer) {
  const source = await PDFDocument.load(sourceBytes, { updateMetadata: false });
  const packet = await PDFDocument.create();
  const pageIndices = Array.from(
    { length: Math.max(0, source.getPageCount() - 5) },
    (_, index) => index + 5,
  );
  const pages = await packet.copyPages(source, pageIndices);
  for (const page of pages) packet.addPage(page);
  return Buffer.from(await packet.save({ useObjectStreams: false }));
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
