import type { LessonSummaryRecord } from "#api/modules/learning-paths/types/lesson-summary.types";
import {
  improveLessonSummaryReviewIssueCopy,
  reconcileLessonSummaryReviewIssues,
} from "#api/modules/learning-paths/utils/lesson-summary-review";

export function serializeLessonSummary(record: LessonSummaryRecord) {
  const contentJson = isRecord(record.contentJson)
    ? reconcileLessonSummaryReviewIssues(record.contentJson)
    : record.contentJson;
  return {
    id: record.id,
    lessonId: record.lessonId,
    contentJson: improveLessonSummaryReviewIssueCopy(contentJson),
    source: record.source,
    reviewStatus: record.reviewStatus,
    aiGenerationId: record.aiGenerationId,
    createdById: record.createdById,
    updatedById: record.updatedById,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
