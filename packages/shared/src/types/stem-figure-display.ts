export const STEM_FIGURE_DISPLAY_SCALE_DEFAULT = 1;
export const STEM_FIGURE_DISPLAY_SCALE_MIN = 0.1;
export const STEM_FIGURE_DISPLAY_SCALE_MAX = 2;

const STEM_FIGURE_DISPLAY_SCALE_PATTERN =
  /^%\s*classhero-display-scale\s*:\s*(\d+(?:\.\d+)?)\s*$/imu;

/**
 * Reads presentation metadata embedded in an editable TikZ comment. The marker
 * is ignored by TeX, survives the existing revision pipeline and lets every UI
 * render the same responsive figure size without exposing the full source.
 */
export function readStemFigureDisplayScale(source: string | null | undefined) {
  if (!source) return null;
  const match = source.match(STEM_FIGURE_DISPLAY_SCALE_PATTERN);
  if (!match?.[1]) return null;
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed)) return null;
  return clampStemFigureDisplayScale(parsed);
}

export function writeStemFigureDisplayScale(source: string, scale: number) {
  const marker = `% classhero-display-scale: ${formatDisplayScale(scale)}`;
  if (STEM_FIGURE_DISPLAY_SCALE_PATTERN.test(source)) {
    return source.replace(STEM_FIGURE_DISPLAY_SCALE_PATTERN, marker);
  }

  const rootStart = source.search(/\\begin\{(?:tikzpicture|circuitikz)\}/u);
  if (rootStart < 0) return source;
  const prefix = source.slice(0, rootStart);
  const separator = prefix.length > 0 && !prefix.endsWith("\n") ? "\n" : "";
  return `${prefix}${separator}${marker}\n${source.slice(rootStart)}`;
}

export function clampStemFigureDisplayScale(scale: number) {
  return Math.min(
    STEM_FIGURE_DISPLAY_SCALE_MAX,
    Math.max(STEM_FIGURE_DISPLAY_SCALE_MIN, scale),
  );
}

function formatDisplayScale(scale: number) {
  return Number(clampStemFigureDisplayScale(scale).toFixed(2)).toString();
}
