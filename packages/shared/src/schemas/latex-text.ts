const MATH_DELIMITER_PATTERN =
  /\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|(?<!\\)\$(?!\$)((?:\\.|[^$\\\n])+?)(?<!\\)\$(?!\$)/gu;

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
  "ce",
  "pu",
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
  `${COMMAND_PREFIX_PATTERN}(${SYMBOL_LATEX_COMMANDS.join("|")})(?![\\p{L}\\p{M}])`,
  "gu",
);

const RECOGNIZED_LATEX_COMMAND_PATTERN_SOURCE = [
  ...TEXT_LATEX_COMMANDS,
  ...ARGUMENT_LATEX_COMMANDS,
  ...SYMBOL_LATEX_COMMANDS,
]
  .sort((left, right) => right.length - left.length)
  .join("|");

const DECODED_LATEX_ESCAPE_REPLACEMENTS = [
  [`${String.fromCharCode(9)}riangle`, String.raw`\triangle`],
  [`${String.fromCharCode(12)}rac`, String.raw`\frac`],
  [`${String.fromCharCode(8)}eta`, String.raw`\beta`],
  [`${String.fromCharCode(13)}ight`, String.raw`\right`],
  [`${String.fromCharCode(28)}widehat`, String.raw`\widehat`],
  [`${String.fromCharCode(28)}hat{`, String.raw`\widehat{`],
  [`${String.fromCharCode(28)}root{`, String.raw`\sqrt{`],
  [`${String.fromCharCode(27)}0`, String.raw`\circ`],
] as const;

const ENCODED_SQUARE_ROOT_CONTROL_PREFIX_PATTERN = /\\*u001croot/giu;
const ENCODED_LATEX_CONTROL_PREFIX_PATTERN = new RegExp(
  String.raw`\\*u001c(?=(?:${RECOGNIZED_LATEX_COMMAND_PATTERN_SOURCE})(?:\b|\s*\{))`,
  "giu",
);
const DECODED_LATEX_CONTROL_PREFIX_PATTERN = new RegExp(
  `${String.fromCharCode(28)}(?=(?:${RECOGNIZED_LATEX_COMMAND_PATTERN_SOURCE})(?:\\b|\\s*\\{))`,
  "gu",
);

/**
 * Repairs a decoded LaTeX fragment when a known command lost its leading
 * backslash. The grammar and command allowlists keep ordinary identifiers and
 * already-valid commands unchanged, making the repair deterministic and
 * idempotent.
 */
export function normalizeLatexCommandBackslashes(latex: string) {
  const decodedLatex = normalizeDecodedLatexControlCharacters(latex);
  const withTextCommands = decodedLatex.replace(
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

/**
 * Repairs decoded control-character fragments that can replace the leading
 * backslash of a LaTeX command in provider JSON. Unknown non-printable control
 * characters are removed from the LaTeX fragment instead of reaching KaTeX.
 */
function normalizeDecodedLatexControlCharacters(latex: string) {
  let normalized = latex
    .replace(ENCODED_SQUARE_ROOT_CONTROL_PREFIX_PATTERN, String.raw`\sqrt`)
    .replace(ENCODED_LATEX_CONTROL_PREFIX_PATTERN, "\\");
  for (const [broken, repaired] of DECODED_LATEX_ESCAPE_REPLACEMENTS) {
    normalized = normalized.replaceAll(broken, repaired);
  }
  return stripForbiddenTextControlCharacters(
    normalized.replace(DECODED_LATEX_CONTROL_PREFIX_PATTERN, "\\"),
  );
}

export function stripForbiddenTextControlCharacters(value: string) {
  return Array.from(value)
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return !(
        code <= 8 ||
        code === 11 ||
        code === 12 ||
        (code >= 14 && code <= 31) ||
        code === 127
      );
    })
    .join("");
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
  return normalizeMathTextLatexSegments(value, normalizeLatexCommandBackslashes);
}

/**
 * Repairs a missing inline-math closer only when the current span crosses a
 * clear sentence boundary into ordinary prose. The evidence gate deliberately
 * excludes content that still looks mathematical after the boundary, so valid
 * decimals, multi-part formulas, display math, code spans, and escaped dollars
 * remain byte-for-byte unchanged.
 */
export function normalizeMissingInlineMathClosers(value: string) {
  let normalized = "";
  let cursor = 0;

  while (cursor < value.length) {
    if (value[cursor] === "\\") {
      const end = Math.min(cursor + 2, value.length);
      normalized += value.slice(cursor, end);
      cursor = end;
      continue;
    }

    if (value[cursor] === "`") {
      const delimiterLength = countRepeatedCharacter(value, cursor, "`");
      const closer = findMatchingDelimiterRun(
        value,
        cursor + delimiterLength,
        "`",
        delimiterLength,
      );
      if (closer < 0) {
        normalized += value.slice(cursor);
        break;
      }
      const end = closer + delimiterLength;
      normalized += value.slice(cursor, end);
      cursor = end;
      continue;
    }

    if (value[cursor] !== "$") {
      normalized += value[cursor];
      cursor += 1;
      continue;
    }

    const delimiterLength = countRepeatedCharacter(value, cursor, "$");
    if (delimiterLength >= 2) {
      const closer = findMatchingDelimiterRun(value, cursor + 2, "$", 2);
      if (closer < 0) {
        normalized += value.slice(cursor);
        break;
      }
      const end = closer + 2;
      normalized += value.slice(cursor, end);
      cursor = end;
      continue;
    }

    const nextDelimiter = findNextInlineMathDollar(value, cursor + 1);
    const contentEnd = nextDelimiter < 0 ? value.length : nextDelimiter;
    const content = value.slice(cursor + 1, contentEnd);
    const repairOffset = findHighConfidenceInlineMathCloser(content);
    if (repairOffset !== null) {
      normalized += `$${content.slice(0, repairOffset)}$${content.slice(repairOffset)}`;
      cursor = contentEnd;
      continue;
    }

    if (nextDelimiter < 0) {
      normalized += value.slice(cursor);
      break;
    }
    normalized += value.slice(cursor, nextDelimiter + 1);
    cursor = nextDelimiter + 1;
  }

  return normalized;
}

/**
 * Applies a LaTeX-fragment normalizer only to recognized math spans while
 * preserving all surrounding prose byte-for-byte. Render pipelines must use
 * this boundary instead of running LaTeX repair over a complete Markdown value.
 */
export function normalizeMathTextLatexSegments(
  value: string,
  normalizeLatex: (latex: string) => string,
) {
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
        return `$$${normalizeLatex(dollarDisplay)}$$`;
      }
      if (bracketDisplay !== undefined) {
        return `\\[${normalizeLatex(bracketDisplay)}\\]`;
      }
      if (parenthesizedInline !== undefined) {
        return `\\(${normalizeLatex(parenthesizedInline)}\\)`;
      }
      return `$${normalizeLatex(dollarInline ?? "")}$`;
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

function findMatchingDelimiterRun(
  value: string,
  start: number,
  character: string,
  delimiterLength: number,
) {
  for (let index = start; index < value.length; index += 1) {
    if (value[index] === "\\") {
      index += 1;
      continue;
    }
    if (
      value[index] === character &&
      countRepeatedCharacter(value, index, character) === delimiterLength
    ) {
      return index;
    }
  }
  return -1;
}

function findNextInlineMathDollar(value: string, start: number) {
  for (let index = start; index < value.length; index += 1) {
    if (value[index] === "\\") {
      index += 1;
      continue;
    }
    if (value[index] !== "$") continue;
    const delimiterLength = countRepeatedCharacter(value, index, "$");
    if (delimiterLength === 1) return index;
    index += delimiterLength - 1;
  }
  return -1;
}

function findHighConfidenceInlineMathCloser(content: string) {
  const sentenceBoundaryPattern = /[.!?](?=\s+\p{Lu})/gu;
  for (const match of content.matchAll(sentenceBoundaryPattern)) {
    const punctuationIndex = match.index;
    if (punctuationIndex === undefined) continue;
    const prefixEnd = trimEndIndex(content, punctuationIndex);
    const mathPrefix = content.slice(0, prefixEnd);
    const proseSuffix = content.slice(punctuationIndex + 1).trim();
    if (
      looksLikeCompleteMathPrefix(mathPrefix) &&
      looksLikeOrdinaryProseSuffix(proseSuffix)
    ) {
      return prefixEnd;
    }
  }
  return null;
}

function trimEndIndex(value: string, end: number) {
  let result = end;
  while (result > 0 && /\s/u.test(value[result - 1]!)) result -= 1;
  return result;
}

function looksLikeCompleteMathPrefix(value: string) {
  if (!value.trim() || !hasBalancedUnescapedBraces(value)) return false;
  return /(?:\\[A-Za-z]+|\d|[=^_+*/<>\-[\]()])/u.test(value);
}

function looksLikeOrdinaryProseSuffix(value: string) {
  if (!/^\p{Lu}/u.test(value) || /[\\^_=+*<>[\]{}]/u.test(value)) return false;
  return (value.match(/\p{L}[\p{L}\p{M}'’-]*/gu) ?? []).length >= 2;
}

function hasBalancedUnescapedBraces(value: string) {
  let depth = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "\\") {
      index += 1;
      continue;
    }
    if (value[index] === "{") depth += 1;
    if (value[index] === "}") depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0;
}

function isMathClosingBoundary(character: string | undefined) {
  return character === undefined || /[\s.,;:!?)]/u.test(character);
}
