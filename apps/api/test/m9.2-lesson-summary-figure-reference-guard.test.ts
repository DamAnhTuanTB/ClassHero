import { BadRequestException } from "@nestjs/common";
import { ContentSource, ReviewStatus, StemFigureRevisionStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  assertLessonSummaryStemFigureReferences,
  LessonSummariesService,
} from "#api/modules/learning-paths/services/lesson-summaries.service";

const currentFigureId = "00000000-0000-4000-8000-000000000001";
const staleFigureId = "00000000-0000-4000-8000-000000000002";

describe("M9.2 lesson Summary figure reference guard", () => {
  it("guards the draft upsert path before stale JSON can be persisted", async () => {
    const summaryUpsert = vi.fn();
    const findFigures = vi.fn(async () => [createFigure(currentFigureId)]);
    const transaction = {
      lesson: { findFirst: vi.fn(async () => ({ id: "lesson-id" })) },
      lessonSummary: {
        findUnique: vi.fn(async () => ({ id: "summary-id" })),
        upsert: summaryUpsert,
      },
      stemFigure: { findMany: findFigures },
    };
    const service = new LessonSummariesService(
      {
        $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) =>
          callback(transaction),
        ),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.upsertForAdmin("lesson-id", "actor-id", {
        contentJson: createSummaryContent([currentFigureId, staleFigureId]),
        source: ContentSource.AI,
        reviewStatus: ReviewStatus.NEEDS_REVIEW,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(findFigures).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          lessonId: "lesson-id",
          lessonSummaryId: "summary-id",
        }),
      }),
    );
    expect(summaryUpsert).not.toHaveBeenCalled();
  });

  it("rejects an orphan figure reference even when saving a draft", () => {
    expect(() =>
      assertLessonSummaryStemFigureReferences({
        referencedFigureIds: [currentFigureId, staleFigureId],
        figures: [createFigure(currentFigureId)],
        requireReadyAsset: false,
      }),
    ).toThrowError(BadRequestException);

    try {
      assertLessonSummaryStemFigureReferences({
        referencedFigureIds: [staleFigureId],
        figures: [],
        requireReadyAsset: false,
      });
    } catch (error) {
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: "LESSON_SUMMARY_STEM_FIGURES_INVALID_REFERENCE",
        details: { figureIds: [staleFigureId] },
      });
    }
  });

  it("allows current unfinished figures in a draft but not in publish", () => {
    const figure = createFigure(currentFigureId);
    expect(() =>
      assertLessonSummaryStemFigureReferences({
        referencedFigureIds: [currentFigureId],
        figures: [figure],
        requireReadyAsset: false,
      }),
    ).not.toThrow();
    expect(() =>
      assertLessonSummaryStemFigureReferences({
        referencedFigureIds: [currentFigureId],
        figures: [figure],
        requireReadyAsset: true,
      }),
    ).toThrowError(BadRequestException);
  });

  it("allows publish when every current figure has a succeeded delivery asset", () => {
    expect(() =>
      assertLessonSummaryStemFigureReferences({
        referencedFigureIds: [currentFigureId],
        figures: [
          {
            id: currentFigureId,
            currentRevision: {
              status: StemFigureRevisionStatus.SUCCEEDED,
              deliveryFileId: "00000000-0000-4000-8000-000000000003",
            },
          },
        ],
        requireReadyAsset: true,
      }),
    ).not.toThrow();
  });
});

function createFigure(id: string) {
  return {
    id,
    currentRevision: {
      status: StemFigureRevisionStatus.QUEUED,
      deliveryFileId: null,
    },
  };
}

function createSummaryContent(figureIds: string[]) {
  return {
    type: "lesson_summary_blocks",
    version: 3,
    data: {
      lessonId: "lesson-id",
      targetGrade: 12,
      title: "Phương trình đường thẳng",
      objectives: null,
      warnings: null,
      warningDetails: null,
      sections: [
        {
          order: 1,
          displayHeading: "Phương trình đường thẳng",
          sourceEvidence: {
            kind: "HEADING",
            text: "Phương trình đường thẳng",
            packetPageNumbers: [1],
          },
          blocks: [
            {
              type: "knowledge",
              title: "Vectơ chỉ phương",
              content: "Một vectơ chỉ phương xác định hướng của đường thẳng.",
              sourcePageNumbers: [1],
              figures: figureIds.map((figureId) => ({
                kind: "TEX_FIGURE",
                figureId,
              })),
            },
          ],
        },
      ],
    },
  };
}
