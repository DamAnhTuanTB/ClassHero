import type {
  AdminLessonSummaryContent,
  AdminStemFigure,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";

type StemFigureSyncRecord = Pick<
  AdminStemFigure,
  | "id"
  | "aiGenerationId"
  | "blockPath"
  | "figureIndex"
  | "planJson"
  | "figureOrigin"
  | "status"
  | "altText"
  | "caption"
>;

export function canReconcileStemFigureSnapshot(input: {
  figures: readonly StemFigureSyncRecord[];
  isFetching: boolean;
  isSuccess: boolean;
  summaryAiGenerationId: string | null;
}) {
  if (!input.isSuccess || input.isFetching) return false;
  return input.figures.every(
    (figure) => figure.aiGenerationId === input.summaryAiGenerationId,
  );
}

export function syncStemFigureReferencesInContent(
  value: AdminLessonSummaryContent,
  figures: readonly StemFigureSyncRecord[],
) {
  if (value.type !== "lesson_summary_blocks") return value;

  const figuresByBlockPath = new Map<string, StemFigureSyncRecord[]>();
  for (const figure of figures) {
    const blockFigures = figuresByBlockPath.get(figure.blockPath) ?? [];
    blockFigures.push(figure);
    figuresByBlockPath.set(
      figure.blockPath,
      blockFigures.sort((left, right) => left.figureIndex - right.figureIndex),
    );
  }

  const copy = structuredClone(value);
  let changed = false;
  const data = copy.data as {
    sections?: Array<{ blocks?: Array<Record<string, unknown>> }>;
  };

  for (const [sectionIndex, section] of (data.sections ?? []).entries()) {
    for (const [blockIndex, block] of (section.blocks ?? []).entries()) {
      const blockPath = `sections.${sectionIndex}.blocks.${blockIndex}`;
      const authoritativeFigures = figuresByBlockPath.get(blockPath) ?? [];
      const authoritativeById = new Map(
        authoritativeFigures.map((figure) => [figure.id, figure]),
      );
      const current = Array.isArray(block.figures) ? block.figures : [];
      const seenFigureIds = new Set<string>();
      const next: unknown[] = [];
      let blockChanged = false;

      for (const item of current) {
        const reference = readStemFigureReference(item);
        if (!reference) {
          next.push(item);
          continue;
        }
        const figure = authoritativeById.get(reference.figureId);
        if (!figure || seenFigureIds.has(reference.figureId)) {
          blockChanged = true;
          continue;
        }
        seenFigureIds.add(reference.figureId);
        const synchronized = {
          ...reference,
          ...(figure.figureOrigin ? { figureOrigin: figure.figureOrigin } : {}),
        };
        delete (synchronized as any).status; // Remove legacy status if present

        if (reference.figureOrigin !== synchronized.figureOrigin || "status" in reference) {
          blockChanged = true;
        }
        next.push(synchronized);
      }

      for (const figure of authoritativeFigures) {
        if (seenFigureIds.has(figure.id)) continue;
        next.splice(Math.min(figure.figureIndex, next.length), 0, {
          kind: "TEX_FIGURE",
          figureId: figure.id,
          ...(figure.figureOrigin ? { figureOrigin: figure.figureOrigin } : {}),
          altText: figure.altText,
          caption: figure.caption,
        });
        seenFigureIds.add(figure.id);
        blockChanged = true;
      }

      if (blockChanged) {
        block.figures = next;
        changed = true;
      }
    }
  }

  return changed ? copy : value;
}

function readStemFigureReference(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.kind !== "TEX_FIGURE" || typeof record.figureId !== "string") {
    return null;
  }
  return record as Record<string, unknown> & { figureId: string };
}
