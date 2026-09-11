import {
  hasMalformedMathText,
  normalizeLearnerMathTextSyntax,
  normalizeThreePointAngleNotation,
  tokenizeMathText,
} from "@learning-path/shared";
import { QuestionType } from "@prisma/client";

import {
  getGeneratedQuizStatementSolutions,
  type GeneratedQuizQuestion,
  type QuizExplanationBlock,
} from "#api/modules/quiz/types/quiz-generation.types";
import { normalizeQuizInlineMathDelimiters } from "#api/modules/quiz/utils/quiz-generation-math-normalizer";

export function toQuizTiptap(text: string) {
  return toQuizTiptapDocument(text, false);
}

export function toQuizSolutionTiptap(text: string) {
  return toQuizTiptapDocument(text, true);
}

function toQuizTiptapDocument(text: string, parseStrongMarkdown: boolean) {
  const normalizedText = normalizeQuizLearnerText(text);
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
      if (line) {
        inlineContent.push(
          ...(parseStrongMarkdown ? parseStrongMarkdownText(line) : [textNode(line)]),
        );
      }
      if (index < lines.length - 1) flushParagraph();
    });
  }
  flushParagraph();
  return { type: "doc", content };
}

export function mapGeneratedQuizQuestion(question: GeneratedQuizQuestion) {
  const solution = getGeneratedQuizSolutionText(question);
  const block: QuizExplanationBlock = {
    type: "quizExplanation",
    problem: normalizeQuizLearnerText(question.explanation.problem),
    solution: normalizeQuizLearnerText(solution),
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
    explanationJson: toQuizSolutionTiptap(block.solution),
    explanationBlock: block,
    recoveryIssues: collectQuizMathSyntaxIssues(question) as Array<{
      classification: "REVIEWABLE";
      code: string;
      message: string;
      technicalDetails?: string;
      blocking: false;
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

export function normalizeQuizLearnerText(value: string) {
  return normalizeLearnerMathTextSyntax(
    normalizeQuizInlineMathDelimiters(normalizeThreePointAngleNotation(value)),
  );
}

function collectQuizMathSyntaxIssues(question: GeneratedQuizQuestion) {
  const candidates: Array<{ path: string; value: string }> = [
    { path: "explanation.problem", value: question.explanation.problem },
    { path: "explanation.solution", value: getGeneratedQuizSolutionText(question) },
    ...(question.hint ? [{ path: "hint", value: question.hint }] : []),
    ...(question.questionType === QuestionType.MULTIPLE_CHOICE
      ? question.options.map((option, index) => ({
          path: `options.${index}.text`,
          value: option.text,
        }))
      : []),
    ...(question.questionType === QuestionType.MULTI_STATEMENT_TRUE_FALSE
      ? question.statements.map((statement, index) => ({
          path: `statements.${index}.text`,
          value: statement.text,
        }))
      : []),
  ];
  const malformed = candidates.filter(({ value }) =>
    hasMalformedMathText(normalizeQuizLearnerText(value)),
  );
  if (malformed.length === 0) return [];
  return [
    {
      classification: "REVIEWABLE" as const,
      code: "MALFORMED_LATEX",
      message:
        "Một số công thức LaTeX vẫn chưa cân bằng sau bước chuẩn hóa; cần admin kiểm tra.",
      technicalDetails: `paths=${malformed.map(({ path }) => path).join(",")}`,
      blocking: false as const,
    },
  ];
}

function parseStrongMarkdownText(value: string): Array<Record<string, unknown>> {
  const nodes: Array<Record<string, unknown>> = [];
  const pattern = /\*\*(\S(?:[^*\n]*?\S)?)\*\*|__(\S(?:[^_\n]*?\S)?)__/gu;
  let cursor = 0;

  for (const match of value.matchAll(pattern)) {
    const start = match.index;
    if (start > cursor) nodes.push(textNode(value.slice(cursor, start)));
    nodes.push({
      ...textNode(match[1] ?? match[2] ?? ""),
      marks: [{ type: "bold" }],
    });
    cursor = start + match[0].length;
  }

  if (cursor < value.length) nodes.push(textNode(value.slice(cursor)));
  return nodes.length > 0 ? nodes : [textNode(value)];
}

function textNode(text: string): Record<string, unknown> {
  return { type: "text", text };
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
