import type { AdminLessonSummaryContent } from "@/features/admin/ai-generation/types/admin-ai-generation.types";

const THEORY_TYPES = new Set(["knowledge", "property", "theorem"]);

export type LessonSummaryPhaseOneLayoutOperation =
  | { type: "MERGE_SECTION"; sectionIndex: number }
  | { type: "DELETE_BLOCK"; sectionIndex: number; blockIndex: number };

export function applyPhaseOneLayoutOperation(
  blocks: Record<string, unknown>,
  operation: LessonSummaryPhaseOneLayoutOperation,
): Record<string, unknown> {
  const parsedEntries = Object.entries(blocks).map(([path, value]) => ({
    path,
    value,
    position: parseBlockPath(path),
  }));
  if (parsedEntries.some((entry) => entry.position === null)) return blocks;

  if (operation.type === "DELETE_BLOCK") {
    const hasTarget = parsedEntries.some(
      (entry) =>
        entry.position?.sectionIndex === operation.sectionIndex &&
        entry.position.blockIndex === operation.blockIndex,
    );
    if (!hasTarget) return blocks;
    return rebuildBlockRecord(
      parsedEntries.flatMap((entry) => {
        const position = entry.position!;
        if (
          position.sectionIndex === operation.sectionIndex &&
          position.blockIndex === operation.blockIndex
        ) {
          return [];
        }
        return [
          {
            value: entry.value,
            sectionIndex: position.sectionIndex,
            blockIndex:
              position.sectionIndex === operation.sectionIndex &&
              position.blockIndex > operation.blockIndex
                ? position.blockIndex - 1
                : position.blockIndex,
          },
        ];
      }),
    );
  }

  if (operation.sectionIndex < 1) return blocks;
  const previousBlockCount = parsedEntries.filter(
    (entry) => entry.position?.sectionIndex === operation.sectionIndex - 1,
  ).length;
  const hasTargetSection = parsedEntries.some(
    (entry) => entry.position?.sectionIndex === operation.sectionIndex,
  );
  if (!hasTargetSection) return blocks;
  return rebuildBlockRecord(
    parsedEntries.map((entry) => {
      const position = entry.position!;
      if (position.sectionIndex === operation.sectionIndex) {
        return {
          value: entry.value,
          sectionIndex: operation.sectionIndex - 1,
          blockIndex: previousBlockCount + position.blockIndex,
        };
      }
      return {
        value: entry.value,
        sectionIndex:
          position.sectionIndex > operation.sectionIndex
            ? position.sectionIndex - 1
            : position.sectionIndex,
        blockIndex: position.blockIndex,
      };
    }),
  );
}

export function applyPhaseOneBlockPreview(
  content: AdminLessonSummaryContent,
  blockPath: string,
  rawBlock: unknown,
): AdminLessonSummaryContent {
  if (content.type !== "lesson_summary_blocks" || !isRecord(rawBlock)) return content;
  const match = blockPath.match(/^sections\.(\d+)\.blocks\.(\d+)$/u);
  if (!match) return content;
  const copy = structuredClone(content);
  if (!isRecord(copy.data) || !Array.isArray(copy.data.sections)) return content;
  const section = copy.data.sections[Number(match[1])];
  if (!isRecord(section) || !Array.isArray(section.blocks)) return content;
  const currentBlock = section.blocks[Number(match[2])];
  if (!isRecord(currentBlock)) return content;

  const nextBlock = mapRawBlockForPreview(rawBlock, currentBlock);
  if (!nextBlock) return content;
  section.blocks[Number(match[2])] = nextBlock;
  return copy;
}

export function applyPhaseOneBlocksPreview(
  content: AdminLessonSummaryContent,
  blocks: Record<string, unknown>,
) {
  return Object.entries(blocks).reduce(
    (current, [blockPath, rawBlock]) =>
      applyPhaseOneBlockPreview(current, blockPath, rawBlock),
    content,
  );
}

function mapRawBlockForPreview(
  rawBlock: Record<string, unknown>,
  currentBlock: Record<string, unknown>,
) {
  const type = rawBlock.type;
  const preserved = {
    figures: currentBlock.figures,
    reviewIssues: currentBlock.reviewIssues,
  };
  if (type === "note") {
    return compact({
      type,
      content: rawBlock.content,
      sourcePageNumbers: rawBlock.sourcePageNumbers,
      ...preserved,
    });
  }
  if (type === "example") {
    return compact({
      type,
      problem: rawBlock.problem,
      solution: rawBlock.solution,
      answer: rawBlock.answer,
      sourcePageNumbers: rawBlock.sourcePageNumbers,
      origin: rawBlock.origin,
      isGeometry: rawBlock.isGeometry,
      geometryStatement: rawBlock.geometryStatement,
      ...preserved,
    });
  }
  if (typeof type === "string" && THEORY_TYPES.has(type)) {
    return compact({
      type,
      title: rawBlock.title,
      content: rawBlock.content,
      sourcePageNumbers: rawBlock.sourcePageNumbers,
      ...preserved,
    });
  }
  return null;
}

function compact(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  );
}

function parseBlockPath(path: string) {
  const match = path.match(/^sections\.(\d+)\.blocks\.(\d+)$/u);
  return match ? { sectionIndex: Number(match[1]), blockIndex: Number(match[2]) } : null;
}

function rebuildBlockRecord(
  entries: Array<{ value: unknown; sectionIndex: number; blockIndex: number }>,
) {
  return Object.fromEntries(
    entries
      .sort(
        (left, right) =>
          left.sectionIndex - right.sectionIndex || left.blockIndex - right.blockIndex,
      )
      .map((entry) => [
        `sections.${entry.sectionIndex}.blocks.${entry.blockIndex}`,
        entry.value,
      ]),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
