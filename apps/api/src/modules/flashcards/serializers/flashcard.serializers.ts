import type {
  AdminFlashcardRecord,
  AdminFlashcardSetRecord,
  StudentFlashcardSetRecord,
} from "#api/modules/flashcards/selectors/flashcard.selects";

export function serializeAdminFlashcardSet(record: AdminFlashcardSetRecord) {
  const { _count, ...set } = record;
  return {
    ...set,
    cardCount: _count.flashcards,
  };
}

export function serializeAdminFlashcard(record: AdminFlashcardRecord) {
  return record;
}

export function serializeStudentFlashcardSet(record: StudentFlashcardSetRecord) {
  return {
    ...record,
    cardCount: record.flashcards.length,
    flashcards: record.flashcards.map(({ explanation, ...flashcard }) => ({
      ...flashcard,
      explanation:
        explanation?.reviewStatus === "APPROVED"
          ? { contentJson: explanation.contentJson }
          : null,
    })),
  };
}
