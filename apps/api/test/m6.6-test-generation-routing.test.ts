import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  AiGenerationType,
  AiModelPurpose,
  AiProviderName,
  Difficulty,
  ProviderCatalogCategory,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  QuizGenerationJobService,
  type QueueQuizGenerationInput,
} from "#api/modules/quiz/services/quiz-generation-job.service";

type GenerationInternals = {
  resolveAssessmentRoute(input: QueueQuizGenerationInput): Promise<unknown>;
  resolveAssessmentImageRoute(input: QueueQuizGenerationInput): Promise<unknown>;
  loadExistingAssessmentQuestions(lessonId: string, isTest: boolean): Promise<unknown>;
};

describe("M6.6 Test generation routing", () => {
  it("resolves both Test text and image configuration through AiGenerationType.TEST", async () => {
    const resolveRoute = vi.fn(async (feature, purpose) => ({
      feature,
      purpose,
      version: 1,
      model: "gpt-test",
      temperature: 0.1,
      reasoningEffort: null,
      maxInputTokens: 100_000,
      maxOutputTokens: 8_000,
      hasConfiguration: true,
      candidates: [
        {
          catalogItemId: "catalog-test",
          priceVersionId: "price-test",
          category: ProviderCatalogCategory.AI_MODEL,
          provider: AiProviderName.OPENAI,
          model: "gpt-test",
          maxInputTokens: 100_000,
          available: true,
          capabilitiesJson: { pdfInput: true, pdfDetailLevels: ["high"] },
          rates: [],
        },
      ],
    }));
    const service = createService({}, { resolve: resolveRoute });
    const input = {
      assessmentKind: "TEST",
      questionCount: 1,
      difficulty: Difficulty.EASY,
    } satisfies QueueQuizGenerationInput;

    await service.resolveAssessmentRoute(input);
    await service.resolveAssessmentImageRoute(input);

    expect(resolveRoute).toHaveBeenNthCalledWith(
      1,
      AiGenerationType.TEST,
      AiModelPurpose.TEXT,
    );
    expect(resolveRoute).toHaveBeenNthCalledWith(
      2,
      AiGenerationType.TEST,
      AiModelPurpose.IMAGE,
    );
  });

  it("reuses Quiz references and appends Test references for Test duplicate protection", async () => {
    const quizQuestion = { questionJson: { quiz: true } };
    const testQuestion = { questionJson: { test: true } };
    const testFindMany = vi.fn().mockResolvedValue([testQuestion]);
    const quizFindMany = vi.fn().mockResolvedValue([quizQuestion]);
    const service = createService({
      testQuestion: { findMany: testFindMany },
      quizQuestion: { findMany: quizFindMany },
    });

    const questions = await service.loadExistingAssessmentQuestions("lesson-1", true);

    expect(quizFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          lessonId: "lesson-1",
          deletedAt: null,
          quizSet: { deletedAt: null },
        },
      }),
    );
    expect(testFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          lessonId: "lesson-1",
          deletedAt: null,
          testSet: { deletedAt: null },
        },
      }),
    );
    expect(questions).toEqual([quizQuestion, testQuestion]);
    expect(quizFindMany.mock.calls[0]?.[0]?.where).not.toHaveProperty("reviewStatus");
    expect(testFindMany.mock.calls[0]?.[0]?.where).not.toHaveProperty("reviewStatus");
  });

  it("keeps Quiz generation on the existing Quiz-only reference path", async () => {
    const quizQuestion = { questionJson: { quiz: true } };
    const testFindMany = vi.fn().mockResolvedValue([{ questionJson: { test: true } }]);
    const quizFindMany = vi.fn().mockResolvedValue([quizQuestion]);
    const service = createService({
      testQuestion: { findMany: testFindMany },
      quizQuestion: { findMany: quizFindMany },
    });

    const questions = await service.loadExistingAssessmentQuestions("lesson-1", false);

    expect(questions).toEqual([quizQuestion]);
    expect(quizFindMany).toHaveBeenCalledOnce();
    expect(testFindMany).not.toHaveBeenCalled();
  });

  it("lets provider accounting derive TEST_GENERATION from the Test job type", async () => {
    const worker = await readFile(
      resolve(process.cwd(), "src/workers/services/quiz-generation.service.ts"),
      "utf8",
    );
    expect(worker).not.toContain(
      'providerContext(context, { operation: "QUIZ_GENERATION" })',
    );
    expect(worker).toContain("providerContext(context)");
  });
});

function createService(
  prisma: Record<string, unknown>,
  modelRouting: Record<string, unknown> = {},
) {
  return new QuizGenerationJobService(
    {} as never,
    {} as never,
    modelRouting as never,
    prisma as never,
    {} as never,
  ) as unknown as GenerationInternals;
}
