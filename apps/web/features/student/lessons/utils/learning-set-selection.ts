export function getNextLearningSet<T extends { id: string }>(
  sets: readonly T[],
  currentSetId: string,
  isAvailable: (set: T) => boolean = () => true,
): T {
  if (sets.length === 0) {
    throw new Error("Không có bộ nội dung học tập khả dụng");
  }

  const currentIndex = sets.findIndex((set) => set.id === currentSetId);
  const startIndex = currentIndex < 0 ? -1 : currentIndex;

  for (let offset = 1; offset <= sets.length; offset += 1) {
    const candidate = sets[(startIndex + offset) % sets.length];
    if (candidate && isAvailable(candidate)) {
      return candidate;
    }
  }

  throw new Error("Không có bộ nội dung học tập khả dụng");
}
