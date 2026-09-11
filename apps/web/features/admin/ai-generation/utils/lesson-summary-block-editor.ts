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
  "summary",
] as const;

export type LessonSummaryEditableBlockType =
  (typeof LESSON_SUMMARY_EDITABLE_BLOCK_TYPES)[number];
export type LessonSummaryEditableField =
  "title" | "content" | "problem" | "solution" | "answer";

export type LessonSummaryBlockEditorValues = {
  blockType: LessonSummaryEditableBlockType;
  isVideoTimelineHidden: boolean;
  startTimeEnabled: boolean;
  startTime: string;
  originalStartTime: string;
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
  summary: "Tổng kết",
};

const BLOCK_FIELDS: Record<LessonSummaryEditableBlockType, LessonSummaryEditableField[]> =
  {
    knowledge: ["title", "content"],
    property: ["title", "content"],
    theorem: ["title", "content"],
    note: ["content"],
    example: ["problem", "solution", "answer"],
    exercise: ["problem", "solution", "answer"],
    summary: ["content"],
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
  options: {
    isVideoTimelineHidden?: boolean;
    startTimeOffsetSeconds?: number;
  } = {},
): LessonSummaryBlockEditorValues {
  const geometryStatement = lessonSummaryGeometryStatementSchema.safeParse(
    block.geometryStatement,
  );
  const startSeconds = isValidStartSeconds(block.startSeconds)
    ? block.startSeconds
    : null;
  const startTimeOffsetSeconds = normalizeStartTimeOffset(options.startTimeOffsetSeconds);
  const playbackStartSeconds =
    startSeconds !== null ? Math.max(0, startSeconds - startTimeOffsetSeconds) : null;
  return {
    blockType: block.type,
    isVideoTimelineHidden: options.isVideoTimelineHidden === true,
    startTimeEnabled: playbackStartSeconds !== null,
    startTime:
      playbackStartSeconds !== null
        ? formatLessonSummaryStartTime(playbackStartSeconds)
        : "",
    originalStartTime:
      startSeconds !== null ? formatLessonSummaryStartTime(startSeconds) : "",
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
  options: {
    isVideoTimelineHidden?: boolean;
    preferOriginalStartTime?: boolean;
    startTimeOffsetSeconds?: number;
    updateGeometryStatement?: boolean;
  } = {},
) {
  const nextBlock = structuredClone(block);
  if (values.startTimeEnabled && isValidStartSeconds(block.startSeconds)) {
    const originalStartTime = formatLessonSummaryStartTime(block.startSeconds);
    const nextOriginalStartSeconds = parseLessonSummaryStartTime(
      values.originalStartTime,
    );
    const startTimeOffsetSeconds = normalizeStartTimeOffset(
      options.startTimeOffsetSeconds,
    );
    const originalPlaybackStartTime = formatLessonSummaryStartTime(
      Math.max(0, block.startSeconds - startTimeOffsetSeconds),
    );
    const nextPlaybackStartSeconds = parseLessonSummaryStartTime(values.startTime);
    if (
      (options.preferOriginalStartTime || options.isVideoTimelineHidden) &&
      nextOriginalStartSeconds !== null &&
      values.originalStartTime !== originalStartTime
    ) {
      nextBlock.startSeconds = nextOriginalStartSeconds;
    } else if (
      !options.preferOriginalStartTime &&
      !options.isVideoTimelineHidden &&
      nextPlaybackStartSeconds !== null &&
      values.startTime !== originalPlaybackStartTime
    ) {
      nextBlock.startSeconds = nextPlaybackStartSeconds + startTimeOffsetSeconds;
    }
  }
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
        originalStatement.success ? originalStatement.data.hypotheses.join("\n\n") : "",
      );
      const originalConclusionsDocument = toEditorDocument(
        originalStatement.success ? originalStatement.data.conclusions.join("\n\n") : "",
      );
      nextBlock.geometryStatement = {
        hypotheses:
          originalStatement.success &&
          areTiptapDocumentsEquivalent(originalHypothesesDocument, values.hypotheses)
            ? originalStatement.data.hypotheses
            : [serializeTiptapDocumentToMathMarkdown(values.hypotheses)],
        conclusions:
          originalStatement.success &&
          areTiptapDocumentsEquivalent(originalConclusionsDocument, values.conclusions)
            ? originalStatement.data.conclusions
            : [serializeTiptapDocumentToMathMarkdown(values.conclusions)],
      };
      nextBlock.isGeometry = true;
    }
  }
  return nextBlock;
}

export const LESSON_SUMMARY_START_TIME_PATTERN = /^(?:\d+:[0-5]\d|\d+:[0-5]\d:[0-5]\d)$/u;

export function formatLessonSummaryStartTime(startSeconds: number) {
  const wholeSeconds = Math.floor(Math.max(0, startSeconds));
  const hours = Math.floor(wholeSeconds / 3_600);
  const minutes = Math.floor((wholeSeconds % 3_600) / 60);
  const seconds = wholeSeconds % 60;
  const secondsText = seconds.toString().padStart(2, "0");

  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, "0")}:${secondsText}`
    : `${minutes}:${secondsText}`;
}

export function parseLessonSummaryStartTime(value: string) {
  if (!LESSON_SUMMARY_START_TIME_PATTERN.test(value)) return null;
  return value
    .split(":")
    .map(Number)
    .reduce((total, part) => total * 60 + part, 0);
}

function isValidStartSeconds(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function normalizeStartTimeOffset(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function toEditorDocument(value: unknown) {
  return typeof value === "string"
    ? createMathMarkdownTiptapDocument(normalizeLessonSummaryAngleNotation(value))
    : createEmptyTiptapDocument();
}
