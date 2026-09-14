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
  "angle",
  "triangle",
  "left",
  "right",
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
  "quad",
  "qquad",
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

const REPEATED_LATEX_COMMAND_BACKSLASH_PATTERN = new RegExp(
  `\\\\{2,}(?=(?:${RECOGNIZED_LATEX_COMMAND_PATTERN_SOURCE})(?:\\b|\\s*\\{))`,
  "gu",
);

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

const LATEX_ENVIRONMENT_TOKEN_PATTERN = /\\(begin|end)\{([A-Za-z][A-Za-z0-9*]*)\}/gu;
const DISPLAY_MATH_BLOCK_PATTERN = /\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]/gu;
const MISPLACED_DOLLAR_DISPLAY_CLOSER_PATTERN =
  /\$\$(?=(?:\s*\\end\{[A-Za-z][A-Za-z0-9*]*\})+\s*\$\$)/gu;
const MISPLACED_BRACKET_DISPLAY_CLOSER_PATTERN =
  /\\\](?=(?:\s*\\end\{[A-Za-z][A-Za-z0-9*]*\})+\s*\\\])/gu;
const MAX_LEARNER_MATH_REPAIR_PASSES = 3;

export const LEARNER_MATH_TEXT_SYNTAX_DESCRIPTION =
  "Mọi công thức phải dùng cặp delimiter đầy đủ (`$...$`, `$$...$$`, `\\(...\\)` hoặc `\\[...\\]`), không dùng backtick để đóng công thức; các dấu `{}` và từng cặp `\\begin{...}`/`\\end{...}` phải cân bằng.";

/**
 * Repairs a decoded LaTeX fragment when a known command lost its leading
 * backslash. The grammar and command allowlists keep ordinary identifiers and
 * already-valid commands unchanged, making the repair deterministic and
 * idempotent.
 */
export function normalizeLatexCommandBackslashes(latex: string) {
  const decodedLatex = normalizeRepeatedLatexCommandBackslashes(
    normalizeDecodedLatexControlCharacters(latex),
  );
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
 * Removes only a duplicated command escape while preserving valid LaTeX row
 * separators immediately before a command. Odd runs already represent one or
 * more `\\\\` row separators followed by the command's own backslash.
 */
export function normalizeRepeatedLatexCommandBackslashes(latex: string) {
  return latex.replace(REPEATED_LATEX_COMMAND_BACKSLASH_PATTERN, (backslashes) =>
    backslashes.length % 2 === 0 ? backslashes.slice(1) : backslashes,
  );
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

/**
 * Reports only deterministic syntax defects that remain unsafe for math
 * rendering. This is intentionally a warning predicate rather than a schema
 * rejection so generated content can still reach the admin review flow.
 */
export function hasMalformedMathText(value: string) {
  let dollarDelimiterLength = 0;
  let parenthesizedMath = false;
  let bracketedMath = false;
  let braceDepth = 0;
  let codeDelimiterLength = 0;
  const environments: string[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!;

    if (character === "`") {
      const delimiterLength = countRepeatedCharacter(value, index, "`");
      if (codeDelimiterLength === 0) codeDelimiterLength = delimiterLength;
      else if (codeDelimiterLength === delimiterLength) codeDelimiterLength = 0;
      index += delimiterLength - 1;
      continue;
    }
    if (codeDelimiterLength > 0) continue;

    const codePoint = character.codePointAt(0) ?? 0;
    if (
      codePoint <= 8 ||
      codePoint === 11 ||
      codePoint === 12 ||
      (codePoint >= 14 && codePoint <= 31) ||
      codePoint === 127
    ) {
      return true;
    }

    if (character === "\\") {
      const token = value.slice(index, index + 2);
      if (token === "\\(") {
        if (parenthesizedMath || bracketedMath || dollarDelimiterLength > 0) {
          return true;
        }
        parenthesizedMath = true;
        index += 1;
        continue;
      }
      if (token === "\\)") {
        if (!parenthesizedMath) return true;
        if (braceDepth !== 0) return true;
        parenthesizedMath = false;
        index += 1;
        continue;
      }
      if (token === "\\[") {
        if (bracketedMath || parenthesizedMath || dollarDelimiterLength > 0) {
          return true;
        }
        bracketedMath = true;
        index += 1;
        continue;
      }
      if (token === "\\]") {
        if (!bracketedMath) return true;
        if (braceDepth !== 0) return true;
        bracketedMath = false;
        index += 1;
        continue;
      }
      index += 1;
      continue;
    }

    if (character === "$") {
      const delimiterLength = Math.min(countRepeatedCharacter(value, index, "$"), 2);
      if (parenthesizedMath || bracketedMath) return true;
      if (dollarDelimiterLength === 0) dollarDelimiterLength = delimiterLength;
      else if (dollarDelimiterLength === delimiterLength) {
        if (braceDepth !== 0) return true;
        dollarDelimiterLength = 0;
      } else return true;
      index += delimiterLength - 1;
      continue;
    }

    const inMath = dollarDelimiterLength > 0 || parenthesizedMath || bracketedMath;
    if (!inMath) continue;
    if (character === "{") braceDepth += 1;
    if (character === "}") {
      if (braceDepth === 0) return true;
      braceDepth -= 1;
    }
  }

  if (
    dollarDelimiterLength > 0 ||
    parenthesizedMath ||
    bracketedMath ||
    braceDepth !== 0
  ) {
    return true;
  }

  const environmentSource = maskMarkdownCodeSpans(value);
  for (const match of environmentSource.matchAll(LATEX_ENVIRONMENT_TOKEN_PATTERN)) {
    if (isEscapedByAnotherBackslash(environmentSource, match.index ?? 0)) continue;
    const operation = match[1];
    const environment = match[2];
    if (!operation || !environment) continue;
    if (operation === "begin") environments.push(environment);
    else if (environments.pop() !== environment) return true;
  }
  return environments.length > 0;
}

function maskMarkdownCodeSpans(value: string) {
  let masked = "";
  let codeDelimiterLength = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "`") {
      const delimiterLength = countRepeatedCharacter(value, index, "`");
      if (codeDelimiterLength === 0) codeDelimiterLength = delimiterLength;
      else if (codeDelimiterLength === delimiterLength) codeDelimiterLength = 0;
      masked += " ".repeat(delimiterLength);
      index += delimiterLength - 1;
      continue;
    }
    masked += codeDelimiterLength > 0 ? " " : value[index];
  }
  return masked;
}

function isEscapedByAnotherBackslash(value: string, index: number) {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
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
 * Repairs mechanically recoverable begin/end defects inside display-math
 * delimiters. Prose, inline math and Markdown code spans remain untouched.
 */
export function normalizeMathTextLatexEnvironments(value: string) {
  return transformOutsideMarkdownCodeSpans(value, (segment) =>
    segment
      .replace(MISPLACED_DOLLAR_DISPLAY_CLOSER_PATTERN, "")
      .replace(MISPLACED_BRACKET_DISPLAY_CLOSER_PATTERN, "")
      .replace(
        DISPLAY_MATH_BLOCK_PATTERN,
        (
          _block,
          dollarContent: string | undefined,
          bracketContent: string | undefined,
        ) => {
          const content = dollarContent ?? bracketContent ?? "";
          const repaired = balanceLatexEnvironments(content);
          return dollarContent === undefined ? `\\[${repaired}\\]` : `$$${repaired}$$`;
        },
      ),
  );
}

/**
 * Balances LaTeX environments inside an already extracted math fragment.
 * Renderers use this for legacy Tiptap and Mathpix nodes that no longer carry
 * their outer Markdown delimiters.
 */
export function normalizeLatexEnvironmentPairs(latex: string) {
  return balanceLatexEnvironments(latex);
}

/**
 * Runs the shared deterministic learner-text repair pipeline to a bounded fixed
 * point. Remaining malformed syntax is intentionally left for review rather
 * than being repaired by guessing at mathematical meaning.
 */
export function normalizeLearnerMathTextSyntax(value: string) {
  let normalized = value;
  for (let pass = 0; pass < MAX_LEARNER_MATH_REPAIR_PASSES; pass += 1) {
    const repaired = stripForbiddenTextControlCharacters(
      normalizeMathTextLatexEnvironments(
        normalizeMathTextLatexCommands(normalizeMissingInlineMathClosers(normalized)),
      ),
    );
    if (repaired === normalized || !hasMalformedMathText(repaired)) return repaired;
    normalized = repaired;
  }
  return normalized;
}

/**
 * Repairs a missing inline-math closer only when the current span crosses a
 * clear sentence boundary into ordinary prose. It also removes an unmatched
 * dollar immediately followed by a clearly prose-only sentence. The evidence
 * gates deliberately exclude content that still looks mathematical, so valid
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
      if (isHighConfidenceOrphanInlineMathDollar(content)) {
        normalized += content;
        cursor = contentEnd;
        continue;
      }
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
    const proseLead = proseSuffix.split(/(?:\r?\n|\$|\\\(|\\\[)/u, 1)[0]?.trim() ?? "";
    if (
      looksLikeCompleteMathPrefix(mathPrefix) &&
      looksLikeOrdinaryProseSuffix(proseLead)
    ) {
      return prefixEnd;
    }
  }

  const terminalPunctuation = /[.!?]\s*$/u.exec(content);
  if (terminalPunctuation?.index !== undefined) {
    const prefixEnd = trimEndIndex(content, terminalPunctuation.index);
    const mathPrefix = content.slice(0, prefixEnd);
    if (
      looksLikeCompleteMathPrefix(mathPrefix) &&
      /(?:\\[A-Za-z]+|[=^_+*/<>-]|[\])}])\s*$/u.test(mathPrefix)
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

function isHighConfidenceOrphanInlineMathDollar(content: string) {
  if (!/^\s+\p{Lu}/u.test(content)) return false;
  const firstSentence = content.split(/(?<=[.!?])(?:\s|$)/u, 1)[0]?.trim() ?? "";
  return (
    looksLikeOrdinaryProseSuffix(firstSentence) &&
    !/(?:\\[A-Za-z]+|[=^_+*<>[\]{}])/u.test(firstSentence)
  );
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

function balanceLatexEnvironments(content: string) {
  const openEnvironments: string[] = [];
  let normalized = "";
  let cursor = 0;

  for (const match of content.matchAll(LATEX_ENVIRONMENT_TOKEN_PATTERN)) {
    const tokenIndex = match.index;
    const operation = match[1];
    const environmentName = match[2];
    if (tokenIndex === undefined || !operation || !environmentName) continue;

    normalized += content.slice(cursor, tokenIndex);
    if (operation === "begin") {
      normalized += match[0];
      openEnvironments.push(environmentName);
    } else {
      const matchingOpenIndex = openEnvironments.lastIndexOf(environmentName);
      if (matchingOpenIndex >= 0) {
        while (openEnvironments.length - 1 > matchingOpenIndex) {
          normalized += `\\end{${openEnvironments.pop()!}}`;
        }
        normalized += match[0];
        openEnvironments.pop();
      }
    }
    cursor = tokenIndex + match[0].length;
  }

  normalized += content.slice(cursor);
  while (openEnvironments.length > 0) {
    normalized += `\\end{${openEnvironments.pop()!}}`;
  }
  return normalized;
}

function transformOutsideMarkdownCodeSpans(
  value: string,
  transform: (segment: string) => string,
) {
  let normalized = "";
  let segmentStart = 0;
  let cursor = 0;

  while (cursor < value.length) {
    if (value[cursor] !== "`") {
      cursor += 1;
      continue;
    }
    const delimiterLength = countRepeatedCharacter(value, cursor, "`");
    const closer = findMatchingDelimiterRun(
      value,
      cursor + delimiterLength,
      "`",
      delimiterLength,
    );
    if (closer < 0) break;

    normalized += transform(value.slice(segmentStart, cursor));
    const codeSpanEnd = closer + delimiterLength;
    normalized += value.slice(cursor, codeSpanEnd);
    cursor = codeSpanEnd;
    segmentStart = codeSpanEnd;
  }

  normalized += transform(value.slice(segmentStart));
  return normalized;
}

function isMathClosingBoundary(character: string | undefined) {
  return character === undefined || /[\s.,;:!?)]/u.test(character);
}
