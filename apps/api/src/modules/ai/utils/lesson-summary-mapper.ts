import { createHash } from "node:crypto";
import {
  normalizeLessonSummaryAngleNotation,
  normalizeLessonSummaryNoteContent,
} from "@learning-path/shared";

import {
  lessonSummaryOutputSchema,
  resolveLessonSummaryReviewIssueResolution,
  type LessonSummaryProviderExampleBlock,
  type LessonSummaryProviderTheoryBlock,
  type LessonSummaryMvpBlock,
  type LessonSummaryOutput,
  type LessonSummaryProviderTransportOutput,
  type StemFigurePlanDraft,
  type StemFigureProviderPlanDraft,
} from "#api/modules/ai/types/lesson-summary.types";
import type { LessonSummarySubjectKey } from "#api/modules/ai/types/lesson-summary-subject.types";
import type { MissingRequiredFigure } from "#api/modules/ai/utils/lesson-summary-figure-requirement";
import { buildLessonSummaryFigureAltText } from "#api/modules/ai/utils/lesson-summary-figure-alt-text";

export type LessonSummaryFigureDraft = {
  blockPath: string;
  figureIndex: number;
  draft: StemFigurePlanDraft;
};

export type MappedLessonSummaryOutput = {
  content: LessonSummaryOutput;
  figures: LessonSummaryFigureDraft[];
  phaseOneBlocks: Record<string, unknown>;
  phaseOneProviderPaths: Record<string, string>;
};

export function mapLessonSummaryProviderOutput(input: {
  lessonId: string;
  output: LessonSummaryProviderTransportOutput;
  packetPageCount: number;
  targetGrade?: number | null;
  subjectKey?: LessonSummarySubjectKey;
  missingRequiredFigures?: MissingRequiredFigure[];
}): MappedLessonSummaryOutput {
  const figures: LessonSummaryFigureDraft[] = [];
  const phaseOneBlocks: Record<string, unknown> = {};
  const phaseOneProviderPaths: Record<string, string> = {};
  const sections: LessonSummaryOutput["sections"] = [];
  const missingFiguresByProviderBlockPath = new Map(
    (input.missingRequiredFigures ?? []).map((issue) => [
      issue.path.replace(/\.figures$/u, ""),
      issue,
    ]),
  );

  const attachMissingFigureIssue = <TBlock extends LessonSummaryMvpBlock>(
    block: TBlock,
    providerBlockPath: string,
    outputBlockPath: string,
  ): TBlock => {
    const requirement = missingFiguresByProviderBlockPath.get(providerBlockPath);
    if (!requirement) return block;
    const code = "MISSING_REQUIRED_FIGURE";
    const path = `${outputBlockPath}.figures`;
    const issueFingerprint = fingerprint(null);
    return {
      ...block,
      reviewIssues: [
        ...(block.reviewIssues ?? []),
        {
          id: `${code}-${fingerprint(`${path}:${requirement.reason}`).slice(0, 12)}`,
          code,
          path,
          message: "Phần này bắt buộc cần hình minh họa nhưng AI chưa tạo hình.",
          suggestion:
            "Bổ sung hình phù hợp hoặc sinh lại nội dung; phần chữ và các phần khác vẫn được giữ nguyên.",
          technicalDetails: `${requirement.reason} Provider path: ${requirement.path}`,
          fingerprint: issueFingerprint,
          resolution: resolveLessonSummaryReviewIssueResolution(code),
          accepted: false,
        },
      ],
    };
  };

  for (const [
    sourceSectionIndex,
    sourceSection,
  ] of input.output.theorySections.entries()) {
    validateSourceEvidence(sourceSection.sourceEvidence, input.packetPageCount);
    const blocks: LessonSummaryMvpBlock[] = [];
    for (const [itemIndex, item] of sourceSection.items.entries()) {
      if (item.itemType === "NOTE") {
        validateSourcePageNumbers(item.note.sourcePageNumbers, input.packetPageCount);
        const notePath = `sections.${sections.length}.blocks.${blocks.length}`;
        phaseOneBlocks[notePath] = structuredClone(item.note);
        phaseOneProviderPaths[notePath] =
          `theorySections.${sourceSectionIndex}.items.${itemIndex}.note`;
        blocks.push({
          type: "note",
          content: normalizeLessonSummaryNoteContent(item.note.content),
          sourcePageNumbers: item.note.sourcePageNumbers,
          figures: [],
        });
        continue;
      }

      validateSourcePageNumbers(item.theory.sourcePageNumbers, input.packetPageCount);
      const theoryPath = `sections.${sections.length}.blocks.${blocks.length}`;
      phaseOneBlocks[theoryPath] = structuredClone(item.theory);
      phaseOneProviderPaths[theoryPath] =
        `theorySections.${sourceSectionIndex}.items.${itemIndex}.theory`;
      const theory = attachMissingFigureIssue(
        mapTheoryBlock(item.theory),
        `theorySections.${sourceSectionIndex}.items.${itemIndex}.theory`,
        theoryPath,
      );
      blocks.push(theory);
      addFigures(
        figures,
        theoryPath,
        item.theory.figures,
        input.packetPageCount,
        item.theory,
        sourceSection.displayHeading,
      );

      validateExampleProvenance(item.example, input.packetPageCount);
      const examplePath = `sections.${sections.length}.blocks.${blocks.length}`;
      phaseOneBlocks[examplePath] = structuredClone(item.example);
      phaseOneProviderPaths[examplePath] =
        `theorySections.${sourceSectionIndex}.items.${itemIndex}.example`;
      blocks.push(
        attachMissingFigureIssue(
          mapLessonSummaryProviderExampleBlock(
            item.example,
            input.subjectKey,
            input.targetGrade,
          ),
          `theorySections.${sourceSectionIndex}.items.${itemIndex}.example`,
          examplePath,
        ),
      );
      addFigures(
        figures,
        examplePath,
        item.example.figures,
        input.packetPageCount,
        item.example,
        sourceSection.displayHeading,
      );
    }
    if (blocks.length === 0) continue;
    const heading = requireText(sourceSection.displayHeading, "displayHeading");
    sections.push({
      order: sections.length + 1,
      displayHeading: stripLeadingHeadingNumber(heading),
      sourceEvidence: sourceSection.sourceEvidence,
      blocks,
    });
  }

  const applicationBlocks: LessonSummaryMvpBlock[] = [];
  const applicationExercises = [
    ...input.output.applicationExercises.standardExercises.map(
      (exercise, exerciseIndex) => ({
        exercise,
        providerPath: `applicationExercises.standardExercises.${exerciseIndex}`,
      }),
    ),
    ...input.output.applicationExercises.realWorldExercises.map(
      (exercise, exerciseIndex) => ({
        exercise,
        providerPath: `applicationExercises.realWorldExercises.${exerciseIndex}`,
      }),
    ),
  ];
  for (const { exercise, providerPath } of applicationExercises) {
    const blockPath = `sections.${sections.length}.blocks.${applicationBlocks.length}`;
    phaseOneBlocks[blockPath] = structuredClone(exercise);
    phaseOneProviderPaths[blockPath] = providerPath;
    validateExampleProvenance(exercise, input.packetPageCount);
    applicationBlocks.push(
      attachMissingFigureIssue(
        mapLessonSummaryProviderExampleBlock(
          exercise,
          input.subjectKey,
          input.targetGrade,
        ),
        providerPath,
        blockPath,
      ),
    );
    addFigures(
      figures,
      blockPath,
      exercise.figures,
      input.packetPageCount,
      exercise,
      "Bài tập vận dụng",
    );
  }
  if (applicationBlocks.length > 0) {
    sections.push({
      order: sections.length + 1,
      displayHeading: "Bài tập vận dụng",
      sourceEvidence: input.output.theorySections.at(-1)?.sourceEvidence ?? {
        kind: "CONTENT",
        text: "Bài tập vận dụng tổng hợp từ nội dung trong PDF packet.",
        packetPageNumbers: [input.packetPageCount],
      },
      blocks: applicationBlocks,
    });
  }

  const content = lessonSummaryOutputSchema.parse({
    lessonId: input.lessonId,
    targetGrade: input.targetGrade ?? null,
    title: requireText(input.output.title, "title"),
    objectives:
      input.output.objectives && input.output.objectives.length > 0
        ? input.output.objectives.map((value) => requireText(value, "objective"))
        : null,
    sections,
    warnings: null,
    warningDetails: null,
  });
  return { content, figures, phaseOneBlocks, phaseOneProviderPaths };
}

export function mapLessonSummaryProviderExampleBlock(
  example: LessonSummaryProviderExampleBlock,
  subjectKey: LessonSummarySubjectKey = "MATH",
  targetGrade: number | null = null,
): LessonSummaryMvpBlock & { type: "example" | "exercise" } {
  const solution = requireText(normalizeSolution(example.solution), "solution");
  return {
    type: example.exampleKind === "ILLUSTRATION" ? "example" : "exercise",
    problem: normalizeMathText(requireText(example.problem, "problem")),
    solution,
    answer: normalizeMathText(requireText(example.answer, "answer")),
    figures: [],
    sourcePageNumbers: example.sourcePageNumbers,
    isGeometry:
      subjectKey === "MATH" && "isGeometry" in example ? example.isGeometry : undefined,
    geometryStatement:
      subjectKey === "MATH" &&
      targetGrade !== null &&
      targetGrade >= 7 &&
      targetGrade <= 9 &&
      "isGeometry" in example &&
      example.isGeometry &&
      "geometryStatement" in example
        ? normalizeGeometryStatement(example.geometryStatement)
        : undefined,
    origin: example.origin,
  };
}

function mapTheoryBlock(block: LessonSummaryProviderTheoryBlock): LessonSummaryMvpBlock {
  return {
    type: block.type,
    title: requireText(block.title, "theory.title"),
    content: requireText(block.content, `${block.type}.content`),
    sourcePageNumbers: block.sourcePageNumbers,
    figures: [],
  };
}

function addFigures(
  figures: LessonSummaryFigureDraft[],
  blockPath: string,
  blockFigures: StemFigureProviderPlanDraft[],
  packetPageCount: number,
  block: LessonSummaryProviderTheoryBlock | LessonSummaryProviderExampleBlock,
  sectionHeading: string,
) {
  for (const [figureIndex, figure] of blockFigures.entries()) {
    for (const reference of figure.sourceReferences) {
      if (
        reference.packetPageNumber < 1 ||
        reference.packetPageNumber > packetPageCount
      ) {
        throw new Error(`LESSON_SUMMARY_FIGURE_REFERENCE_OUT_OF_RANGE:${blockPath}`);
      }
    }
    figures.push({
      blockPath,
      figureIndex,
      draft: {
        ...figure,
        figurePlanContractVersion: 3,
        localId: `F${String(figures.length + 1).padStart(3, "0")}`,
        altText: buildLessonSummaryFigureAltText({
          block,
          sectionHeading,
        }),
      },
    });
  }
}

function validateExampleProvenance(
  example: LessonSummaryProviderExampleBlock,
  packetPageCount: number,
) {
  validateSourcePageNumbers(example.sourcePageNumbers, packetPageCount);
  if (example.origin === "AI_AUTHORED" && example.sourcePageNumbers.length > 0) {
    throw new Error("LESSON_SUMMARY_AI_AUTHORED_EXAMPLE_HAS_SOURCE_PAGE");
  }
  if (example.origin !== "AI_AUTHORED" && example.sourcePageNumbers.length === 0) {
    throw new Error("LESSON_SUMMARY_SOURCE_EXAMPLE_MISSING_SOURCE_PAGE");
  }
}

function validateSourcePageNumbers(pageNumbers: number[], packetPageCount: number) {
  if (pageNumbers.some((pageNumber) => pageNumber < 1 || pageNumber > packetPageCount)) {
    throw new Error("LESSON_SUMMARY_BLOCK_SOURCE_PAGE_OUT_OF_RANGE");
  }
}

function validateSourceEvidence(
  evidence: { packetPageNumbers: number[] },
  packetPageCount: number,
) {
  if (
    evidence.packetPageNumbers.some(
      (pageNumber) => pageNumber < 1 || pageNumber > packetPageCount,
    )
  ) {
    throw new Error("LESSON_SUMMARY_SOURCE_EVIDENCE_OUT_OF_RANGE");
  }
}

function normalizeGeometryStatement(
  value:
    | {
        hypotheses: string[];
        conclusions: string[];
      }
    | null
    | undefined,
) {
  if (!value) return undefined;
  const hypotheses = value.hypotheses.map(normalizeMathText).filter(Boolean);
  const conclusions = value.conclusions.map(normalizeMathText).filter(Boolean);
  return hypotheses.length > 0 && conclusions.length > 0
    ? { hypotheses, conclusions }
    : undefined;
}

function normalizeSolution(value: string) {
  return normalizeMathText(value)
    .split("\n")
    .filter(
      (line) =>
        !/^\s*(?:#{1,6}\s*)?(?:\*\*|__)?(?:Lời giải|Chứng minh)\s*:?(?:\*\*|__)?\s*$/iu.test(
          line,
        ),
    )
    .join("\n")
    .trim();
}

function normalizeMathText(value: string) {
  return normalizeLessonSummaryAngleNotation(value).trim();
}

function requireText(value: string, field: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`LESSON_SUMMARY_EMPTY_FIELD: ${field}`);
  return normalized;
}

function stripLeadingHeadingNumber(value: string) {
  return value.replace(/^\s*(?:§\s*)?\d+(?:[.,]\d+)*(?:\s*[:.)-])?\s+/u, "").trim();
}

function fingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
