export const LEARNING_CONTENT_KATEX_MACROS = {
  "\\frac": "\\dfrac",
  "\\N": "\\mathbb{N}",
  "\\R": "\\mathbb{R}",
  "\\Z": "\\mathbb{Z}",
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
  return value.replace(/\\frac\b/gu, "\\dfrac");
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
