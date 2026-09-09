import type { GeneratedFlashcardOutput } from "#api/modules/flashcards/types/flashcard-generation.types";
import {
  normalizeMathTextLatexCommands,
  normalizeMissingInlineMathClosers,
  tokenizeMathText,
} from "@learning-path/shared";
import type { Difficulty } from "@prisma/client";

export function toFlashcardTiptap(text: string) {
  return toFlashcardTiptapDocument(text, false);
}

export function toFlashcardSolutionTiptap(text: string) {
  return toFlashcardTiptapDocument(text, true);
}

function toFlashcardTiptapDocument(text: string, parseStrongMarkdown: boolean) {
  const normalizedText = normalizeMathTextLatexCommands(
    normalizeMissingInlineMathClosers(text),
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
    const lines = token.value.split(/\n+/u);
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

export function validateGeneratedFlashcards(input: {
  output: GeneratedFlashcardOutput;
  requestedCount: number;
  packetPageCount: number;
  difficulty: Difficulty;
  difficultyCounts: { easy: number; medium: number; hard: number } | null;
}) {
  if (input.output.cards.length !== input.requestedCount) {
    throw new Error("AI_OUTPUT_COUNT_MISMATCH: Số thẻ không khớp yêu cầu.");
  }
  const normalizedFronts = new Set<string>();
  for (const [index, card] of input.output.cards.entries()) {
    if (
      new Set(card.sourcePacketPageNumbers).size !==
        card.sourcePacketPageNumbers.length ||
      card.sourcePacketPageNumbers.some(
        (pageNumber) => pageNumber > input.packetPageCount,
      )
    ) {
      throw new Error(
        `AI_OUTPUT_SOURCE_INVALID: Thẻ ${index + 1} dẫn trang packet PDF không hợp lệ.`,
      );
    }
    const front = normalize(card.front);
    const back = normalize(card.back);
    const solution = normalize(card.solution);
    if (front === back) {
      throw new Error(
        `AI_OUTPUT_FLASHCARD_PAIR_INVALID: Mặt trước và mặt sau thẻ ${index + 1} bị trùng.`,
      );
    }
    if (!isClearQuestion(card.front)) {
      throw new Error(
        `AI_OUTPUT_FLASHCARD_FRONT_INVALID: Mặt trước thẻ ${index + 1} chưa phải một câu hỏi rõ ràng.`,
      );
    }
    if (normalizedFronts.has(front)) {
      throw new Error(
        `AI_OUTPUT_FLASHCARD_DUPLICATE: Mặt trước thẻ ${index + 1} bị trùng với thẻ khác trong cùng lượt sinh.`,
      );
    }
    normalizedFronts.add(front);
    if (solution === back) {
      throw new Error(
        `AI_OUTPUT_FLASHCARD_SOLUTION_INVALID: Lời giải thẻ ${index + 1} chỉ lặp lại mặt sau.`,
      );
    }
  }
  if (input.difficulty !== "MIXED") {
    if (input.output.cards.some((card) => card.difficulty !== input.difficulty)) {
      throw new Error(
        "AI_OUTPUT_DIFFICULTY_MISMATCH: Độ khó của thẻ không khớp yêu cầu.",
      );
    }
  } else if (input.difficultyCounts) {
    const actual = input.output.cards.reduce(
      (counts, card) => {
        if (card.difficulty === "EASY") counts.easy += 1;
        if (card.difficulty === "MEDIUM") counts.medium += 1;
        if (card.difficulty === "HARD") counts.hard += 1;
        return counts;
      },
      { easy: 0, medium: 0, hard: 0 },
    );
    if (
      actual.easy !== input.difficultyCounts.easy ||
      actual.medium !== input.difficultyCounts.medium ||
      actual.hard !== input.difficultyCounts.hard
    ) {
      throw new Error(
        "AI_OUTPUT_DIFFICULTY_COUNTS_MISMATCH: Phân bổ độ khó của Flashcard không khớp yêu cầu.",
      );
    }
  }
  return input.output.cards;
}

function isClearQuestion(value: string) {
  const text = value.trim();
  return (
    text.endsWith("?") ||
    /^(hãy|nêu|trình bày|giải thích|phát biểu|định nghĩa|cho biết|thế nào|vì sao|khi nào|điều kiện nào|công thức nào)\b/iu.test(
      text,
    )
  );
}

function normalize(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("vi")
    .replace(/\s+/gu, " ")
    .replace(/[?.!]+$/u, "");
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
