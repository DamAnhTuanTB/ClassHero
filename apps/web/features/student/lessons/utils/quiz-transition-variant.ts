export const allQuizTransitionVariants = [
  "book",
  "rocket",
  "pencil-portal",
  "eraser",
  "paper-tear",
  "compass-portal",
  "notebook-flip",
  "page-riffle",
  "ink-spread",
] as const;

export type QuizTransitionVariant = (typeof allQuizTransitionVariants)[number];

export const quizTransitionVariants = [
  "book",
  "rocket",
  "pencil-portal",
  "eraser",
  "paper-tear",
  "compass-portal",
  "notebook-flip",
  "page-riffle",
  "ink-spread",
] as const satisfies readonly QuizTransitionVariant[];
export type QuizTransitionPhase = "idle" | "closing" | "closed" | "opening";
export type ActiveQuizTransitionPhase = Exclude<QuizTransitionPhase, "idle">;

export type QuizTransitionEffectProps = {
  panelDuration: number;
  phase: ActiveQuizTransitionPhase;
  shouldReduceMotion: boolean;
};

export const quizTransitionTimings = {
  closeMs: 800,
  holdMs: 0,
  openMs: 620,
  reducedCloseMs: 400,
  reducedOpenMs: 80,
} as const;

export function pickQuizTransitionVariant(
  previousVariant: QuizTransitionVariant | null,
  randomValue = Math.random(),
): QuizTransitionVariant {
  const candidates =
    previousVariant === null
      ? quizTransitionVariants
      : quizTransitionVariants.filter((variant) => variant !== previousVariant);
  const safeRandomValue = Number.isFinite(randomValue)
    ? Math.min(Math.max(randomValue, 0), 0.999999)
    : 0;
  const index = Math.floor(safeRandomValue * candidates.length);

  return candidates[index] ?? quizTransitionVariants[0];
}
