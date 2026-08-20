import type {
  LessonSummaryFigureRequirement,
  LessonSummaryProviderTransportOutput,
} from "#api/modules/ai/types/lesson-summary.types";

export type MissingRequiredFigure = {
  path: string;
  reason: string;
};

/**
 * Source-supported figure coverage is decided by the multimodal Summary call.
 * The backend does not have enough semantic context to infer this reliably from
 * lesson titles or keyword lists, so it must not manufacture review warnings.
 */
export function findMissingRequiredLessonSummaryFigures(_input: {
  output: LessonSummaryProviderTransportOutput;
  subjectKey: "MATH" | "PHYSICS" | "CHEMISTRY" | "GENERAL";
}): MissingRequiredFigure[] {
  return [];
}

/**
 * Retained for request-draft compatibility. Provider schemas no longer switch
 * to a global all-figures mode based on lesson title or OCR keywords.
 */
export function resolveLessonSummaryFigureRequirement(_input: {
  lessonTitle: string;
  subjectKey: "MATH" | "PHYSICS" | "CHEMISTRY" | "GENERAL";
  contextChunks: ReadonlyArray<{ content: string }>;
}): LessonSummaryFigureRequirement {
  return "CONTEXTUAL";
}
