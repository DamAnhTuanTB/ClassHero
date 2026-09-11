import { normalizeLearnerMathTextSyntax } from "@learning-path/shared";

import type { GeneratedQuizQuestion } from "#api/modules/quiz/types/quiz-generation.types";

/**
 * Repairs deterministic LaTeX-environment defects in newly generated Quiz data.
 * The function is deliberately non-throwing so formatting recovery never blocks
 * a valid structured AI output from continuing to persistence.
 */
export function normalizeGeneratedQuizQuestionLatex(
  question: GeneratedQuizQuestion,
): GeneratedQuizQuestion {
  return normalizeGeneratedQuizValue(question);
}

/**
 * Repairs the provider defect `$math`` where an inline-math opener is closed
 * with a Markdown backtick. Backticks inside an actual Markdown code span are
 * preserved, and only short, math-like inline content is repaired.
 */
export function normalizeQuizInlineMathDelimiters(value: string) {
  let normalized = "";
  let cursor = 0;
  let codeDelimiterLength = 0;
  let inlineMathContentStart: number | null = null;
  let inDisplayMath = false;

  while (cursor < value.length) {
    const character = value[cursor]!;

    if (character === "\\" && cursor + 1 < value.length) {
      normalized += value.slice(cursor, cursor + 2);
      cursor += 2;
      continue;
    }

    if (character === "`") {
      const delimiterLength = countRepeatedCharacter(value, cursor, "`");
      if (codeDelimiterLength > 0) {
        if (delimiterLength === codeDelimiterLength) codeDelimiterLength = 0;
        normalized += value.slice(cursor, cursor + delimiterLength);
        cursor += delimiterLength;
        continue;
      }

      if (
        !inDisplayMath &&
        inlineMathContentStart !== null &&
        delimiterLength === 1 &&
        isRepairableInlineMathContent(value.slice(inlineMathContentStart, cursor)) &&
        isInlineMathClosingBoundary(value[cursor + 1])
      ) {
        normalized += "$";
        inlineMathContentStart = null;
        cursor += 1;
        continue;
      }

      if (inlineMathContentStart === null && !inDisplayMath) {
        codeDelimiterLength = delimiterLength;
      }
      normalized += value.slice(cursor, cursor + delimiterLength);
      cursor += delimiterLength;
      continue;
    }

    if (codeDelimiterLength === 0 && character === "$") {
      const delimiterLength = countRepeatedCharacter(value, cursor, "$");
      if (delimiterLength >= 2) {
        inDisplayMath = !inDisplayMath;
        inlineMathContentStart = null;
      } else if (!inDisplayMath) {
        inlineMathContentStart = inlineMathContentStart === null ? cursor + 1 : null;
      }
      normalized += value.slice(cursor, cursor + delimiterLength);
      cursor += delimiterLength;
      continue;
    }

    if (character === "\n" && inlineMathContentStart !== null) {
      inlineMathContentStart = null;
    }
    normalized += character;
    cursor += 1;
  }

  return normalized;
}

function countRepeatedCharacter(value: string, start: number, character: string) {
  let end = start + 1;
  while (value[end] === character) end += 1;
  return end - start;
}

function isRepairableInlineMathContent(content: string) {
  const trimmed = content.trim();
  return (
    trimmed.length > 0 &&
    trimmed.length <= 500 &&
    !trimmed.includes("\n") &&
    (/[0-9\\^_=+\-*/<>()[\]{}]/u.test(trimmed) ||
      /^[A-Za-z](?:[A-Za-z0-9]|['′″]|[₀-₉]){0,7}$/u.test(trimmed))
  );
}

function isInlineMathClosingBoundary(character: string | undefined) {
  return character === undefined || /[\s.,;:!?)]/u.test(character);
}

function normalizeGeneratedQuizValue<T>(value: T): T {
  if (typeof value === "string") {
    return normalizeLearnerMathTextSyntax(normalizeQuizInlineMathDelimiters(value)) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeGeneratedQuizValue(item)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        normalizeGeneratedQuizValue(item),
      ]),
    ) as T;
  }
  return value;
}
