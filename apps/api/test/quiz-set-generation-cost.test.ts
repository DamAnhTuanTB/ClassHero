import { AiGenerationStatus, AiGenerationType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { QuizService } from "#api/modules/quiz/services/quiz.service";

describe("QuizService generation cost summary", () => {
  it("returns every generation status with server-side usage aggregates", async () => {
    const createdAt = new Date("2026-08-25T01:00:00.000Z");
    const quizSet = {
      id: "quiz-set-1",
      lessonId: "lesson-1",
      title: "Bộ câu hỏi 1",
      source: "ADMIN",
      reviewStatus: "DRAFT",
      questionCount: 0,
      sortOrder: 0,
      aiGeneration: null,
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
      _count: { questions: 0 },
    };
    const prisma = {
      quizSet: { findMany: vi.fn(async () => [quizSet]) },
      quizQuestion: {
        groupBy: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
      },
      aiGeneration: {
        findMany: vi.fn(async () => [
          {
            id: "generation-succeeded",
            targetId: quizSet.id,
            status: AiGenerationStatus.SUCCEEDED,
            model: "gpt-5.6-luna",
            inputMetaJson: null,
            startedAt: createdAt,
            finishedAt: createdAt,
            createdAt,
          },
          {
            id: "generation-failed",
            targetId: quizSet.id,
            status: AiGenerationStatus.FAILED,
            model: "gpt-5.6-luna",
            inputMetaJson: null,
            startedAt: createdAt,
            finishedAt: createdAt,
            createdAt,
          },
        ]),
      },
      providerUsageEvent: {
        groupBy: vi.fn(async () => [
          {
            aiGenerationId: "generation-succeeded",
            _count: { _all: 3 },
            _sum: { costVnd: 1_250 },
          },
          {
            aiGenerationId: "generation-failed",
            _count: { _all: 1 },
            _sum: { costVnd: 90 },
          },
        ]),
      },
    };
    const service = new QuizService(prisma as never);

    const result = await service.listQuizSetsByLesson("lesson-1");

    expect(prisma.aiGeneration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: AiGenerationType.QUIZ,
          targetId: { in: [quizSet.id] },
        }),
      }),
    );
    expect(prisma.providerUsageEvent.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ["aiGenerationId"],
        _sum: { costVnd: true },
      }),
    );
    expect(result[0]?.aiGenerations).toEqual([
      expect.objectContaining({
        id: "generation-succeeded",
        status: AiGenerationStatus.SUCCEEDED,
        totalCostVnd: 1_250,
        usageEventCount: 3,
      }),
      expect.objectContaining({
        id: "generation-failed",
        status: AiGenerationStatus.FAILED,
        totalCostVnd: 90,
        usageEventCount: 1,
      }),
    ]);
  });
});
