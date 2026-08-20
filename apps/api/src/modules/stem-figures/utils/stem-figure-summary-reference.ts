import type { Prisma } from "@prisma/client";
import type { StemFigureOrigin } from "@learning-path/shared";

export function ensureStemFigureSummaryReference(
  value: Prisma.JsonValue,
  input: {
    blockPath: string;
    figureIndex: number;
    figureId: string;
    figureOrigin: StemFigureOrigin;
    altText: string;
    caption: string | null;
  },
) {
  const copy = structuredClone(value) as unknown;
  if (!isRecord(copy)) return value;
  const data = isRecord(copy.data) ? copy.data : copy;
  const match = input.blockPath.match(/^sections\.(\d+)\.blocks\.(\d+)$/u);
  if (!match || !Array.isArray(data.sections)) return value;
  const section = data.sections[Number(match[1])];
  if (!isRecord(section) || !Array.isArray(section.blocks)) return value;
  const block = section.blocks[Number(match[2])];
  if (!isRecord(block)) return value;
  const figures = Array.isArray(block.figures) ? [...block.figures] : [];
  const existingIndex = figures.findIndex(
    (item) => isRecord(item) && item.figureId === input.figureId,
  );
  const visual = {
    kind: "TEX_FIGURE",
    figureId: input.figureId,
    figureOrigin: input.figureOrigin,
    altText: input.altText,
    caption: input.caption,
    status: "SUCCEEDED",
  };
  if (existingIndex >= 0) figures[existingIndex] = visual;
  else figures.splice(Math.min(input.figureIndex, figures.length), 0, visual);
  block.figures = figures;
  return copy as Prisma.JsonValue;
}

export function readStemFigureOrigin(value: unknown): StemFigureOrigin | undefined {
  if (!isRecord(value)) return undefined;
  if (
    value.figureOrigin === "TEXTBOOK_SOURCE" ||
    value.figureOrigin === "GENERATED_FROM_BRIEF"
  ) {
    return value.figureOrigin;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
