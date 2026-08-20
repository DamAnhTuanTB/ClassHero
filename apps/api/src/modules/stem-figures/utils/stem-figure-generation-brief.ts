import { z } from "zod";

import {
  sourceEvidenceSchema,
  type StemFigureRenderPlan,
} from "#api/modules/ai/types/lesson-summary.types";
import type { StemFigureGenerationBrief } from "#api/modules/stem-figures/types/stem-figure-generation.types";

export const stemFigureLessonContextSchema = z
  .object({
    targetGrade: z.number().int().min(1).max(12).nullable().optional(),
    title: z.string().trim().min(1).max(240),
    sections: z
      .array(
        z
          .object({
            displayHeading: z.string().trim().min(1).max(240),
            sourceEvidence: sourceEvidenceSchema,
            blocks: z.array(z.record(z.string(), z.unknown())).min(1),
          })
          .passthrough(),
      )
      .min(1),
  })
  .passthrough();

export type StemFigureLessonContext = z.infer<typeof stemFigureLessonContextSchema>;

export function buildStemFigureGenerationBrief(input: {
  output: StemFigureLessonContext;
  blockPath: string;
  plan: StemFigureRenderPlan;
  targetGrade: number | null;
  referenceAssets?: StemFigureGenerationBrief["referenceAssets"];
  referenceImageMode?: StemFigureGenerationBrief["referenceImageMode"];
  currentLatexSource?: string | null;
  adminInstructions?: string | null;
}): StemFigureGenerationBrief {
  const match = input.blockPath.match(/^sections\.(\d+)\.blocks\.(\d+)$/u);
  if (!match) throw new Error(`Invalid STEM figure block path: ${input.blockPath}`);
  const section = input.output.sections[Number(match[1])];
  const block = section?.blocks[Number(match[2])];
  if (!section || !block) {
    throw new Error(`STEM figure block path not found: ${input.blockPath}`);
  }
  const figureOrigin = input.plan.figureOrigin;
  const referenceImageMode =
    input.referenceImageMode ??
    (figureOrigin === "GENERATED_FROM_BRIEF" ? "NONE" : "SOURCE_CROP_ONLY");
  const referenceAssets =
    referenceImageMode === "NONE" ? [] : (input.referenceAssets ?? []);
  return {
    figurePlanContractVersion: 3,
    figureOrigin,
    targetGrade: input.targetGrade,
    blockPath: input.blockPath,
    blockContent: projectStemFigureBlock(block),
    sourceReferences:
      figureOrigin === "GENERATED_FROM_BRIEF" ? [] : input.plan.sourceReferences,
    referenceAssets,
    referenceImageMode,
    ...(input.currentLatexSource?.trim()
      ? { currentLatexSource: input.currentLatexSource.trim() }
      : {}),
    adminInstructions: input.adminInstructions?.trim() || null,
  };
}

export function projectStemFigureBlock(value: Record<string, unknown>) {
  const type = typeof value.type === "string" ? value.type : null;
  if (type === "example") {
    const projection: Record<string, unknown> = {
      type,
      ...(typeof value.problem === "string" ? { problem: value.problem } : {}),
      ...(typeof value.isGeometry === "boolean" ? { isGeometry: value.isGeometry } : {}),
    };
    const geometryStatement = readRecord(value.geometryStatement);
    if (geometryStatement && Array.isArray(geometryStatement.hypotheses)) {
      projection.geometryStatement = {
        hypotheses: geometryStatement.hypotheses.filter(
          (item): item is string => typeof item === "string",
        ),
      };
    }
    return projection;
  }
  if (type === "note") {
    return {
      type,
      ...(typeof value.content === "string" ? { content: value.content } : {}),
    };
  }
  return {
    ...(type ? { type } : {}),
    ...(typeof value.title === "string" ? { title: value.title } : {}),
    ...(typeof value.content === "string" ? { content: value.content } : {}),
  };
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
