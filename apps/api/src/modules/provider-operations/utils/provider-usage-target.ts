import {
  providerUsageTargetContextSchema,
  type ProviderUsageTargetContext,
} from "@learning-path/shared";
import type { AiGenerationType } from "@prisma/client";

export function buildWholeFeatureUsageTarget(
  feature: AiGenerationType,
  entityId?: string | null,
): ProviderUsageTargetContext {
  const kindByFeature = {
    SUMMARY: "LESSON_SUMMARY",
    VIDEO_SUMMARY: "VIDEO_SUMMARY",
    QUIZ: "QUIZ_SET",
    FLASHCARD: "FLASHCARD_SET",
    TEST: "TEST_SET",
    EXPLANATION: "EXPLANATION",
    CHAT: "CHAT_THREAD",
    EMBEDDING: "EMBEDDING_SOURCE",
    DOCUMENT_EXTRACT: "SOURCE_DOCUMENT",
    DIAGRAM_RENDER: "DIAGRAM",
  } as const satisfies Record<AiGenerationType, ProviderUsageTargetContext["kind"]>;
  return {
    version: 1,
    kind: kindByFeature[feature],
    entityId: entityId ?? null,
  };
}

export function buildSummaryBlockUsageTarget(input: {
  entityId: string;
  blockPath: string;
  blockType: unknown;
  targetMode?: "QUESTION" | "SOLUTION" | null;
}): ProviderUsageTargetContext {
  const match = input.blockPath.match(/^sections\.(\d+)\.blocks\.(\d+)$/u);
  return {
    version: 1,
    kind: "SUMMARY_BLOCK",
    entityId: input.entityId,
    sectionOrdinal: match ? Number(match[1]) + 1 : null,
    blockOrdinal: match ? Number(match[2]) + 1 : null,
    blockKind: normalizeSummaryBlockKind(input.blockType),
    figureRole:
      input.targetMode === "QUESTION"
        ? "QUESTION"
        : input.targetMode === "SOLUTION"
          ? "SOLUTION"
          : "ILLUSTRATION",
  };
}

export function buildItemUsageTarget(input: {
  kind: "QUIZ_QUESTION" | "FLASHCARD_CARD" | "TEST_QUESTION";
  entityId: string;
  sortOrder: number;
  figureRole?: "QUESTION" | "SOLUTION" | "ILLUSTRATION" | null;
}): ProviderUsageTargetContext {
  return {
    version: 1,
    kind: input.kind,
    entityId: input.entityId,
    itemOrdinal: Math.max(1, input.sortOrder + 1),
    figureRole: input.figureRole ?? null,
  };
}

export function parseProviderUsageTargetContext(
  value: unknown,
): ProviderUsageTargetContext | null {
  const parsed = providerUsageTargetContextSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function formatProviderUsageTargetLabel(value: unknown): string {
  const target = parseProviderUsageTargetContext(value);
  if (!target) return "Chưa xác định";
  switch (target.kind) {
    case "LESSON_SUMMARY":
      return "Bài học · Toàn bài";
    case "VIDEO_SUMMARY":
      return "Video · Tóm tắt";
    case "QUIZ_SET":
      return "Quiz · Cả bộ";
    case "FLASHCARD_SET":
      return "Flashcard · Cả bộ";
    case "TEST_SET":
      return "Bài kiểm tra · Cả bộ";
    case "QUIZ_QUESTION":
      return joinTargetParts([
        "Quiz",
        target.itemOrdinal ? `Câu ${target.itemOrdinal}` : "Câu hỏi",
        figureRoleLabel(target.figureRole),
      ]);
    case "FLASHCARD_CARD":
      return joinTargetParts([
        "Flashcard",
        target.itemOrdinal ? `Thẻ ${target.itemOrdinal}` : "Thẻ",
        figureRoleLabel(target.figureRole),
      ]);
    case "TEST_QUESTION":
      return joinTargetParts([
        "Bài kiểm tra",
        target.itemOrdinal ? `Câu ${target.itemOrdinal}` : "Câu hỏi",
        figureRoleLabel(target.figureRole),
      ]);
    case "SUMMARY_BLOCK": {
      const block = summaryBlockLabel(target.blockKind);
      const position = target.blockOrdinal
        ? target.sectionOrdinal && target.sectionOrdinal > 1
          ? `${block} ${target.sectionOrdinal}.${target.blockOrdinal}`
          : `${block} ${target.blockOrdinal}`
        : block;
      return joinTargetParts([position, figureRoleLabel(target.figureRole)]);
    }
    case "EXPLANATION":
      return target.itemOrdinal ? `Giải thích · Mục ${target.itemOrdinal}` : "Giải thích";
    case "CHAT_THREAD":
      return "Buổi học · Chat";
    case "EMBEDDING_SOURCE":
      return "Tài liệu · Embedding";
    case "SOURCE_DOCUMENT":
      return "Tài liệu nguồn";
    case "DIAGRAM":
      return "Bài học · Sơ đồ";
  }
}

function normalizeSummaryBlockKind(
  value: unknown,
): ProviderUsageTargetContext["blockKind"] {
  if (typeof value !== "string") return "OTHER";
  switch (value.trim().toLowerCase()) {
    case "theory":
    case "concept":
      return "THEORY";
    case "note":
    case "warning":
      return "NOTE";
    case "example":
      return "EXAMPLE";
    case "exercise":
    case "problem":
      return "EXERCISE";
    default:
      return "OTHER";
  }
}

function summaryBlockLabel(kind: ProviderUsageTargetContext["blockKind"]) {
  switch (kind) {
    case "THEORY":
      return "Lý thuyết";
    case "NOTE":
      return "Chú ý";
    case "EXAMPLE":
      return "Ví dụ";
    case "EXERCISE":
      return "Bài tập";
    default:
      return "Khối nội dung";
  }
}

function figureRoleLabel(role: ProviderUsageTargetContext["figureRole"]) {
  switch (role) {
    case "QUESTION":
      return "Hình đề";
    case "SOLUTION":
      return "Hình lời giải";
    case "ILLUSTRATION":
      return "Hình minh họa";
    default:
      return null;
  }
}

function joinTargetParts(parts: Array<string | null>) {
  return parts.filter((part): part is string => Boolean(part)).join(" · ");
}
