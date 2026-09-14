import type { GeneratedFlashcardOutput } from "#api/modules/flashcards/types/flashcard-generation.types";
import {
  hasMalformedMathText,
  normalizeLearnerMathTextSyntax,
  normalizeThreePointAngleNotation,
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
  const normalizedText = normalizeFlashcardLearnerText(text);
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

export function normalizeFlashcardLearnerText(value: string) {
  return normalizeLearnerMathTextSyntax(normalizeThreePointAngleNotation(value));
}

export function collectFlashcardMathSyntaxWarnings(input: {
  front: string;
  back: string;
  solution: string;
}) {
  const learnerTextEntries = [
    ["front", input.front],
    ["back", input.back],
    ["solution", input.solution],
  ] as const;
  const malformedPaths = learnerTextEntries
    .filter(([, value]) => hasMalformedMathText(normalizeFlashcardLearnerText(value)))
    .map(([path]) => path);
  return malformedPaths.length === 0
    ? []
    : [
        {
          code: "MALFORMED_LATEX",
          message:
            "Một số công thức LaTeX vẫn chưa cân bằng sau bước chuẩn hóa; cần admin kiểm tra.",
          severity: "WARNING" as const,
          paths: malformedPaths,
        },
      ];
}

export function validateGeneratedFlashcards(input: {
  output: GeneratedFlashcardOutput;
  requestedCount: number;
  packetPageCount: number;
  difficulty: Difficulty;
  difficultyCounts: { easy: number; medium: number; hard: number } | null;
}) {
  const warnings: Array<{
    code: string;
    message: string;
    severity: "WARNING";
    paths: string[];
    cardIndex?: number;
  }> = [];
  const warn = (code: string, message: string, paths: string[], cardIndex?: number) =>
    warnings.push({ code, message, severity: "WARNING", paths, cardIndex });
  if (input.output.cards.length !== input.requestedCount) {
    warn("AI_OUTPUT_COUNT_MISMATCH", "Số thẻ không khớp yêu cầu.", ["cards"]);
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
      warn(
        "AI_OUTPUT_SOURCE_INVALID",
        `Thẻ ${index + 1} dẫn trang packet PDF không hợp lệ.`,
        ["sourcePacketPageNumbers"],
        index,
      );
    }
    const front = normalize(card.front);
    const back = normalize(card.back);
    const solution = normalize(card.solution);
    if (front === back) {
      warn(
        "AI_OUTPUT_FLASHCARD_PAIR_INVALID",
        `Mặt trước và mặt sau thẻ ${index + 1} bị trùng.`,
        ["front", "back"],
        index,
      );
    }
    if (referencesExternalFigure(card.front)) {
      warn(
        "AI_OUTPUT_FLASHCARD_FRONT_CONTEXT_INVALID",
        `Mặt trước thẻ ${index + 1} tham chiếu hình nguồn thay vì tự đủ bằng text.`,
        ["front"],
        index,
      );
    }
    if (!isTheoryRecallFront(card.front)) {
      warn(
        "AI_OUTPUT_FLASHCARD_THEORY_ONLY",
        `Mặt trước thẻ ${index + 1} có dấu hiệu yêu cầu giải bài thay vì kiểm tra lý thuyết.`,
        ["front"],
        index,
      );
    }
    if (!isClearQuestion(card.front)) {
      warn(
        "AI_OUTPUT_FLASHCARD_FRONT_INVALID",
        `Mặt trước thẻ ${index + 1} chưa phải một câu hỏi rõ ràng.`,
        ["front"],
        index,
      );
    }
    if (normalizedFronts.has(front)) {
      warn(
        "AI_OUTPUT_FLASHCARD_DUPLICATE",
        `Mặt trước thẻ ${index + 1} bị trùng với thẻ khác trong cùng lượt sinh.`,
        ["front"],
        index,
      );
    }
    normalizedFronts.add(front);
    if (solution === back) {
      warn(
        "AI_OUTPUT_FLASHCARD_SOLUTION_INVALID",
        `Phần giải thích thẻ ${index + 1} chỉ lặp lại mặt sau.`,
        ["solution"],
        index,
      );
    }
  }
  if (input.difficulty !== "MIXED") {
    if (input.output.cards.some((card) => card.difficulty !== input.difficulty)) {
      warn("AI_OUTPUT_DIFFICULTY_MISMATCH", "Độ khó của một số thẻ không khớp yêu cầu.", [
        "difficulty",
      ]);
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
      warn(
        "AI_OUTPUT_DIFFICULTY_COUNTS_MISMATCH",
        "Phân bổ độ khó của Flashcard không khớp yêu cầu.",
        ["cards", "difficulty"],
      );
    }
  }
  return warnings;
}

function isClearQuestion(value: string) {
  const text = value.trim();
  return (
    text.endsWith("?") ||
    /^(hãy|nêu|trình bày|giải thích|cho biết|thế nào|vì sao|khi nào|điều kiện nào|công thức nào|phân biệt|liệt kê)\b/iu.test(
      text,
    )
  );
}

function isTheoryRecallFront(value: string) {
  const text = value.trim();
  const textWithoutObjectCounts = text.replace(
    /\b\d+\s+(?:góc|cạnh|đỉnh|điểm|đường|tia|đoạn|cung|mặt|trục|nghiệm|phần|bước|đại lượng|chất|nguyên tử|phân tử|ion|vật|lực)\b/giu,
    "",
  );
  return !(
    /(?:^|[.;,:]\s+)(?:(?:em\s+)?hãy\s+)?(?:giải(?!\s+thích\b)|chứng minh|dựng|vẽ|biện luận|rút gọn|lập\s+(?:phương trình|hệ)|cân bằng\s+(?:phương trình|phản ứng)|thực hiện\s+phép\s+tính)\b/iu.test(
      text,
    ) ||
    /(?:^|[.;,:]\s+)(?:(?:em\s+)?hãy\s+)?(?:tính\s+(?:giá trị|số đo|độ dài|chu vi|diện tích|thể tích|khối lượng|số mol|nồng độ|vận tốc|gia tốc|công suất|điện trở|cường độ|hiệu điện thế|tọa độ|xác suất|tỉ số|phần trăm)|tìm\s+(?:giá trị|nghiệm|số đo|độ dài|tọa độ)|xác định\s+(?:giá trị|nghiệm|số đo|độ dài|tọa độ))(?=\s|$|[.,;:?!])/iu.test(
      text,
    ) ||
    (/\d/u.test(textWithoutObjectCounts) &&
      /\b(?:giá trị|nghiệm|kết quả|số đo|độ dài|chu vi|diện tích|thể tích|khối lượng|số mol|nồng độ|vận tốc|gia tốc|công suất|điện trở|cường độ|hiệu điện thế|đại lượng)\b[\s\S]{0,160}\b(?:là|bằng)\s+bao nhiêu\?/iu.test(
        text,
      ))
  );
}

function referencesExternalFigure(value: string) {
  return /\b(?:(?<!cấu\s)hình|figure|sơ đồ|biểu đồ|đồ thị)\s*(?:(?:số\s*)?\d+(?:[.:]\d+|[a-z])?|(?:bên|phía|ở)\s*(?:trên|dưới|bên|này|đây)|(?:này|đây))\b/iu.test(
    value,
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
