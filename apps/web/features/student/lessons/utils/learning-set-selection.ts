export function getNextLearningSet<T extends { id: string }>(
  sets: readonly T[],
  currentSetId: string,
): T {
  if (sets.length === 0) {
    throw new Error("Không có bộ nội dung học tập khả dụng");
  }

  const currentIndex = sets.findIndex((set) => set.id === currentSetId);
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % sets.length;

  return sets[nextIndex] ?? sets[0]!;
}
