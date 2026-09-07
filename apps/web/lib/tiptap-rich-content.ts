import {
  normalizeLessonSummaryAngleNotation,
  normalizeMathTextLatexCommands,
  normalizeMissingInlineMathClosers,
  tokenizeMathText,
  type TiptapJsonNode,
  type TiptapTextDocument,
} from "@learning-path/shared";

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
  return createMathTiptapDocument(text, false);
}

export function createMathMarkdownTiptapDocument(text: string): TiptapTextDocument {
  return createMathTiptapDocument(text, true);
}

function createMathTiptapDocument(
  text: string,
  parseStrongMarkdown: boolean,
): TiptapTextDocument {
  const content: TiptapJsonNode[] = [];
  let inlineContent: TiptapJsonNode[] = [];

  const flushParagraph = () => {
    const paragraphContent = trimParagraphBoundaryWhitespace(inlineContent);
    if (paragraphContent.length > 0) {
      content.push({ type: "paragraph", content: paragraphContent });
    }
    inlineContent = [];
  };

  const normalizedText = normalizeMathTextLatexCommands(
    normalizeMissingInlineMathClosers(text.trim()),
  );
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
      if (index < lines.length - 1) {
        flushParagraph();
      }
    });
  }

  flushParagraph();
  return content.length > 0 ? { type: "doc", content } : createEmptyTiptapDocument();
}

function parseStrongMarkdownText(value: string): TiptapJsonNode[] {
  const nodes: TiptapJsonNode[] = [];
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

function textNode(text: string): TiptapJsonNode {
  return { type: "text", text };
}

export function getTiptapDocumentText(document: TiptapTextDocument | null | undefined) {
  return collectNodeText(document).replace(/\s+/g, " ").trim();
}

export function hasTiptapDocumentContent(
  document: TiptapTextDocument | null | undefined,
) {
  return getTiptapDocumentText(document).length > 0;
}

export function normalizeLessonSummaryAnglesInTiptapDocument(
  document: TiptapTextDocument,
): TiptapTextDocument {
  return normalizeTiptapNodeAngles(document) as TiptapTextDocument;
}

function normalizeTiptapNodeAngles(node: TiptapJsonNode): TiptapJsonNode {
  const latex = node.attrs?.latex;
  const normalizedLatex =
    (node.type === "inlineMath" || node.type === "blockMath") && typeof latex === "string"
      ? normalizeLessonSummaryAngleNotation(latex)
      : latex;
  const content = node.content?.map(normalizeTiptapNodeAngles);

  return {
    ...node,
    ...(node.attrs && normalizedLatex !== latex
      ? { attrs: { ...node.attrs, latex: normalizedLatex } }
      : {}),
    ...(content ? { content } : {}),
  };
}

export function serializeTiptapDocumentToMathMarkdown(document: TiptapTextDocument) {
  return serializeBlockNodes(document.content ?? []).trim();
}

function serializeBlockNodes(nodes: TiptapJsonNode[]) {
  return nodes
    .map((node) => serializeBlockNode(node))
    .filter(Boolean)
    .join("\n\n");
}

function serializeBlockNode(node: TiptapJsonNode): string {
  switch (node.type) {
    case "paragraph":
      return wrapAlignedBlock(serializeInlineNodes(node.content ?? []), node.attrs);
    case "heading": {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level) || 2));
      return `${"#".repeat(level)} ${serializeInlineNodes(node.content ?? [])}`;
    }
    case "bulletList":
      return serializeList(node, false);
    case "orderedList":
      return serializeList(node, true);
    case "blockquote":
      return serializeBlockNodes(node.content ?? [])
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    case "codeBlock":
      return `\`\`\`\n${collectRawText(node)}\n\`\`\``;
    case "blockMath": {
      const latex = readStringAttribute(node.attrs, "latex");
      return latex ? `$$\n${latex}\n$$` : "";
    }
    case "horizontalRule":
      return "---";
    case "table":
      return serializeTable(node);
    default:
      return node.content?.length ? serializeBlockNodes(node.content) : "";
  }
}

function serializeInlineNodes(nodes: TiptapJsonNode[]) {
  return nodes.map(serializeInlineNode).join("");
}

function serializeInlineNode(node: TiptapJsonNode): string {
  if (node.type === "inlineMath") {
    const latex = readStringAttribute(node.attrs, "latex");
    return latex ? `$${latex}$` : "";
  }
  if (node.type === "hardBreak") return "\n";
  if (node.type === "image") {
    const src = readStringAttribute(node.attrs, "src");
    if (!src) return "";
    const alt = readStringAttribute(node.attrs, "alt").replaceAll("]", "\\]");
    return `![${alt}](${src})`;
  }

  let value = node.text ?? (node.content ? serializeInlineNodes(node.content) : "");
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") value = `**${value}**`;
    else if (mark.type === "italic") value = `_${value}_`;
    else if (mark.type === "strike") value = `~~${value}~~`;
    else if (mark.type === "code") value = `\`${value}\``;
    else if (mark.type === "underline") value = `<u>${value}</u>`;
    else if (mark.type === "textStyle") {
      const color = readStringAttribute(mark.attrs, "color");
      if (color)
        value = `<span style="color: ${escapeHtmlAttribute(color)}">${value}</span>`;
    }
  }
  return value;
}

function serializeList(node: TiptapJsonNode, ordered: boolean) {
  return (node.content ?? [])
    .map((item, index) => {
      const children = item.content ?? [];
      const first = children[0];
      const firstLine =
        first?.type === "paragraph" ? serializeInlineNodes(first.content ?? []) : "";
      const prefix = ordered ? `${index + 1}. ` : "- ";
      const nested = children
        .slice(1)
        .map((child) => serializeBlockNode(child))
        .filter(Boolean)
        .map((value) =>
          value
            .split("\n")
            .map((line) => `  ${line}`)
            .join("\n"),
        )
        .join("\n");
      return `${prefix}${firstLine}${nested ? `\n${nested}` : ""}`;
    })
    .join("\n");
}

function serializeTable(node: TiptapJsonNode) {
  const rows = (node.content ?? []).map((row) =>
    (row.content ?? []).map((cell) =>
      serializeBlockNodes(cell.content ?? [])
        .replaceAll("|", "\\|")
        .replace(/\n+/gu, " ")
        .trim(),
    ),
  );
  if (rows.length === 0) return "";
  const columnCount = Math.max(...rows.map((row) => row.length));
  const normalizedRows = rows.map((row) => [
    ...row,
    ...Array.from({ length: columnCount - row.length }, () => ""),
  ]);
  const header = normalizedRows[0]!;
  return [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...normalizedRows.slice(1).map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function wrapAlignedBlock(value: string, attrs: Record<string, unknown> | undefined) {
  const alignment = readStringAttribute(attrs, "textAlign");
  if (!alignment || alignment === "left") return value;
  return `<div style="text-align: ${escapeHtmlAttribute(alignment)}">${value}</div>`;
}

function collectRawText(node: TiptapJsonNode): string {
  return [node.text ?? "", ...(node.content ?? []).map(collectRawText)].join("");
}

function readStringAttribute(attrs: Record<string, unknown> | undefined, key: string) {
  const value = attrs?.[key];
  return typeof value === "string" ? value : "";
}

function escapeHtmlAttribute(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

export function removeTrailingOptionPeriod(
  document: TiptapTextDocument,
): TiptapTextDocument {
  return stripTrailingPeriod(document).node as TiptapTextDocument;
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

function stripTrailingPeriod(node: TiptapJsonNode): {
  hasVisibleContent: boolean;
  node: TiptapJsonNode;
  removed: boolean;
} {
  if (node.type === "text") {
    const text = node.text ?? "";
    const hasVisibleContent = text.trim().length > 0;
    const nextText = text.replace(/(?<!\.)\.(\s*)$/u, "$1");

    return {
      hasVisibleContent,
      node: nextText === text ? node : { ...node, text: nextText },
      removed: nextText !== text,
    };
  }

  if (!node.content?.length) {
    return {
      hasVisibleContent: node.type !== "doc" && node.type !== "paragraph",
      node,
      removed: false,
    };
  }

  for (let index = node.content.length - 1; index >= 0; index -= 1) {
    const result = stripTrailingPeriod(node.content[index]!);
    if (result.removed) {
      const content = [...node.content];
      content[index] = result.node;
      return { hasVisibleContent: true, node: { ...node, content }, removed: true };
    }
    if (result.hasVisibleContent) {
      return { hasVisibleContent: true, node, removed: false };
    }
  }

  return { hasVisibleContent: false, node, removed: false };
}

function trimParagraphBoundaryWhitespace(nodes: TiptapJsonNode[]) {
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
