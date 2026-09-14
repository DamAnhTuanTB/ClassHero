import {
  normalizeLatexCommandBackslashes,
  normalizeLatexEnvironmentPairs,
  normalizeMathTextLatexSegments,
  normalizeMissingInlineMathClosers,
  normalizeRepeatedLatexCommandBackslashes,
} from "@learning-path/shared";

export const LEARNING_CONTENT_KATEX_MACROS = {
  "\\frac": "\\dfrac",
  "\\N": "\\mathbb{N}",
  "\\R": "\\mathbb{R}",
  "\\Z": "\\mathbb{Z}",
  "\\wideparen": "\\overset{\\frown}{#1}",
  "\\overparen": "\\overset{\\frown}{#1}",
} as const;

const DISPLAY_MATH_ENVIRONMENT_NAMES = [
  "aligned",
  "alignedat",
  "array",
  "cases",
  "gather",
  "gathered",
  "matrix",
  "pmatrix",
  "bmatrix",
  "Bmatrix",
  "vmatrix",
  "Vmatrix",
  "split",
] as const;

const MISPLACED_DISPLAY_MATH_CLOSER_PATTERN = new RegExp(
  `\\$\\$(?=\\s*\\\\end\\{(?:${DISPLAY_MATH_ENVIRONMENT_NAMES.join("|")})\\})`,
  "gu",
);

const MISALIGNED_INFERENCE_WITH_EQUALITY_PATTERN =
  /(^|\\\\)\s*&\s*(\\(?:Longleftrightarrow|Longrightarrow|Longleftarrow|Leftrightarrow|Rightarrow|Leftarrow|impliedby|implies|iff))\s+([^&\r\n]+?)\s*=\s*/gmu;
const MISALIGNED_LEADING_INFERENCE_PATTERN =
  /(^|\\\\)\s*&\s*(\\(?:Longleftrightarrow|Longrightarrow|Longleftarrow|Leftrightarrow|Rightarrow|Leftarrow|impliedby|implies|iff))/gmu;
const LOGICAL_ALIGNMENT_ENVIRONMENT_PATTERN =
  /\\begin\{(aligned|alignedat|split)\}([\s\S]*?)\\end\{\1\}/gu;
/**
 * Keep fraction numerators and denominators readable at the shared learning-content
 * font size. Display-style fractions preserve the outer font-size while avoiding
 * the script-size reduction used by inline `\\frac`.
 */
export function normalizeLearningContentLatex(value: string) {
  return normalizeLatexEnvironmentPairs(
    normalizeLatexCommandBackslashes(
      normalizeLearningContentLatexCommandEscapes(
        normalizeDecodedLearningContentLatex(value),
      ),
    ),
  ).replace(/\\frac\b/gu, "\\dfrac");
}

function normalizeDecodedLearningContentLatex(value: string) {
  return value
    .replaceAll(`${String.fromCharCode(9)}riangle`, "\\triangle")
    .replaceAll(`${String.fromCharCode(12)}rac`, "\\frac")
    .replaceAll(`${String.fromCharCode(8)}eta`, "\\beta")
    .replaceAll(`${String.fromCharCode(13)}ight`, "\\right")
    .replaceAll(`${String.fromCharCode(28)}hat{`, "\\widehat{")
    .replaceAll(`${String.fromCharCode(27)}0`, "\\circ");
}

/**
 * Repairs commands whose leading backslash was escaped twice without consuming
 * valid `\\\\` row separators immediately before the command. An odd run is
 * already `row separators + command`; an even run has one duplicated command
 * backslash and only that extra slash is removed.
 */
export function normalizeLearningContentLatexCommandEscapes(value: string) {
  return normalizeRepeatedLatexCommandBackslashes(value);
}

/**
 * Normalizes provider-authored Mathpix Markdown before it is converted to HTML.
 * Keep this pipeline shared and testable because it is used by Quiz, Test,
 * Summary and every other surface rendered through MathpixMarkdownRenderer.
 */
export function normalizeMathpixMarkdown(value: string) {
  const repairedDisplayMathClosers = normalizeStandaloneDisplayMathBlocks(
    normalizeMissingInlineMathClosers(value).replace(
      MISPLACED_DISPLAY_MATH_CLOSER_PATTERN,
      "",
    ),
  );

  return normalizeMathpixLatexLists(
    normalizeMathTextLatexSegments(repairedDisplayMathClosers, (latex) =>
      normalizeLearningContentMathMarkdown(
        normalizeLearningContentLatex(
          trimMathDelimiterPadding(normalizeDecodedLearningContentLatex(latex)),
        ),
      ),
    ),
  );
}

/**
 * Mathpix Markdown treats a line containing only `=` as a Setext heading even
 * when it appears between standalone `$$` delimiter lines. Provider responses
 * commonly split long equations at that relation sign. Collapse only complete
 * display-math blocks outside fenced code so Markdown cannot consume their
 * inner lines before the math parser sees them.
 */
function normalizeStandaloneDisplayMathBlocks(value: string) {
  const lines = value.split("\n");
  const normalizedLines: string[] = [];
  let codeFence: { marker: "`" | "~"; length: number } | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const fence = line.match(/^\s*(`{3,}|~{3,})/u)?.[1];
    if (fence) {
      const marker = fence[0] as "`" | "~";
      if (!codeFence) {
        codeFence = { marker, length: fence.length };
      } else if (codeFence.marker === marker && fence.length >= codeFence.length) {
        codeFence = null;
      }
      normalizedLines.push(line);
      continue;
    }
    if (codeFence || !/^\s*\$\$\s*$/u.test(line)) {
      normalizedLines.push(line);
      continue;
    }

    let closingIndex = index + 1;
    while (closingIndex < lines.length && !/^\s*\$\$\s*$/u.test(lines[closingIndex]!)) {
      closingIndex += 1;
    }
    if (closingIndex >= lines.length) {
      normalizedLines.push(line);
      continue;
    }

    const body = lines
      .slice(index + 1, closingIndex)
      .map((bodyLine) => bodyLine.trim())
      .filter(Boolean)
      .join(" ");
    if (!body) {
      normalizedLines.push(line, lines[closingIndex]!);
      index = closingIndex;
      continue;
    }
    normalizedLines.push(`$$${body}$$`);
    index = closingIndex;
  }

  return normalizedLines.join("\n");
}

/**
 * Mathpix uses LaTeX list environments in MMD, while mathpix-markdown-it leaves
 * those commands visible as plain text. Convert only line-level list commands
 * outside fenced code to Markdown and keep item content, including math, intact.
 */
function normalizeMathpixLatexLists(value: string) {
  const listStack: Array<"enumerate" | "itemize"> = [];
  let codeFence: { marker: "`" | "~"; length: number } | null = null;

  const normalizedLines = value.split("\n").map((line) => {
    const fence = line.match(/^\s*(`{3,}|~{3,})/u)?.[1];
    if (fence) {
      const marker = fence[0] as "`" | "~";
      if (!codeFence) {
        codeFence = { marker, length: fence.length };
      } else if (codeFence.marker === marker && fence.length >= codeFence.length) {
        codeFence = null;
      }
      return line;
    }
    if (codeFence) return line;

    const boundary = line.match(/^\s*\\(begin|end)\{(itemize|enumerate)\}\s*$/u);
    if (boundary) {
      const action = boundary[1];
      const environment = boundary[2] as "enumerate" | "itemize";
      if (action === "begin") {
        listStack.push(environment);
      } else if (listStack.at(-1) === environment) {
        listStack.pop();
      } else {
        return line;
      }
      return "";
    }

    const item = line.match(/^\s*\\item(?:\[([^\]]*)\])?\s*(.*)$/u);
    if (item && listStack.length > 0) {
      const label = item[1]?.trim() ?? "";
      const content = item[2] ?? "";
      const indentation = "  ".repeat(Math.max(0, listStack.length - 1));
      const marker = listStack.at(-1) === "enumerate" ? "1." : "-";
      const visibleLabel = label && label !== "*" && label !== "-";
      return `${indentation}${marker} ${
        visibleLabel ? `**${label}** ` : ""
      }${content}`.trimEnd();
    }

    if (listStack.length > 0 && line.trim()) {
      return `${"  ".repeat(listStack.length)}${line.trimStart()}`;
    }
    return line;
  });

  return listStack.length === 0 ? normalizedLines.join("\n") : value;
}

function trimMathDelimiterPadding(value: string) {
  let start = 0;
  while (start < value.length && /\s/u.test(value[start]!)) start += 1;

  let end = value.length;
  while (end > start && /\s/u.test(value[end - 1]!)) {
    let precedingBackslashes = 0;
    for (let index = end - 2; index >= start && value[index] === "\\"; index -= 1) {
      precedingBackslashes += 1;
    }
    if (precedingBackslashes % 2 === 1) break;
    end -= 1;
  }

  return value.slice(start, end);
}

/**
 * Repairs a common AI-authored Markdown error where the display-math closer is
 * emitted before the closing LaTeX environment, for example
 * `$$\\begin{aligned}...$$\\end{aligned}$$`.
 */
export function normalizeLearningContentMathMarkdown(value: string) {
  return value
    .replace(MISPLACED_DISPLAY_MATH_CLOSER_PATTERN, "")
    .replace(
      LOGICAL_ALIGNMENT_ENVIRONMENT_PATTERN,
      (_, environmentName: string, body: string) =>
        `\\begin{${environmentName}}${body
          .replace(
            MISALIGNED_INFERENCE_WITH_EQUALITY_PATTERN,
            (_match: string, rowStart: string, inference: string, leftHandSide: string) =>
              `${rowStart}${inference}\\quad ${leftHandSide.trim()} &= `,
          )
          .replace(
            MISALIGNED_LEADING_INFERENCE_PATTERN,
            "$1$2",
          )}\\end{${environmentName}}`,
    );
}
