const DISPLAY_MATH_BLOCK_PATTERN = /\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]/gu;
const TERMINAL_PERIOD_PATTERN = /([^\s.])\.(\s*)$/u;
const INVISIBLE_RIGHT_DELIMITER_PATTERN = /\\right\s*\.\s*$/u;
const QUIZ_ANSWER_OPTION_PREFIX_PATTERN = /^([A-Z]+)\s*[.)]\s*/iu;
const QUIZ_ANSWER_OPTION_LABEL_PATTERN = /^[A-Z]+$/iu;
const QUIZ_CANONICAL_FRACTION_PATTERN = /^(-?)(0|[1-9]\d*)\/([1-9]\d*)$/u;

export type QuizExplanationQuestionType =
  | "MULTIPLE_CHOICE"
  | "TRUE_FALSE"
  | "MULTI_STATEMENT_TRUE_FALSE"
  | "TEXT_INPUT";

export function resolveQuizCorrectAnswerDisplay({
  correctAnswer,
  optionIds = [],
  questionType,
}: {
  correctAnswer: unknown;
  optionIds?: readonly string[];
  questionType: QuizExplanationQuestionType;
}): { content: string; optionLabel: string | null } | null {
  if (questionType === "MULTIPLE_CHOICE") {
    const correctOptionId = readStringAnswers(correctAnswer)[0];
    if (!correctOptionId) return null;
    const optionIndex = optionIds.indexOf(correctOptionId);
    const optionLabel =
      optionIndex >= 0
        ? answerOptionLabel(optionIndex)
        : QUIZ_ANSWER_OPTION_LABEL_PATTERN.test(correctOptionId)
          ? correctOptionId.toUpperCase()
          : null;
    return {
      content: optionLabel ?? correctOptionId,
      optionLabel,
    };
  }

  if (questionType === "TRUE_FALSE") {
    return typeof correctAnswer === "boolean"
      ? { content: correctAnswer ? "Đúng" : "Sai", optionLabel: null }
      : null;
  }

  if (questionType === "MULTI_STATEMENT_TRUE_FALSE") {
    const answers = readStatementAnswers(correctAnswer);
    if (answers.length === 0) return null;
    const answerById = new Map(
      answers.map((answer) => [answer.statementId, answer.value]),
    );
    const orderedIds =
      optionIds.length > 0 ? optionIds : answers.map((answer) => answer.statementId);
    const items = orderedIds.flatMap((statementId, index) => {
      const value = answerById.get(statementId);
      return value === undefined
        ? []
        : [`${answerOptionLabel(index).toLowerCase()}) ${value ? "Đúng" : "Sai"}`];
    });
    return items.length > 0 ? { content: items.join("\n"), optionLabel: null } : null;
  }

  const answers = readStringAnswers(correctAnswer);
  return answers.length > 0
    ? {
        content: answers.map(formatCanonicalFractionForDisplay).join(" hoặc "),
        optionLabel: null,
      }
    : null;
}

export function resolveQuizAnswerOptionDisplay(
  value: string,
  explicitOptionId: string | null | undefined,
) {
  const prefixMatch = value.match(QUIZ_ANSWER_OPTION_PREFIX_PATTERN);
  const explicitLabel = explicitOptionId?.trim();
  const optionLabel =
    prefixMatch?.[1]?.toUpperCase() ??
    (explicitLabel && QUIZ_ANSWER_OPTION_LABEL_PATTERN.test(explicitLabel)
      ? explicitLabel.toUpperCase()
      : null);

  return {
    content: prefixMatch ? value.slice(prefixMatch[0].length).trim() : value,
    optionLabel,
  };
}

export function removeQuizDisplayMathTerminalPeriods(value: string) {
  return value.replace(
    DISPLAY_MATH_BLOCK_PATTERN,
    (block, dollarContent: string | undefined, bracketContent: string | undefined) => {
      const content = dollarContent ?? bracketContent ?? "";
      // `\right.` closes a scalable delimiter with an invisible right-hand side.
      // Its dot is LaTeX syntax, not sentence punctuation, and must be preserved.
      if (INVISIBLE_RIGHT_DELIMITER_PATTERN.test(content)) return block;

      const normalizedContent = content.replace(TERMINAL_PERIOD_PATTERN, "$1$2");

      if (normalizedContent === content) return block;
      return dollarContent === undefined
        ? `\\[${normalizedContent}\\]`
        : `$$${normalizedContent}$$`;
    },
  );
}

function readStringAnswers(value: unknown) {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) =>
    typeof item === "string" && item.trim() ? [item.trim()] : [],
  );
}

function formatCanonicalFractionForDisplay(value: string) {
  const fraction = value.match(QUIZ_CANONICAL_FRACTION_PATTERN);
  if (!fraction) return value;

  const [, sign, numerator, denominator] = fraction;
  return `$${sign}\\frac{${numerator}}{${denominator}}$`;
}

function readStatementAnswers(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const answer = item as Record<string, unknown>;
    return typeof answer.statementId === "string" && typeof answer.value === "boolean"
      ? [{ statementId: answer.statementId, value: answer.value }]
      : [];
  });
}

function answerOptionLabel(index: number) {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}
