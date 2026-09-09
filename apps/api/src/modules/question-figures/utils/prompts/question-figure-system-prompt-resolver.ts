import type { QuestionFigureSubjectSnapshot } from "#api/modules/question-figures/types/question-figure-subject.types";
import { buildChemistryQuestionFigureSystemPrompt } from "#api/modules/question-figures/utils/prompts/chemistry-question-figure-system-prompt";
import { buildGeneralQuestionFigureSystemPrompt } from "#api/modules/question-figures/utils/prompts/general-question-figure-system-prompt";
import { buildMathQuestionFigureSystemPrompt } from "#api/modules/question-figures/utils/prompts/math-question-figure-system-prompt";
import { buildPhysicsQuestionFigureSystemPrompt } from "#api/modules/question-figures/utils/prompts/physics-question-figure-system-prompt";

export function buildQuestionFigureSystemPrompt(subject: QuestionFigureSubjectSnapshot) {
  switch (subject.key) {
    case "MATH":
      return buildMathQuestionFigureSystemPrompt(subject);
    case "PHYSICS":
      return buildPhysicsQuestionFigureSystemPrompt(subject);
    case "CHEMISTRY":
      return buildChemistryQuestionFigureSystemPrompt(subject);
    case "GENERAL":
      return buildGeneralQuestionFigureSystemPrompt(subject);
  }
}
