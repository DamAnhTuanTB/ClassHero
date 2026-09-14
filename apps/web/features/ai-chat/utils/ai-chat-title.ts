export function createOptimisticAiChatTitle(question: string) {
  const compact = question.replace(/\s+/gu, " ").trim();
  return compact.length <= 80 ? compact : `${compact.slice(0, 77).trimEnd()}…`;
}
