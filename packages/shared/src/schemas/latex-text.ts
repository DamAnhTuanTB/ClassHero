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
  return value.replace(
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
