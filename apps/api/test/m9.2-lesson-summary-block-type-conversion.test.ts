import { describe, expect, it } from "vitest";

import { getLessonSummaryProviderTransportOutputSchema } from "#api/modules/ai/types/lesson-summary.types";
import { mapLessonSummaryProviderOutput } from "#api/modules/ai/utils/lesson-summary-mapper";
import { applyLessonSummaryPhaseOneBlockEdits } from "#api/modules/ai/utils/lesson-summary-phase-one-editor";

const lessonId = "00000000-0000-4000-8000-000000000201";

describe("M9.2 lesson Summary block type conversion", () => {
  it("persists a theory-to-note conversion only through the Phase 1 save path", () => {
    const fixture = createFixture();
    const blocks = structuredClone(fixture.mapped.phaseOneBlocks);
    blocks["sections.0.blocks.0"] = {
      type: "note",
      content: "Nội dung kiến thức được giữ lại.",
      sourcePageNumbers: [1],
    };

    const result = applyLessonSummaryPhaseOneBlockEdits({
      lessonId,
      snapshot: fixture.snapshot,
      blocks,
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.message);
    expect(result.mapped.content.sections[0]?.blocks[0]).toMatchObject({
      type: "note",
      content: "Nội dung kiến thức được giữ lại.",
    });
    expect(result.mapped.content.sections[0]?.blocks[1]?.type).toBe("example");
    expect(result.mapped.figures).toHaveLength(1);
    expect(result.mapped.figures[0]?.blockPath).toBe("sections.0.blocks.0");
    expect(result.snapshot.blocks["sections.0.blocks.0"]).toEqual(
      blocks["sections.0.blocks.0"],
    );
  });

  it("persists a note-to-theorem conversion with its required title", () => {
    const fixture = createFixture();
    const blocks = structuredClone(fixture.mapped.phaseOneBlocks);
    blocks["sections.0.blocks.2"] = {
      type: "theorem",
      title: "Định lí",
      content: "Nội dung chú ý được giữ lại.",
      sourcePageNumbers: [1],
      figures: [],
    };

    const result = applyLessonSummaryPhaseOneBlockEdits({
      lessonId,
      snapshot: fixture.snapshot,
      blocks,
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.message);
    expect(result.mapped.content.sections[0]?.blocks[2]).toMatchObject({
      type: "theorem",
      title: "Định lí",
      content: "Nội dung chú ý được giữ lại.",
    });
  });
});

function createFixture() {
  const output = getLessonSummaryProviderTransportOutputSchema(
    "MATH",
    "CONTEXTUAL",
    12,
  ).parse({
    title: "Bài học thử nghiệm",
    objectives: null,
    theorySections: [
      {
        displayHeading: "Đề mục",
        sourceEvidence: {
          kind: "HEADING",
          text: "Đề mục",
          packetPageNumbers: [1],
        },
        items: [
          {
            itemType: "UNIT",
            theory: {
              type: "knowledge",
              title: "Kiến thức cũ",
              content: "Nội dung kiến thức được giữ lại.",
              sourcePageNumbers: [1],
              figures: [
                {
                  figureOrigin: "GENERATED_FROM_BRIEF",
                  sourceReferences: [],
                },
              ],
            },
            example: exampleBlock("ILLUSTRATION"),
          },
          {
            itemType: "NOTE",
            note: {
              type: "note",
              content: "Nội dung chú ý được giữ lại.",
              sourcePageNumbers: [1],
            },
          },
        ],
      },
    ],
    applicationExercises: {
      standardExercises: [
        exampleBlock("STANDARD_EXERCISE"),
        exampleBlock("STANDARD_EXERCISE"),
      ],
      realWorldExercises: [
        exampleBlock("REAL_WORLD_EXERCISE"),
        exampleBlock("REAL_WORLD_EXERCISE"),
      ],
    },
  });
  const mapped = mapLessonSummaryProviderOutput({
    lessonId,
    output,
    packetPageCount: 1,
    targetGrade: 12,
    subjectKey: "MATH",
  });
  return {
    mapped,
    snapshot: {
      type: "lesson_summary_phase_one_blocks" as const,
      version: 2 as const,
      providerOutput: output,
      blocks: mapped.phaseOneBlocks,
      providerPaths: mapped.phaseOneProviderPaths,
      subjectKey: "MATH" as const,
      targetGrade: 12,
      packetPageCount: 1,
    },
  };
}

function exampleBlock(
  exampleKind: "ILLUSTRATION" | "STANDARD_EXERCISE" | "REAL_WORLD_EXERCISE",
) {
  return {
    type: exampleKind === "ILLUSTRATION" ? "example" : "exercise",
    exampleKind,
    problem: "Đề bài.",
    solution: "Lời giải.",
    answer: "Đáp án.",
    figures: [],
    origin: "SOURCE_EXACT",
    sourcePageNumbers: [1],
    isGeometry: false,
    geometryStatement: null,
  };
}
