import { ProviderUsageStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { QuizService } from "#api/modules/quiz/services/quiz.service";

describe("QuizService figure generation costs", () => {
  it("returns the deduplicated OpenAI cost for the current delivery asset", async () => {
    const currentDeliveryFileId = "33333333-3333-4333-8333-333333333333";
    const oldDeliveryFileId = "44444444-4444-4444-8444-444444444444";
    const figureId = "22222222-2222-4222-8222-222222222222";
    const usageEvent = { id: "usage-current", costVnd: 125 };
    const prisma = {
      quizQuestion: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "question-1",
            sourceMetadataJson: null,
            figures: [
              {
                id: figureId,
                currentRevision: {
                  deliveryFile: { id: currentDeliveryFileId },
                },
              },
            ],
          },
        ]),
      },
      quizFigureRenderAttempt: {
        findMany: vi.fn().mockResolvedValue([
          {
            quizFigureId: figureId,
            revision: { deliveryFileId: currentDeliveryFileId },
            backgroundJob: { providerUsageEvents: [usageEvent] },
          },
          {
            quizFigureId: figureId,
            revision: { deliveryFileId: currentDeliveryFileId },
            backgroundJob: { providerUsageEvents: [usageEvent] },
          },
          {
            quizFigureId: figureId,
            revision: { deliveryFileId: oldDeliveryFileId },
            backgroundJob: {
              providerUsageEvents: [{ id: "usage-old", costVnd: 900 }],
            },
          },
        ]),
      },
    };
    const service = new QuizService(prisma as never);

    const result = await service.listQuestionsBySet("quiz-set-1");

    expect(prisma.quizFigureRenderAttempt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          backgroundJob: {
            select: {
              providerUsageEvents: {
                where: {
                  provider: "OPENAI",
                  status: ProviderUsageStatus.SUCCEEDED,
                },
                select: { id: true, costVnd: true },
              },
            },
          },
        }),
      }),
    );
    expect(result[0]?.figures[0]).toMatchObject({
      id: figureId,
      openAiGenerationCostVnd: 125,
    });
  });

  it("returns null when the current asset has no successful OpenAI usage", async () => {
    const prisma = {
      quizQuestion: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "question-1",
            sourceMetadataJson: null,
            figures: [
              {
                id: "figure-1",
                currentRevision: { deliveryFile: { id: "delivery-1" } },
              },
            ],
          },
        ]),
      },
      quizFigureRenderAttempt: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new QuizService(prisma as never);

    const result = await service.listQuestionsBySet("quiz-set-1");

    expect(result[0]?.figures[0]?.openAiGenerationCostVnd).toBeNull();
  });
});
