import {
  getLessonSummaryProviderTransportOutputSchema,
  type LessonSummaryProviderTransportOutput,
} from "#api/modules/ai/types/lesson-summary.types";
import type { LessonSummarySubjectKey } from "#api/modules/ai/types/lesson-summary-subject.types";
import {
  mapLessonSummaryProviderOutput,
  type MappedLessonSummaryOutput,
} from "#api/modules/ai/utils/lesson-summary-mapper";

export type LessonSummaryPhaseOneLayoutOperation =
  | { type: "MERGE_SECTION"; sectionIndex: number }
  | { type: "DELETE_SECTION"; sectionIndex: number }
  | { type: "DELETE_BLOCK"; sectionIndex: number; blockIndex: number }
  | { type: "MOVE_SECTION"; sectionIndex: number; targetSectionIndex: number }
  | {
      type: "MOVE_BLOCK";
      sectionIndex: number;
      blockIndex: number;
      targetSectionIndex: number;
      targetBlockIndex: number;
    };

export type LessonSummaryPhaseOneSnapshot = {
  type: "lesson_summary_phase_one_blocks";
  version: 2;
  providerOutput: Record<string, unknown>;
  blocks: Record<string, unknown>;
  providerPaths: Record<string, string>;
  subjectKey: LessonSummarySubjectKey;
  targetGrade: number | null;
  packetPageCount: number;
  layoutOperations?: LessonSummaryPhaseOneLayoutOperation[];
};

export function readLessonSummaryPhaseOneSnapshot(
  value: unknown,
): LessonSummaryPhaseOneSnapshot | null {
  if (!isRecord(value)) return null;
  if (value.type !== "lesson_summary_phase_one_blocks" || value.version !== 2) {
    return null;
  }
  if (!isRecord(value.providerOutput) || !isRecord(value.blocks)) return null;
  if (!isStringRecord(value.providerPaths)) return null;
  if (!isLessonSummarySubjectKey(value.subjectKey)) return null;
  if (
    value.targetGrade !== null &&
    (typeof value.targetGrade !== "number" || !Number.isInteger(value.targetGrade))
  ) {
    return null;
  }
  if (
    typeof value.packetPageCount !== "number" ||
    !Number.isInteger(value.packetPageCount) ||
    value.packetPageCount < 1
  ) {
    return null;
  }
  if (
    value.layoutOperations !== undefined &&
    (!Array.isArray(value.layoutOperations) ||
      !value.layoutOperations.every(isLayoutOperation))
  ) {
    return null;
  }
  return value as LessonSummaryPhaseOneSnapshot;
}

export function prepareLessonSummaryPhaseOneLayoutEdits(
  snapshot: LessonSummaryPhaseOneSnapshot,
  operations: LessonSummaryPhaseOneLayoutOperation[],
) {
  let current = structuredClone(snapshot);
  for (const operation of operations) {
    const blocks = applyLayoutOperationToRecord(current.blocks, operation);
    const providerPaths = applyLayoutOperationToRecord(current.providerPaths, operation);
    if (!blocks || !providerPaths) {
      return {
        success: false as const,
        code: "LESSON_SUMMARY_PHASE_ONE_LAYOUT_INVALID",
        message: "Không thể áp dụng thao tác xóa vào cấu trúc Phase 1 hiện tại.",
        details: { operation },
      };
    }
    current = {
      ...current,
      blocks,
      providerPaths: providerPaths as Record<string, string>,
      layoutOperations: [...(current.layoutOperations ?? []), operation],
    };
  }

  const newPathByProviderPath = new Map(
    Object.entries(current.providerPaths).map(([blockPath, providerPath]) => [
      providerPath,
      blockPath,
    ]),
  );
  const blockPathChanges = new Map<string, string | null>();
  for (const [oldBlockPath, providerPath] of Object.entries(snapshot.providerPaths)) {
    const newBlockPath = newPathByProviderPath.get(providerPath) ?? null;
    if (newBlockPath !== oldBlockPath) {
      blockPathChanges.set(oldBlockPath, newBlockPath);
    }
  }

  return { success: true as const, snapshot: current, blockPathChanges };
}

export function applyLessonSummaryPhaseOneBlockEdits(input: {
  lessonId: string;
  snapshot: LessonSummaryPhaseOneSnapshot;
  blocks: Record<string, unknown>;
}) {
  const expectedPaths = Object.keys(input.snapshot.providerPaths).sort();
  const receivedPaths = Object.keys(input.blocks).sort();
  if (
    expectedPaths.length !== receivedPaths.length ||
    expectedPaths.some((path, index) => path !== receivedPaths[index])
  ) {
    return {
      success: false as const,
      code: "LESSON_SUMMARY_PHASE_ONE_BLOCK_SET_INVALID",
      message:
        "Danh sách block raw không còn khớp bản Phase 1 ban đầu. Hãy tải lại trang.",
      details: { expectedPaths, receivedPaths },
    };
  }

  const providerOutput = structuredClone(input.snapshot.providerOutput);
  for (const blockPath of expectedPaths) {
    const providerPath = input.snapshot.providerPaths[blockPath];
    if (
      !providerPath ||
      !setValueAtPath(providerOutput, providerPath, input.blocks[blockPath])
    ) {
      return {
        success: false as const,
        code: "LESSON_SUMMARY_PHASE_ONE_PATH_INVALID",
        message: `Không ánh xạ được raw JSON của block ${blockPath}.`,
        details: { blockPath, providerPath: providerPath ?? null },
      };
    }
  }

  const schema = getLessonSummaryProviderTransportOutputSchema(
    input.snapshot.subjectKey,
    "CONTEXTUAL",
    input.snapshot.targetGrade,
  );
  const parsed = schema.safeParse(providerOutput);
  if (!parsed.success) {
    return {
      success: false as const,
      code: "LESSON_SUMMARY_PHASE_ONE_SCHEMA_INVALID",
      message: "Raw JSON chưa đúng schema Phase 1 nên chưa thể lưu.",
      details: {
        issues: parsed.error.issues.slice(0, 40).map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
    };
  }

  let mapped: MappedLessonSummaryOutput;
  try {
    const providerMapped = mapLessonSummaryProviderOutput({
      lessonId: input.lessonId,
      output: parsed.data as LessonSummaryProviderTransportOutput,
      packetPageCount: input.snapshot.packetPageCount,
      targetGrade: input.snapshot.targetGrade,
      subjectKey: input.snapshot.subjectKey,
    });
    const layoutMapped = applyLayoutOperationsToMappedOutput(
      providerMapped,
      input.snapshot.layoutOperations ?? [],
    );
    if (!layoutMapped) {
      return {
        success: false as const,
        code: "LESSON_SUMMARY_PHASE_ONE_LAYOUT_INVALID",
        message: "Cấu trúc xóa/gộp section không còn khớp raw Phase 1.",
        details: { operations: input.snapshot.layoutOperations ?? [] },
      };
    }
    mapped = layoutMapped;
  } catch (error) {
    return {
      success: false as const,
      code: "LESSON_SUMMARY_PHASE_ONE_SEMANTIC_INVALID",
      message: "Raw JSON chưa đạt kiểm tra nội dung Phase 1 nên chưa thể lưu.",
      details: {
        reason: error instanceof Error ? error.message : "UNKNOWN_MAPPING_ERROR",
      },
    };
  }
  return {
    success: true as const,
    mapped,
    snapshot: {
      ...input.snapshot,
      providerOutput: parsed.data,
      blocks: mapped.phaseOneBlocks,
      providerPaths: mapped.phaseOneProviderPaths,
    } satisfies LessonSummaryPhaseOneSnapshot,
  };
}

function applyLayoutOperationsToMappedOutput(
  mapped: MappedLessonSummaryOutput,
  operations: LessonSummaryPhaseOneLayoutOperation[],
): MappedLessonSummaryOutput | null {
  let current = structuredClone(mapped);
  for (const operation of operations) {
    const previousProviderPaths = current.phaseOneProviderPaths;
    const blocks = applyLayoutOperationToRecord(current.phaseOneBlocks, operation);
    const providerPaths = applyLayoutOperationToRecord(previousProviderPaths, operation);
    if (!blocks || !providerPaths) return null;

    const newPathByProviderPath = new Map(
      Object.entries(providerPaths).map(([blockPath, providerPath]) => [
        providerPath,
        blockPath,
      ]),
    );
    const nextFigurePathByOldPath = new Map<string, string | null>();
    for (const [oldBlockPath, providerPath] of Object.entries(previousProviderPaths)) {
      nextFigurePathByOldPath.set(
        oldBlockPath,
        newPathByProviderPath.get(String(providerPath)) ?? null,
      );
    }

    if (operation.type === "DELETE_BLOCK") {
      const section = current.content.sections[operation.sectionIndex];
      if (!section?.blocks[operation.blockIndex]) return null;
      section.blocks.splice(operation.blockIndex, 1);
    } else if (operation.type === "DELETE_SECTION") {
      if (!current.content.sections[operation.sectionIndex]) return null;
      current.content.sections.splice(operation.sectionIndex, 1);
      current.content.sections.forEach((item, index) => {
        item.order = index + 1;
      });
    } else if (operation.type === "MERGE_SECTION") {
      if (operation.sectionIndex < 1) return null;
      const section = current.content.sections[operation.sectionIndex];
      const previousSection = current.content.sections[operation.sectionIndex - 1];
      if (!section || !previousSection) return null;
      previousSection.blocks.push(...section.blocks);
      current.content.sections.splice(operation.sectionIndex, 1);
      current.content.sections.forEach((item, index) => {
        item.order = index + 1;
      });
    } else if (operation.type === "MOVE_SECTION") {
      const [section] = current.content.sections.splice(operation.sectionIndex, 1);
      if (!section || operation.targetSectionIndex > current.content.sections.length) {
        return null;
      }
      current.content.sections.splice(operation.targetSectionIndex, 0, section);
      current.content.sections.forEach((item, index) => {
        item.order = index + 1;
      });
    } else {
      const sourceSection = current.content.sections[operation.sectionIndex];
      const targetSection = current.content.sections[operation.targetSectionIndex];
      if (!sourceSection || !targetSection) return null;
      const [block] = sourceSection.blocks.splice(operation.blockIndex, 1);
      if (!block || operation.targetBlockIndex > targetSection.blocks.length) {
        return null;
      }
      targetSection.blocks.splice(operation.targetBlockIndex, 0, block);
    }

    current = {
      ...current,
      phaseOneBlocks: blocks,
      phaseOneProviderPaths: providerPaths as Record<string, string>,
      figures: current.figures.flatMap((figure) => {
        const nextPath = nextFigurePathByOldPath.get(figure.blockPath);
        return nextPath ? [{ ...figure, blockPath: nextPath }] : [];
      }),
    };
  }
  return current;
}

function applyLayoutOperationToRecord<T>(
  record: Record<string, T>,
  operation: LessonSummaryPhaseOneLayoutOperation,
): Record<string, T> | null {
  const entries = Object.entries(record).map(([path, value]) => ({
    path,
    value,
    position: parseBlockPath(path),
  }));
  if (entries.some((entry) => entry.position === null)) return null;

  if (operation.type === "DELETE_BLOCK") {
    const hasTarget = entries.some(
      (entry) =>
        entry.position?.sectionIndex === operation.sectionIndex &&
        entry.position.blockIndex === operation.blockIndex,
    );
    if (!hasTarget) return null;
    return rebuildBlockRecord(
      entries.flatMap((entry) => {
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

  if (operation.type === "DELETE_SECTION") {
    const hasTargetSection = entries.some(
      (entry) => entry.position?.sectionIndex === operation.sectionIndex,
    );
    if (!hasTargetSection) return null;
    return rebuildBlockRecord(
      entries.flatMap((entry) => {
        const position = entry.position!;
        if (position.sectionIndex === operation.sectionIndex) return [];
        return [
          {
            value: entry.value,
            sectionIndex:
              position.sectionIndex > operation.sectionIndex
                ? position.sectionIndex - 1
                : position.sectionIndex,
            blockIndex: position.blockIndex,
          },
        ];
      }),
    );
  }

  if (operation.type === "MOVE_SECTION") {
    const sections = groupRecordEntriesBySection(entries);
    const [section] = sections.splice(operation.sectionIndex, 1);
    if (!section || operation.targetSectionIndex > sections.length) return null;
    sections.splice(operation.targetSectionIndex, 0, section);
    return rebuildGroupedBlockRecord(sections);
  }

  if (operation.type === "MOVE_BLOCK") {
    const sections = groupRecordEntriesBySection(entries);
    const sourceSection = sections[operation.sectionIndex];
    const targetSection = sections[operation.targetSectionIndex];
    if (!sourceSection || !targetSection) return null;
    const [block] = sourceSection.splice(operation.blockIndex, 1);
    if (!block || operation.targetBlockIndex > targetSection.length) return null;
    targetSection.splice(operation.targetBlockIndex, 0, block);
    return rebuildGroupedBlockRecord(sections);
  }

  if (operation.sectionIndex < 1) return null;
  const previousBlockCount = entries.filter(
    (entry) => entry.position?.sectionIndex === operation.sectionIndex - 1,
  ).length;
  if (!entries.some((entry) => entry.position?.sectionIndex === operation.sectionIndex)) {
    return null;
  }
  return rebuildBlockRecord(
    entries.map((entry) => {
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

function parseBlockPath(path: string) {
  const match = path.match(/^sections\.(\d+)\.blocks\.(\d+)$/u);
  return match ? { sectionIndex: Number(match[1]), blockIndex: Number(match[2]) } : null;
}

function rebuildBlockRecord<T>(
  entries: Array<{ value: T; sectionIndex: number; blockIndex: number }>,
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

function groupRecordEntriesBySection<T>(
  entries: Array<{
    value: T;
    position: { sectionIndex: number; blockIndex: number } | null;
  }>,
) {
  const sectionCount =
    Math.max(...entries.map((entry) => entry.position?.sectionIndex ?? -1)) + 1;
  const sections = Array.from({ length: sectionCount }, () => [] as T[]);
  for (const entry of entries) {
    const position = entry.position!;
    sections[position.sectionIndex]![position.blockIndex] = entry.value;
  }
  return sections;
}

function rebuildGroupedBlockRecord<T>(sections: T[][]) {
  return rebuildBlockRecord(
    sections.flatMap((section, sectionIndex) =>
      section.map((value, blockIndex) => ({ value, sectionIndex, blockIndex })),
    ),
  );
}

function isLayoutOperation(
  value: unknown,
): value is LessonSummaryPhaseOneLayoutOperation {
  if (!isRecord(value)) return false;
  const sectionIndex = value.sectionIndex;
  if (typeof sectionIndex !== "number" || !Number.isInteger(sectionIndex)) {
    return false;
  }
  if (value.type === "MERGE_SECTION") return sectionIndex >= 1;
  if (value.type === "DELETE_SECTION") return sectionIndex >= 0;
  if (value.type === "MOVE_SECTION") {
    return (
      sectionIndex >= 0 &&
      Number.isInteger(value.targetSectionIndex) &&
      Number(value.targetSectionIndex) >= 0
    );
  }
  if (value.type === "MOVE_BLOCK") {
    return (
      sectionIndex >= 0 &&
      Number.isInteger(value.blockIndex) &&
      Number(value.blockIndex) >= 0 &&
      Number.isInteger(value.targetSectionIndex) &&
      Number(value.targetSectionIndex) >= 0 &&
      Number.isInteger(value.targetBlockIndex) &&
      Number(value.targetBlockIndex) >= 0
    );
  }
  return (
    value.type === "DELETE_BLOCK" &&
    sectionIndex >= 0 &&
    Number.isInteger(value.blockIndex) &&
    Number(value.blockIndex) >= 0
  );
}

function setValueAtPath(root: Record<string, unknown>, path: string, value: unknown) {
  const segments = path.split(".");
  if (segments.length < 1) return false;
  let current: unknown = root;
  for (const segment of segments.slice(0, -1)) {
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) return false;
      current = current[index];
      continue;
    }
    if (!isRecord(current) || !(segment in current)) return false;
    current = current[segment];
  }
  const last = segments.at(-1);
  if (!last) return false;
  if (Array.isArray(current)) {
    const index = Number(last);
    if (!Number.isInteger(index) || index < 0 || index >= current.length) return false;
    current[index] = structuredClone(value);
    return true;
  }
  if (!isRecord(current) || !(last in current)) return false;
  current[last] = structuredClone(value);
  return true;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    isRecord(value) && Object.values(value).every((item) => typeof item === "string")
  );
}

function isLessonSummarySubjectKey(value: unknown): value is LessonSummarySubjectKey {
  return ["MATH", "PHYSICS", "CHEMISTRY", "GENERAL"].includes(String(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
