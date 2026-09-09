import type { QuizSubjectSnapshot } from "#api/modules/quiz/types/quiz-generation.types";
import { buildQuestionFigureSystemPrompt } from "#api/modules/question-figures/utils/prompts/question-figure-system-prompt-resolver";
import {
  buildMathQuizFigureRefinementSystemPrompt,
  buildMathSolutionFigureSystemPrompt,
} from "#api/modules/solution-figures/utils/prompts/math-solution-figure-system-prompt";
import {
  buildPhysicsQuizFigureRefinementSystemPrompt,
  buildPhysicsSolutionFigureSystemPrompt,
} from "#api/modules/solution-figures/utils/prompts/physics-solution-figure-system-prompt";
import {
  buildChemistryQuizFigureRefinementSystemPrompt,
  buildChemistrySolutionFigureSystemPrompt,
} from "#api/modules/solution-figures/utils/prompts/chemistry-solution-figure-system-prompt";
import {
  buildGeneralQuizFigureRefinementSystemPrompt,
  buildGeneralSolutionFigureSystemPrompt,
} from "#api/modules/solution-figures/utils/prompts/general-solution-figure-system-prompt";

export type QuizFigureSystemPromptMode = "QUESTION" | "SOLUTION";

export function buildQuizFigureSystemPrompt(
  subject: QuizSubjectSnapshot,
  mode: QuizFigureSystemPromptMode,
) {
  if (mode === "QUESTION") {
    return buildQuestionFigureSystemPrompt(subject);
  }
  switch (subject.key) {
    case "MATH":
      return resolveMathQuizFigureMode(subject, mode);
    case "PHYSICS":
      return resolvePhysicsQuizFigureMode(subject, mode);
    case "CHEMISTRY":
      return resolveChemistryQuizFigureMode(subject, mode);
    case "GENERAL":
      return resolveGeneralQuizFigureMode(subject, mode);
  }
}

export function buildQuizFigureRefinementSystemPrompt(
  subject: QuizSubjectSnapshot,
  mode: QuizFigureSystemPromptMode,
) {
  switch (subject.key) {
    case "MATH":
      return buildMathQuizFigureRefinementSystemPrompt(subject, mode);
    case "PHYSICS":
      return buildPhysicsQuizFigureRefinementSystemPrompt(subject, mode);
    case "CHEMISTRY":
      return buildChemistryQuizFigureRefinementSystemPrompt(subject, mode);
    case "GENERAL":
      return buildGeneralQuizFigureRefinementSystemPrompt(subject, mode);
  }
}

function resolveMathQuizFigureMode(
  subject: QuizSubjectSnapshot,
  mode: QuizFigureSystemPromptMode,
) {
  switch (mode) {
    case "QUESTION":
      return buildQuestionFigureSystemPrompt(subject);
    case "SOLUTION":
      return buildMathSolutionFigureSystemPrompt(subject);
  }
}

function resolvePhysicsQuizFigureMode(
  subject: QuizSubjectSnapshot,
  mode: QuizFigureSystemPromptMode,
) {
  switch (mode) {
    case "QUESTION":
      return buildQuestionFigureSystemPrompt(subject);
    case "SOLUTION":
      return buildPhysicsSolutionFigureSystemPrompt(subject);
  }
}

function resolveChemistryQuizFigureMode(
  subject: QuizSubjectSnapshot,
  mode: QuizFigureSystemPromptMode,
) {
  switch (mode) {
    case "QUESTION":
      return buildQuestionFigureSystemPrompt(subject);
    case "SOLUTION":
      return buildChemistrySolutionFigureSystemPrompt(subject);
  }
}

function resolveGeneralQuizFigureMode(
  subject: QuizSubjectSnapshot,
  mode: QuizFigureSystemPromptMode,
) {
  switch (mode) {
    case "QUESTION":
      return buildQuestionFigureSystemPrompt(subject);
    case "SOLUTION":
      return buildGeneralSolutionFigureSystemPrompt(subject);
  }
}
