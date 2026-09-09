import { describe, expect, it, vi } from "vitest";

import { FlashcardFigureRequestService } from "#api/modules/flashcards/services/flashcard-figure-request.service";
import { FlashcardFiguresService } from "#api/modules/flashcards/services/flashcard-figures.service";
import type { FlashcardFigureContext } from "#api/modules/flashcards/types/flashcard-figure-generation.types";
import { readFlashcardGenerationReference } from "#api/modules/flashcards/utils/flashcard-generation-reference";

const context: FlashcardFigureContext = {
  flashcardId: "flashcard-id",
  front: "Câu hỏi",
  solution: "Lời giải",
  sourcePacketPageNumbers: [1],
  targetGrade: 8,
  subject: { key: "MATH", name: "Toán", slug: "toan" },
};

describe("M9.29 Flashcard figure usage attribution", () => {
  it("reads the parent generation from AI card metadata", () => {
    expect(readFlashcardGenerationReference({ aiGenerationId: "generation-id" })).toBe(
      "generation-id",
    );
    expect(readFlashcardGenerationReference({ aiGenerationId: "" })).toBeNull();
    expect(readFlashcardGenerationReference(null)).toBeNull();
  });

  it("carries the parent generation through the prepared figure request", async () => {
    const prisma = {
      flashcard: {
        findFirst: vi.fn().mockResolvedValue({
          id: "flashcard-id",
          frontJson: tiptapText("Câu hỏi"),
          solutionJson: tiptapText("Lời giải"),
          sourceMetadataJson: { aiGenerationId: "generation-id" },
          lesson: {
            learningPath: {
              domain: { name: "Toán", slug: "toan" },
              targetAudiences: [{ targetAudience: { grade: 8 } }],
            },
          },
          figures: [],
        }),
      },
    };
    const service = new FlashcardFigureRequestService(
      prisma as never,
      {} as never,
      {} as never,
    );

    const prepared = await service.prepare("flashcard-id", { mode: "REGENERATE" }, {
      model: "gpt-test",
      candidates: [],
      hasConfiguration: true,
    } as never);

    expect(prepared.aiGenerationId).toBe("generation-id");
  });

  it("attaches a manually requested figure to the AI card generation", async () => {
    const prisma = {
      flashcardFigure: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "figure-id" }),
      },
      flashcard: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ lessonId: "lesson-id" }),
      },
      flashcardFigureRevision: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "revision-id" }),
      },
    };
    const requests = {
      prepare: vi.fn().mockResolvedValue({
        aiGenerationId: "generation-id",
        context,
        routeSnapshot: { model: "gpt-test" },
      }),
    };
    const jobs = {
      enqueue: vi.fn().mockResolvedValue({ id: "job-id", status: "QUEUED" }),
    };
    const service = new FlashcardFiguresService(
      prisma as never,
      requests as never,
      jobs as never,
      {} as never,
    );

    await service.createWithAi("flashcard-id", "actor-id", { mode: "REGENERATE" });

    expect(prisma.flashcardFigure.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ aiGenerationId: "generation-id" }),
      }),
    );
    expect(jobs.enqueue).toHaveBeenCalledOnce();
  });
});

function tiptapText(text: string) {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}
