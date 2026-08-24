import { tokenizeMathText } from "@learning-path/shared";

import type { TiptapJsonNode, TiptapTextDocument } from "@/types/rich-text";

export function createEmptyTiptapDocument(): TiptapTextDocument {
  return {
    type: "doc",
    content: [{ type: "paragraph" }],
  };
}

export function createTextTiptapDocument(text: string): TiptapTextDocument {
  const normalizedText = text.trim();
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        ...(normalizedText ? { content: [{ type: "text", text: normalizedText }] } : {}),
      },
    ],
  };
}

export function createMathTextTiptapDocument(text: string): TiptapTextDocument {
  const content: TiptapJsonNode[] = [];
  let inlineContent: TiptapJsonNode[] = [];

  const flushParagraph = () => {
    const paragraphContent = trimParagraphBoundaryWhitespace(inlineContent);
    if (paragraphContent.length > 0) {
      content.push({ type: "paragraph", content: paragraphContent });
    }
    inlineContent = [];
  };

  for (const token of tokenizeMathText(text.trim())) {
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
  return content.length > 0
    ? { type: "doc", content }
    : createEmptyTiptapDocument();
}

export function getTiptapDocumentText(document: TiptapTextDocument | null | undefined) {
  return collectNodeText(document).replace(/\s+/g, " ").trim();
}

export function hasTiptapDocumentContent(
  document: TiptapTextDocument | null | undefined,
) {
  return getTiptapDocumentText(document).length > 0;
}

export function areTiptapDocumentsEquivalent(
  left: TiptapTextDocument,
  right: TiptapTextDocument,
) {
  return (
    JSON.stringify(toComparableValue(left)) === JSON.stringify(toComparableValue(right))
  );
}

function toComparableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(toComparableValue);
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  const entries = Object.entries(value)
    .filter(([, childValue]) => childValue !== null && childValue !== undefined)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .flatMap(([key, childValue]) => {
      const comparableChild = toComparableValue(childValue);
      if (
        typeof comparableChild === "object" &&
        comparableChild !== null &&
        !Array.isArray(comparableChild) &&
        Object.keys(comparableChild).length === 0
      ) {
        return [];
      }
      return [[key, comparableChild] as const];
    });

  return Object.fromEntries(entries);
}

function collectNodeText(node: TiptapJsonNode | null | undefined): string {
  if (!node) {
    return "";
  }

  const values: string[] = [];
  if (node.text) {
    values.push(node.text);
  }

  if (node.type === "inlineMath" || node.type === "blockMath") {
    const latex = node.attrs?.latex;
    if (typeof latex === "string" && latex.trim()) {
      values.push(latex);
    }
  }

  if (node.type === "image") {
    const alt = node.attrs?.alt;
    values.push(typeof alt === "string" && alt.trim() ? alt : "[Hình ảnh]");
  }

  if (node.type === "table") {
    values.push("[Bảng]");
  }

  if (node.content?.length) {
    values.push(...node.content.map(collectNodeText));
  }

  return values.filter(Boolean).join(" ");
}

function trimParagraphBoundaryWhitespace(nodes: TiptapJsonNode[]) {
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
