import { autoRepairMathAnglePics } from "#api/common/ai/tikz-angle-auto-repair";
import { autoRepairTikzLocalHeaderPlacement } from "#api/common/ai/tikz-local-header-auto-repair";
import { autoRepairTikzMidpointMarkerBundles } from "#api/common/ai/tikz-midpoint-marker-auto-repair";
import { autoRepairTikzNarrativeCallouts } from "#api/common/ai/tikz-narrative-callout-auto-repair";

const FORBIDDEN_PATTERNS: Array<[RegExp, string]> = [
  [/\\(?:documentclass|usepackage|RequirePackage)\b/u, "document wrapper/package"],
  [/\\begin\s*\{\s*document\s*\}/u, "document environment"],
  [/\\(?:input|include|includegraphics|openin|openout|write18)\b/u, "external file"],
  [/\\(?:directlua|luaexec)\b/u, "direct Lua"],
  [/\\(?:href|url)\b/u, "external URL"],
  [/<(?:svg|script|iframe|foreignObject)\b/iu, "raw active markup"],
];

export function assertSolutionFigureLatexSource(source: string, errorPrefix: string) {
  for (const [pattern, label] of FORBIDDEN_PATTERNS) {
    if (pattern.test(source))
      throw new Error(`${errorPrefix}_SOURCE_FORBIDDEN: ${label}`);
  }
  const roots = source.match(/\\begin\s*\{\s*(?:tikzpicture|circuitikz)\s*\}/gu);
  if ((roots?.length ?? 0) !== 1) throw new Error(`${errorPrefix}_SOURCE_ROOT_INVALID`);
}

export function autoRepairSolutionFigureLatexSource(input: {
  source: string;
  subjectKey: string;
  authorityText: string;
}) {
  const localHeader = autoRepairTikzLocalHeaderPlacement(input.source);
  const narrative = autoRepairTikzNarrativeCallouts(localHeader.source);
  if (input.subjectKey !== "MATH") {
    return {
      source: narrative.source,
      changes: [...localHeader.changes, ...narrative.changes],
    };
  }
  const angles = autoRepairMathAnglePics({
    source: narrative.source,
    authorityText: input.authorityText,
  });
  const midpointMarkers = autoRepairTikzMidpointMarkerBundles({
    source: angles.source,
    authorityText: input.authorityText,
  });
  return {
    source: midpointMarkers.source,
    changes: [
      ...localHeader.changes,
      ...narrative.changes,
      ...angles.changes,
      ...midpointMarkers.changes,
    ],
  };
}

export function sanitizeSolutionFigureSvg(svg: string, errorPrefix: string) {
  const sanitized = svg
    .replace(/<\?xml[^>]*\?>/giu, "")
    .replace(/<!--([\s\S]*?)-->/gu, "")
    .trim();
  if (!/^<svg\b/iu.test(sanitized) || !/<\/svg>\s*$/iu.test(sanitized)) {
    throw new Error(`${errorPrefix}_SVG_ROOT_INVALID`);
  }
  if (
    /<(?:script|iframe|object|embed|foreignObject)\b/iu.test(sanitized) ||
    /\son[a-z]+\s*=/iu.test(sanitized) ||
    /(?:javascript|data:text\/html)\s*:/iu.test(sanitized) ||
    /(?:href|xlink:href)\s*=\s*["']\s*(?:https?:|\/\/)/iu.test(sanitized)
  ) {
    throw new Error(`${errorPrefix}_SVG_UNSAFE`);
  }
  return sanitized;
}
