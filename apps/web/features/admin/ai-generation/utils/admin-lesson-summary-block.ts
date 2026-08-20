import type { AdminLessonSummaryContent } from "@/features/admin/ai-generation/types/admin-ai-generation.types";

export type AdminLessonSummaryBlockLocation = {
  block: Record<string, unknown>;
  blockIndex: number;
  path: string;
  section: Record<string, unknown>;
  sectionIndex: number;
};

export function getAdminLessonSummaryBlock(
  content: AdminLessonSummaryContent,
  blockPath: string,
): AdminLessonSummaryBlockLocation | null {
  const indexes = parseBlockPath(blockPath);
  if (!indexes || content.type !== "lesson_summary_blocks" || !isRecord(content.data)) {
    return null;
  }

  const sections = content.data.sections;
  if (!Array.isArray(sections)) return null;
  const section = sections[indexes.sectionIndex];
  if (!isRecord(section) || !Array.isArray(section.blocks)) return null;
  const block = section.blocks[indexes.blockIndex];
  if (!isRecord(block)) return null;

  return {
    block,
    blockIndex: indexes.blockIndex,
    path: blockPath,
    section,
    sectionIndex: indexes.sectionIndex,
  };
}

export function findAdminLessonSummaryFigureBlockPath(
  content: AdminLessonSummaryContent,
  figureId: string,
  preferredBlockPath: string,
) {
  const preferredBlock = getAdminLessonSummaryBlock(content, preferredBlockPath);
  if (preferredBlock && blockContainsFigure(preferredBlock.block, figureId)) {
    return preferredBlockPath;
  }
  if (content.type !== "lesson_summary_blocks" || !isRecord(content.data)) {
    return preferredBlockPath;
  }

  const sections = content.data.sections;
  if (!Array.isArray(sections)) return preferredBlockPath;
  for (const [sectionIndex, section] of sections.entries()) {
    if (!isRecord(section) || !Array.isArray(section.blocks)) continue;
    for (const [blockIndex, block] of section.blocks.entries()) {
      if (isRecord(block) && blockContainsFigure(block, figureId)) {
        return `sections.${sectionIndex}.blocks.${blockIndex}`;
      }
    }
  }
  return preferredBlockPath;
}

export function toAdminLessonSummaryBlockElementId(blockPath: string) {
  const indexes = parseBlockPath(blockPath);
  return indexes ? `block-${indexes.sectionIndex}-${indexes.blockIndex}` : null;
}

function blockContainsFigure(block: Record<string, unknown>, figureId: string) {
  return (
    Array.isArray(block.figures) &&
    block.figures.some((figure) => isRecord(figure) && figure.figureId === figureId)
  );
}

function parseBlockPath(blockPath: string) {
  const match = blockPath.match(/^sections\.(\d+)\.blocks\.(\d+)$/u);
  if (!match) return null;
  return {
    sectionIndex: Number(match[1]),
    blockIndex: Number(match[2]),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
