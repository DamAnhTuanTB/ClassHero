import { createHash } from "node:crypto";

/**
 * Score OCR page text quality from 0.0 (very bad) to 1.0 (perfect).
 *
 * Penalties:
 * - Too little text for a page that should have content
 * - High ratio of Unicode replacement characters (U+FFFD)
 * - High ratio of control/garbage characters
 * - Very short lines suggesting broken layout
 */
export function scorePageQuality(text: string | null | undefined): number {
  if (!text || text.trim().length === 0) {
    return 0;
  }

  const trimmed = text.trim();
  let score = 1.0;

  // Penalty: very short text (likely a blank/title page or OCR failure)
  if (trimmed.length < 50) {
    score *= 0.3;
  } else if (trimmed.length < 150) {
    score *= 0.6;
  }

  // Penalty: replacement characters (U+FFFD)
  const replacementCount = countOccurrences(trimmed, "\uFFFD");
  if (replacementCount > 0) {
    const ratio = replacementCount / trimmed.length;
    score *= Math.max(0.1, 1 - ratio * 10);
  }

  // Penalty: high ratio of non-printable control characters (except newline/tab)
  const controlCount = countControlChars(trimmed);
  if (controlCount > 0) {
    const ratio = controlCount / trimmed.length;
    score *= Math.max(0.2, 1 - ratio * 5);
  }

  // Penalty: very high ratio of special/symbolic characters (might indicate garbage)
  const alphanumAndSpaceCount = countAlphanumericAndSpace(trimmed);
  const alphanumRatio = alphanumAndSpaceCount / trimmed.length;
  if (alphanumRatio < 0.3) {
    score *= 0.5;
  }

  return Math.round(score * 100) / 100;
}

/**
 * Compute content hash (SHA-256, hex) for a text string.
 */
export function computeTextHash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function countOccurrences(text: string, char: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === char) {
      count++;
    }
  }
  return count;
}

function countControlChars(text: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // Control chars except \n (10), \r (13), \t (9)
    if (code < 32 && code !== 10 && code !== 13 && code !== 9) {
      count++;
    }
  }
  return count;
}

function countAlphanumericAndSpace(text: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (
      (code >= 48 && code <= 57) || // 0-9
      (code >= 65 && code <= 90) || // A-Z
      (code >= 97 && code <= 122) || // a-z
      code === 32 || // space
      code === 10 || // newline
      code >= 192 // extended latin / Vietnamese / CJK
    ) {
      count++;
    }
  }
  return count;
}

// --- lines.json confidence integration ---

interface MathpixLine {
  type?: string;
  confidence?: number;
  confidence_rate?: number;
  text?: string;
  page?: number;
}

/**
 * Parse lines.json and extract lines for a specific page (0-indexed).
 */
export function parseLinesJsonForPage(
  linesJsonBuffer: Buffer,
  pageIndex: number,
): MathpixLine[] {
  try {
    const parsed = JSON.parse(linesJsonBuffer.toString("utf8"));

    // lines.json can be an array of pages, or an object with a "pages" array
    let allLines: MathpixLine[] = [];

    if (Array.isArray(parsed)) {
      // Flat array — filter by page field
      allLines = parsed as MathpixLine[];
    } else if (parsed.pages && Array.isArray(parsed.pages)) {
      // Pages array — get the specific page
      const page = parsed.pages[pageIndex];
      if (page && Array.isArray(page.lines)) {
        return page.lines as MathpixLine[];
      }
      return [];
    } else if (parsed.lines && Array.isArray(parsed.lines)) {
      allLines = parsed.lines as MathpixLine[];
    }

    // Filter by page index if lines have a page field
    return allLines.filter((line) => line.page === pageIndex);
  } catch {
    return [];
  }
}

/**
 * Compute average confidence from Mathpix lines for a page.
 * Returns null if no confidence data available.
 */
export function computePageConfidence(lines: MathpixLine[]): number | null {
  if (lines.length === 0) return null;

  const confidences = lines
    .map((l) => l.confidence ?? l.confidence_rate)
    .filter((c): c is number => c !== undefined && c !== null);

  if (confidences.length === 0) return null;

  const sum = confidences.reduce((a, b) => a + b, 0);
  return sum / confidences.length;
}

/**
 * Combined quality score using OCR confidence (60%) + text heuristic (40%).
 * Falls back to heuristic-only if no confidence data.
 */
export function scorePageQualityWithConfidence(
  text: string | null | undefined,
  linesJsonBuffer?: Buffer | null,
  pageIndex?: number,
): number {
  const heuristicScore = scorePageQuality(text);

  if (!linesJsonBuffer || pageIndex === undefined) {
    return heuristicScore;
  }

  const lines = parseLinesJsonForPage(linesJsonBuffer, pageIndex);
  const confidence = computePageConfidence(lines);

  if (confidence === null) {
    return heuristicScore;
  }

  // Combined: 60% OCR confidence + 40% heuristic
  const combined = 0.6 * confidence + 0.4 * heuristicScore;
  return Math.round(combined * 100) / 100;
}
