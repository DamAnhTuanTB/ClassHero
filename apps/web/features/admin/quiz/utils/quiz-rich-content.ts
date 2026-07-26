import type {
  TiptapJsonNode,
  TiptapTextDocument,
} from "@/features/admin/quiz/api/admin-quiz-api";

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
