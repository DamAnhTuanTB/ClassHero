import { AiGenerationType, QuestionType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { AiGenerationExecutionContext } from "#api/modules/ai/types/ai-generation.types";
import type { QuizSolutionRefinementJobInput } from "#api/modules/quiz/types/quiz-solution-refinement.types";
import {
  QuizGenerationService,
  resolveSolutionRefinementTarget,
} from "#api/workers/services/quiz-generation.service";

const questionId = "11111111-1111-4111-8111-111111111111";

describe("M6.6 Test solution refinement worker target", () => {
  it("routes a versioned Test job to the Test target and Test accounting", () => {
    const target = resolveSolutionRefinementTarget(testContext(), testInput());

    expect(target).toMatchObject({
      kind: "TEST",
      refinementTargetType: "TEST_SOLUTION_REFINEMENT",
      refinementOperation: "TEST_SOLUTION_REFINEMENT",
    });
  });

  it("rejects a Test metadata target that does not match its background job", () => {
    expect(() =>
      resolveSolutionRefinementTarget(
        { ...testContext(), targetId: "22222222-2222-4222-8222-222222222222" },
        testInput(),
      ),
    ).toThrow("TEST_SOLUTION_REFINEMENT_TARGET_INVALID");
  });

  it("checks the TestQuestion snapshot before a Test provider call", async () => {
    const testQuestionFindFirst = vi.fn().mockResolvedValue({
      questionType: QuestionType.MULTIPLE_CHOICE,
      questionJson: { type: "doc", content: [{ type: "paragraph" }] },
      optionsJson: [],
      correctAnswerJson: ["A"],
      hintJson: null,
      sourceMetadataJson: null,
      sortOrder: 3,
      explanation: null,
      figures: [],
    });
    const worker = Object.create(
      QuizGenerationService.prototype,
    ) as QuizGenerationService;
    (worker as unknown as { prisma: unknown }).prisma = {
      testQuestion: { findFirst: testQuestionFindFirst },
      quizQuestion: { findFirst: vi.fn() },
    };

    const assertSnapshot = worker as unknown as {
      assertSolutionSnapshotCurrent: (
        input: QuizSolutionRefinementJobInput,
        target: ReturnType<typeof resolveSolutionRefinementTarget>,
      ) => Promise<unknown>;
    };
    await expect(
      assertSnapshot.assertSolutionSnapshotCurrent(
        testInput(),
        resolveSolutionRefinementTarget(testContext(), testInput()),
      ),
    ).rejects.toThrow("TEST_SOLUTION_REFINEMENT_CONFLICT");
    expect(testQuestionFindFirst).toHaveBeenCalledOnce();
  });
});

function testContext(): AiGenerationExecutionContext {
  return {
    backgroundJobId: "33333333-3333-4333-8333-333333333333",
    aiGenerationId: "44444444-4444-4444-8444-444444444444",
    type: AiGenerationType.TEST,
    ownerUserId: "55555555-5555-4555-8555-555555555555",
    lessonId: "66666666-6666-4666-8666-666666666666",
    targetType: "TEST_SOLUTION_REFINEMENT",
    targetId: questionId,
    inputMeta: { assessmentKind: "TEST", pipelineVersion: "ASSESSMENT_QUIZ_V1" },
    attempt: 1,
    maxAttempts: 1,
  };
}

function testInput(): QuizSolutionRefinementJobInput {
  return {
    operation: "TEST_SOLUTION_REFINEMENT",
    assessmentKind: "TEST",
    targetQuestionId: questionId,
    mode: "REFINE",
    includeCurrentSolutionAsRejected: false,
    questionId,
    baseContentHash: "a".repeat(64),
    requestHash: "b".repeat(64),
    subjectKey: "MATH",
    subjectName: "Toán",
    subjectSlug: "toan",
    targetGrade: 8,
    adminInstructions: null,
    questionFigure: null,
    questionSnapshot: {
      questionType: QuestionType.MULTIPLE_CHOICE,
      problem: "Đề bài.",
      options: [{ id: "A", text: "A" }],
      correctAnswer: ["A"],
      currentHint: null,
      currentSolution: "Lời giải cũ.",
    },
  };
}
