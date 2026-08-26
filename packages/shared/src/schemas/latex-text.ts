const MATH_DELIMITER_PATTERN =
  /\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|(?<!\\)\$(?!\$)([^$\n]+?)(?<!\\)\$(?!\$)/gu;

const TEXT_LATEX_COMMANDS = [
  "text",
  "mathrm",
  "mathbf",
  "mathit",
  "mathsf",
  "mathtt",
  "mathbb",
  "mathcal",
  "operatorname",
] as const;

const ARGUMENT_LATEX_COMMANDS = [
  "begin",
  "end",
  "frac",
  "dfrac",
  "tfrac",
  "sqrt",
  "overline",
  "underline",
  "overbrace",
  "underbrace",
  "widehat",
  "widetilde",
  "hat",
  "tilde",
  "bar",
  "vec",
  "dot",
  "ddot",
  "overrightarrow",
  "overleftarrow",
] as const;

const SYMBOL_LATEX_COMMANDS = [
  "circ",
  "pi",
  "theta",
  "alpha",
  "beta",
  "gamma",
  "delta",
  "epsilon",
  "lambda",
  "mu",
  "rho",
  "sigma",
  "phi",
  "varphi",
  "omega",
  "infty",
  "pm",
  "mp",
  "times",
  "div",
  "cdot",
  "le",
  "leq",
  "ge",
  "geq",
  "ne",
  "neq",
  "approx",
  "sim",
  "cong",
  "equiv",
  "parallel",
  "perp",
  "in",
  "notin",
  "subset",
  "subseteq",
  "supset",
  "supseteq",
  "cup",
  "cap",
  "sum",
  "prod",
  "int",
  "lim",
  "sin",
  "cos",
  "tan",
  "cot",
  "log",
  "ln",
] as const;

const COMMAND_PREFIX_PATTERN = String.raw`(^|[\s^_=+\-*/<>()\[\],;&:])`;
const TEXT_LATEX_COMMAND_PATTERN = new RegExp(
  `${COMMAND_PREFIX_PATTERN}(${TEXT_LATEX_COMMANDS.join("|")})(?=\\s*\\{)`,
  "gu",
);
const PROTECTED_TEXT_LATEX_COMMAND_PATTERN = new RegExp(
  `\\\\(?:${TEXT_LATEX_COMMANDS.join("|")})\\s*\\{`,
  "gu",
);
const ARGUMENT_LATEX_COMMAND_PATTERN = new RegExp(
  `${COMMAND_PREFIX_PATTERN}(${ARGUMENT_LATEX_COMMANDS.join("|")})(?=\\s*\\{)`,
  "gu",
);
const SYMBOL_LATEX_COMMAND_PATTERN = new RegExp(
  `${COMMAND_PREFIX_PATTERN}(${SYMBOL_LATEX_COMMANDS.join("|")})(?![A-Za-z])`,
  "gu",
);

/**
 * Repairs a decoded LaTeX fragment when a known command lost its leading
 * backslash. The grammar and command allowlists keep ordinary identifiers and
 * already-valid commands unchanged, making the repair deterministic and
 * idempotent.
 */
export function normalizeLatexCommandBackslashes(latex: string) {
  const withTextCommands = latex.replace(
    TEXT_LATEX_COMMAND_PATTERN,
    (_match, prefix: string, command: string) => `${prefix}\\${command}`,
  );
  let normalized = "";
  let cursor = 0;

  for (const match of withTextCommands.matchAll(PROTECTED_TEXT_LATEX_COMMAND_PATTERN)) {
    const matchIndex = match.index;
    if (matchIndex === undefined || matchIndex < cursor) continue;
    const openBraceIndex = withTextCommands.indexOf("{", matchIndex);
    const closeBraceIndex = findMatchingBrace(withTextCommands, openBraceIndex);
    if (openBraceIndex < 0 || closeBraceIndex < 0) continue;

    normalized += normalizeUnprotectedLatex(withTextCommands.slice(cursor, matchIndex));
    normalized += withTextCommands.slice(matchIndex, closeBraceIndex + 1);
    cursor = closeBraceIndex + 1;
  }

  normalized += normalizeUnprotectedLatex(withTextCommands.slice(cursor));
  return normalized;
}

function normalizeUnprotectedLatex(latex: string) {
  return latex
    .replace(
      ARGUMENT_LATEX_COMMAND_PATTERN,
      (_match, prefix: string, command: string) => `${prefix}\\${command}`,
    )
    .replace(
      SYMBOL_LATEX_COMMAND_PATTERN,
      (_match, prefix: string, command: string) => `${prefix}\\${command}`,
    );
}

function findMatchingBrace(value: string, openBraceIndex: number) {
  if (openBraceIndex < 0 || value[openBraceIndex] !== "{") return -1;
  let depth = 0;
  for (let index = openBraceIndex; index < value.length; index += 1) {
    if (value[index - 1] === "\\") continue;
    if (value[index] === "{") depth += 1;
    if (value[index] === "}") depth -= 1;
    if (depth === 0) return index;
  }
  return -1;
}

/**
 * Applies command repair only inside recognized inline/display math delimiters.
 * Learner-facing prose outside math is intentionally preserved verbatim.
 */
export function normalizeMathTextLatexCommands(value: string) {
  return normalizeEscapedMathClosers(value).replace(
    MATH_DELIMITER_PATTERN,
    (
      _match,
      dollarDisplay: string | undefined,
      bracketDisplay: string | undefined,
      parenthesizedInline: string | undefined,
      dollarInline: string | undefined,
    ) => {
      if (dollarDisplay !== undefined) {
        return `$$${normalizeLatexCommandBackslashes(dollarDisplay)}$$`;
      }
      if (bracketDisplay !== undefined) {
        return `\\[${normalizeLatexCommandBackslashes(bracketDisplay)}\\]`;
      }
      if (parenthesizedInline !== undefined) {
        return `\\(${normalizeLatexCommandBackslashes(parenthesizedInline)}\\)`;
      }
      return `$${normalizeLatexCommandBackslashes(dollarInline ?? "")}$`;
    },
  );
}

/**
 * Repairs an accidental escape before a closing math delimiter. Providers can
 * emit `\$`/`\$$` where the backslash was meant for the preceding LaTeX command;
 * only an active math span followed by a closing boundary is repaired so prose
 * currency escapes remain untouched.
 */
export function normalizeEscapedMathClosers(value: string) {
  let normalized = "";
  let cursor = 0;
  let codeDelimiterLength = 0;
  let mathDelimiterLength = 0;

  while (cursor < value.length) {
    const character = value[cursor]!;

    if (character === "`") {
      const delimiterLength = countRepeatedCharacter(value, cursor, "`");
      if (codeDelimiterLength === 0) {
        codeDelimiterLength = delimiterLength;
      } else if (codeDelimiterLength === delimiterLength) {
        codeDelimiterLength = 0;
      }
      normalized += value.slice(cursor, cursor + delimiterLength);
      cursor += delimiterLength;
      continue;
    }

    if (codeDelimiterLength > 0) {
      normalized += character;
      cursor += 1;
      continue;
    }

    if (character === "\\") {
      const escapedDelimiterLength = countRepeatedCharacter(value, cursor + 1, "$");
      if (
        mathDelimiterLength > 0 &&
        escapedDelimiterLength === mathDelimiterLength &&
        isMathClosingBoundary(value[cursor + 1 + escapedDelimiterLength])
      ) {
        normalized += "$".repeat(escapedDelimiterLength);
        mathDelimiterLength = 0;
        cursor += escapedDelimiterLength + 1;
        continue;
      }

      normalized += value.slice(cursor, cursor + Math.min(2, value.length - cursor));
      cursor += Math.min(2, value.length - cursor);
      continue;
    }

    if (character === "$") {
      const delimiterLength = Math.min(countRepeatedCharacter(value, cursor, "$"), 2);
      if (mathDelimiterLength === 0) {
        mathDelimiterLength = delimiterLength;
      } else if (mathDelimiterLength === delimiterLength) {
        mathDelimiterLength = 0;
      }
      normalized += "$".repeat(delimiterLength);
      cursor += delimiterLength;
      continue;
    }

    normalized += character;
    cursor += 1;
  }

  return normalized;
}

function countRepeatedCharacter(value: string, start: number, character: string) {
  let end = start;
  while (value[end] === character) end += 1;
  return end - start;
}

function isMathClosingBoundary(character: string | undefined) {
  return character === undefined || /[\s.,;:!?)]/u.test(character);
}
