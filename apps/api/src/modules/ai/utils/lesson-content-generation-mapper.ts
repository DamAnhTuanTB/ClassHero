import {
  normalizeLessonSummaryAngleNotation,
  tokenizeMathText,
} from "@learning-path/shared";
import { QuestionType } from "@prisma/client";
import type { GeneratedQuestion } from "#api/modules/ai/types/lesson-content-generation.types";

export function toTiptap(text: string) {
  const normalizedText = normalizeLessonSummaryAngleNotation(text);
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
        inlineContent.push({ type: "text", text: line });
      }
      if (index < lines.length - 1) {
        flushParagraph();
      }
    });
  }
  flushParagraph();

  return {
    type: "doc",
    content,
  };
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

export function mapGeneratedQuestion(question: GeneratedQuestion) {
  const mappedExample = mapGeneratedExample(question);
  const common = {
    questionType: question.questionType,
    difficulty: question.difficulty,
    questionJson: toTiptap(mappedExample.block.problem),
    hintJson: null,
    explanationJson: mappedExample.contentJson,
    exampleBlock: mappedExample.block,
    recoveryIssues: mappedExample.recoveryIssues,
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

function mapGeneratedExample(question: GeneratedQuestion) {
  const sourceChunkIds = "sourceChunkIds" in question ? question.sourceChunkIds : [];
  const mappedBlock = {
    type: "example" as const,
    problem: normalizeLessonSummaryAngleNotation(question.example.problem),
    solution: question.example.solution
      ? normalizeLessonSummaryAngleNotation(question.example.solution)
      : null,
    answer: normalizeLessonSummaryAngleNotation(question.example.answer),
    geometryStatement:
      "geometryStatement" in question.example
        ? (question.example.geometryStatement ?? undefined)
        : undefined,
    origin: "AI_AUTHORED" as const,
  };
  const block =
    sourceChunkIds.length > 0 ? { ...mappedBlock, sourceChunkIds } : mappedBlock;
  return {
    block,
    contentJson: toTiptap(
      [block.solution, `Đáp án: ${block.answer}`].filter(Boolean).join("\n"),
    ),
    recoveryIssues: [] as Array<{
      classification: "REVIEWABLE";
      code: string;
      message: string;
      technicalDetails?: string;
    }>,
  };
}

export function assertGeneratedContent(input: {
  items: Array<{ sourceChunkIds?: string[]; text: string }>;
  allowedChunkIds: Set<string>;
  contextTexts: string[];
}) {
  for (const item of input.items) {
    if (item.sourceChunkIds?.some((id) => !input.allowedChunkIds.has(id))) {
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
