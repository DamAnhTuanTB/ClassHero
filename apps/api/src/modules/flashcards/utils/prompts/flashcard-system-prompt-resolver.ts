import type { FlashcardSubjectSnapshot } from "#api/modules/flashcards/types/flashcard-generation.types";
import { buildChemistryFlashcardSystemPrompt } from "#api/modules/flashcards/utils/prompts/chemistry-flashcard-system-prompt";
import { buildGeneralFlashcardSystemPrompt } from "#api/modules/flashcards/utils/prompts/general-flashcard-system-prompt";
import { buildMathFlashcardSystemPrompt } from "#api/modules/flashcards/utils/prompts/math-flashcard-system-prompt";
import { buildPhysicsFlashcardSystemPrompt } from "#api/modules/flashcards/utils/prompts/physics-flashcard-system-prompt";

export function buildFlashcardSubjectSystemPrompt(subject: FlashcardSubjectSnapshot) {
  switch (subject.key) {
    case "MATH":
      return buildMathFlashcardSystemPrompt(subject);
    case "PHYSICS":
      return buildPhysicsFlashcardSystemPrompt(subject);
    case "CHEMISTRY":
      return buildChemistryFlashcardSystemPrompt(subject);
    case "GENERAL":
      return buildGeneralFlashcardSystemPrompt(subject);
  }
}
