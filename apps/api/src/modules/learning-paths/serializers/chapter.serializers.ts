import { serializeLesson } from "#api/modules/learning-paths/serializers/lesson.serializers";
import type {
  ChapterDetailRecord,
  ChapterDetailResponse,
  ChapterRecord,
  ChapterResponse,
} from "#api/modules/learning-paths/types/chapter.types";

export function serializeChapter(record: ChapterRecord): ChapterResponse {
  return {
    id: record.id,
    learningPathId: record.learningPathId,
    orderIndex: record.orderIndex,
    title: record.title,
    overview: record.overview,
    objectivesJson: record.objectivesJson,
    status: record.status,
    createdById: record.createdById,
    updatedById: record.updatedById,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function serializeChapterDetail(
  record: ChapterDetailRecord,
): ChapterDetailResponse {
  return {
    ...serializeChapter(record),
    lessons: record.lessons.map(serializeLesson),
  };
}
