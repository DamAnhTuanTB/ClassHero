import type { QuizSubjectKey } from "#api/modules/quiz/types/quiz-generation.types";
import { CHEMISTRY_QUIZ_SOLUTION_REFINEMENT_SYSTEM_PROMPT, CHEMISTRY_QUIZ_SOLUTION_REGENERATION_SYSTEM_PROMPT, CHEMISTRY_QUIZ_SOLUTION_REGENERATION_WITH_REJECTED_SYSTEM_PROMPT } from "#api/modules/quiz/utils/prompts/solution-refinement/chemistry-quiz-solution-refinement-system-prompt";
import { GENERAL_QUIZ_SOLUTION_REFINEMENT_SYSTEM_PROMPT, GENERAL_QUIZ_SOLUTION_REGENERATION_SYSTEM_PROMPT, GENERAL_QUIZ_SOLUTION_REGENERATION_WITH_REJECTED_SYSTEM_PROMPT } from "#api/modules/quiz/utils/prompts/solution-refinement/general-quiz-solution-refinement-system-prompt";
import { MATH_QUIZ_SOLUTION_REFINEMENT_SYSTEM_PROMPT, MATH_QUIZ_SOLUTION_REGENERATION_SYSTEM_PROMPT, MATH_QUIZ_SOLUTION_REGENERATION_WITH_REJECTED_SYSTEM_PROMPT } from "#api/modules/quiz/utils/prompts/solution-refinement/math-quiz-solution-refinement-system-prompt";
import { PHYSICS_QUIZ_SOLUTION_REFINEMENT_SYSTEM_PROMPT, PHYSICS_QUIZ_SOLUTION_REGENERATION_SYSTEM_PROMPT, PHYSICS_QUIZ_SOLUTION_REGENERATION_WITH_REJECTED_SYSTEM_PROMPT } from "#api/modules/quiz/utils/prompts/solution-refinement/physics-quiz-solution-refinement-system-prompt";

export function resolveQuizSolutionRefinementSystemPrompt(subjectKey: QuizSubjectKey) {
  switch (subjectKey) {
    case "MATH": return MATH_QUIZ_SOLUTION_REFINEMENT_SYSTEM_PROMPT;
    case "PHYSICS": return PHYSICS_QUIZ_SOLUTION_REFINEMENT_SYSTEM_PROMPT;
    case "CHEMISTRY": return CHEMISTRY_QUIZ_SOLUTION_REFINEMENT_SYSTEM_PROMPT;
    case "GENERAL": return GENERAL_QUIZ_SOLUTION_REFINEMENT_SYSTEM_PROMPT;
  }
}

export function resolveQuizSolutionRegenerationSystemPrompt(
  subjectKey: QuizSubjectKey,
  includeCurrentSolutionAsRejected = false,
) {
  switch (subjectKey) {
    case "MATH": return includeCurrentSolutionAsRejected ? MATH_QUIZ_SOLUTION_REGENERATION_WITH_REJECTED_SYSTEM_PROMPT : MATH_QUIZ_SOLUTION_REGENERATION_SYSTEM_PROMPT;
    case "PHYSICS": return includeCurrentSolutionAsRejected ? PHYSICS_QUIZ_SOLUTION_REGENERATION_WITH_REJECTED_SYSTEM_PROMPT : PHYSICS_QUIZ_SOLUTION_REGENERATION_SYSTEM_PROMPT;
    case "CHEMISTRY": return includeCurrentSolutionAsRejected ? CHEMISTRY_QUIZ_SOLUTION_REGENERATION_WITH_REJECTED_SYSTEM_PROMPT : CHEMISTRY_QUIZ_SOLUTION_REGENERATION_SYSTEM_PROMPT;
    case "GENERAL": return includeCurrentSolutionAsRejected ? GENERAL_QUIZ_SOLUTION_REGENERATION_WITH_REJECTED_SYSTEM_PROMPT : GENERAL_QUIZ_SOLUTION_REGENERATION_SYSTEM_PROMPT;
  }
}
