import type { LessonSummaryRecord } from "#api/modules/learning-paths/types/lesson-summary.types";

export function serializeLessonSummary(record: LessonSummaryRecord) {
  return {
    id: record.id,
    lessonId: record.lessonId,
    contentJson: record.contentJson,
    source: record.source,
    reviewStatus: record.reviewStatus,
    aiGenerationId: record.aiGenerationId,
    createdById: record.createdById,
    updatedById: record.updatedById,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
