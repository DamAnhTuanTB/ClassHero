import type { LessonSummarySubjectSnapshot } from "#api/modules/ai/types/lesson-summary-subject.types";
import { buildChemistryLessonSummarySystemPrompt } from "#api/modules/ai/utils/prompts/lesson-summary/chemistry-lesson-summary-system-prompt";
import { buildGeneralLessonSummarySystemPrompt } from "#api/modules/ai/utils/prompts/lesson-summary/general-lesson-summary-system-prompt";
import { buildMathLessonSummarySystemPrompt } from "#api/modules/ai/utils/prompts/lesson-summary/math-lesson-summary-system-prompt";
import { buildPhysicsLessonSummarySystemPrompt } from "#api/modules/ai/utils/prompts/lesson-summary/physics-lesson-summary-system-prompt";

export function buildLessonSummarySubjectSystemPrompt(
  subject: LessonSummarySubjectSnapshot,
) {
  switch (subject.key) {
    case "MATH":
      return buildMathLessonSummarySystemPrompt(subject);
    case "PHYSICS":
      return buildPhysicsLessonSummarySystemPrompt(subject);
    case "CHEMISTRY":
      return buildChemistryLessonSummarySystemPrompt(subject);
    case "GENERAL":
      return buildGeneralLessonSummarySystemPrompt(subject);
  }
}
