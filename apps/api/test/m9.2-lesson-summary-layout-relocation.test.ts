import {
  ContentSource,
  ReviewStatus,
  StemFigureRevisionStatus,
  StemFigureStatus,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { getLessonSummaryProviderTransportOutputSchema } from "#api/modules/ai/types/lesson-summary.types";
import { mapLessonSummaryProviderOutput } from "#api/modules/ai/utils/lesson-summary-mapper";
import {
  applyLessonSummaryPhaseOneBlockEdits,
  prepareLessonSummaryPhaseOneLayoutEdits,
} from "#api/modules/ai/utils/lesson-summary-phase-one-editor";
import { LessonSummariesService } from "#api/modules/learning-paths/services/lesson-summaries.service";

const lessonId = "00000000-0000-4000-8000-000000000101";
const summaryId = "00000000-0000-4000-8000-000000000102";
const generationId = "00000000-0000-4000-8000-000000000103";
const activeFigureId = "00000000-0000-4000-8000-000000000104";
const deletedFigureId = "00000000-0000-4000-8000-000000000105";
const revisionId = "00000000-0000-4000-8000-000000000106";

describe("M9.2 lesson Summary layout relocation", () => {
  it("moves raw blocks and their figure paths together", () => {
    const output = createProviderOutput();
    const mapped = mapLessonSummaryProviderOutput({
      lessonId,
      output,
      packetPageCount: 1,
      targetGrade: 12,
      subjectKey: "MATH",
    });
    const prepared = prepareLessonSummaryPhaseOneLayoutEdits(
      {
        type: "lesson_summary_phase_one_blocks",
        version: 2,
        providerOutput: output,
        blocks: mapped.phaseOneBlocks,
        providerPaths: mapped.phaseOneProviderPaths,
        subjectKey: "MATH",
        targetGrade: 12,
        packetPageCount: 1,
      },
      [
        {
          type: "MOVE_BLOCK",
          sectionIndex: 0,
          blockIndex: 1,
          targetSectionIndex: 0,
          targetBlockIndex: 0,
        },
      ],
    );

    expect(prepared.success).toBe(true);
    if (!prepared.success) throw new Error(prepared.message);
    expect(prepared.blockPathChanges.get("sections.0.blocks.0")).toBe(
      "sections.0.blocks.1",
    );
    expect(prepared.blockPathChanges.get("sections.0.blocks.1")).toBe(
      "sections.0.blocks.0",
    );

    const applied = applyLessonSummaryPhaseOneBlockEdits({
      lessonId,
      snapshot: prepared.snapshot,
      blocks: prepared.snapshot.blocks,
    });
    expect(applied.success).toBe(true);
    if (!applied.success) throw new Error(applied.message);
    expect(applied.mapped.content.sections[0]?.blocks[0]?.type).toBe("example");
    expect(applied.mapped.figures[0]?.blockPath).toBe("sections.0.blocks.0");
  });

  it("frees a destination held by a soft-deleted figure before shifting an active figure", async () => {
    const output = createProviderOutput();
    const mapped = mapLessonSummaryProviderOutput({
      lessonId,
      output,
      packetPageCount: 1,
      targetGrade: 12,
      subjectKey: "MATH",
    });
    const activePlan = mapped.figures[0]?.draft;
    if (!activePlan) throw new Error("Expected one active figure fixture.");

    const snapshot = {
      type: "lesson_summary_phase_one_blocks" as const,
      version: 2 as const,
      providerOutput: output,
      blocks: mapped.phaseOneBlocks,
      providerPaths: mapped.phaseOneProviderPaths,
      subjectKey: "MATH" as const,
      targetGrade: 12,
      packetPageCount: 1,
    };
    const now = new Date("2026-08-21T00:00:00.000Z");
    const summary = {
      id: summaryId,
      lessonId,
      contentJson: mapped.content,
      source: ContentSource.AI,
      reviewStatus: ReviewStatus.NEEDS_REVIEW,
      aiGenerationId: generationId,
      createdById: "actor-id",
      updatedById: "actor-id",
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      aiGeneration: { id: generationId, outputJson: snapshot },
      stemFigures: [
        {
          id: activeFigureId,
          blockPath: "sections.0.blocks.1",
          figureIndex: 0,
          localPlanId: activePlan.localId,
          planJson: activePlan,
          status: StemFigureStatus.SUCCEEDED,
          currentRevision: {
            id: revisionId,
            status: StemFigureRevisionStatus.SUCCEEDED,
            deliveryFileId: "00000000-0000-4000-8000-000000000107",
            altText: activePlan.altText,
            caption: null,
          },
          pendingRevision: null,
        },
      ],
    };
    const figureFindMany = vi.fn(async () => [
      {
        id: deletedFigureId,
        blockPath: "sections.0.blocks.0",
        figureIndex: 0,
      },
    ]);
    const figureUpdate = vi.fn(async () => ({}));
    const updatedSummary = {
      ...summary,
      aiGeneration: undefined,
      stemFigures: undefined,
    };
    const transaction = {
      lessonSummary: {
        findFirst: vi.fn(async () => summary),
        update: vi.fn(async () => updatedSummary),
      },
      stemFigure: {
        findMany: figureFindMany,
        update: figureUpdate,
        updateMany: vi.fn(async () => ({ count: 0 })),
      },
      stemFigureRevision: { update: vi.fn(async () => ({})) },
      aiGeneration: { update: vi.fn(async () => ({})) },
      auditLog: { create: vi.fn(async () => ({})) },
    };
    const prisma = {
      $transaction: vi.fn(
        async (callback: (client: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    };
    const service = new LessonSummariesService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    vi.spyOn(service, "getForAdmin").mockResolvedValue({ id: summaryId } as never);

    await service.updatePhaseOneBlocksForAdmin(lessonId, "actor-id", {
      phaseOneBlockJsonByPath: {
        "sections.0.blocks.0": mapped.phaseOneBlocks["sections.0.blocks.1"],
        "sections.1.blocks.0": mapped.phaseOneBlocks["sections.1.blocks.0"],
        "sections.1.blocks.1": mapped.phaseOneBlocks["sections.1.blocks.1"],
      },
      phaseOneLayoutOperations: [
        { type: "DELETE_BLOCK", sectionIndex: 0, blockIndex: 0 },
      ],
      source: ContentSource.ADMIN,
      reviewStatus: ReviewStatus.NEEDS_REVIEW,
    });

    expect(figureFindMany).toHaveBeenCalledWith({
      where: {
        lessonSummaryId: summaryId,
        deletedAt: { not: null },
      },
      select: { id: true, blockPath: true, figureIndex: true },
    });
    expect(figureUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: activeFigureId },
      data: { blockPath: `layout-operation-${activeFigureId}` },
    });
    expect(figureUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: deletedFigureId },
      data: { blockPath: `layout-operation-${deletedFigureId}` },
    });
    expect(figureUpdate).toHaveBeenNthCalledWith(3, {
      where: { id: activeFigureId },
      data: { blockPath: "sections.0.blocks.0" },
    });
  });
});

function createProviderOutput() {
  return getLessonSummaryProviderTransportOutputSchema("MATH", "CONTEXTUAL", 12).parse({
    title: "Phương trình đường thẳng",
    objectives: null,
    theorySections: [
      {
        displayHeading: "Vectơ chỉ phương",
        sourceEvidence: {
          kind: "HEADING",
          text: "Vectơ chỉ phương",
          packetPageNumbers: [1],
        },
        items: [
          {
            itemType: "UNIT",
            theory: {
              type: "knowledge",
              title: "Vectơ chỉ phương",
              content: "Nội dung lý thuyết.",
              sourcePageNumbers: [1],
              figures: [],
            },
            example: {
              ...exampleBlock("ILLUSTRATION"),
              figures: [
                {
                  figureOrigin: "GENERATED_FROM_BRIEF",
                  sourceReferences: [],
                },
              ],
            },
          },
        ],
      },
    ],
    applicationExercises: {
      standardExercise: exampleBlock("STANDARD_EXERCISE"),
      realWorldExercise: exampleBlock("REAL_WORLD_EXERCISE"),
    },
  });
}

function exampleBlock(
  exampleKind: "ILLUSTRATION" | "STANDARD_EXERCISE" | "REAL_WORLD_EXERCISE",
) {
  return {
    type: "example" as const,
    exampleKind,
    problem: "Nêu một ví dụ.",
    solution: "Áp dụng kiến thức.",
    answer: "Kết quả đúng.",
    origin: "AI_AUTHORED" as const,
    sourcePageNumbers: [],
    isGeometry: false,
    geometryStatement: null,
    figures: [],
  };
}
