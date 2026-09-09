import { describe, expect, it, vi } from "vitest";

import {
  serializeAdminFlashcardAccessUrls,
  serializeStudentFlashcardSet,
} from "#api/modules/flashcards/serializers/flashcard.serializers";

const signedUrl = "http://localhost:9000/learning-path/signed-flashcard-figure.svg";

const files = {
  resolveAccessUrl: vi.fn().mockResolvedValue(signedUrl),
};

const figure = {
  id: "figure-id",
  role: "SOLUTION",
  status: "SUCCEEDED",
  lastErrorCode: null,
  lastErrorMessage: null,
  currentRevision: {
    id: "revision-id",
    sourceKind: "AI_TEX",
    latexSource: "\\begin{tikzpicture}\\end{tikzpicture}",
    altText: "Hình lời giải Flashcard",
    caption: null,
    deliveryFile: {
      id: "file-id",
      mimeType: "image/svg+xml",
      objectKey: "uploads/development/ai_diagram/figure.svg",
      publicUrl: null,
      visibility: "PUBLIC",
    },
  },
};

describe("M9.29 Flashcard figure access URL", () => {
  it("returns a signed URL when a completed admin figure has no public base URL", async () => {
    const card = await serializeAdminFlashcardAccessUrls(
      { id: "card-id", figures: [figure] } as never,
      files,
    );

    expect(card.figures[0]?.currentRevision?.deliveryFile).toEqual({
      id: "file-id",
      mimeType: "image/svg+xml",
      publicUrl: signedUrl,
    });
    expect(files.resolveAccessUrl).toHaveBeenCalledWith(
      expect.objectContaining({ publicUrl: null, visibility: "PUBLIC" }),
    );
  });

  it("returns the same fallback URL to an enrolled student's Flashcard response", async () => {
    const set = await serializeStudentFlashcardSet(
      {
        id: "set-id",
        flashcards: [{ id: "card-id", figures: [figure] }],
      } as never,
      new Map(),
      new Set(),
      files,
    );

    expect(set.flashcards[0]?.solutionFigure).toEqual({
      role: "SOLUTION",
      altText: "Hình lời giải Flashcard",
      caption: null,
      fileId: "file-id",
      mimeType: "image/svg+xml",
      url: signedUrl,
    });
  });
});
