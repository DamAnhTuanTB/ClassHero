export type TikzLocalHeaderRepairChange = {
  kind: "LOCAL_HEADER_HOISTED";
  command: "usetikzlibrary" | "tikzset";
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
  if (commands.length === 0) return { source, changes: [] };

  const withoutInnerCommands = [...commands]
    .sort((left, right) => right.start - left.start)
    .reduce(
      (current, command) =>
        `${current.slice(0, command.start)}${current.slice(command.end)}`,
      source,
    );
  const existingHeader = source.slice(0, root.index);
  const commandsToInsert = commands.filter(
    (command) => !existingHeader.includes(command.source),
  );
  const prefix = commandsToInsert.map((command) => command.source).join("\n");
  return {
    source: `${withoutInnerCommands.slice(0, root.index)}${prefix}${prefix ? "\n" : ""}${withoutInnerCommands.slice(root.index)}`,
    changes: commands.map((command): TikzLocalHeaderRepairChange => ({
      kind: "LOCAL_HEADER_HOISTED",
      command: command.name,
    })),
  };
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
