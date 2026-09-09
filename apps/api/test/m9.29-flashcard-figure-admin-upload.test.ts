import { describe, expect, it, vi } from "vitest";

import { FlashcardFigureArtifactService } from "#api/modules/flashcards/services/flashcard-figure-artifact.service";

describe("Flashcard solution figure admin upload", () => {
  it("promotes a freshly uploaded question image before attaching it", async () => {
    const figureId = "11111111-1111-4111-8111-111111111111";
    const fileId = "22222222-2222-4222-8222-222222222222";
    const transaction = {
      flashcardFigure: {
        findFirstOrThrow: vi.fn().mockResolvedValue({ id: figureId }),
        update: vi.fn().mockResolvedValue({}),
      },
      file: {
        findFirst: vi.fn().mockResolvedValue({ id: fileId, status: "UPLOADED" }),
        update: vi.fn().mockResolvedValue({}),
      },
      flashcardFigureRevision: {
        findFirst: vi.fn().mockResolvedValue({ sourceVersion: 1 }),
        create: vi.fn().mockResolvedValue({ id: "revision-id" }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    const service = new FlashcardFigureArtifactService(
      prisma as never,
      {} as never,
      {} as never,
    );

    await service.attachAdminUpload({
      figureId,
      fileId,
      actorUserId: "33333333-3333-4333-8333-333333333333",
      altText: "Hình minh họa lời giải Flashcard",
    });

    expect(transaction.file.findFirst).toHaveBeenCalledWith({
      where: {
        id: fileId,
        purpose: "QUESTION_IMAGE",
        status: { in: ["UPLOADED", "READY"] },
        mimeType: { startsWith: "image/" },
        deletedAt: null,
      },
      select: { id: true, status: true },
    });
    expect(transaction.file.update).toHaveBeenCalledWith({
      where: { id: fileId },
      data: { status: "READY" },
    });
    expect(transaction.flashcardFigureRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceKind: "ADMIN_UPLOAD",
          deliveryFileId: fileId,
        }),
      }),
    );
  });
});
