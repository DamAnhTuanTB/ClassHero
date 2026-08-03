import { DocumentStatus, Prisma, ReviewStatus } from "@prisma/client";

export const studentLessonFileSelect = {
  id: true,
  objectKey: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  publicUrl: true,
} satisfies Prisma.FileSelect;

export const studentLessonSummarySelect = {
  id: true,
  lessonId: true,
  contentJson: true,
  source: true,
  reviewStatus: true,
  updatedAt: true,
  deletedAt: true,
} satisfies Prisma.LessonSummarySelect;

const approvedQuizQuestionWhere = {
  deletedAt: null,
  reviewStatus: ReviewStatus.APPROVED,
} satisfies Prisma.QuizQuestionWhereInput;

const approvedFlashcardWhere = {
  deletedAt: null,
  reviewStatus: ReviewStatus.APPROVED,
} satisfies Prisma.FlashcardWhereInput;

const approvedTestQuestionWhere = {
  deletedAt: null,
  reviewStatus: ReviewStatus.APPROVED,
} satisfies Prisma.TestQuestionWhereInput;

export const studentLessonContentSelect = {
  id: true,
  learningPathId: true,
  chapterId: true,
  orderIndex: true,
  title: true,
  shortDescription: true,
  lessonType: true,
  liveUrl: true,
  prepMaterialJson: true,
  scheduledAt: true,
  examOpenAt: true,
  videoUrl: true,
  customVideoSettings: true,
  completionMinScore: true,
  trialEnabled: true,
  learningPath: {
    select: {
      id: true,
      slug: true,
      title: true,
    },
  },
  chapter: {
    select: {
      id: true,
      orderIndex: true,
      title: true,
      overview: true,
    },
  },
  materials: {
    where: {
      deletedAt: null,
      OR: [{ fileId: null }, { file: { deletedAt: null } }],
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      type: true,
      fileId: true,
      file: {
        select: studentLessonFileSelect,
      },
      url: true,
      title: true,
      contentJson: true,
      sortOrder: true,
    },
  },
  documents: {
    where: {
      replacedAt: null,
      status: DocumentStatus.READY,
      file: {
        deletedAt: null,
      },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      fileId: true,
      file: {
        select: studentLessonFileSelect,
      },
      kind: true,
      pageRangeId: true,
      pageRange: {
        select: {
          pageStart: true,
          pageEnd: true,
        },
      },
      sortOrder: true,
      title: true,
    },
  },
  summary: {
    select: studentLessonSummarySelect,
  },
  quizSets: {
    where: {
      deletedAt: null,
      isReserve: false,
      reviewStatus: ReviewStatus.APPROVED,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      difficulty: true,
      source: true,
      sortOrder: true,
      _count: {
        select: {
          questions: {
            where: approvedQuizQuestionWhere,
          },
        },
      },
    },
  },
  flashcardSets: {
    where: {
      deletedAt: null,
      isReserve: false,
      reviewStatus: ReviewStatus.APPROVED,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      difficulty: true,
      source: true,
      sortOrder: true,
      _count: {
        select: {
          flashcards: {
            where: approvedFlashcardWhere,
          },
        },
      },
    },
  },
  testSets: {
    where: {
      deletedAt: null,
      isReserve: false,
      reviewStatus: ReviewStatus.APPROVED,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      durationSeconds: true,
      difficulty: true,
      source: true,
      totalScore: true,
      sortOrder: true,
      _count: {
        select: {
          questions: {
            where: approvedTestQuestionWhere,
          },
        },
      },
    },
  },
} satisfies Prisma.LessonSelect;

export const studentQuizSetSelect = {
  id: true,
  lessonId: true,
  title: true,
  difficulty: true,
  source: true,
  sortOrder: true,
  questions: {
    where: approvedQuizQuestionWhere,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      questionType: true,
      questionJson: true,
      optionsJson: true,
      hintJson: true,
      difficulty: true,
      sortOrder: true,
    },
  },
} satisfies Prisma.QuizSetSelect;

export const studentTestSetSelect = {
  id: true,
  lessonId: true,
  title: true,
  durationSeconds: true,
  difficulty: true,
  source: true,
  totalScore: true,
  sortOrder: true,
  _count: {
    select: {
      questions: {
        where: approvedTestQuestionWhere,
      },
    },
  },
} satisfies Prisma.TestSetSelect;
