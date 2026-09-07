import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import {
  AiGenerationType,
  Difficulty,
  DocumentStatus,
  QuestionType,
} from "@prisma/client";

import { AppModule } from "#api/app.module";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { AiProviderCallService } from "#api/modules/ai/services/ai-provider-call.service";
import { LessonSourcePacketService } from "#api/modules/ai/services/lesson-source-packet.service";
import { AiModelRoutingService } from "#api/modules/provider-operations/services/ai-model-routing.service";
import {
  getGeneratedQuizOutputSchema,
  QUIZ_PROMPT_VERSIONS,
  QUIZ_SCHEMA_VERSION,
  type QuizGenerationJobInput,
} from "#api/modules/quiz/types/quiz-generation.types";
import { normalizeGeneratedQuizQuestionContent } from "#api/modules/quiz/utils/quiz-generation-content-normalizer";
import { buildQuizStructuredInput } from "#api/modules/quiz/utils/quiz-generation-prompt";
import { validateQuizOutput } from "#api/modules/quiz/utils/quiz-generation-validation";

async function main() {
  if (process.env.RUN_M9_3_LIVE_QUIZ !== "1") {
    throw new Error("Set RUN_M9_3_LIVE_QUIZ=1 to authorize the paid live call.");
  }

  const lessonId = requiredEnv("M9_3_LIVE_LESSON_ID");
  const model = process.env.M9_3_LIVE_MODEL?.trim() || "gpt-5.6-luna";
  const reasoningEffort =
    process.env.M9_3_LIVE_REASONING_EFFORT === "high" ? "high" : "medium";
  const maxBudgetVnd = readPositiveNumberEnv("M9_3_LIVE_MAX_BUDGET_VND", 5_000);
  const outputPath = resolve(
    process.cwd(),
    process.env.M9_3_LIVE_OUTPUT ??
      `../../.codex/artifacts/m9.3-quiz-live/quiz-${QUIZ_PROMPT_VERSIONS.MATH}-${QUIZ_SCHEMA_VERSION}-${model}.json`,
  );
  if (process.env.M9_3_LIVE_FORCE !== "1") {
    const cached = await readFile(outputPath, "utf8").catch(() => null);
    if (cached) {
      process.stdout.write(`CACHE_HIT ${outputPath}\n`);
      return;
    }
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  });
  const prisma = app.get(PrismaService);
  const packets = app.get(LessonSourcePacketService);
  const routing = app.get(AiModelRoutingService);
  const providerCalls = app.get(AiProviderCallService);
  let packetObjectKey: string | null = null;

  try {
    const lesson = await prisma.lesson.findFirstOrThrow({
      where: { id: lessonId, deletedAt: null },
      select: { title: true },
    });
    const documents = await prisma.lessonDocument.findMany({
      where: {
        lessonId,
        status: DocumentStatus.READY,
        replacedAt: null,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    const documentIds = documents.map((document) => document.id);
    const packet = await packets.build(lessonId, documentIds);
    packetObjectKey = packet.objectKey;

    const candidate = await routing.resolveCandidateByModel(model);
    if (!candidate?.available) {
      throw new Error(`Model ${model} is not available with an active credential.`);
    }

    const configuration = {
      requestDraftId: "00000000-0000-4000-8000-000000000001",
      requestHash: "0".repeat(64),
      packetHash: "0".repeat(64),
      manifestHash: "0".repeat(64),
      documentIds,
      sourceHash: packet.sourceHash,
      targetGrade: 9,
      subjectKey: "MATH",
      subjectName: "Toán",
      subjectSlug: "toan",
      targetQuizSetId: null,
      questionCount: 1,
      difficulty: Difficulty.MEDIUM,
      difficultyCounts: null,
      questionTypes: [QuestionType.TEXT_INPUT],
      style: "student_friendly",
      styleInstructions: "",
      extraInstructions: "",
      systemInstructions: "",
      userPrompt: "",
      model,
      temperature: 0.1,
      reasoningEffort,
      schemaReferenceStrategy: "ref_v2",
      promptCacheKeyEnabled: true,
      promptCacheRetention: "in_memory",
      maxOutputTokens: 2_000,
    } satisfies QuizGenerationJobInput;
    const structuredInput = buildQuizStructuredInput({
      lessonId,
      lessonTitle: lesson.title,
      documentIds,
      sourceHash: packet.sourceHash,
      packet: {
        filename: packet.filename,
        bytes: packet.bytes,
      },
      configuration,
    });
    const providerSchema = getGeneratedQuizOutputSchema({
      subjectKey: "MATH",
      targetGrade: 9,
      questionCount: 1,
      questionTypes: [QuestionType.TEXT_INPUT],
      difficulty: Difficulty.MEDIUM,
      includeSourceCoverageAudit: true,
    });
    const routeSnapshot = {
      feature: AiGenerationType.QUIZ,
      version: 1,
      model,
      temperature: 0.1,
      reasoningEffort,
      maxOutputTokens: structuredInput.maxTokens,
      candidates: [candidate],
      hasConfiguration: true,
    } as const;
    const preview = await providerCalls.previewStructuredRequest(
      {
        feature: AiGenerationType.QUIZ,
        routeSnapshot,
      },
      structuredInput,
      providerSchema,
    );
    const upperBoundVnd = preview.estimatedCost.upperBoundVnd;
    if (upperBoundVnd === null || upperBoundVnd > maxBudgetVnd) {
      throw new Error(
        `Quiz Phase 1 estimated upper bound ${String(upperBoundVnd)} VND exceeds live budget ${maxBudgetVnd} VND.`,
      );
    }
    process.stdout.write(
      `LIVE_QUIZ_PHASE_ONE_BUDGET estimated_upper_bound_vnd=${upperBoundVnd} budget_vnd=${maxBudgetVnd}\n`,
    );

    const result = await providerCalls.generateStructured(
      {
        feature: AiGenerationType.QUIZ,
        attempt: 1,
        callSequence: 1,
        idempotencyKey: `m9.3-live-stage-one:${lessonId}:${QUIZ_PROMPT_VERSIONS.MATH}:${QUIZ_SCHEMA_VERSION}:${model}`,
        routeSnapshot,
      },
      structuredInput,
      providerSchema,
    );
    const normalizedQuestions = result.data.questions.map(
      normalizeGeneratedQuizQuestionContent,
    );
    const validation = validateQuizOutput({
      questions: normalizedQuestions,
      sourceCoverageAudit: result.data.sourceCoverageAudit,
      requestedCount: 1,
      requestedTypes: [QuestionType.TEXT_INPUT],
      requestedDifficulty: Difficulty.MEDIUM,
      difficultyCounts: null,
    });
    const estimatedUsageCostVnd = estimateLunaCostVnd(result.usage);

    await mkdir(resolve(outputPath, ".."), { recursive: true });
    await writeFile(
      outputPath,
      `${JSON.stringify(
        {
          lessonId,
          lessonTitle: lesson.title,
          model,
          reasoningEffort,
          promptVersion: QUIZ_PROMPT_VERSIONS.MATH,
          schemaVersion: QUIZ_SCHEMA_VERSION,
          usage: result.usage ?? null,
          providerRequestId: result.providerRequestId ?? null,
          latencyMs: result.latencyMs,
          estimatedUpperBoundVnd: upperBoundVnd,
          estimatedUsageCostVnd,
          budgetVnd: maxBudgetVnd,
          providerOutput: result.data,
          normalizedQuestions: validation.questions,
          validationMetadata: validation.metadata,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    process.stdout.write(
      `LIVE_QUIZ_SUCCESS estimated_usage_cost_vnd=${estimatedUsageCostVnd} ${outputPath}\n`,
    );
  } finally {
    if (packetObjectKey) {
      await packets.cleanup(packetObjectKey).catch(() => undefined);
    }
    await app.close();
  }
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function readPositiveNumberEnv(name: string, fallback: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }
  return value;
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
  const costUsd =
    (uncachedInputTokens / 1_000_000) * 0.2 +
    (cachedInputTokens / 1_000_000) * 0.02 +
    (cacheWriteInputTokens / 1_000_000) * 0.25 +
    ((usage.completionTokens ?? 0) / 1_000_000) * 1.2;
  return Math.round(costUsd * 27_200);
}

void main();
