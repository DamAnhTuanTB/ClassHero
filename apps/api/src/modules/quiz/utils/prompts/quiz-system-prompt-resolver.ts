import type { QuizSubjectSnapshot } from "#api/modules/quiz/types/quiz-generation.types";
import { buildChemistryQuizSystemPrompt } from "#api/modules/quiz/utils/prompts/chemistry-quiz-system-prompt";
import { buildGeneralQuizSystemPrompt } from "#api/modules/quiz/utils/prompts/general-quiz-system-prompt";
import { buildMathQuizSystemPrompt } from "#api/modules/quiz/utils/prompts/math-quiz-system-prompt";
import { buildPhysicsQuizSystemPrompt } from "#api/modules/quiz/utils/prompts/physics-quiz-system-prompt";

export function buildQuizSubjectSystemPrompt(subject: QuizSubjectSnapshot) {
  switch (subject.key) {
    case "MATH":
      return buildMathQuizSystemPrompt(subject);
    case "PHYSICS":
      return buildPhysicsQuizSystemPrompt(subject);
    case "CHEMISTRY":
      return buildChemistryQuizSystemPrompt(subject);
    case "GENERAL":
      return buildGeneralQuizSystemPrompt(subject);
  }
}
