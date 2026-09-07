import assert from "node:assert/strict";
import test from "node:test";
import type {
  AdminLearningPath,
  AdminLesson,
} from "@/features/admin/courses/admin-courses-data";
import { findLessonMatch } from "@/features/admin/courses/admin-courses-utils";

test("finds a top-level lesson without assigning it to a chapter", () => {
  const topLevelLesson = createLesson("lesson-top-level", null);
  const path = createPath(topLevelLesson);

  const match = findLessonMatch(path, topLevelLesson.id);

  assert.equal(match?.lesson.id, topLevelLesson.id);
  assert.equal(match?.chapter, null);
});

test("keeps finding a lesson nested in a chapter", () => {
  const nestedLesson = createLesson("lesson-in-chapter", "chapter-1");
  const path = createPath(null, nestedLesson);

  const match = findLessonMatch(path, nestedLesson.id);

  assert.equal(match?.lesson.id, nestedLesson.id);
  assert.equal(match?.chapter?.id, "chapter-1");
});

function createPath(
  topLevelLesson: AdminLesson | null,
  nestedLesson?: AdminLesson,
): AdminLearningPath {
  return {
    id: "path-1",
    chapters: nestedLesson
      ? [
          {
            id: "chapter-1",
            orderIndex: 1,
            title: "Chương 1",
            overview: "",
            objectives: "",
            status: "DRAFT",
            lessons: [nestedLesson],
          },
        ]
      : [],
    structureItems: topLevelLesson ? [{ type: "LESSON", ...topLevelLesson }] : [],
  } as AdminLearningPath;
}

function createLesson(id: string, chapterId: string | null): AdminLesson {
  return {
    id,
    learningPathId: "path-1",
    chapterId,
    orderIndex: 1,
    title: "Bài học",
    shortDescription: "",
    lessonType: "BASIC",
    liveUrl: "",
    scheduledAt: "",
    examOpenAt: "",
    videoUrl: "",
    completionMinScore: 7,
    trialEnabled: false,
    status: "DRAFT",
  };
}
