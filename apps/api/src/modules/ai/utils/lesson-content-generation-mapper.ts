import { QuestionType } from "@prisma/client";
import type { GeneratedQuestion } from "#api/modules/ai/types/lesson-content-generation.types";

export function toTiptap(text: string) {
  return {
    type: "doc",
    content: text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({ type: "paragraph", content: [{ type: "text", text: line }] })),
  };
}

export function mapGeneratedQuestion(question: GeneratedQuestion) {
  const common = {
    questionType: question.questionType,
    difficulty: question.difficulty,
    questionJson: toTiptap(question.prompt),
    hintJson: question.hint ? toTiptap(question.hint) : null,
    explanationJson: toTiptap(question.explanation),
    sourceMetadataJson: { sourceChunkIds: question.sourceChunkIds },
  };

  switch (question.questionType) {
    case QuestionType.MULTIPLE_CHOICE:
      return {
        ...common,
        optionsJson: question.options.map((option) => ({
          id: option.id,
          richText: toTiptap(option.text),
        })),
        correctAnswerJson: question.correctOptionIds,
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
          richText: toTiptap(statement.text),
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
        correctAnswerJson: question.acceptedAnswers,
        gradingConfigJson: {
          caseSensitive: question.caseSensitive,
          exactMatch: question.exactMatch,
          keywords: question.keywords,
        },
      };
  }
}

export function assertGeneratedContent(input: {
  items: Array<{ sourceChunkIds: string[]; text: string }>;
  allowedChunkIds: Set<string>;
  contextTexts: string[];
}) {
  for (const item of input.items) {
    if (item.sourceChunkIds.some((id) => !input.allowedChunkIds.has(id))) {
      throw new Error(
        "AI_SOURCE_REFERENCE_INVALID: Output references a chunk outside the retrieved lesson context.",
      );
    }
    if (copiesSourceVerbatim(item.text, input.contextTexts)) {
      throw new Error(
        "AI_OUTPUT_TOO_SIMILAR: Generated content copies a long source phrase verbatim.",
      );
    }
  }
}

export function copiesSourceVerbatim(
  value: string,
  sourceTexts: string[],
  phraseTokens = 12,
) {
  const tokens = normalize(value).split(" ").filter(Boolean);
  if (tokens.length < phraseTokens) return false;
  const normalizedSources = sourceTexts.map(normalize);
  for (let index = 0; index <= tokens.length - phraseTokens; index += 1) {
    const phrase = tokens.slice(index, index + phraseTokens).join(" ");
    if (normalizedSources.some((source) => source.includes(phrase))) return true;
  }
  return false;
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase("vi")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
