import type { LessonSummarySubjectSnapshot } from "#api/modules/ai/types/lesson-summary-subject.types";
import { buildMathStemFigureSystemPrompt } from "#api/modules/stem-figures/utils/prompts/math-stem-figure-system-prompt";
import { buildPhysicsStemFigureSystemPrompt } from "#api/modules/stem-figures/utils/prompts/physics-stem-figure-system-prompt";
import { buildChemistryStemFigureSystemPrompt } from "#api/modules/stem-figures/utils/prompts/chemistry-stem-figure-system-prompt";
import { buildGeneralStemFigureSystemPrompt } from "#api/modules/stem-figures/utils/prompts/general-stem-figure-system-prompt";

export type StemFigureSystemPromptMode =
  "REGENERATE_FROM_SOURCE" | "EDIT_CURRENT_SOURCE" | "GENERATE_FROM_BLOCK" | "REPAIR";

export function buildStemFigureSystemPrompt(
  subject: LessonSummarySubjectSnapshot,
  mode: StemFigureSystemPromptMode,
  options: { hasAdminInstructions?: boolean } = {},
) {
  const resolvedOptions = {
    hasAdminInstructions: options.hasAdminInstructions ?? false,
  };
  switch (subject.key) {
    case "MATH":
      return buildMathStemFigureSystemPrompt(subject, mode, resolvedOptions);
    case "PHYSICS":
      return buildPhysicsStemFigureSystemPrompt(subject, mode, resolvedOptions);
    case "CHEMISTRY":
      return buildChemistryStemFigureSystemPrompt(subject, mode, resolvedOptions);
    case "GENERAL":
      return buildGeneralStemFigureSystemPrompt(subject, mode, resolvedOptions);
  }
}
