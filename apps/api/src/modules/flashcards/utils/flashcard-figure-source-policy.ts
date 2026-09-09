import {
  assertSolutionFigureLatexSource,
  autoRepairSolutionFigureLatexSource,
  sanitizeSolutionFigureSvg,
} from "#api/modules/solution-figures/utils/solution-figure-source-policy";

export function assertFlashcardFigureLatexSource(source: string) {
  return assertSolutionFigureLatexSource(source, "FLASHCARD_FIGURE");
}

export const autoRepairFlashcardFigureLatexSource = autoRepairSolutionFigureLatexSource;

export function sanitizeFlashcardFigureSvg(svg: string) {
  return sanitizeSolutionFigureSvg(svg, "FLASHCARD_FIGURE");
}
