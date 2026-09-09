import type { AiStructuredInput } from "#api/modules/ai/types/ai-text.types";
import type { FlashcardSubjectSnapshot } from "#api/modules/flashcards/types/flashcard-generation.types";
import {
  buildSolutionFigureStructuredInput,
  generatedSolutionFigureSchema,
  SOLUTION_FIGURE_SCHEMA_VERSION,
  type SolutionFigureMode,
} from "#api/modules/solution-figures/types/solution-figure-generation.types";

export const FLASHCARD_FIGURE_SCHEMA_VERSION = SOLUTION_FIGURE_SCHEMA_VERSION;

export type FlashcardSolutionFigureMode = SolutionFigureMode;

export const generatedFlashcardFigureSchema = generatedSolutionFigureSchema;

export type FlashcardFigureContext = {
  flashcardId: string;
  front: string;
  solution: string;
  currentSolutionLatexSource?: string | null;
  sourcePacketPageNumbers: number[];
  targetGrade: number | null;
  subject: FlashcardSubjectSnapshot;
};

export function buildFlashcardFigureStructuredInput(input: {
  context: FlashcardFigureContext;
  adminInstructions?: string | null;
  mode?: FlashcardSolutionFigureMode;
  systemPrompt?: string | null;
  userPrompt?: string | null;
}): AiStructuredInput {
  const { context } = input;
  return buildSolutionFigureStructuredInput({
    subject: context.subject,
    problem: context.front,
    solution: context.solution,
    targetGrade: context.targetGrade,
    adminInstructions: input.adminInstructions,
    mode: input.mode,
    currentSolutionLatexSource: context.currentSolutionLatexSource,
    systemPrompt: input.systemPrompt,
    userPrompt: input.userPrompt,
  });
}
