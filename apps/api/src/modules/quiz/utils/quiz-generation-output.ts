import { QuestionType } from "@prisma/client";

export type QuizGenerationQuestionReference = {
  aiGenerationId: string;
  generationQuestionIndex: number;
};

export type CurrentQuizQuestionJsonSource = {
  questionType: QuestionType;
  difficulty: string;
  questionJson: unknown;
  optionsJson: unknown;
  correctAnswerJson: unknown;
  hintJson: unknown;
  sourceMetadataJson: unknown;
  explanation: { contentJson: unknown } | null;
};

export function readQuizGenerationQuestionReference(
  value: unknown,
): QuizGenerationQuestionReference | null {
  if (!isRecord(value)) return null;
  if (typeof value.aiGenerationId !== "string" || value.aiGenerationId.length === 0) {
    return null;
  }
  if (
    typeof value.generationQuestionIndex !== "number" ||
    !Number.isInteger(value.generationQuestionIndex) ||
    value.generationQuestionIndex < 0
  ) {
    return null;
  }
  return {
    aiGenerationId: value.aiGenerationId,
    generationQuestionIndex: value.generationQuestionIndex,
  };
}

export function readQuizGenerationQuestion(
  outputJson: unknown,
  questionIndex: number,
): Record<string, unknown> | null {
  if (!isRecord(outputJson) || !Array.isArray(outputJson.questions)) return null;
  const question = outputJson.questions[questionIndex];
  return isRecord(question) ? stripQuizGeometryStatementFromQuestion(question) : null;
}

export function stripQuizGeometryStatementFromMetadata(value: unknown) {
  if (!isRecord(value)) return value;
  const metadata = cloneJsonRecord(value);
  if (!isRecord(metadata.quizExplanationBlock)) return metadata;
  const explanationBlock = cloneJsonRecord(metadata.quizExplanationBlock);
  delete explanationBlock.geometryStatement;
  delete explanationBlock.answer;
  metadata.quizExplanationBlock = explanationBlock;
  return metadata;
}

/** @deprecated Use readQuizGenerationQuestion; outputJson is a mutable snapshot. */
export const readRawProviderQuizQuestion = readQuizGenerationQuestion;

/**
 * Builds the current provider-shaped Quiz question before it is written back to
 * the mutable AI generation output. Provider-only fields such as the figure
 * decision remain intact while editable fields come from the persisted Quiz.
 */
export function buildCurrentQuizQuestionJson(
  question: CurrentQuizQuestionJsonSource,
  generationQuestionJson: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!generationQuestionJson) return null;

  const current = cloneJsonRecord(generationQuestionJson);
  current.questionType = question.questionType;
  current.difficulty = question.difficulty;
  current.hint = serializeQuizRichText(question.hintJson) || null;

  const explanation = isRecord(current.explanation)
    ? cloneJsonRecord(current.explanation)
    : {};
  delete explanation.geometryStatement;
  delete explanation.answer;
  const currentExplanationBlock = readCurrentExplanationBlock(
    question.sourceMetadataJson,
  );
  const currentExplanationText = serializeQuizRichText(question.explanation?.contentJson);
  explanation.problem = serializeQuizRichText(question.questionJson);

  if (
    currentExplanationBlock &&
    question.questionType !== QuestionType.MULTI_STATEMENT_TRUE_FALSE
  ) {
    explanation.solution = currentExplanationBlock.solution;
    if (typeof currentExplanationBlock.isGeometry === "boolean") {
      explanation.isGeometry = currentExplanationBlock.isGeometry;
    }
  } else {
    if (currentExplanationText) {
      explanation.solution = currentExplanationText;
      if (question.questionType === QuestionType.MULTI_STATEMENT_TRUE_FALSE) {
        delete explanation.statementSolutions;
      }
    }
  }
  current.explanation = explanation;

  delete current.options;
  delete current.correctOptionId;
  delete current.correctAnswer;
  delete current.statements;

  switch (question.questionType) {
    case QuestionType.MULTIPLE_CHOICE: {
      const options = readQuizOptions(question.optionsJson);
      current.options = options;
      current.correctOptionId = readStringAnswers(question.correctAnswerJson)[0] ?? null;
      break;
    }
    case QuestionType.TRUE_FALSE:
      current.correctAnswer =
        typeof question.correctAnswerJson === "boolean"
          ? question.correctAnswerJson
          : null;
      break;
    case QuestionType.MULTI_STATEMENT_TRUE_FALSE: {
      const answerByStatementId = new Map(
        readMultiStatementAnswers(question.correctAnswerJson).map((answer) => [
          answer.statementId,
          answer.value,
        ]),
      );
      current.statements = readQuizOptions(question.optionsJson).map((statement) => ({
        id: statement.id,
        text: statement.text,
        value: answerByStatementId.get(statement.id) ?? null,
      }));
      break;
    }
    case QuestionType.TEXT_INPUT: {
      const acceptedAnswers = readStringAnswers(question.correctAnswerJson);
      current.correctAnswer = acceptedAnswers[0] ?? null;
      break;
    }
  }

  return current;
}

export function updateQuizGenerationQuestionOutput(
  outputJson: unknown,
  questionIndex: number,
  question: CurrentQuizQuestionJsonSource,
): Record<string, unknown> | null {
  if (!isRecord(outputJson) || !Array.isArray(outputJson.questions)) return null;

  const currentQuestion = buildCurrentQuizQuestionJson(
    question,
    readQuizGenerationQuestion(outputJson, questionIndex),
  );
  if (!currentQuestion) return null;

  const currentOutput = cloneJsonRecord(outputJson);
  const questions = [...outputJson.questions];
  questions[questionIndex] = currentQuestion;
  currentOutput.questions = questions;
  return currentOutput;
}

export function replaceQuizGenerationQuestionOutput(
  outputJson: unknown,
  questionIndex: number,
  generationQuestionJson: Record<string, unknown>,
): Record<string, unknown> | null {
  if (!isRecord(outputJson) || !Array.isArray(outputJson.questions)) return null;
  if (questionIndex < 0 || questionIndex >= outputJson.questions.length) return null;

  const currentOutput = cloneJsonRecord(outputJson);
  const questions = [...outputJson.questions];
  questions[questionIndex] =
    stripQuizGeometryStatementFromQuestion(generationQuestionJson);
  currentOutput.questions = questions;
  return currentOutput;
}

function stripQuizGeometryStatementFromQuestion(
  question: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized = cloneJsonRecord(question);
  if (!isRecord(sanitized.explanation)) return sanitized;
  const explanation = cloneJsonRecord(sanitized.explanation);
  delete explanation.geometryStatement;
  delete explanation.answer;
  sanitized.explanation = explanation;
  return sanitized;
}

function readQuizOptions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((option) => {
    if (!isRecord(option) || typeof option.id !== "string") return [];
    return [
      {
        id: option.id,
        text: serializeQuizRichText(option.richText),
      },
    ];
  });
}

function readStringAnswers(value: unknown) {
  return Array.isArray(value)
    ? value.filter((answer): answer is string => typeof answer === "string")
    : [];
}

function readMultiStatementAnswers(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((answer) => {
    if (
      !isRecord(answer) ||
      typeof answer.statementId !== "string" ||
      typeof answer.value !== "boolean"
    ) {
      return [];
    }
    return [{ statementId: answer.statementId, value: answer.value }];
  });
}

function readCurrentExplanationBlock(value: unknown) {
  if (!isRecord(value) || !isRecord(value.quizExplanationBlock)) return null;
  const block = value.quizExplanationBlock;
  if (
    block.type !== "quizExplanation" ||
    (block.solution !== null && typeof block.solution !== "string")
  ) {
    return null;
  }
  return block;
}

export function serializeQuizRichText(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(serializeQuizRichText).filter(Boolean).join("\n").trim();
  }
  if (!isRecord(value)) return "";

  if (typeof value.text === "string") return value.text;
  const attrs = isRecord(value.attrs) ? value.attrs : null;
  if (value.type === "inlineMath" && typeof attrs?.latex === "string") {
    return `$${attrs.latex}$`;
  }
  if (value.type === "blockMath" && typeof attrs?.latex === "string") {
    return `$$${attrs.latex}$$`;
  }
  if (value.type === "hardBreak") return "\n";
  if (value.type === "image") {
    return typeof attrs?.alt === "string" && attrs.alt.trim()
      ? `[Hình ảnh: ${attrs.alt.trim()}]`
      : "[Hình ảnh]";
  }
  if (value.type === "table") return "[Bảng]";

  const content = Array.isArray(value.content)
    ? value.content.map(serializeQuizRichText).filter(Boolean)
    : [];
  const separator = isQuizBlockNode(value.type) ? "\n" : "";
  return content.join(separator).trim();
}

function isQuizBlockNode(type: unknown) {
  return (
    type === "doc" ||
    type === "bulletList" ||
    type === "orderedList" ||
    type === "listItem" ||
    type === "blockquote"
  );
}

function cloneJsonRecord(value: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
