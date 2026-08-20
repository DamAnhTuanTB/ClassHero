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
  stemFigureAssetUrls: ReadonlyMap<string, string | null> = new Map(),
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
    chapter: record.chapter
      ? {
          id: record.chapter.id,
          orderIndex: record.chapter.orderIndex,
          title: record.chapter.title,
          overview: record.chapter.overview,
        }
      : null,
    learningPath: record.learningPath,
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
    summary: serializeStudentLessonSummary(record.summary, stemFigureAssetUrls),
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

export function serializeStudentLessonSummary(
  record: StudentLessonSummaryRecord | null,
  stemFigureAssetUrls: ReadonlyMap<string, string | null> = new Map(),
) {
  if (!record || record.deletedAt || record.reviewStatus !== ReviewStatus.APPROVED) {
    return null;
  }

  return {
    id: record.id,
    lessonId: record.lessonId,
    contentJson: hydrateStemFigureReferences(
      record.contentJson,
      new Map(
        record.stemFigures.map((figure) => [
          figure.id,
          {
            status: "SUCCEEDED" as const,
            altText: figure.currentRevision?.altText ?? "Hình minh họa STEM",
            caption: figure.currentRevision?.caption ?? null,
            assetUrl: stemFigureAssetUrls.get(figure.id) ?? null,
          },
        ]),
      ),
    ),
    source: record.source,
    updatedAt: record.updatedAt,
  };
}

function hydrateStemFigureReferences(
  contentJson: unknown,
  figures: ReadonlyMap<
    string,
    {
      status: "SUCCEEDED";
      altText: string;
      caption: string | null;
      assetUrl: string | null;
    }
  >,
) {
  if (!isRecord(contentJson) || !isRecord(contentJson.data)) return contentJson;
  const sections = contentJson.data.sections;
  if (!Array.isArray(sections)) return contentJson;
  return {
    ...contentJson,
    data: {
      ...contentJson.data,
      sections: sections.map((section) => {
        if (!isRecord(section) || !Array.isArray(section.blocks)) return section;
        return {
          ...section,
          blocks: section.blocks.map((block) => {
            if (!isRecord(block) || !Array.isArray(block.figures)) return block;
            return {
              ...block,
              figures: block.figures.map((visual) => {
                if (
                  !isRecord(visual) ||
                  visual.kind !== "TEX_FIGURE" ||
                  typeof visual.figureId !== "string"
                ) {
                  return visual;
                }
                const figure = figures.get(visual.figureId);
                return figure
                  ? {
                      kind: "TEX_FIGURE",
                      figureId: visual.figureId,
                      status: figure.status,
                      altText: figure.altText,
                      caption: figure.caption,
                      assetUrl: figure.assetUrl,
                    }
                  : visual;
              }),
            };
          }),
        };
      }),
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
  latestSubmittedAttempt: {
    id: string;
    score: { toString(): string } | null;
    durationSeconds: number | null;
    submittedAt: Date | null;
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
    latestSubmittedAttempt: latestSubmittedAttempt
      ? {
          id: latestSubmittedAttempt.id,
          score: latestSubmittedAttempt.score
            ? Number(latestSubmittedAttempt.score)
            : null,
          durationSeconds: latestSubmittedAttempt.durationSeconds,
          submittedAt: latestSubmittedAttempt.submittedAt?.toISOString() ?? null,
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
