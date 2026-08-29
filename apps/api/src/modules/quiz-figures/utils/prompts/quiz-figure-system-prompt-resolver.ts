import type { QuizSubjectSnapshot } from "#api/modules/quiz/types/quiz-generation.types";
import {
  buildMathQuizFigureRefinementSystemPrompt,
  buildMathQuizQuestionFigureSystemPrompt,
  buildMathQuizSolutionFigureSystemPrompt,
} from "#api/modules/quiz-figures/utils/prompts/math-quiz-figure-system-prompt";
import {
  buildPhysicsQuizFigureRefinementSystemPrompt,
  buildPhysicsQuizQuestionFigureSystemPrompt,
  buildPhysicsQuizSolutionFigureSystemPrompt,
} from "#api/modules/quiz-figures/utils/prompts/physics-quiz-figure-system-prompt";
import {
  buildChemistryQuizFigureRefinementSystemPrompt,
  buildChemistryQuizQuestionFigureSystemPrompt,
  buildChemistryQuizSolutionFigureSystemPrompt,
} from "#api/modules/quiz-figures/utils/prompts/chemistry-quiz-figure-system-prompt";
import {
  buildGeneralQuizFigureRefinementSystemPrompt,
  buildGeneralQuizQuestionFigureSystemPrompt,
  buildGeneralQuizSolutionFigureSystemPrompt,
} from "#api/modules/quiz-figures/utils/prompts/general-quiz-figure-system-prompt";

export type QuizFigureSystemPromptMode = "QUESTION" | "SOLUTION";

export function buildQuizFigureSystemPrompt(
  subject: QuizSubjectSnapshot,
  mode: QuizFigureSystemPromptMode,
) {
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
      return buildMathQuizQuestionFigureSystemPrompt(subject);
    case "SOLUTION":
      return buildMathQuizSolutionFigureSystemPrompt(subject);
  }
}

function resolvePhysicsQuizFigureMode(
  subject: QuizSubjectSnapshot,
  mode: QuizFigureSystemPromptMode,
) {
  switch (mode) {
    case "QUESTION":
      return buildPhysicsQuizQuestionFigureSystemPrompt(subject);
    case "SOLUTION":
      return buildPhysicsQuizSolutionFigureSystemPrompt(subject);
  }
}

function resolveChemistryQuizFigureMode(
  subject: QuizSubjectSnapshot,
  mode: QuizFigureSystemPromptMode,
) {
  switch (mode) {
    case "QUESTION":
      return buildChemistryQuizQuestionFigureSystemPrompt(subject);
    case "SOLUTION":
      return buildChemistryQuizSolutionFigureSystemPrompt(subject);
  }
}

function resolveGeneralQuizFigureMode(
  subject: QuizSubjectSnapshot,
  mode: QuizFigureSystemPromptMode,
) {
  switch (mode) {
    case "QUESTION":
      return buildGeneralQuizQuestionFigureSystemPrompt(subject);
    case "SOLUTION":
      return buildGeneralQuizSolutionFigureSystemPrompt(subject);
  }
}
