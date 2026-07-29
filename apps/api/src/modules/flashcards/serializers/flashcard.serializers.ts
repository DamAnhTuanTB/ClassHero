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

export function serializeStudentFlashcardSet(
  record: StudentFlashcardSetRecord,
  progressByCardId: Map<
    string,
    { isKnown: boolean; lastReviewedAt: Date; reviewCount: number }
  > = new Map(),
  favoriteCardIds: Set<string> = new Set(),
) {
  const progress = record.flashcards.map((flashcard) =>
    progressByCardId.get(flashcard.id),
  );
  const reviewedCount = progress.filter(Boolean).length;
  const knownCount = progress.filter((entry) => entry?.isKnown === true).length;
  return {
    ...record,
    cardCount: record.flashcards.length,
    flashcards: record.flashcards.map(({ explanation, ...flashcard }) => ({
      ...flashcard,
      progress: progressByCardId.get(flashcard.id) ?? null,
      isFavorite: favoriteCardIds.has(flashcard.id),
      explanation:
        explanation?.reviewStatus === "APPROVED"
          ? { contentJson: explanation.contentJson }
          : null,
    })),
    progress: {
      totalCount: record.flashcards.length,
      reviewedCount,
      knownCount,
      unknownCount: reviewedCount - knownCount,
      unreviewedCount: record.flashcards.length - reviewedCount,
      isCompleted:
        record.flashcards.length === 0 || reviewedCount === record.flashcards.length,
    },
  };
}
