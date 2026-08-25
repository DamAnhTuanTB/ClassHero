export function buildLessonSummaryFigureAltText(input: {
  block: unknown;
  sectionHeading: string;
}) {
  const block = readRecord(input.block);
  const subject =
    normalizeText(block?.title) ??
    normalizeText(block?.problem) ??
    normalizeText(input.sectionHeading) ??
    "nội dung bài học";
  return `Hình minh họa cho ${subject}`.slice(0, 500);
}

function normalizeText(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.replaceAll(/\s+/gu, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
