import { normalizeMathTextLatexCommands } from "@learning-path/shared";

import type { GeneratedQuizQuestion } from "#api/modules/quiz/types/quiz-generation.types";

const DISPLAY_MATH_BLOCK_PATTERN = /\$\$([\s\S]*?)\$\$/gu;
const LATEX_ENVIRONMENT_TOKEN_PATTERN = /\\(begin|end)\{([A-Za-z][A-Za-z0-9*]*)\}/gu;
const MISPLACED_DISPLAY_MATH_CLOSER_PATTERN =
  /\$\$(?=(?:\s*\\end\{[A-Za-z][A-Za-z0-9*]*\})+\s*\$\$)/gu;

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

export function normalizeQuizDisplayMathEnvironments(value: string) {
  return value
    .replace(MISPLACED_DISPLAY_MATH_CLOSER_PATTERN, "")
    .replace(
      DISPLAY_MATH_BLOCK_PATTERN,
      (_block, content: string) => `$$${balanceLatexEnvironments(content)}$$`,
    );
}

function balanceLatexEnvironments(content: string) {
  const openEnvironments: string[] = [];
  let normalized = "";
  let cursor = 0;

  for (const match of content.matchAll(LATEX_ENVIRONMENT_TOKEN_PATTERN)) {
    const tokenIndex = match.index;
    const operation = match[1];
    const environmentName = match[2];
    if (tokenIndex === undefined || !operation || !environmentName) continue;

    normalized += content.slice(cursor, tokenIndex);
    if (operation === "begin") {
      normalized += match[0];
      openEnvironments.push(environmentName);
    } else {
      const matchingOpenIndex = openEnvironments.lastIndexOf(environmentName);
      if (matchingOpenIndex >= 0) {
        while (openEnvironments.length - 1 > matchingOpenIndex) {
          normalized += `\\end{${openEnvironments.pop()!}}`;
        }
        normalized += match[0];
        openEnvironments.pop();
      }
      // An orphan closing token is removed because it cannot represent valid
      // nested LaTeX and retaining it would force KaTeX into its error fallback.
    }
    cursor = tokenIndex + match[0].length;
  }

  normalized += content.slice(cursor);
  while (openEnvironments.length > 0) {
    normalized += `\\end{${openEnvironments.pop()!}}`;
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
    return normalizeQuizDisplayMathEnvironments(
      normalizeMathTextLatexCommands(normalizeQuizInlineMathDelimiters(value)),
    ) as T;
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
