import type { QuizSubjectSnapshot } from "#api/modules/quiz/types/quiz-generation.types";
import {
  buildMathQuizFigureRefinementSystemPrompt,
  buildMathQuizQuestionFigureSystemPrompt,
  buildMathQuizSolutionExtensionSystemPrompt,
  buildMathQuizSolutionRedrawSystemPrompt,
} from "#api/modules/quiz-figures/utils/prompts/math-quiz-figure-system-prompt";
import {
  buildPhysicsQuizFigureRefinementSystemPrompt,
  buildPhysicsQuizQuestionFigureSystemPrompt,
  buildPhysicsQuizSolutionExtensionSystemPrompt,
  buildPhysicsQuizSolutionRedrawSystemPrompt,
} from "#api/modules/quiz-figures/utils/prompts/physics-quiz-figure-system-prompt";
import {
  buildChemistryQuizFigureRefinementSystemPrompt,
  buildChemistryQuizQuestionFigureSystemPrompt,
  buildChemistryQuizSolutionExtensionSystemPrompt,
  buildChemistryQuizSolutionRedrawSystemPrompt,
} from "#api/modules/quiz-figures/utils/prompts/chemistry-quiz-figure-system-prompt";
import {
  buildGeneralQuizFigureRefinementSystemPrompt,
  buildGeneralQuizQuestionFigureSystemPrompt,
  buildGeneralQuizSolutionExtensionSystemPrompt,
  buildGeneralQuizSolutionRedrawSystemPrompt,
} from "#api/modules/quiz-figures/utils/prompts/general-quiz-figure-system-prompt";

export type QuizFigureSystemPromptMode =
  "QUESTION" | "EXTEND_QUESTION" | "REDRAW_AS_MODEL";

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
    case "EXTEND_QUESTION":
      return buildMathQuizSolutionExtensionSystemPrompt(subject);
    case "REDRAW_AS_MODEL":
      return buildMathQuizSolutionRedrawSystemPrompt(subject);
  }
}

function resolvePhysicsQuizFigureMode(
  subject: QuizSubjectSnapshot,
  mode: QuizFigureSystemPromptMode,
) {
  switch (mode) {
    case "QUESTION":
      return buildPhysicsQuizQuestionFigureSystemPrompt(subject);
    case "EXTEND_QUESTION":
      return buildPhysicsQuizSolutionExtensionSystemPrompt(subject);
    case "REDRAW_AS_MODEL":
      return buildPhysicsQuizSolutionRedrawSystemPrompt(subject);
  }
}

function resolveChemistryQuizFigureMode(
  subject: QuizSubjectSnapshot,
  mode: QuizFigureSystemPromptMode,
) {
  switch (mode) {
    case "QUESTION":
      return buildChemistryQuizQuestionFigureSystemPrompt(subject);
    case "EXTEND_QUESTION":
      return buildChemistryQuizSolutionExtensionSystemPrompt(subject);
    case "REDRAW_AS_MODEL":
      return buildChemistryQuizSolutionRedrawSystemPrompt(subject);
  }
}

function resolveGeneralQuizFigureMode(
  subject: QuizSubjectSnapshot,
  mode: QuizFigureSystemPromptMode,
) {
  switch (mode) {
    case "QUESTION":
      return buildGeneralQuizQuestionFigureSystemPrompt(subject);
    case "EXTEND_QUESTION":
      return buildGeneralQuizSolutionExtensionSystemPrompt(subject);
    case "REDRAW_AS_MODEL":
      return buildGeneralQuizSolutionRedrawSystemPrompt(subject);
  }
}
