import { QUIZ_FIGURE_EXTENSION_MARKER } from "#api/modules/quiz-figures/types/quiz-figure-generation.types";

const forbiddenPatterns: Array<[RegExp, string]> = [
  [/\\(?:documentclass|usepackage|RequirePackage)\b/u, "document wrapper/package"],
  [/\\begin\s*\{\s*document\s*\}/u, "document environment"],
  [/\\(?:input|include|includegraphics|openin|openout|write18)\b/u, "external file"],
  [/\\(?:directlua|luaexec)\b/u, "direct Lua"],
  [/\\(?:href|url)\b/u, "external URL"],
  [/<(?:svg|script|iframe|foreignObject)\b/iu, "raw active markup"],
];

export function assertQuizFigureLatexSource(source: string) {
  for (const [pattern, label] of forbiddenPatterns) {
    if (pattern.test(source)) throw new Error(`QUIZ_FIGURE_SOURCE_FORBIDDEN: ${label}`);
  }
  const roots = source.match(/\\begin\s*\{\s*(?:tikzpicture|circuitikz)\s*\}/gu);
  if ((roots?.length ?? 0) !== 1) {
    throw new Error("QUIZ_FIGURE_SOURCE_ROOT_INVALID");
  }
  if (!source.includes(QUIZ_FIGURE_EXTENSION_MARKER)) {
    throw new Error("QUIZ_FIGURE_EXTENSION_MARKER_MISSING");
  }
}

export function applyQuizSolutionExtension(baseSource: string, extension: string) {
  if (!baseSource.includes(QUIZ_FIGURE_EXTENSION_MARKER)) {
    throw new Error("QUIZ_FIGURE_EXTENSION_MARKER_MISSING");
  }
  if (/\\begin\s*\{\s*(?:tikzpicture|circuitikz)\s*\}/u.test(extension)) {
    throw new Error("QUIZ_SOLUTION_EXTENSION_ROOT_FORBIDDEN");
  }
  for (const [pattern, label] of forbiddenPatterns) {
    if (pattern.test(extension)) {
      throw new Error(`QUIZ_SOLUTION_EXTENSION_FORBIDDEN: ${label}`);
    }
  }
  return baseSource.replace(
    QUIZ_FIGURE_EXTENSION_MARKER,
    `${QUIZ_FIGURE_EXTENSION_MARKER}\n${extension.trim()}`,
  );
}

export function sanitizeQuizFigureSvg(svg: string) {
  const sanitized = svg
    .replace(/<\?xml[^>]*\?>/giu, "")
    .replace(/<!--([\s\S]*?)-->/gu, "")
    .trim();
  if (!/^<svg\b/iu.test(sanitized) || !/<\/svg>\s*$/iu.test(sanitized)) {
    throw new Error("QUIZ_FIGURE_SVG_ROOT_INVALID");
  }
  if (
    /<(?:script|iframe|object|embed|foreignObject)\b/iu.test(sanitized) ||
    /\son[a-z]+\s*=/iu.test(sanitized) ||
    /(?:javascript|data:text\/html)\s*:/iu.test(sanitized) ||
    /(?:href|xlink:href)\s*=\s*["']\s*(?:https?:|\/\/)/iu.test(sanitized)
  ) {
    throw new Error("QUIZ_FIGURE_SVG_UNSAFE");
  }
  return sanitized;
}
