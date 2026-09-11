import type {
  GeneratedQuizQuestion,
  QuizExplanationBlock,
} from "#api/modules/quiz/types/quiz-generation.types";
import { normalizeGeneratedQuizQuestionLatex } from "#api/modules/quiz/utils/quiz-generation-math-normalizer";

const CONCLUSION_START_PATTERN = /(?:Vậy|Vì vậy|Do đó|Suy ra)(?=[\s,]|$)/giu;

/**
 * Keeps the final learner-facing conclusion in its own Markdown paragraph.
 * Prompt/schema descriptions guide the provider, while this deterministic
 * boundary guarantees the presentation invariant before persistence.
 */
export function normalizeQuizConclusionParagraph(value: string) {
  const normalized = value.trim();
  const conclusionStarts = Array.from(normalized.matchAll(CONCLUSION_START_PATTERN));
  let conclusionStart: number | undefined;

  for (let index = conclusionStarts.length - 1; index >= 0; index -= 1) {
    const matchIndex = conclusionStarts[index]?.index;
    if (
      matchIndex !== undefined &&
      (matchIndex === 0 || /\s/u.test(normalized[matchIndex - 1] ?? ""))
    ) {
      conclusionStart = matchIndex;
      break;
    }
  }

  if (conclusionStart === undefined || conclusionStart === 0) return normalized;

  const precedingSource = normalized.slice(0, conclusionStart);
  const precedingContent = precedingSource.trimEnd();
  const conclusion = normalized.slice(conclusionStart).trim();
  if (!precedingContent || !conclusion) return normalized;
  if (!hasConclusionBoundary(precedingSource, precedingContent)) return normalized;

  return `${precedingContent}\n\n${conclusion}`;
}

function hasConclusionBoundary(precedingSource: string, precedingContent: string) {
  return (
    /\n\s*$/u.test(precedingSource) ||
    /[.!?:;。]$/u.test(precedingContent) ||
    /(?:\$|\\\])$/u.test(precedingContent) ||
    /\\end\{[A-Za-z][A-Za-z0-9*]*\}$/u.test(precedingContent)
  );
}

export function normalizeQuizExplanationBlock(
  block: QuizExplanationBlock,
): QuizExplanationBlock {
  return {
    ...block,
    solution: normalizeQuizConclusionParagraph(block.solution),
  };
}

export function normalizeGeneratedQuizQuestionContent(
  question: GeneratedQuizQuestion,
): GeneratedQuizQuestion {
  return normalizeGeneratedQuizConclusionValues(
    normalizeGeneratedQuizQuestionLatex(question),
  );
}

function normalizeGeneratedQuizConclusionValues<T>(value: T, key?: string): T {
  if (typeof value === "string") {
    return (key === "solution" ? normalizeQuizConclusionParagraph(value) : value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeGeneratedQuizConclusionValues(item)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, item]) => [
        entryKey,
        normalizeGeneratedQuizConclusionValues(item, entryKey),
      ]),
    ) as T;
  }
  return value;
}
