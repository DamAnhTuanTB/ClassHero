import type {
  LessonRecord,
  LessonResponse,
} from "#api/modules/learning-paths/types/lesson.types";

export function serializeLesson(record: LessonRecord): LessonResponse {
  return {
    id: record.id,
    learningPathId: record.learningPathId,
    orderIndex: record.orderIndex,
    title: record.title,
    shortDescription: record.shortDescription,
    scheduledAt: record.scheduledAt,
    examOpenAt: record.examOpenAt,
    videoUrl: record.videoUrl,
    completionMinScore: Number(record.completionMinScore),
    status: record.status,
    createdById: record.createdById,
    updatedById: record.updatedById,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
