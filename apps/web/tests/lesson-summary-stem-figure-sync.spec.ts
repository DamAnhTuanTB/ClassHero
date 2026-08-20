import { expect, test } from "@playwright/test";

import type {
  AdminLessonSummaryContent,
  AdminStemFigure,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import {
  canReconcileStemFigureSnapshot,
  syncStemFigureReferencesInContent,
} from "@/features/admin/ai-generation/utils/lesson-summary-stem-figure-sync";

const oldFigureId = "00000000-0000-4000-8000-000000000001";
const newFigureId = "00000000-0000-4000-8000-000000000002";
const oldGenerationId = "00000000-0000-4000-8000-000000000003";
const newGenerationId = "00000000-0000-4000-8000-000000000004";

test("không reconcile cache figure đang refetch hoặc thuộc lượt sinh cũ", () => {
  const staleFigure = createFigure({
    id: oldFigureId,
    aiGenerationId: oldGenerationId,
  });

  expect(
    canReconcileStemFigureSnapshot({
      figures: [staleFigure],
      isFetching: true,
      isSuccess: true,
      summaryAiGenerationId: newGenerationId,
    }),
  ).toBe(false);
  expect(
    canReconcileStemFigureSnapshot({
      figures: [staleFigure],
      isFetching: false,
      isSuccess: true,
      summaryAiGenerationId: newGenerationId,
    }),
  ).toBe(false);
});

test("loại figure cũ, giữ figure mới và đồng bộ trạng thái hoàn tất", () => {
  const content = createContent([
    createReference(oldFigureId, "SUCCEEDED"),
    createReference(newFigureId, "QUEUED"),
  ]);
  const result = syncStemFigureReferencesInContent(content, [
    createFigure({
      id: newFigureId,
      aiGenerationId: newGenerationId,
      status: "SUCCEEDED",
    }),
  ]);

  expect(readFirstBlockFigures(result)).toEqual([
    expect.objectContaining({ figureId: newFigureId, status: "SUCCEEDED" }),
  ]);
  expect(readFirstBlockFigures(content)).toHaveLength(2);
});

test("không gộp hai figure hợp lệ khác nhau chỉ vì nội dung gần giống nhau", () => {
  const first = createFigure({ id: oldFigureId, figureIndex: 0 });
  const second = createFigure({ id: newFigureId, figureIndex: 1 });
  const result = syncStemFigureReferencesInContent(createContent([]), [first, second]);

  expect(readFirstBlockFigures(result).map((figure) => figure.figureId)).toEqual([
    oldFigureId,
    newFigureId,
  ]);
});

function createFigure(
  overrides: Partial<
    Pick<AdminStemFigure, "id" | "aiGenerationId" | "figureIndex" | "status">
  > = {},
) {
  return {
    id: newFigureId,
    aiGenerationId: newGenerationId,
    blockPath: "sections.0.blocks.0",
    figureIndex: 0,
    planJson: {
      figurePlanContractVersion: 3,
      localId: "F001",
      figureOrigin: "TEXTBOOK_SOURCE",
      sourceReferences: [],
    },
    figureOrigin: "TEXTBOOK_SOURCE" as const,
    status: "QUEUED" as const,
    altText: "Vectơ song song với đường thẳng.",
    caption: "Vectơ chỉ phương.",
    ...overrides,
  };
}

function createReference(figureId: string, status: "QUEUED" | "SUCCEEDED") {
  return {
    kind: "TEX_FIGURE" as const,
    figureId,
    figureOrigin: "TEXTBOOK_SOURCE" as const,
    altText: "Vectơ song song với đường thẳng.",
    caption: "Vectơ chỉ phương.",
    status,
  };
}

function createContent(figures: ReturnType<typeof createReference>[]) {
  return {
    type: "lesson_summary_blocks",
    version: 3,
    data: {
      lessonId: "00000000-0000-4000-8000-000000000005",
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
              figures,
            },
          ],
        },
      ],
    },
  } as AdminLessonSummaryContent;
}

function readFirstBlockFigures(content: AdminLessonSummaryContent) {
  if (content.type !== "lesson_summary_blocks") return [];
  const data = content.data as {
    sections: Array<{
      blocks: Array<{ figures: Array<{ figureId: string; status: string }> }>;
    }>;
  };
  return data.sections[0]?.blocks[0]?.figures ?? [];
}
