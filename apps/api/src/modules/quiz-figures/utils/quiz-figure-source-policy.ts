import {
  assertQuestionFigureLatexSource,
  autoRepairQuestionFigureLatexSource,
  sanitizeQuestionFigureSvg,
} from "#api/modules/question-figures/utils/question-figure-source-policy";
import { autoRepairSolutionFigureLatexSource } from "#api/modules/solution-figures/utils/solution-figure-source-policy";

export function assertQuizFigureLatexSource(source: string) {
  return assertQuestionFigureLatexSource(source, "QUIZ_FIGURE");
}

export const autoRepairQuizQuestionFigureLatexSource =
  autoRepairQuestionFigureLatexSource;
export const autoRepairQuizSolutionFigureLatexSource =
  autoRepairSolutionFigureLatexSource;
export const autoRepairQuizFigureLatexSource = autoRepairQuizQuestionFigureLatexSource;

export function sanitizeQuizFigureSvg(svg: string) {
  return sanitizeQuestionFigureSvg(svg, "QUIZ_FIGURE");
}
