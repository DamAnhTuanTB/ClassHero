import { AiGenerationType, Difficulty, QuestionType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { AiGenerationExecutionContext } from "#api/modules/ai/types/ai-generation.types";
import { QuizGenerationJobService } from "#api/modules/quiz/services/quiz-generation-job.service";
import type { QuizGenerationJobInput } from "#api/modules/quiz/types/quiz-generation.types";
import { buildQuizProviderContract } from "#api/modules/quiz/utils/quiz-generation-prompt";
import { QuizGenerationService } from "#api/workers/services/quiz-generation.service";

const lessonId = "00000000-0000-4000-8000-000000000001";
const actorUserId = "00000000-0000-4000-8000-000000000002";
const requestDraftId = "00000000-0000-4000-8000-000000000003";
const quizSetId = "00000000-0000-4000-8000-000000000004";
const aiGenerationId = "00000000-0000-4000-8000-000000000005";
const backgroundJobId = "00000000-0000-4000-8000-000000000006";
const requestHash = "a".repeat(64);
const packetHash = "b".repeat(64);
const manifestHash = "c".repeat(64);
const sourceHash = "d".repeat(64);
const documentId = "00000000-0000-4000-8000-000000000007";

const generationConfiguration = {
  targetQuizSetId: quizSetId,
  questionCount: 1,
  difficulty: Difficulty.EASY,
  difficultyCounts: null,
  questionTypes: [QuestionType.MULTIPLE_CHOICE],
  style: "student_friendly" as const,
  styleInstructions: "",
  extraInstructions: "",
  systemInstructions: "",
  userPrompt: "",
  maxOutputTokens: 12_000,
  schemaReferenceStrategy: "ref_v2" as const,
  promptCacheKeyEnabled: false,
  promptCacheRetention: "in_memory" as const,
};

function currentContract() {
  return buildQuizProviderContract({
    subjectKey: "MATH",
    targetGrade: 7,
    questionCount: generationConfiguration.questionCount,
    questionTypes: generationConfiguration.questionTypes,
    difficulty: generationConfiguration.difficulty,
    schemaReferenceStrategy: generationConfiguration.schemaReferenceStrategy,
  });
}

function staleDraft() {
  const contract = currentContract();
  return {
    id: requestDraftId,
    lessonId,
    createdById: actorUserId,
    requestHash,
    packetHash,
    manifestHash,
    packetObjectKey: "ai/quiz/request.pdf",
    packetFilename: "lesson.pdf",
    packetSizeBytes: 10n,
    packetPageCount: 1,
    systemInstructions: "OLD QUIZ PROMPT",
    userPrompt: "Tạo một câu Quiz.",
    schemaName: contract.schemaName,
    schemaVersion: contract.schemaVersion,
    schemaHash: contract.schemaHash,
    schemaJson: contract.schemaJson,
    manifestJson: { version: 1, pages: [] },
    sourceSnapshotJson: {
      documentIds: [documentId],
      sourceHash,
      lessonTitle: "Phân số",
      targetGrade: 7,
      subjectKey: "MATH",
      subjectName: "Toán",
      subjectSlug: "toan",
      targetQuizSetId: quizSetId,
      generationConfiguration,
    },
    modelConfigJson: {
      promptVersion: "quiz-math-v89-stale",
      routeSnapshot: {},
      imageRouteSnapshot: {},
    },
    expiresAt: new Date(Date.now() + 60_000),
    consumedAt: null,
  };
}

function currentJobInput(): QuizGenerationJobInput {
  const contract = currentContract();
  return {
    assessmentKind: "QUIZ",
    pipelineVersion: "ASSESSMENT_QUIZ_V1",
    requestDraftId,
    requestHash,
    packetHash,
    manifestHash,
    documentIds: [documentId],
    sourceHash,
    targetGrade: 7,
    subjectKey: "MATH",
    subjectName: "Toán",
    subjectSlug: "toan",
    targetQuizSetId: quizSetId,
    difficultyCounts: null,
    ...generationConfiguration,
    promptVersion: "quiz-math-v89-stale",
    schemaName: contract.schemaName,
    schemaVersion: contract.schemaVersion,
    schemaHash: contract.schemaHash,
  };
}

describe("Quiz generation provider contract integrity", () => {
  it("rejects a stale prompt preview before enqueue even when the schema is current", async () => {
    const draft = staleDraft();
    const createAndEnqueue = vi.fn();
    const prisma = {
      quizGenerationRequestDraft: {
        findFirst: vi.fn().mockResolvedValue(draft),
        update: vi.fn(),
      },
    };
    const config = {
      get: vi.fn((key: string) => {
        if (key === "AI_QUIZ_SCHEMA_REFERENCE_STRATEGY") return "ref_v2";
        if (key === "AI_QUIZ_PROMPT_CACHE_KEY_ENABLED") return false;
        if (key === "AI_QUIZ_PROMPT_CACHE_RETENTION") return "in_memory";
        return undefined;
      }),
    };
    const service = new QuizGenerationJobService(
      { createAndEnqueue } as never,
      {} as never,
      {} as never,
      prisma as never,
      config as never,
    );
    const internals = service as unknown as {
      loadCurrentSourceHash: () => Promise<string>;
      resolveAssessmentTargetSet: () => Promise<{ id: string }>;
    };
    internals.loadCurrentSourceHash = vi.fn().mockResolvedValue(sourceHash);
    internals.resolveAssessmentTargetSet = vi.fn().mockResolvedValue({ id: quizSetId });

    await expect(
      service.queueQuiz(lessonId, actorUserId, {
        requestDraftId,
        requestHash,
        targetQuizSetId: quizSetId,
        questionCount: 1,
        difficulty: Difficulty.EASY,
        questionTypes: [QuestionType.MULTIPLE_CHOICE],
      }),
    ).rejects.toMatchObject({ response: { code: "AI_INPUT_CONTRACT_STALE" } });
    expect(createAndEnqueue).not.toHaveBeenCalled();
  });

  it("blocks a stale prompt job at the worker before any provider or packet call", async () => {
    const draft = staleDraft();
    const provider = { generateStructured: vi.fn() };
    const aiService = { generateStructured: vi.fn() };
    const generationContext = {
      computeCurrentSourceHash: vi.fn(),
      downloadPacket: vi.fn(),
    };
    const prisma = {
      quizGenerationRequestDraft: { findFirst: vi.fn().mockResolvedValue(draft) },
      aiGeneration: {
        findFirst: vi.fn().mockResolvedValue({
          promptVersion: "quiz-math-v89-stale",
          schemaVersion: currentContract().schemaVersion,
        }),
      },
    };
    const service = new QuizGenerationService(
      prisma as never,
      aiService as never,
      generationContext as never,
      {} as never,
      {} as never,
      provider as never,
    );
    const context: AiGenerationExecutionContext = {
      backgroundJobId,
      aiGenerationId,
      type: AiGenerationType.QUIZ,
      ownerUserId: actorUserId,
      lessonId,
      targetType: "QUIZ_SET",
      targetId: quizSetId,
      inputMeta: currentJobInput(),
      attempt: 1,
      maxAttempts: 1,
    };

    await expect(service.generate(context)).rejects.toThrow("AI_INPUT_CONTRACT_STALE");
    expect(provider.generateStructured).not.toHaveBeenCalled();
    expect(aiService.generateStructured).not.toHaveBeenCalled();
    expect(generationContext.computeCurrentSourceHash).not.toHaveBeenCalled();
    expect(generationContext.downloadPacket).not.toHaveBeenCalled();
  });
});
