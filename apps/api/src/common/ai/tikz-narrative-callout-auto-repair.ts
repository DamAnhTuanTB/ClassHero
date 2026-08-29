export type TikzNarrativeCalloutAutoRepairChange = {
  kind: "NARRATIVE_CALLOUT_REMOVED";
  nodeKind: "standalone" | "path-attached";
  text: string;
};

export type TikzNarrativeCalloutAutoRepairResult = {
  source: string;
  changes: TikzNarrativeCalloutAutoRepairChange[];
};

type ParsedNode = {
  start: number;
  end: number;
  body: string;
  standalone: boolean;
};

/**
 * Removes only high-confidence prose/callout text from TikZ nodes while
 * preserving geometric labels, measurements, axes, formulas, categories and
 * component names. Feature wrappers decide which generated sources may be
 * normalized.
 */
export function autoRepairTikzNarrativeCallouts(
  source: string,
): TikzNarrativeCalloutAutoRepairResult {
  const nodes = parseTikzNodes(source).filter((node) => isNarrativeCallout(node.body));
  if (nodes.length === 0) return { source, changes: [] };

  const changes = nodes.map((node) => ({
    kind: "NARRATIVE_CALLOUT_REMOVED" as const,
    nodeKind: node.standalone ? ("standalone" as const) : ("path-attached" as const),
    text: toVisibleText(node.body),
  }));
  let repairedSource = source;
  for (const node of [...nodes].sort((left, right) => right.start - left.start)) {
    repairedSource = repairedSource.slice(0, node.start) + repairedSource.slice(node.end);
  }
  return { source: repairedSource, changes };
}

function parseTikzNodes(source: string): ParsedNode[] {
  const maskedSource = maskTexComments(source);
  const nodes: ParsedNode[] = [];
  const nodePattern = /\\?node\b/gu;
  for (const match of maskedSource.matchAll(nodePattern)) {
    const token = match[0];
    const start = match.index;
    if (start == null || isIdentifierCharacter(maskedSource[start - 1])) continue;

    const standalone = token.startsWith("\\");
    let cursor = skipWhitespace(maskedSource, start + token.length);
    if (maskedSource[cursor] === "[") {
      const options = readBalancedGroup(maskedSource, cursor, "[", "]");
      if (!options) continue;
      cursor = skipWhitespace(maskedSource, options.end);
    }
    if (maskedSource[cursor] === "(") {
      const name = readBalancedGroup(maskedSource, cursor, "(", ")");
      if (!name) continue;
      cursor = skipWhitespace(maskedSource, name.end);
    }
    if (/^at\b/u.test(maskedSource.slice(cursor))) {
      cursor = skipWhitespace(maskedSource, cursor + 2);
      if (maskedSource[cursor] !== "(") continue;
      const coordinate = readBalancedGroup(maskedSource, cursor, "(", ")");
      if (!coordinate) continue;
      cursor = skipWhitespace(maskedSource, coordinate.end);
    }
    if (maskedSource[cursor] !== "{") continue;
    const body = readBalancedGroup(maskedSource, cursor, "{", "}");
    if (!body) continue;

    let end = body.end;
    if (standalone) {
      const semicolon = skipWhitespace(maskedSource, end);
      if (maskedSource[semicolon] !== ";") continue;
      end = semicolon + 1;
    }
    nodes.push({
      start,
      end,
      body: source.slice(cursor + 1, body.end - 1),
      standalone,
    });
  }
  return nodes;
}

function isNarrativeCallout(body: string) {
  const text = toVisibleText(body);
  if (!text) return false;

  const colon = /^(.+?)\s*[:：]\s*(.+)$/u.exec(text);
  if (colon) {
    const leftWords = readWords(colon[1] ?? "");
    const leftLooksDescriptive =
      leftWords.length >= 2 || leftWords.some((word) => [...word].length >= 3);
    if (leftLooksDescriptive && (colon[2]?.trim().length ?? 0) > 0) return true;
  }

  const words = readWords(text);
  return words.length >= 4 && /[.!?。！？]\s*$/u.test(text);
}

function toVisibleText(body: string) {
  return body
    .replace(/\\\\/gu, " ")
    .replace(/\\[,;:! ]/gu, " ")
    .replace(/\\(?:quad|qquad|enspace|thinspace)\b/gu, " ")
    .replace(
      /\\(?:text|textrm|textsf|texttt|textbf|textit|mathrm|mathbf|mathsf|operatorname|mbox)\s*/gu,
      "",
    )
    .replace(/\\colon\b/gu, ":")
    .replace(/\\[A-Za-z@]+\*?/gu, " ")
    .replace(/[$}{]/gu, "")
    .replace(/[~\u00a0]/gu, " ")
    .replace(/\\([%&#_$])/gu, "$1")
    .replace(/\s+/gu, " ")
    .trim();
}

function readWords(value: string) {
  return value.match(/\p{L}[\p{L}\p{M}]*/gu) ?? [];
}

function readBalancedGroup(source: string, start: number, open: string, close: string) {
  if (source[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index]!;
    if (character === "\\") {
      index += 1;
      continue;
    }
    if (character === open) depth += 1;
    if (character !== close) continue;
    depth -= 1;
    if (depth === 0) return { end: index + 1 };
  }
  return null;
}

function maskTexComments(source: string) {
  const characters = source.split("");
  for (let index = 0; index < characters.length; index += 1) {
    if (characters[index] !== "%" || isEscaped(characters, index)) continue;
    while (index < characters.length && characters[index] !== "\n") {
      characters[index] = " ";
      index += 1;
    }
  }
  return characters.join("");
}

function isEscaped(characters: string[], index: number) {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && characters[cursor] === "\\"; cursor -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

function skipWhitespace(source: string, start: number) {
  let cursor = start;
  while (/\s/u.test(source[cursor] ?? "")) cursor += 1;
  return cursor;
}

function isIdentifierCharacter(value: string | undefined) {
  return Boolean(value && /[A-Za-z0-9@:_-]/u.test(value));
}
