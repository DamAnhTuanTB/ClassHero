import { ReviewStatus } from "@prisma/client";
import type { StudentLessonAccessContext } from "#api/modules/learning-paths/types/lesson.types";
import type {
  StudentFileAccessUrls,
  StudentLessonContentRecord,
  StudentLessonSummaryRecord,
  StudentQuizSetRecord,
  StudentTestSetRecord,
} from "#api/modules/student-learning/types/student-lesson.types";
import type { StudentTestPrerequisiteStatus } from "#api/modules/student-learning/types/student-learning-prerequisite.types";

export function serializeStudentLessonContent(
  record: StudentLessonContentRecord,
  access: StudentLessonAccessContext,
  fileAccessUrls: StudentFileAccessUrls,
) {
  const canStartTest = canStudentStartTest(record.examOpenAt, access);

  return {
    id: record.id,
    learningPathId: record.learningPathId,
    chapterId: record.chapterId,
    orderIndex: record.orderIndex,
    title: record.title,
    shortDescription: record.shortDescription,
    lessonType: record.lessonType,
    liveUrl: record.liveUrl,
    prepMaterialJson: record.prepMaterialJson,
    scheduledAt: record.scheduledAt,
    examOpenAt: record.examOpenAt,
    videoUrl: record.videoUrl,
    customVideoSettings: record.customVideoSettings,
    completionMinScore: Number(record.completionMinScore),
    trialEnabled: record.trialEnabled,
    access: {
      mode: access.mode,
    },
    chapter: {
      id: record.chapter.id,
      orderIndex: record.chapter.orderIndex,
      title: record.chapter.title,
      overview: record.chapter.overview,
    },
    learningPath: record.chapter.learningPath,
    materials: record.materials.map((material) => ({
      id: material.id,
      type: material.type,
      fileId: material.fileId,
      file: material.file ? serializeStudentFile(material.file, fileAccessUrls) : null,
      url: material.url,
      title: material.title,
      contentJson: material.contentJson,
      sortOrder: material.sortOrder,
    })),
    documents: record.documents.map((document) => ({
      id: document.id,
      fileId: document.fileId,
      file: serializeStudentFile(document.file, fileAccessUrls),
      kind: document.kind,
      pageRangeId: document.pageRangeId,
      pageRange: document.pageRange,
      sortOrder: document.sortOrder,
      title: document.title,
    })),
    summary: serializeStudentLessonSummary(record.summary),
    quizSets: record.quizSets.map(({ _count, ...set }) => ({
      ...set,
      questionCount: _count.questions,
    })),
    flashcardSets: record.flashcardSets.map(({ _count, ...set }) => ({
      ...set,
      cardCount: _count.flashcards,
    })),
    testSets: record.testSets.map((set) => serializeStudentTestSet(set)),
    testAvailability: {
      canStartTest,
      examOpenAt: record.examOpenAt,
    },
  };
}

export function serializeStudentLessonSummary(record: StudentLessonSummaryRecord | null) {
  if (!record || record.deletedAt || record.reviewStatus !== ReviewStatus.APPROVED) {
    return null;
  }

  return {
    id: record.id,
    lessonId: record.lessonId,
    contentJson: record.contentJson,
    source: record.source,
    updatedAt: record.updatedAt,
  };
}

export function serializeStudentQuizSet(record: StudentQuizSetRecord) {
  return {
    ...record,
    questionCount: record.questions.length,
  };
}

export function serializeStudentTestStatus(
  records: StudentTestSetRecord[],
  prerequisites: StudentTestPrerequisiteStatus,
  bestAttempt: {
    id: string;
    score: { toString(): string } | null;
    durationSeconds: number | null;
  } | null,
) {
  return {
    ...prerequisites,
    bestAttempt: bestAttempt
      ? {
          id: bestAttempt.id,
          score: bestAttempt.score ? Number(bestAttempt.score) : null,
          durationSeconds: bestAttempt.durationSeconds,
        }
      : null,
    sets: records.map((record) => serializeStudentTestSet(record)),
  };
}

function serializeStudentTestSet(
  record: StudentTestSetRecord | StudentLessonContentRecord["testSets"][number],
) {
  const { _count, totalScore, ...set } = record;
  return {
    ...set,
    totalScore: Number(totalScore),
    questionCount: _count.questions,
  };
}

function serializeStudentFile(
  file: StudentLessonContentRecord["documents"][number]["file"],
  fileAccessUrls: StudentFileAccessUrls,
) {
  return {
    id: file.id,
    originalName: file.originalName,
    mimeType: file.mimeType,
    sizeBytes: Number(file.sizeBytes),
    accessUrl: fileAccessUrls.get(file.id) ?? null,
  };
}

function canStudentStartTest(
  examOpenAt: Date | null,
  access: StudentLessonAccessContext,
) {
  if (access.mode === "TRIAL") {
    return false;
  }

  return !examOpenAt || examOpenAt.getTime() <= access.evaluatedAt.getTime();
}
