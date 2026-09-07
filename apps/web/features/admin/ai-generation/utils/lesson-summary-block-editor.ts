import {
  lessonSummaryGeometryStatementSchema,
  normalizeLessonSummaryAngleNotation,
  type TiptapTextDocument,
} from "@learning-path/shared";
import {
  areTiptapDocumentsEquivalent,
  createEmptyTiptapDocument,
  createMathMarkdownTiptapDocument,
  serializeTiptapDocumentToMathMarkdown,
} from "@/lib/tiptap-rich-content";

export const LESSON_SUMMARY_EDITABLE_BLOCK_TYPES = [
  "knowledge",
  "property",
  "theorem",
  "note",
  "example",
  "exercise",
] as const;

export type LessonSummaryEditableBlockType =
  (typeof LESSON_SUMMARY_EDITABLE_BLOCK_TYPES)[number];
export type LessonSummaryEditableField =
  "title" | "content" | "problem" | "solution" | "answer";

export type LessonSummaryBlockEditorValues = {
  blockType: LessonSummaryEditableBlockType;
  title: TiptapTextDocument;
  content: TiptapTextDocument;
  problem: TiptapTextDocument;
  solution: TiptapTextDocument;
  answer: TiptapTextDocument;
  geometryStatementEnabled: boolean;
  hypotheses: TiptapTextDocument;
  conclusions: TiptapTextDocument;
};

const BLOCK_LABELS: Record<LessonSummaryEditableBlockType, string> = {
  knowledge: "Kiến thức",
  property: "Tính chất",
  theorem: "Định lí",
  note: "Chú ý",
  example: "Ví dụ",
  exercise: "Bài tập",
};

const BLOCK_FIELDS: Record<LessonSummaryEditableBlockType, LessonSummaryEditableField[]> =
  {
    knowledge: ["title", "content"],
    property: ["title", "content"],
    theorem: ["title", "content"],
    note: ["content"],
    example: ["problem", "solution", "answer"],
    exercise: ["problem", "solution", "answer"],
  };

export function isLessonSummaryEditableBlock(
  value: unknown,
): value is Record<string, unknown> & { type: LessonSummaryEditableBlockType } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return LESSON_SUMMARY_EDITABLE_BLOCK_TYPES.includes(
    (value as { type?: LessonSummaryEditableBlockType })
      .type as LessonSummaryEditableBlockType,
  );
}

export function getLessonSummaryBlockLabel(type: LessonSummaryEditableBlockType) {
  return BLOCK_LABELS[type];
}

export function getLessonSummaryBlockEditableFields(
  type: LessonSummaryEditableBlockType,
) {
  return BLOCK_FIELDS[type];
}

export function createLessonSummaryBlockEditorValues(
  block: Record<string, unknown> & { type: LessonSummaryEditableBlockType },
): LessonSummaryBlockEditorValues {
  const geometryStatement = lessonSummaryGeometryStatementSchema.safeParse(
    block.geometryStatement,
  );
  return {
    blockType: block.type,
    title: toEditorDocument(block.title),
    content: toEditorDocument(block.content),
    problem: toEditorDocument(block.problem),
    solution: toEditorDocument(block.solution),
    answer: toEditorDocument(block.answer),
    geometryStatementEnabled: geometryStatement.success,
    hypotheses: toEditorDocument(
      geometryStatement.success ? geometryStatement.data.hypotheses.join("\n\n") : "",
    ),
    conclusions: toEditorDocument(
      geometryStatement.success ? geometryStatement.data.conclusions.join("\n\n") : "",
    ),
  };
}

export function applyLessonSummaryBlockEditorValues(
  block: Record<string, unknown> & { type: LessonSummaryEditableBlockType },
  values: LessonSummaryBlockEditorValues,
  options: { updateGeometryStatement?: boolean } = {},
) {
  const nextBlock = structuredClone(block);
  for (const field of BLOCK_FIELDS[block.type]) {
    const originalValue = typeof block[field] === "string" ? block[field] : "";
    const originalDocument = createMathMarkdownTiptapDocument(
      normalizeLessonSummaryAngleNotation(originalValue),
    );
    nextBlock[field] = areTiptapDocumentsEquivalent(originalDocument, values[field])
      ? originalValue
      : serializeTiptapDocumentToMathMarkdown(values[field]);
  }
  if (
    options.updateGeometryStatement &&
    (block.type === "example" || block.type === "exercise")
  ) {
    if (!values.geometryStatementEnabled) {
      delete nextBlock.geometryStatement;
      nextBlock.isGeometry = false;
    } else {
      const originalStatement = lessonSummaryGeometryStatementSchema.safeParse(
        block.geometryStatement,
      );
      const originalHypothesesDocument = toEditorDocument(
        originalStatement.success
          ? originalStatement.data.hypotheses.join("\n\n")
          : "",
      );
      const originalConclusionsDocument = toEditorDocument(
        originalStatement.success
          ? originalStatement.data.conclusions.join("\n\n")
          : "",
      );
      nextBlock.geometryStatement = {
        hypotheses:
          originalStatement.success &&
          areTiptapDocumentsEquivalent(
            originalHypothesesDocument,
            values.hypotheses,
          )
            ? originalStatement.data.hypotheses
            : [serializeTiptapDocumentToMathMarkdown(values.hypotheses)],
        conclusions:
          originalStatement.success &&
          areTiptapDocumentsEquivalent(
            originalConclusionsDocument,
            values.conclusions,
          )
            ? originalStatement.data.conclusions
            : [serializeTiptapDocumentToMathMarkdown(values.conclusions)],
      };
      nextBlock.isGeometry = true;
    }
  }
  return nextBlock;
}

function toEditorDocument(value: unknown) {
  return typeof value === "string"
    ? createMathMarkdownTiptapDocument(normalizeLessonSummaryAngleNotation(value))
    : createEmptyTiptapDocument();
}
