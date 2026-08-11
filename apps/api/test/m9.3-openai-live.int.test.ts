import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { Test, type TestingModule } from "@nestjs/testing";
import { config as loadEnv } from "dotenv";
import {
  AiGenerationStatus,
  AiGenerationType,
  BackgroundJobQueue,
  BackgroundJobStatus,
  Difficulty,
  Prisma,
  QuestionType,
  UserRole,
  UserStatus,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "#api/app.module";
import { getTiptapText } from "#api/common/validation/rich-text-content";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { AiGenerationLifecycleService } from "#api/modules/ai/services/ai-generation-lifecycle.service";
import { AiService } from "#api/modules/ai/services/ai.service";
import {
  LessonContentGenerationContextService,
  type LessonContentGenerationContextService as LessonContentContextServiceType,
} from "#api/modules/ai/services/lesson-content-generation-context.service";
import type { AiGenerationExecutionContext } from "#api/modules/ai/types/ai-generation.types";
import {
  LESSON_CONTENT_PROMPT_VERSION,
  LESSON_CONTENT_SCHEMA_VERSION,
} from "#api/modules/ai/types/lesson-content-generation.types";
import { hashAiValue } from "#api/modules/ai/utils/ai-hash";
import { QuizService } from "#api/modules/quiz/services/quiz.service";
import { LessonContentGenerationService } from "#api/workers/services/lesson-content-generation.service";

loadEnv({ path: resolve(process.cwd(), "../../.env"), override: false });

const runLiveTest = process.env.RUN_OPENAI_LIVE_TESTS === "1";
const ALGEBRA_LESSON_ID = "87c1291d-356c-4650-9db2-0c3422b2c04d";
const GEOMETRY_LESSON_ID = "0ba395e6-d64a-439f-a668-d9cbb3fc9544";
const MODEL = process.env.OPENAI_STRUCTURED_MODEL ?? "gpt-4.1-mini";
const QUIZ_QUERY = "kiến thức trọng tâm và bài tập ôn tập của buổi học";
const TEST_QUERY = "kiến thức và năng lực cần đánh giá trong bài kiểm tra";
const selectedDomains = new Set(
  (process.env.M93_LIVE_DOMAINS ?? "algebra,geometry")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const selectedCounts = (process.env.M93_LIVE_COUNTS ?? "1,5,10")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => [1, 5, 10].includes(value));
const runTestGate = process.env.M93_LIVE_TEST_GATE !== "0";

type LiveTotals = {
  calls: number;
  input: number;
  output: number;
  total: number;
  resourceIds: string[];
};

describe.skipIf(!runLiveTest)("M9.3 database-backed OpenAI live matrix", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let aiService: AiService;
  let realContext: LessonContentGenerationContextService;
  let lifecycle: AiGenerationLifecycleService;
  let quizService: QuizService;
  let ownerUserId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
    aiService = moduleRef.get(AiService);
    realContext = moduleRef.get(LessonContentGenerationContextService);
    lifecycle = moduleRef.get(AiGenerationLifecycleService);
    quizService = moduleRef.get(QuizService);
    const owner = await prisma.user.findFirst({
      where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!owner) throw new Error("M9.3 live test requires one active ADMIN user.");
    ownerUserId = owner.id;
  });

  afterAll(async () => {
    if (moduleRef) await moduleRef.close();
  });

  it("generates source-grounded Algebra, Geometry and mixed EXAMPLE Quiz questions", async () => {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required for M9.3 live tests.");
    }
    const totals: LiveTotals = {
      calls: 0,
      input: 0,
      output: 0,
      total: 0,
      resourceIds: [],
    };
    const cases = [
      { domain: "algebra", lessonId: ALGEBRA_LESSON_ID },
      { domain: "geometry", lessonId: GEOMETRY_LESSON_ID },
      { domain: "mixed", lessonId: ALGEBRA_LESSON_ID },
    ].filter((liveCase) => selectedDomains.has(liveCase.domain));
    let geometryTenQuestionGeneration: {
      generationId: string;
      questionIds: string[];
      setId: string;
    } | null = null;
    let expectedQuizCalls = 0;

    for (const liveCase of cases) {
      const caseQuestionCounts =
        liveCase.domain === "mixed"
          ? selectedCounts.filter((questionCount) => questionCount === 10)
          : selectedCounts;
      if (liveCase.domain === "mixed" && caseQuestionCounts.length === 0) {
        throw new Error("The mixed Algebra + Geometry live case requires M93_LIVE_COUNTS=10.");
      }
      expectedQuizCalls += caseQuestionCounts.length;
      const targetSet = await prisma.quizSet.findFirstOrThrow({
        where: { lessonId: liveCase.lessonId, deletedAt: null },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      });
      const setCountBefore = await prisma.quizSet.count({
        where: { lessonId: liveCase.lessonId, deletedAt: null },
      });
      const { snapshot, retrieved } =
        liveCase.domain === "mixed"
          ? await createMixedAlgebraGeometryContext()
          : await createSingleLessonContext(liveCase.lessonId);
      const worker = createWorkerWithCachedSource(retrieved);

      for (const questionCount of caseQuestionCounts) {
        const inputMeta = {
          targetQuizSetId: targetSet.id,
          documentIds: snapshot.documentIds,
          sourceHash: snapshot.sourceHash,
          targetGrade: snapshot.targetGrade,
          questionCount,
          difficulty: Difficulty.MIXED,
          difficultyCounts: balancedDifficultyCounts(questionCount),
          questionTypes: Object.values(QuestionType),
          style: "student_friendly" as const,
          styleInstructions:
            "Rõ ràng, phù hợp học sinh lớp 7 và ưu tiên học qua từng bước.",
          extraInstructions:
            liveCase.domain === "geometry"
              ? "Nếu câu phụ thuộc hình, hãy tạo diagram semantic an toàn và lời giải hình học mạch lạc."
              : liveCase.domain === "mixed"
                ? "Đây là lượt kiểm thử tổng hợp: 5 câu đầu phải là Đại số/số hữu tỉ, 5 câu sau phải là Hình học/tam giác vuông. Phải có cả hai nhóm trong cùng một output; ít nhất 2 câu Hình học phải có diagramSpec semantic an toàn."
              : "Ưu tiên phép tính mới, không chép nguyên bài tập trong nguồn.",
          systemInstructions: "",
          userPrompt: "",
          model: MODEL,
          temperature: 0.1,
          maxOutputTokens: outputTokenCap(questionCount),
        };
        const context = await createExecutionContext({
          inputMeta,
          lessonId: liveCase.lessonId,
          ownerUserId,
          type: AiGenerationType.QUIZ,
        });
        const { prepared, persisted } = await executeLiveGeneration(worker, context);
        expect(persisted.resourceType).toBe("QUIZ_SET");
        expect(persisted.resourceId).toBe(targetSet.id);
        const generatedQuestions = await prisma.quizQuestion.findMany({
          where: {
            quizSetId: targetSet.id,
            deletedAt: null,
            explanation: { aiGenerationId: context.aiGenerationId },
          },
          orderBy: { sortOrder: "asc" },
          include: { explanation: true },
        });
        const set = await prisma.quizSet.findUniqueOrThrow({
          where: { id: targetSet.id },
        });
        const generation = await prisma.aiGeneration.findUniqueOrThrow({
          where: { id: context.aiGenerationId },
          select: { inputMetaJson: true, targetId: true },
        });
        expect(set.questionCount).toBeGreaterThanOrEqual(questionCount);
        expect(generatedQuestions).toHaveLength(questionCount);
        expect(generation.targetId).toBe(targetSet.id);
        expect(generation.inputMetaJson).toMatchObject({
          generationAudit: {
            requestedCount: questionCount,
            initialGeneratedCount: questionCount,
            currentActiveCount: questionCount,
            deletedCount: 0,
          },
        });
        for (const question of generatedQuestions) {
          expect(getTiptapText(question.questionJson).trim().length).toBeGreaterThan(10);
          expect(getTiptapText(question.hintJson).trim().length).toBeGreaterThan(0);
          expect(question.explanation).not.toBeNull();
          expect(getTiptapText(question.explanation!.contentJson).trim()).toContain(
            "Đáp án:",
          );
          const sourceMetadata = question.sourceMetadataJson as {
            exampleBlock?: { type?: string; problem?: string; answer?: string };
            sourceChunkIds?: unknown;
            sourceHash?: unknown;
            sources?: unknown;
          };
          expect(sourceMetadata.exampleBlock).toMatchObject({
            type: "example",
            problem: expect.any(String),
            answer: expect.any(String),
          });
          expect(sourceMetadata.sourceChunkIds).toBeUndefined();
          expect(sourceMetadata.sourceHash).toBeUndefined();
          expect(sourceMetadata.sources).toBeUndefined();
        }
        if (liveCase.domain === "mixed") {
          const generatedText = generatedQuestions.map((question) =>
            getTiptapText(question.questionJson).trim(),
          );
          expect(generatedText.slice(0, 5).every(isAlgebraQuestion)).toBe(true);
          expect(generatedText.slice(5).every(isGeometryQuestion)).toBe(true);
          expect(
            generatedQuestions.filter((question) => {
              const metadata = question.sourceMetadataJson as {
                exampleBlock?: { visual?: { kind?: string } };
              };
              return metadata.exampleBlock?.visual?.kind === "DIAGRAM_SPEC";
            }).length,
          ).toBeGreaterThanOrEqual(2);
        }
        recordUsage(totals, prepared.output, `${liveCase.domain}-${questionCount}`);
        totals.resourceIds.push(targetSet.id);
        if (liveCase.domain === "geometry" && questionCount === 10) {
          geometryTenQuestionGeneration = {
            generationId: context.aiGenerationId,
            questionIds: generatedQuestions.map((question) => question.id),
            setId: targetSet.id,
          };
        }
      }
      expect(
        await prisma.quizSet.count({
          where: { lessonId: liveCase.lessonId, deletedAt: null },
        }),
      ).toBe(setCountBefore);
    }

    if (geometryTenQuestionGeneration) {
      for (const questionId of geometryTenQuestionGeneration.questionIds.slice(0, 2)) {
        await quizService.deleteQuestion(questionId, ownerUserId, {});
      }
      const geometrySetAfterDelete = await prisma.quizSet.findUniqueOrThrow({
        where: { id: geometryTenQuestionGeneration.setId },
        select: { id: true, questionCount: true },
      });
      const geometryGenerationAfterDelete = await prisma.aiGeneration.findUniqueOrThrow({
        where: { id: geometryTenQuestionGeneration.generationId },
        select: { inputMetaJson: true },
      });
      expect(geometrySetAfterDelete.id).toBe(geometryTenQuestionGeneration.setId);
      expect(geometryGenerationAfterDelete.inputMetaJson).toMatchObject({
        generationAudit: {
          requestedCount: 10,
          initialGeneratedCount: 10,
          deletedCount: 2,
          currentActiveCount: 8,
        },
      });
    }

    if (runTestGate) {
      const testSnapshot = await realContext.snapshot(ALGEBRA_LESSON_ID);
      const testRetrieved = await realContext.retrieve({
        lessonId: ALGEBRA_LESSON_ID,
        documentIds: testSnapshot.documentIds,
        sourceHash: testSnapshot.sourceHash,
        query: TEST_QUERY,
      });
      const testWorker = createWorkerWithCachedSource(testRetrieved);
      const testContext = await createExecutionContext({
        inputMeta: {
          documentIds: testSnapshot.documentIds,
          sourceHash: testSnapshot.sourceHash,
          targetGrade: testSnapshot.targetGrade,
          questionCount: 2,
          durationSeconds: 600,
          difficultyRatio: { easy: 0, medium: 1, hard: 0 },
          questionTypes: [QuestionType.MULTIPLE_CHOICE, QuestionType.TEXT_INPUT],
        },
        lessonId: ALGEBRA_LESSON_ID,
        ownerUserId,
        type: AiGenerationType.TEST,
      });
      const testRun = await executeLiveGeneration(testWorker, testContext);
      const testSet = await prisma.testSet.findUniqueOrThrow({
        where: { id: testRun.persisted.resourceId! },
        include: { questions: { include: { explanation: true } } },
      });
      expect(testSet.questions).toHaveLength(2);
      expect(testSet.questions.every((question) => question.explanation !== null)).toBe(
        true,
      );
      recordUsage(totals, testRun.prepared.output, "test-gate-algebra-2");
    }

    const estimatedUsd = estimateOpenAiCostUsd(MODEL, totals.input, totals.output);
    console.info(
      `[M9.3 LIVE TOTAL] calls=${totals.calls} model=${MODEL} ` +
        `inputTokens=${totals.input} outputTokens=${totals.output} ` +
        `totalTokens=${totals.total} estimatedUsd=${estimatedUsd?.toFixed(6) ?? "unknown"} ` +
        `quizSetIds=${totals.resourceIds.join(",")}`,
    );
    expect(totals.calls).toBe(expectedQuizCalls + Number(runTestGate));
    expect(totals.total).toBeGreaterThan(0);
  }, 1_200_000);

  function createWorkerWithCachedSource(
    retrieved: Awaited<ReturnType<LessonContentGenerationContextService["retrieve"]>>,
  ) {
    const cachedContext = {
      retrieve: async (input: { lessonId: string; sourceHash: string }) => {
        expect(input.lessonId).toBe(retrieved.lessonId);
        expect(input.sourceHash).toBe(retrieved.sourceHash);
        return retrieved;
      },
    } as unknown as LessonContentContextServiceType;
    return new LessonContentGenerationService(
      prisma,
      aiService,
      cachedContext,
      undefined,
    );
  }

  async function createSingleLessonContext(lessonId: string) {
    const snapshot = await realContext.snapshot(lessonId);
    const retrieved = await realContext.retrieve({
      lessonId,
      documentIds: snapshot.documentIds,
      sourceHash: snapshot.sourceHash,
      query: QUIZ_QUERY,
    });
    return { snapshot, retrieved };
  }

  async function createMixedAlgebraGeometryContext() {
    const [algebra, geometry] = await Promise.all([
      createSingleLessonContext(ALGEBRA_LESSON_ID),
      createSingleLessonContext(GEOMETRY_LESSON_ID),
    ]);
    const documentIds = [
      ...algebra.snapshot.documentIds,
      ...geometry.snapshot.documentIds,
    ];
    const sourceHash = hashAiValue({
      purpose: "m9.3-live-mixed-algebra-geometry",
      algebra: algebra.snapshot.sourceHash,
      geometry: geometry.snapshot.sourceHash,
    });
    const chunks = [...algebra.retrieved.chunks, ...geometry.retrieved.chunks];
    const snapshot = {
      ...algebra.snapshot,
      lessonTitle: "Ôn tập tổng hợp Đại số và Hình học",
      documentIds,
      sourceHash,
      chunks,
      totalTokens: algebra.snapshot.totalTokens + geometry.snapshot.totalTokens,
    };
    const retrieved = {
      ...algebra.retrieved,
      lessonTitle: snapshot.lessonTitle,
      documentIds,
      sourceHash,
      chunks,
      totalTokens: algebra.retrieved.totalTokens + geometry.retrieved.totalTokens,
    };
    return { snapshot, retrieved };
  }

  async function createExecutionContext(input: {
    inputMeta: Record<string, unknown>;
    lessonId: string;
    ownerUserId: string;
    type: AiGenerationType;
  }): Promise<AiGenerationExecutionContext> {
    const pair = await prisma.$transaction(async (transaction) => {
      const job = await transaction.backgroundJob.create({
        data: {
          queue: BackgroundJobQueue.AI_GENERATION,
          status: BackgroundJobStatus.QUEUED,
          ownerUserId: input.ownerUserId,
          lessonId: input.lessonId,
          resourceType: `${input.type}_SET`,
          inputMeta: toInputJson(input.inputMeta),
          idempotencyKey: `m9.3-live:${input.type}:${input.lessonId}:${randomUUID()}`,
          maxAttempts: 1,
        },
        select: { id: true },
      });
      const generation = await transaction.aiGeneration.create({
        data: {
          type: input.type,
          status: AiGenerationStatus.QUEUED,
          backgroundJobId: job.id,
          createdByUserId: input.ownerUserId,
          lessonId: input.lessonId,
          targetType: `${input.type}_SET`,
          promptVersion: LESSON_CONTENT_PROMPT_VERSION,
          schemaVersion: LESSON_CONTENT_SCHEMA_VERSION,
          inputHash: randomUUID().replaceAll("-", ""),
          inputMetaJson: toInputJson(input.inputMeta),
        },
        select: { id: true },
      });
      return { backgroundJobId: job.id, aiGenerationId: generation.id };
    });
    return {
      ...pair,
      type: input.type,
      ownerUserId: input.ownerUserId,
      lessonId: input.lessonId,
      targetType: `${input.type}_SET`,
      targetId: null,
      inputMeta: input.inputMeta,
      attempt: 1,
      maxAttempts: 1,
    };
  }

  async function executeLiveGeneration(
    worker: LessonContentGenerationService,
    context: AiGenerationExecutionContext,
  ) {
    await lifecycle.markRunning(context, context.backgroundJobId);
    try {
      const prepared = await worker.generate(context);
      const persisted = await worker.persist(context, prepared);
      await lifecycle.markSucceeded(context, prepared, persisted);
      return { prepared, persisted };
    } catch (error) {
      await lifecycle.markFailed(context, error, true);
      throw error;
    }
  }
});

function balancedDifficultyCounts(questionCount: number) {
  const medium = Math.ceil(questionCount / 3);
  const easy = Math.ceil((questionCount - medium) / 2);
  return { easy, medium, hard: questionCount - easy - medium };
}

function outputTokenCap(questionCount: number) {
  if (questionCount === 1) return 3_500;
  if (questionCount === 5) return 8_000;
  return 14_000;
}

function isAlgebraQuestion(value: string) {
  return /(?:phân số|số hữu tỉ|biểu thức|tính|\\dfrac|\\frac|số thập phân)/iu.test(
    value,
  );
}

function isGeometryQuestion(value: string) {
  return /(?:tam giác|cạnh huyền|góc vuông|vuông tại|\\widehat)/iu.test(value);
}

function estimateOpenAiCostUsd(model: string, inputTokens: number, outputTokens: number) {
  const rates = model.startsWith("gpt-5.4")
    ? { input: 2.5, output: 15 }
    : model.startsWith("gpt-4.1-mini")
      ? { input: 0.4, output: 1.6 }
      : model.startsWith("gpt-4.1")
        ? { input: 2, output: 8 }
        : null;
  return rates
    ? (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000
    : null;
}

function recordUsage(
  totals: LiveTotals,
  output: {
    model: string;
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
    latencyMs?: number;
  },
  label: string,
) {
  totals.calls += 1;
  totals.input += output.usage?.promptTokens ?? 0;
  totals.output += output.usage?.completionTokens ?? 0;
  totals.total += output.usage?.totalTokens ?? 0;
  console.info(
    `[M9.3 LIVE] case=${label} model=${output.model} ` +
      `inputTokens=${output.usage?.promptTokens ?? "unknown"} ` +
      `outputTokens=${output.usage?.completionTokens ?? "unknown"} ` +
      `latencyMs=${output.latencyMs ?? "unknown"}`,
  );
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
