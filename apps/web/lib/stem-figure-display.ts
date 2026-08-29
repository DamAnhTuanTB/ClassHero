import { clampStemFigureDisplayScale } from "@learning-path/shared";

const FIGURE_BASE_OCCUPANCY_PERCENT = 82;

export function getStemFigureDisplayPercent(displayScale: number | null | undefined) {
  if (displayScale === null || displayScale === undefined) return null;
  return Number(
    (FIGURE_BASE_OCCUPANCY_PERCENT * clampStemFigureDisplayScale(displayScale)).toFixed(
      2,
    ),
  );
}

export function getStemFigureDraftDisplayPercent(displayScale: number) {
  return getStemFigureDisplayPercent(displayScale) ?? FIGURE_BASE_OCCUPANCY_PERCENT;
}
