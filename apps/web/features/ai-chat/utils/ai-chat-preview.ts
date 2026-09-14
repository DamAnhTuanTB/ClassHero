const MARKDOWN_IMAGE_PATTERN = /!\[([^\]]*)\]\([^\n)]*\)/gu;
const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\([^\n)]*\)/gu;
const MARKDOWN_AUTOLINK_PATTERN = /<(https?:\/\/[^>]+)>/giu;
const MARKDOWN_HTML_TAG_PATTERN = /<[^>]+>/gu;
const MARKDOWN_LINE_PREFIX_PATTERN =
  /^\s{0,3}(?:#{1,6}|>|(?:[-+*]|\d+[.)])\s+)\s*/gmu;
const MARKDOWN_TASK_MARKER_PATTERN = /^\s*\[(?:x| )\]\s*/gimu;
const MARKDOWN_FENCE_PATTERN = /^\s*```[^\n]*$|^\s*~~~[^\n]*$/gmu;
const MARKDOWN_ESCAPED_PUNCTUATION_PATTERN = /\\([\\`*{}[\]()#+\-.!_>])/gu;
const MARKDOWN_UNMATCHED_OPENING_STAR_PATTERN = /(^|[\s([{])\*{1,3}(?=\S)/gu;
const MARKDOWN_UNMATCHED_CLOSING_STAR_PATTERN =
  /(?<=\S)\*{1,3}(?=$|[\s)\]},.!?:;])/gu;
const LATEX_DISPLAY_BRACKET_PATTERN = /\\\[([\s\S]*?)\\\]/gu;
const LATEX_INLINE_PAREN_PATTERN = /\\\(([^\n]*?)\\\)/gu;
const LATEX_DISPLAY_DOLLAR_PATTERN = /\$\$([\s\S]*?)\$\$/gu;
const LATEX_INLINE_DOLLAR_PATTERN = /(?<!\\)\$([^$\n]+?)(?<!\\)\$/gu;
const LITERAL_DOLLAR_PLACEHOLDER = "\uE000";

/** Converts the short Markdown message excerpt returned by Chat AI into one-line text. */
export function formatAiChatPreview(value: string | null | undefined) {
  if (!value) return "";

  const withoutMarkdown = value
    .replace(/\r\n?/gu, "\n")
    .replace(MARKDOWN_FENCE_PATTERN, " ")
    .replace(MARKDOWN_IMAGE_PATTERN, "$1")
    .replace(MARKDOWN_LINK_PATTERN, "$1")
    .replace(MARKDOWN_AUTOLINK_PATTERN, "$1")
    .replace(MARKDOWN_HTML_TAG_PATTERN, " ")
    .replace(MARKDOWN_LINE_PREFIX_PATTERN, "")
    .replace(MARKDOWN_TASK_MARKER_PATTERN, "")
    .replace(/\*\*\*([^*\n]+)\*\*\*/gu, "$1")
    .replace(/___([^_\n]+)___/gu, "$1")
    .replace(/\*\*([^*\n]+)\*\*/gu, "$1")
    .replace(/__([^_\n]+)__/gu, "$1")
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/gu, "$1")
    .replace(/(?<!_)_([^_\n]+)_(?!_)/gu, "$1")
    .replace(/~~([^~\n]+)~~/gu, "$1")
    .replace(/`([^`\n]+)`/gu, "$1")
    .replace(MARKDOWN_UNMATCHED_OPENING_STAR_PATTERN, "$1")
    .replace(MARKDOWN_UNMATCHED_CLOSING_STAR_PATTERN, "");

  return formatLatexForPreview(withoutMarkdown)
    .replace(MARKDOWN_ESCAPED_PUNCTUATION_PATTERN, "$1")
    .replace(/\s+/gu, " ")
    .trim();
}

function formatLatexForPreview(value: string) {
  let normalized = value
    .replace(/\\\$/gu, LITERAL_DOLLAR_PLACEHOLDER)
    .replace(LATEX_DISPLAY_BRACKET_PATTERN, "$1")
    .replace(LATEX_INLINE_PAREN_PATTERN, "$1")
    .replace(LATEX_DISPLAY_DOLLAR_PATTERN, "$1")
    .replace(LATEX_INLINE_DOLLAR_PATTERN, "$1")
    .replace(/(^|\s)\$(?=\d)/gu, `$1${LITERAL_DOLLAR_PLACEHOLDER}`)
    .replace(/\${1,2}/gu, "")
    .replace(/\\(?:begin|end)\{[^{}]*\}/gu, " ")
    .replace(/\\\\/gu, " ")
    .replace(/\\(?:left|right)\b/gu, "")
    .replace(/\^\s*\{\s*\\circ\s*\}|\^\s*\\circ\b|\\circ\b/gu, "°")
    .replace(/\\(?:neq|ne)(?![A-Za-z])/gu, "≠")
    .replace(/\\leq?(?![A-Za-z])/gu, "≤")
    .replace(/\\geq?(?![A-Za-z])/gu, "≥")
    .replace(/\\times(?![A-Za-z])/gu, "×")
    .replace(/\\cdot(?![A-Za-z])/gu, "·")
    .replace(/\\pm(?![A-Za-z])/gu, "±")
    .replace(/\\approx(?![A-Za-z])/gu, "≈")
    .replace(/\\infty(?![A-Za-z])/gu, "∞")
    .replace(/\\in(?![A-Za-z])/gu, "∈")
    .replace(/\\subset(?:eq)?(?![A-Za-z])/gu, "⊂")
    .replace(/\\(?:Rightarrow|implies)(?![A-Za-z])/gu, "⇒")
    .replace(/\\(?:rightarrow|to)(?![A-Za-z])/gu, "→")
    .replace(/\\alpha(?![A-Za-z])/gu, "α")
    .replace(/\\beta(?![A-Za-z])/gu, "β")
    .replace(/\\gamma(?![A-Za-z])/gu, "γ")
    .replace(/\\delta(?![A-Za-z])/gu, "δ")
    .replace(/\\theta(?![A-Za-z])/gu, "θ")
    .replace(/\\pi(?![A-Za-z])/gu, "π")
    .replace(/\\(sin|cos|tan|cot|log|ln|max|min)(?![A-Za-z])/gu, "$1")
    .replace(/\\(?:quad|qquad|enspace|thinspace)\b|\\[,;:! ]/gu, " ")
    .replace(/&/gu, "")
    .replace(/~/gu, " ");

  for (let pass = 0; pass < 4; pass += 1) {
    const next = normalized
      .replace(/\\(?:dfrac|tfrac|frac)\{([^{}]*)\}\{([^{}]*)\}/gu, "$1/$2")
      .replace(/\\sqrt\{([^{}]*)\}/gu, "√($1)")
      .replace(
        /\\(?:text|textbf|textit|mathrm|mathbf|mathit|operatorname|overline|underline)\{([^{}]*)\}/gu,
        "$1",
      );
    if (next === normalized) break;
    normalized = next;
  }

  return normalized
    .replace(/\\([%&#_$])/gu, "$1")
    .replace(/\\([{}[\]()])/gu, "$1")
    .replace(/\\[A-Za-z]+\*?/gu, " ")
    .replace(/[{}]/gu, "")
    .replace(/\\/gu, "")
    .replaceAll(LITERAL_DOLLAR_PLACEHOLDER, "$");
}
