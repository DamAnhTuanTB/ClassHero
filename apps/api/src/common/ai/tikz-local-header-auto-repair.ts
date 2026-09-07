export type TikzLocalHeaderRepairChange = {
  kind: "LOCAL_HEADER_HOISTED" | "LOCAL_MACRO_MOVED_INTO_ROOT";
  command:
    | "usetikzlibrary"
    | "tikzset"
    | "pgfmathsetmacro"
    | "pgfmathsetlengthmacro"
    | "pgfmathtruncatemacro";
};

export function autoRepairTikzLocalHeaderPlacement(source: string) {
  const root = /\\begin\s*\{\s*(?:tikzpicture|circuitikz)\s*\}(?:\s*\[[^\]]*\])?/u.exec(
    source,
  );
  if (!root || root.index === undefined) return { source, changes: [] };

  let cursor = root.index + root[0].length;
  const commands: Array<{
    start: number;
    end: number;
    source: string;
    name: "usetikzlibrary" | "tikzset";
  }> = [];
  while (cursor < source.length) {
    cursor = skipWhitespaceAndComments(source, cursor);
    const command = /^\\(usetikzlibrary|tikzset)\s*\{/u.exec(source.slice(cursor));
    if (!command) break;
    const openingBrace = cursor + command[0].length - 1;
    const closingBrace = findMatchingBrace(source, openingBrace);
    if (closingBrace === null) return { source, changes: [] };
    commands.push({
      start: cursor,
      end: closingBrace + 1,
      source: source.slice(cursor, closingBrace + 1).trim(),
      name: command[1] as "usetikzlibrary" | "tikzset",
    });
    cursor = closingBrace + 1;
  }
  const hoisted =
    commands.length === 0
      ? { source, changes: [] as TikzLocalHeaderRepairChange[] }
      : hoistLocalHeaderCommands(source, root.index, commands);

  return moveTopLevelMathMacrosIntoRoot(hoisted.source, hoisted.changes);
}

function hoistLocalHeaderCommands(
  source: string,
  rootIndex: number,
  commands: Array<{
    start: number;
    end: number;
    source: string;
    name: "usetikzlibrary" | "tikzset";
  }>,
) {
  const withoutInnerCommands = [...commands]
    .sort((left, right) => right.start - left.start)
    .reduce(
      (current, command) =>
        `${current.slice(0, command.start)}${current.slice(command.end)}`,
      source,
    );
  const existingHeader = source.slice(0, rootIndex);
  const commandsToInsert = commands.filter(
    (command) => !existingHeader.includes(command.source),
  );
  const prefix = commandsToInsert.map((command) => command.source).join("\n");
  return {
    source: `${withoutInnerCommands.slice(0, rootIndex)}${prefix}${prefix ? "\n" : ""}${withoutInnerCommands.slice(rootIndex)}`,
    changes: commands.map((command): TikzLocalHeaderRepairChange => ({
      kind: "LOCAL_HEADER_HOISTED",
      command: command.name,
    })),
  };
}

function moveTopLevelMathMacrosIntoRoot(
  source: string,
  existingChanges: TikzLocalHeaderRepairChange[],
) {
  const root = /\\begin\s*\{\s*(?:tikzpicture|circuitikz)\s*\}(?:\s*\[[^\]]*\])?/u.exec(
    source,
  );
  if (!root || root.index === undefined) {
    return { source, changes: existingChanges };
  }

  const header = source.slice(0, root.index);
  const commands = readTopLevelMathMacroCommands(header);
  if (commands.length === 0) {
    return { source, changes: existingChanges };
  }

  const headerWithoutMacros = [...commands]
    .sort((left, right) => right.start - left.start)
    .reduce(
      (current, command) =>
        `${current.slice(0, command.start)}${current.slice(command.end)}`,
      header,
    );
  const rootSource = source.slice(root.index, root.index + root[0].length);
  const body = source.slice(root.index + root[0].length);
  const macroSource = commands.map((command) => command.source).join("\n");

  return {
    source: `${headerWithoutMacros}${rootSource}\n${macroSource}${body.startsWith("\n") ? "" : "\n"}${body}`,
    changes: [
      ...existingChanges,
      ...commands.map((command): TikzLocalHeaderRepairChange => ({
        kind: "LOCAL_MACRO_MOVED_INTO_ROOT",
        command: command.name,
      })),
    ],
  };
}

function readTopLevelMathMacroCommands(source: string) {
  const commands: Array<{
    start: number;
    end: number;
    source: string;
    name: "pgfmathsetmacro" | "pgfmathsetlengthmacro" | "pgfmathtruncatemacro";
  }> = [];
  let braceDepth = 0;
  let cursor = 0;

  while (cursor < source.length) {
    if (source[cursor] === "%" && !isEscaped(source, cursor)) {
      const nextLine = source.indexOf("\n", cursor);
      cursor = nextLine < 0 ? source.length : nextLine + 1;
      continue;
    }
    if (source[cursor] === "{" && !isEscaped(source, cursor)) {
      braceDepth += 1;
      cursor += 1;
      continue;
    }
    if (source[cursor] === "}" && !isEscaped(source, cursor)) {
      braceDepth = Math.max(0, braceDepth - 1);
      cursor += 1;
      continue;
    }
    if (source[cursor] !== "\\" || braceDepth !== 0) {
      cursor += 1;
      continue;
    }

    const match =
      /^\\(pgfmathsetmacro|pgfmathsetlengthmacro|pgfmathtruncatemacro)\b/u.exec(
        source.slice(cursor),
      );
    if (!match) {
      cursor += 1;
      continue;
    }
    const name = match[1] as
      "pgfmathsetmacro" | "pgfmathsetlengthmacro" | "pgfmathtruncatemacro";
    let end = cursor + match[0].length;
    let valid = true;
    for (let argumentIndex = 0; argumentIndex < 2; argumentIndex += 1) {
      end = skipWhitespaceAndComments(source, end);
      if (source[end] !== "{") {
        valid = false;
        break;
      }
      const closingBrace = findMatchingBrace(source, end);
      if (closingBrace === null) {
        valid = false;
        break;
      }
      end = closingBrace + 1;
    }
    if (!valid) {
      cursor += match[0].length;
      continue;
    }
    commands.push({ start: cursor, end, source: source.slice(cursor, end), name });
    cursor = end;
  }

  return commands;
}

function skipWhitespaceAndComments(source: string, start: number) {
  let cursor = start;
  while (cursor < source.length) {
    if (/\s/u.test(source[cursor]!)) {
      cursor += 1;
      continue;
    }
    if (source[cursor] !== "%") break;
    const nextLine = source.indexOf("\n", cursor);
    cursor = nextLine < 0 ? source.length : nextLine + 1;
  }
  return cursor;
}

function findMatchingBrace(source: string, openingBrace: number) {
  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "\\") {
      index += 1;
      continue;
    }
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return null;
}

function isEscaped(source: string, index: number) {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === "\\"; cursor -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}
