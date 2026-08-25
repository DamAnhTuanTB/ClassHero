import { Difficulty, QuestionType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { lessonSummaryJobInputSchema } from "#api/modules/ai/types/lesson-summary.types";
import { quizGenerationJobInputSchema } from "#api/modules/quiz/types/quiz-generation.types";

const documentId = "00000000-0000-4000-8000-000000000001";
const requestDraftId = "00000000-0000-4000-8000-000000000099";
const imageRouteSnapshot = {
  feature: "QUIZ",
  purpose: "IMAGE",
  version: 1,
  model: "gpt-5.6-luna",
  temperature: null,
  reasoningEffort: null,
  maxOutputTokens: 16_000,
  candidates: [],
  hasConfiguration: true,
};

const commonSnapshot = {
  requestDraftId,
  requestHash: "b".repeat(64),
  packetHash: "c".repeat(64),
  manifestHash: "d".repeat(64),
  documentIds: [documentId],
  sourceHash: "a".repeat(64),
  targetGrade: 9,
  subjectKey: "MATH" as const,
  subjectName: "Toán",
  subjectSlug: "toan",
};

describe("M9.20 phase-specific route snapshots in AI job input", () => {
  it("accepts the image route snapshot in a Quiz generation job", () => {
    const parsed = quizGenerationJobInputSchema.safeParse({
      ...commonSnapshot,
      targetQuizSetId: null,
      questionCount: 1,
      difficulty: Difficulty.EASY,
      difficultyCounts: null,
      questionTypes: [QuestionType.TRUE_FALSE],
      style: "student_friendly",
      imageRouteSnapshot,
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.imageRouteSnapshot).toEqual(imageRouteSnapshot);
    }
  });

  it("accepts the image route snapshot in a lesson Summary generation job", () => {
    const parsed = lessonSummaryJobInputSchema.safeParse({
      ...commonSnapshot,
      style: "student_friendly",
      imageRouteSnapshot: { ...imageRouteSnapshot, feature: "SUMMARY" },
    });

    expect(parsed.success).toBe(true);
  });

  it("still rejects malformed route snapshots and unrelated input keys", () => {
    const quizInput = {
      ...commonSnapshot,
      targetQuizSetId: null,
      questionCount: 1,
      difficulty: Difficulty.EASY,
      difficultyCounts: null,
      questionTypes: [QuestionType.TRUE_FALSE],
      style: "student_friendly",
    };

    expect(
      quizGenerationJobInputSchema.safeParse({
        ...quizInput,
        imageRouteSnapshot: "invalid",
      }).success,
    ).toBe(false);
    expect(
      quizGenerationJobInputSchema.safeParse({
        ...quizInput,
        unrelatedRouteSnapshot: imageRouteSnapshot,
      }).success,
    ).toBe(false);
  });
});
