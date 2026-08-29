const LEADING_NOTE_LABEL_PATTERN =
  /^\s*(?:(?:\*\*|__)\s*)?(?:chú\s*ý|lưu\s*ý|nhận\s*xét)(?:\s+\d+)?\s*(?:rằng\b\s*)?(?:[:：,.;\-–—]\s*)?(?:(?:\*\*|__)\s*)?(?:[:：,.;\-–—]\s*)?/iu;

const MATH_DELIMITER_PATTERN =
  /\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|(?<!\\)\$(?!\$)((?:\\.|[^$\\\n])+?)(?<!\\)\$(?!\$)/gu;

export type MathTextToken =
  { type: "text"; value: string } | { type: "math"; display: boolean; latex: string };

/**
 * The note block already owns a visible label in the UI. Remove only a repeated
 * leading label from generated or legacy content and preserve the explanation.
 */
export function normalizeLessonSummaryNoteContent(value: string) {
  const trimmed = value.trim();
  return trimmed.replace(LEADING_NOTE_LABEL_PATTERN, "").trim();
}

/**
 * Accept the delimiter styles seen in provider output and legacy Quiz rows.
 * New content is converted to native Tiptap math nodes; renderers also use this
 * tokenizer as a compatibility fallback so raw delimiters never leak into UI.
 */
export function tokenizeMathText(value: string): MathTextToken[] {
  const tokens: MathTextToken[] = [];
  let cursor = 0;

  for (const match of value.matchAll(MATH_DELIMITER_PATTERN)) {
    const matchIndex = match.index ?? 0;
    if (matchIndex > cursor) {
      tokens.push({ type: "text", value: value.slice(cursor, matchIndex) });
    }

    const latex = (match[1] ?? match[2] ?? match[3] ?? match[4] ?? "").trim();
    if (latex) {
      tokens.push({
        type: "math",
        display: match[1] !== undefined || match[2] !== undefined,
        latex,
      });
    } else {
      tokens.push({ type: "text", value: match[0] });
    }
    cursor = matchIndex + match[0].length;
  }

  if (cursor < value.length) {
    tokens.push({ type: "text", value: value.slice(cursor) });
  }

  return tokens.length > 0 ? tokens : [{ type: "text", value }];
}

const BRACED_THREE_POINT_ANGLE_PATTERN =
  /\\angle\s*\{([A-Za-z](?:['′″]|[0-9₀-₉]){0,3})([A-Za-z](?:['′″]|[0-9₀-₉]){0,3})([A-Za-z](?:['′″]|[0-9₀-₉]){0,3})\}/gu;
const THREE_POINT_ANGLE_PATTERN =
  /\\angle\s+([A-Za-z](?:['′″]|[0-9₀-₉]){0,3})([A-Za-z](?:['′″]|[0-9₀-₉]){0,3})([A-Za-z](?:['′″]|[0-9₀-₉]){0,3})(?![A-Za-z0-9_'′″₀-₉])/gu;

/**
 * Normalize three-point angle notation without depending on a renderer-specific
 * geometry model. TeX figures own their labels and geometry independently.
 */
export function normalizeLessonSummaryAngleNotation(
  value: string,
  _legacyDiagramSpec?: unknown,
) {
  return value
    .replace(
      BRACED_THREE_POINT_ANGLE_PATTERN,
      (_, first: string, vertex: string, second: string) =>
        `\\widehat{${first}${vertex}${second}}`,
    )
    .replace(
      THREE_POINT_ANGLE_PATTERN,
      (_, first: string, vertex: string, second: string) =>
        `\\widehat{${first}${vertex}${second}}`,
    );
}
