import { QuestionType } from "@prisma/client";

import {
  getGeneratedQuizStatementSolutions,
  type GeneratedQuizQuestion,
  type QuizExplanationBlock,
} from "#api/modules/quiz/types/quiz-generation.types";

const MATH_DELIMITER_PATTERN =
  /\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|(?<!\\)\$(?!\$)([^$\n]+?)(?<!\\)\$(?!\$)/gu;
const BRACED_THREE_POINT_ANGLE_PATTERN =
  /\\angle\s*\{([A-Za-z](?:['′″]|[0-9₀-₉]){0,3})([A-Za-z](?:['′″]|[0-9₀-₉]){0,3})([A-Za-z](?:['′″]|[0-9₀-₉]){0,3})\}/gu;
const THREE_POINT_ANGLE_PATTERN =
  /\\angle\s+([A-Za-z](?:['′″]|[0-9₀-₉]){0,3})([A-Za-z](?:['′″]|[0-9₀-₉]){0,3})([A-Za-z](?:['′″]|[0-9₀-₉]){0,3})(?![A-Za-z0-9_'′″₀-₉])/gu;

export function toQuizTiptap(text: string) {
  const normalizedText = normalizeQuizAngleNotation(text);
  const content: Array<Record<string, unknown>> = [];
  let inlineContent: Array<Record<string, unknown>> = [];
  const flushParagraph = () => {
    const paragraphContent = trimParagraphBoundaryWhitespace(inlineContent);
    if (paragraphContent.length > 0) {
      content.push({ type: "paragraph", content: paragraphContent });
    }
    inlineContent = [];
  };

  for (const token of tokenizeQuizMathText(normalizedText)) {
    if (token.type === "math") {
      if (token.display) {
        flushParagraph();
        content.push({ type: "blockMath", attrs: { latex: token.latex } });
      } else {
        inlineContent.push({ type: "inlineMath", attrs: { latex: token.latex } });
      }
      continue;
    }
    const lines = token.value.split(/\n+/);
    lines.forEach((line, index) => {
      if (line) inlineContent.push({ type: "text", text: line });
      if (index < lines.length - 1) flushParagraph();
    });
  }
  flushParagraph();
  return { type: "doc", content };
}

export function mapGeneratedQuizQuestion(question: GeneratedQuizQuestion) {
  const canonicalAnswer = getCanonicalQuizAnswer(question);
  const solution = getGeneratedQuizSolutionText(question);
  const block: QuizExplanationBlock = {
    type: "quizExplanation",
    problem: normalizeQuizAngleNotation(question.explanation.problem),
    solution: normalizeQuizAngleNotation(solution),
    answer: normalizeQuizAngleNotation(canonicalAnswer),
    ...("isGeometry" in question.explanation
      ? { isGeometry: question.explanation.isGeometry }
      : {}),
    origin: "AI_AUTHORED",
  };
  const common = {
    questionType: question.questionType,
    difficulty: question.difficulty,
    questionJson: toQuizTiptap(block.problem),
    hintJson: question.hint ? toQuizTiptap(question.hint) : null,
    explanationJson: toQuizTiptap(
      [block.solution, `Đáp án: ${block.answer}`].filter(Boolean).join("\n"),
    ),
    explanationBlock: block,
    recoveryIssues: [] as Array<{
      classification: "REVIEWABLE";
      code: string;
      message: string;
      technicalDetails?: string;
    }>,
  };

  switch (question.questionType) {
    case QuestionType.MULTIPLE_CHOICE:
      return {
        ...common,
        optionsJson: question.options.map((option) => ({
          id: option.id,
          richText: toQuizTiptap(option.text),
        })),
        correctAnswerJson: [question.correctOptionId],
        gradingConfigJson: null,
      };
    case QuestionType.TRUE_FALSE:
      return {
        ...common,
        optionsJson: null,
        correctAnswerJson: question.correctAnswer,
        gradingConfigJson: null,
      };
    case QuestionType.MULTI_STATEMENT_TRUE_FALSE:
      return {
        ...common,
        optionsJson: question.statements.map((statement) => ({
          id: statement.id,
          richText: toQuizTiptap(statement.text),
        })),
        correctAnswerJson: question.statements.map((statement) => ({
          statementId: statement.id,
          value: statement.value,
        })),
        gradingConfigJson: null,
      };
    case QuestionType.TEXT_INPUT:
      return {
        ...common,
        optionsJson: null,
        correctAnswerJson: [question.correctAnswer],
        gradingConfigJson: null,
      };
  }
}

export function getGeneratedQuizSolutionText(question: GeneratedQuizQuestion) {
  const statementSolutions = getGeneratedQuizStatementSolutions(question);
  if (statementSolutions) {
    return statementSolutions
      .map(({ statementId, solution }) => `**${statementId})** ${solution.trim()}`)
      .join("\n\n");
  }

  if (
    "solution" in question.explanation &&
    typeof question.explanation.solution === "string"
  ) {
    return question.explanation.solution;
  }

  throw new Error("Generated quiz explanation does not contain a solution.");
}

function getCanonicalQuizAnswer(question: GeneratedQuizQuestion) {
  if (question.questionType === QuestionType.MULTI_STATEMENT_TRUE_FALSE) {
    return question.statements
      .map((statement) => `${statement.id}) ${statement.value ? "Đúng" : "Sai"}.`)
      .join("\n");
  }
  if (question.questionType !== QuestionType.MULTIPLE_CHOICE) {
    return question.explanation.answer;
  }
  const correctOption = question.options.find(
    (option) => option.id === question.correctOptionId,
  );
  return correctOption
    ? `${question.correctOptionId}. ${correctOption.text}`
    : question.explanation.answer;
}

function tokenizeQuizMathText(value: string) {
  const tokens: Array<
    { type: "text"; value: string } | { type: "math"; display: boolean; latex: string }
  > = [];
  let cursor = 0;
  for (const match of value.matchAll(MATH_DELIMITER_PATTERN)) {
    const matchIndex = match.index ?? 0;
    if (matchIndex > cursor) {
      tokens.push({ type: "text", value: value.slice(cursor, matchIndex) });
    }
    const latex = (match[1] ?? match[2] ?? match[3] ?? match[4] ?? "").trim();
    tokens.push(
      latex
        ? {
            type: "math",
            display: match[1] !== undefined || match[2] !== undefined,
            latex,
          }
        : { type: "text", value: match[0] },
    );
    cursor = matchIndex + match[0].length;
  }
  if (cursor < value.length) tokens.push({ type: "text", value: value.slice(cursor) });
  return tokens.length > 0 ? tokens : [{ type: "text" as const, value }];
}

function normalizeQuizAngleNotation(value: string) {
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

function trimParagraphBoundaryWhitespace(nodes: Array<Record<string, unknown>>) {
  const trimmed = nodes.map((node) => ({ ...node }));
  const firstTextIndex = trimmed.findIndex((node) => node.type === "text");
  let lastTextIndex = -1;
  for (let index = trimmed.length - 1; index >= 0; index -= 1) {
    if (trimmed[index]?.type === "text") {
      lastTextIndex = index;
      break;
    }
  }
  const firstText = trimmed[firstTextIndex]?.text;
  if (firstTextIndex >= 0 && typeof firstText === "string") {
    trimmed[firstTextIndex]!.text = firstText.trimStart();
  }
  const lastText = trimmed[lastTextIndex]?.text;
  if (lastTextIndex >= 0 && typeof lastText === "string") {
    trimmed[lastTextIndex]!.text = lastText.trimEnd();
  }
  return trimmed.filter(
    (node) => node.type !== "text" || (typeof node.text === "string" && node.text),
  );
}
