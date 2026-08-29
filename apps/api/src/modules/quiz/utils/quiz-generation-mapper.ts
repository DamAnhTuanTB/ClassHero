import {
  normalizeMathTextLatexCommands,
  normalizeMissingInlineMathClosers,
  tokenizeMathText,
} from "@learning-path/shared";
import { QuestionType } from "@prisma/client";

import {
  getGeneratedQuizStatementSolutions,
  type GeneratedQuizQuestion,
  type QuizExplanationBlock,
} from "#api/modules/quiz/types/quiz-generation.types";

const BRACED_THREE_POINT_ANGLE_PATTERN =
  /\\angle\s*\{([A-Za-z](?:['′″]|[0-9₀-₉]){0,3})([A-Za-z](?:['′″]|[0-9₀-₉]){0,3})([A-Za-z](?:['′″]|[0-9₀-₉]){0,3})\}/gu;
const THREE_POINT_ANGLE_PATTERN =
  /\\angle\s+([A-Za-z](?:['′″]|[0-9₀-₉]){0,3})([A-Za-z](?:['′″]|[0-9₀-₉]){0,3})([A-Za-z](?:['′″]|[0-9₀-₉]){0,3})(?![A-Za-z0-9_'′″₀-₉])/gu;

export function toQuizTiptap(text: string) {
  const normalizedText = normalizeMathTextLatexCommands(
    normalizeMissingInlineMathClosers(normalizeQuizAngleNotation(text)),
  );
  const content: Array<Record<string, unknown>> = [];
  let inlineContent: Array<Record<string, unknown>> = [];
  const flushParagraph = () => {
    const paragraphContent = trimParagraphBoundaryWhitespace(inlineContent);
    if (paragraphContent.length > 0) {
      content.push({ type: "paragraph", content: paragraphContent });
    }
    inlineContent = [];
  };

  for (const token of tokenizeMathText(normalizedText)) {
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
      [block.solution, `Đáp án: ${normalizeQuizAngleNotation(canonicalAnswer)}`]
        .filter(Boolean)
        .join("\n"),
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
  if (question.questionType === QuestionType.TRUE_FALSE) {
    return question.correctAnswer ? "Đúng." : "Sai.";
  }
  if (question.questionType === QuestionType.TEXT_INPUT) {
    return question.correctAnswer;
  }
  const correctOption = question.options.find(
    (option) => option.id === question.correctOptionId,
  );
  if (!correctOption) {
    throw new Error("Generated Quiz correctOptionId does not match any option.");
  }
  return `${question.correctOptionId}. ${correctOption.text}`;
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
  const firstTextIndex = trimmed[0]?.type === "text" ? 0 : -1;
  const lastIndex = trimmed.length - 1;
  const lastTextIndex = trimmed[lastIndex]?.type === "text" ? lastIndex : -1;
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
