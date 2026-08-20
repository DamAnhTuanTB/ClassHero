import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import {
  EnrollmentStatus,
  LearningPathKind,
  Prisma,
  PublishStatus,
} from "@prisma/client";
import { PrismaService } from "#api/common/prisma/prisma.service";

const cloneLessonInclude = {
  materials: {
    where: { deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  },
  documentPageRanges: true,
  documents: {
    where: { replacedAt: null },
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      chunks: {
        orderBy: { chunkIndex: "asc" },
      },
    },
  },
  summary: {
    where: { deletedAt: null },
  },
  quizSets: {
    where: { deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      questions: {
        where: { deletedAt: null },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          explanation: true,
        },
      },
    },
  },
  flashcardSets: {
    where: { deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      flashcards: {
        where: { deletedAt: null },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          explanation: true,
        },
      },
    },
  },
  testSets: {
    where: { deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      questions: {
        where: { deletedAt: null },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          explanation: true,
        },
      },
    },
  },
} satisfies Prisma.LessonInclude;

const cloneGraphInclude = {
  targetAudiences: {
    select: { targetAudienceId: true },
  },
  sourceDocuments: {
    where: { deletedAt: null },
    include: {
      pages: {
        orderBy: { pageNumber: "asc" },
      },
    },
  },
  lessons: {
    where: { chapterId: null, deletedAt: null },
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
    include: cloneLessonInclude,
  },
  chapters: {
    where: { deletedAt: null },
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
    include: {
      lessons: {
        where: { deletedAt: null },
        orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
        include: cloneLessonInclude,
      },
    },
  },
} satisfies Prisma.LearningPathInclude;

type SourceLearningPathGraph = Prisma.LearningPathGetPayload<{
  include: typeof cloneGraphInclude;
}>;

type CloneCounts = {
  chapters: number;
  lessons: number;
  sourceDocuments: number;
  sourceDocumentPages: number;
  lessonMaterials: number;
  lessonDocuments: number;
  documentChunks: number;
  quizSets: number;
  quizQuestions: number;
  flashcardSets: number;
  flashcards: number;
  testSets: number;
  testQuestions: number;
  aiExplanations: number;
  lessonProgress: number;
  flashcardProgress: number;
};

@Injectable()
export class PersonalLearningPathClonerService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async cloneForEnrollment({
    enrollmentId,
    actorUserId,
    backgroundJobId,
  }: {
    enrollmentId: string;
    actorUserId: string;
    backgroundJobId: string;
  }) {
    const now = new Date();
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        id: enrollmentId,
        status: EnrollmentStatus.ACTIVE,
        startsAt: { lte: now },
        expiresAt: { gt: now },
      },
      select: {
        id: true,
        studentUserId: true,
        learningPathId: true,
        deliveryLearningPathId: true,
      },
    });

    if (!enrollment) {
      throw new Error(`Active enrollment ${enrollmentId} was not found`);
    }

    if (enrollment.deliveryLearningPathId) {
      return {
        personalLearningPathId: enrollment.deliveryLearningPathId,
        sourceLearningPathId: enrollment.learningPathId,
        enrollmentId,
        alreadyActivated: true,
        counts: emptyCloneCounts(),
      };
    }

    const source = await this.prisma.learningPath.findFirst({
      where: {
        id: enrollment.learningPathId,
        kind: LearningPathKind.CATALOG,
        deletedAt: null,
      },
      include: cloneGraphInclude,
    });

    if (!source) {
      throw new Error(`Catalog learning path ${enrollment.learningPathId} was not found`);
    }

    const sourceLessons = [
      ...source.lessons,
      ...source.chapters.flatMap((chapter) => chapter.lessons),
    ];
    const sourceLessonIds = sourceLessons.map((lesson) => lesson.id);
    const sourceFlashcardIds = sourceLessons.flatMap((lesson) =>
      lesson.flashcardSets.flatMap((set) =>
        set.flashcards.map((flashcard) => flashcard.id),
      ),
    );
    const [lessonProgress, flashcardProgress] = await Promise.all([
      this.prisma.lessonProgress.findMany({
        where: {
          studentUserId: enrollment.studentUserId,
          lessonId: { in: sourceLessonIds },
        },
      }),
      this.prisma.flashcardProgress.findMany({
        where: {
          studentUserId: enrollment.studentUserId,
          flashcardId: { in: sourceFlashcardIds },
        },
      }),
    ]);

    return this.prisma.$transaction(
      async (tx) =>
        this.cloneGraphInTransaction({
          tx,
          source,
          enrollment,
          lessonProgress,
          flashcardProgress,
          actorUserId,
          backgroundJobId,
        }),
      {
        maxWait: 10_000,
        timeout: 120_000,
      },
    );
  }

  private async cloneGraphInTransaction({
    tx,
    source,
    enrollment,
    lessonProgress,
    flashcardProgress,
    actorUserId,
    backgroundJobId,
  }: {
    tx: Prisma.TransactionClient;
    source: SourceLearningPathGraph;
    enrollment: {
      id: string;
      studentUserId: string;
      learningPathId: string;
      deliveryLearningPathId: string | null;
    };
    lessonProgress: Array<{
      studentUserId: string;
      lessonId: string;
      status: Prisma.LessonProgressCreateManyInput["status"];
      bestTestAttemptId: string | null;
      bestScore: Prisma.Decimal | null;
      bestDurationSeconds: number | null;
      completedAt: Date | null;
      xpAwarded: boolean;
    }>;
    flashcardProgress: Array<{
      studentUserId: string;
      lessonId: string;
      flashcardId: string;
      isKnown: boolean;
      lastReviewedAt: Date;
      reviewCount: number;
    }>;
    actorUserId: string;
    backgroundJobId: string;
  }) {
    const personalLearningPathId = randomUUID();
    const chapterIdMap = createIdMap(source.chapters);
    const lessons = [
      ...source.lessons,
      ...source.chapters.flatMap((chapter) => chapter.lessons),
    ];
    const lessonIdMap = createIdMap(lessons);
    const sourceDocumentIdMap = createIdMap(source.sourceDocuments);
    const pageRanges = lessons.flatMap((lesson) => lesson.documentPageRanges);
    const pageRangeIdMap = createIdMap(pageRanges);
    const lessonDocuments = lessons.flatMap((lesson) => lesson.documents);
    const lessonDocumentIdMap = createIdMap(lessonDocuments);
    const documentChunks = lessonDocuments.flatMap((document) => document.chunks);
    const documentChunkIdMap = createIdMap(documentChunks);
    const quizSets = lessons.flatMap((lesson) => lesson.quizSets);
    const quizSetIdMap = createIdMap(quizSets);
    const quizQuestions = quizSets.flatMap((set) => set.questions);
    const quizQuestionIdMap = createIdMap(quizQuestions);
    const flashcardSets = lessons.flatMap((lesson) => lesson.flashcardSets);
    const flashcardSetIdMap = createIdMap(flashcardSets);
    const flashcards = flashcardSets.flatMap((set) => set.flashcards);
    const flashcardIdMap = createIdMap(flashcards);
    const testSets = lessons.flatMap((lesson) => lesson.testSets);
    const testSetIdMap = createIdMap(testSets);
    const testQuestions = testSets.flatMap((set) => set.questions);
    const testQuestionIdMap = createIdMap(testQuestions);
    const explanationClones = [
      ...quizQuestions.flatMap((question) =>
        question.explanation
          ? [
              buildExplanationClone({
                source: question.explanation,
                targetId: getMappedId(quizQuestionIdMap, question.id),
                lessonId: getMappedId(lessonIdMap, question.lessonId),
              }),
            ]
          : [],
      ),
      ...flashcards.flatMap((flashcard) =>
        flashcard.explanation
          ? [
              buildExplanationClone({
                source: flashcard.explanation,
                targetId: getMappedId(flashcardIdMap, flashcard.id),
                lessonId: getMappedId(lessonIdMap, flashcard.lessonId),
              }),
            ]
          : [],
      ),
      ...testQuestions.flatMap((question) =>
        question.explanation
          ? [
              buildExplanationClone({
                source: question.explanation,
                targetId: getMappedId(testQuestionIdMap, question.id),
                lessonId: getMappedId(lessonIdMap, question.lessonId),
              }),
            ]
          : [],
      ),
    ];
    const explanationIdByTargetId = new Map(
      explanationClones.map((item) => [item.targetId, item.id]),
    );

    await tx.learningPath.create({
      data: {
        id: personalLearningPathId,
        kind: LearningPathKind.PERSONALIZED,
        sourceLearningPathId: source.id,
        domainId: source.domainId,
        targetAudiences: {
          create: source.targetAudiences.map(({ targetAudienceId }) => ({
            targetAudience: { connect: { id: targetAudienceId } },
          })),
        },
        title: source.title,
        slug: `personal-${enrollment.id}`,
        originalPriceVnd: source.originalPriceVnd,
        salePriceVnd: source.salePriceVnd,
        totalChapterCount: source.chapters.length,
        totalLessonCount: lessons.length,
        thumbnailFileId: source.thumbnailFileId,
        descriptionJson: nullableJson(source.descriptionJson),
        startDate: source.startDate,
        endDate: source.endDate,
        lessonCountMin: source.lessonCountMin,
        lessonCountMax: source.lessonCountMax,
        status: PublishStatus.PUBLISHED,
        trialEnabled: false,
        publishedAt: new Date(),
        sortOrder: source.sortOrder,
        createdById: actorUserId,
        updatedById: actorUserId,
      },
    });

    await createManyIfNeeded(
      tx.sourceDocument,
      source.sourceDocuments.map((document) => ({
        id: getMappedId(sourceDocumentIdMap, document.id),
        learningPathId: personalLearningPathId,
        fileId: document.fileId,
        title: document.title,
        status: document.status,
        pageCount: document.pageCount,
        contentHash: document.contentHash,
        processingJobId: null,
        processedAt: document.processedAt,
        metadataJson: nullableJson(document.metadataJson),
      })),
    );

    await createManyIfNeeded(
      tx.sourceDocumentPage,
      source.sourceDocuments.flatMap((document) =>
        document.pages.map((page) => ({
          id: randomUUID(),
          sourceDocumentId: getMappedId(sourceDocumentIdMap, document.id),
          pageNumber: page.pageNumber,
          status: page.status,
          text: page.text,
          mathpixMarkdown: page.mathpixMarkdown,
          textSource: page.textSource,
          qualityScore: page.qualityScore,
          thumbnailFileId: page.thumbnailFileId,
          extractError: page.extractError,
          metadataJson: nullableJson(page.metadataJson),
        })),
      ),
    );

    await createManyIfNeeded(
      tx.learningPathChapter,
      source.chapters.map((chapter) => ({
        id: getMappedId(chapterIdMap, chapter.id),
        sourceChapterId: chapter.id,
        learningPathId: personalLearningPathId,
        orderIndex: chapter.orderIndex,
        title: chapter.title,
        overview: chapter.overview,
        objectivesJson: nullableJson(chapter.objectivesJson),
        status: chapter.status,
        createdById: actorUserId,
        updatedById: actorUserId,
      })),
    );

    await createManyIfNeeded(
      tx.lesson,
      lessons.map((lesson) => ({
        id: getMappedId(lessonIdMap, lesson.id),
        sourceLessonId: lesson.id,
        learningPathId: personalLearningPathId,
        chapterId: lesson.chapterId ? getMappedId(chapterIdMap, lesson.chapterId) : null,
        orderIndex: lesson.orderIndex,
        title: lesson.title,
        shortDescription: lesson.shortDescription,
        lessonType: lesson.lessonType,
        liveUrl: lesson.liveUrl,
        prepMaterialJson: nullableJson(lesson.prepMaterialJson),
        scheduledAt: lesson.scheduledAt,
        examOpenAt: lesson.examOpenAt,
        videoUrl: lesson.videoUrl,
        completionMinScore: lesson.completionMinScore,
        trialEnabled: false,
        status: lesson.status,
        createdById: actorUserId,
        updatedById: actorUserId,
      })),
    );

    await createManyIfNeeded(
      tx.lessonMaterial,
      lessons.flatMap((lesson) =>
        lesson.materials.map((material) => ({
          id: randomUUID(),
          lessonId: getMappedId(lessonIdMap, lesson.id),
          type: material.type,
          fileId: material.fileId,
          url: material.url,
          title: material.title,
          contentJson: nullableJson(material.contentJson),
          sortOrder: material.sortOrder,
        })),
      ),
    );

    await createManyIfNeeded(
      tx.lessonDocumentPageRange,
      pageRanges.map((range) => ({
        id: getMappedId(pageRangeIdMap, range.id),
        lessonId: getMappedId(lessonIdMap, range.lessonId),
        sourceDocumentId: getMappedId(sourceDocumentIdMap, range.sourceDocumentId),
        pageStart: range.pageStart,
        pageEnd: range.pageEnd,
        createdById: actorUserId,
        metadataJson: nullableJson(range.metadataJson),
      })),
    );

    await createManyIfNeeded(
      tx.lessonDocument,
      lessonDocuments.map((document) => ({
        id: getMappedId(lessonDocumentIdMap, document.id),
        lessonId: getMappedId(lessonIdMap, document.lessonId),
        fileId: document.fileId,
        sourceDocumentId: document.sourceDocumentId
          ? getMappedId(sourceDocumentIdMap, document.sourceDocumentId)
          : null,
        pageRangeId: document.pageRangeId
          ? getMappedId(pageRangeIdMap, document.pageRangeId)
          : null,
        kind: document.kind,
        sortOrder: document.sortOrder,
        title: document.title,
        status: document.status,
        extractedText: document.extractedText,
        extractError: document.extractError,
        contentHash: document.contentHash,
        chunkCount: document.chunks.length,
        processingJobId: null,
        processedAt: document.processedAt,
        embeddingProvider: document.embeddingProvider,
        embeddingModel: document.embeddingModel,
        embeddingDimensions: document.embeddingDimensions,
        metadataJson: nullableJson(document.metadataJson),
      })),
    );

    await createManyIfNeeded(
      tx.documentChunk,
      lessonDocuments.flatMap((document) =>
        document.chunks.map((chunk) => ({
          id: getMappedId(documentChunkIdMap, chunk.id),
          documentId: getMappedId(lessonDocumentIdMap, document.id),
          lessonId: getMappedId(lessonIdMap, document.lessonId),
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          contentHash: chunk.contentHash,
          tokenCount: chunk.tokenCount,
          embeddingProvider: chunk.embeddingProvider,
          embeddingModel: chunk.embeddingModel,
          embeddingDimensions: chunk.embeddingDimensions,
          metadataJson: nullableJson(chunk.metadataJson),
        })),
      ),
    );

    await copyChunkEmbeddings({
      tx,
      chunks: documentChunks,
      chunkIdMap: documentChunkIdMap,
    });

    await createManyIfNeeded(
      tx.lessonSummary,
      lessons.flatMap((lesson) =>
        lesson.summary
          ? [
              {
                id: randomUUID(),
                lessonId: getMappedId(lessonIdMap, lesson.id),
                contentJson: requiredJson(lesson.summary.contentJson),
                source: lesson.summary.source,
                reviewStatus: lesson.summary.reviewStatus,
                aiGenerationId: null,
                createdById: actorUserId,
                updatedById: actorUserId,
              },
            ]
          : [],
      ),
    );

    await createManyIfNeeded(
      tx.quizSet,
      quizSets.map((set) => ({
        id: getMappedId(quizSetIdMap, set.id),
        lessonId: getMappedId(lessonIdMap, set.lessonId),
        title: set.title,
        difficulty: set.difficulty,
        source: set.source,
        reviewStatus: set.reviewStatus,
        isReserve: set.isReserve,
        generatedByUserId: set.generatedByUserId,
        aiGenerationId: null,
        questionCount: set.questions.length,
        sortOrder: set.sortOrder,
        createdById: actorUserId,
        updatedById: actorUserId,
      })),
    );

    await createManyIfNeeded(
      tx.aiExplanation,
      explanationClones.map((item) => item.data),
    );

    await createManyIfNeeded(
      tx.quizQuestion,
      quizSets.flatMap((set) =>
        set.questions.map((question) => ({
          id: getMappedId(quizQuestionIdMap, question.id),
          quizSetId: getMappedId(quizSetIdMap, set.id),
          lessonId: getMappedId(lessonIdMap, question.lessonId),
          questionType: question.questionType,
          questionJson: requiredJson(question.questionJson),
          optionsJson: nullableJson(question.optionsJson),
          correctAnswerJson: requiredJson(question.correctAnswerJson),
          hintJson: nullableJson(question.hintJson),
          gradingConfigJson: nullableJson(question.gradingConfigJson),
          difficulty: question.difficulty,
          reviewStatus: question.reviewStatus,
          explanationId:
            explanationIdByTargetId.get(getMappedId(quizQuestionIdMap, question.id)) ??
            null,
          sortOrder: question.sortOrder,
        })),
      ),
    );

    await createManyIfNeeded(
      tx.flashcardSet,
      flashcardSets.map((set) => ({
        id: getMappedId(flashcardSetIdMap, set.id),
        lessonId: getMappedId(lessonIdMap, set.lessonId),
        title: set.title,
        difficulty: set.difficulty,
        source: set.source,
        reviewStatus: set.reviewStatus,
        isReserve: set.isReserve,
        generatedByUserId: set.generatedByUserId,
        aiGenerationId: null,
        cardCount: set.flashcards.length,
        sortOrder: set.sortOrder,
        createdById: actorUserId,
        updatedById: actorUserId,
      })),
    );

    await createManyIfNeeded(
      tx.flashcard,
      flashcards.map((flashcard) => ({
        id: getMappedId(flashcardIdMap, flashcard.id),
        flashcardSetId: getMappedId(flashcardSetIdMap, flashcard.flashcardSetId),
        lessonId: getMappedId(lessonIdMap, flashcard.lessonId),
        frontJson: requiredJson(flashcard.frontJson),
        backJson: requiredJson(flashcard.backJson),
        hintJson: nullableJson(flashcard.hintJson),
        explanationId:
          explanationIdByTargetId.get(getMappedId(flashcardIdMap, flashcard.id)) ?? null,
        difficulty: flashcard.difficulty,
        reviewStatus: flashcard.reviewStatus,
        sortOrder: flashcard.sortOrder,
      })),
    );

    await createManyIfNeeded(
      tx.testSet,
      testSets.map((set) => ({
        id: getMappedId(testSetIdMap, set.id),
        lessonId: getMappedId(lessonIdMap, set.lessonId),
        title: set.title,
        durationSeconds: set.durationSeconds,
        difficulty: set.difficulty,
        difficultyRatioJson: nullableJson(set.difficultyRatioJson),
        source: set.source,
        reviewStatus: set.reviewStatus,
        isReserve: set.isReserve,
        generatedByUserId: set.generatedByUserId,
        aiGenerationId: null,
        questionCount: set.questions.length,
        totalScore: set.totalScore,
        sortOrder: set.sortOrder,
        createdById: actorUserId,
        updatedById: actorUserId,
      })),
    );

    await createManyIfNeeded(
      tx.testQuestion,
      testSets.flatMap((set) =>
        set.questions.map((question) => ({
          id: getMappedId(testQuestionIdMap, question.id),
          testSetId: getMappedId(testSetIdMap, set.id),
          lessonId: getMappedId(lessonIdMap, question.lessonId),
          questionType: question.questionType,
          questionJson: requiredJson(question.questionJson),
          optionsJson: nullableJson(question.optionsJson),
          correctAnswerJson: requiredJson(question.correctAnswerJson),
          hintJson: nullableJson(question.hintJson),
          gradingConfigJson: nullableJson(question.gradingConfigJson),
          points: question.points,
          difficulty: question.difficulty,
          reviewStatus: question.reviewStatus,
          explanationId:
            explanationIdByTargetId.get(getMappedId(testQuestionIdMap, question.id)) ??
            null,
          sortOrder: question.sortOrder,
        })),
      ),
    );

    const migratedLessonProgress = lessonProgress.flatMap((progress) => {
      const clonedLessonId = lessonIdMap.get(progress.lessonId);
      return clonedLessonId
        ? [
            {
              id: randomUUID(),
              studentUserId: progress.studentUserId,
              lessonId: clonedLessonId,
              status: progress.status,
              bestTestAttemptId: progress.bestTestAttemptId,
              bestScore: progress.bestScore,
              bestDurationSeconds: progress.bestDurationSeconds,
              completedAt: progress.completedAt,
              xpAwarded: progress.xpAwarded,
            },
          ]
        : [];
    });
    await createManyIfNeeded(tx.lessonProgress, migratedLessonProgress);

    const migratedFlashcardProgress = flashcardProgress.flatMap((progress) => {
      const clonedLessonId = lessonIdMap.get(progress.lessonId);
      const clonedFlashcardId = flashcardIdMap.get(progress.flashcardId);
      return clonedLessonId && clonedFlashcardId
        ? [
            {
              id: randomUUID(),
              studentUserId: progress.studentUserId,
              lessonId: clonedLessonId,
              flashcardId: clonedFlashcardId,
              isKnown: progress.isKnown,
              lastReviewedAt: progress.lastReviewedAt,
              reviewCount: progress.reviewCount,
            },
          ]
        : [];
    });
    await createManyIfNeeded(tx.flashcardProgress, migratedFlashcardProgress);

    const activated = await tx.enrollment.updateMany({
      where: {
        id: enrollment.id,
        deliveryLearningPathId: null,
      },
      data: {
        deliveryLearningPathId: personalLearningPathId,
      },
    });

    if (activated.count !== 1) {
      throw new Error(
        `Enrollment ${enrollment.id} was activated by another clone transaction`,
      );
    }

    const counts: CloneCounts = {
      chapters: source.chapters.length,
      lessons: lessons.length,
      sourceDocuments: source.sourceDocuments.length,
      sourceDocumentPages: source.sourceDocuments.reduce(
        (total, document) => total + document.pages.length,
        0,
      ),
      lessonMaterials: lessons.reduce(
        (total, lesson) => total + lesson.materials.length,
        0,
      ),
      lessonDocuments: lessonDocuments.length,
      documentChunks: lessonDocuments.reduce(
        (total, document) => total + document.chunks.length,
        0,
      ),
      quizSets: quizSets.length,
      quizQuestions: quizSets.reduce((total, set) => total + set.questions.length, 0),
      flashcardSets: flashcardSets.length,
      flashcards: flashcards.length,
      testSets: testSets.length,
      testQuestions: testSets.reduce((total, set) => total + set.questions.length, 0),
      aiExplanations: explanationClones.length,
      lessonProgress: migratedLessonProgress.length,
      flashcardProgress: migratedFlashcardProgress.length,
    };

    await tx.auditLog.create({
      data: {
        actorUserId,
        action: "PERSONAL_LEARNING_PATH_ACTIVATED",
        entityType: "Enrollment",
        entityId: enrollment.id,
        before: {
          deliveryLearningPathId: null,
          learningPathId: source.id,
        },
        after: {
          deliveryLearningPathId: personalLearningPathId,
          learningPathId: source.id,
        },
        metadata: {
          backgroundJobId,
          counts,
          immutableArtifactsReused: true,
          paidProviderCalls: 0,
        },
      },
    });

    return {
      personalLearningPathId,
      sourceLearningPathId: source.id,
      enrollmentId: enrollment.id,
      alreadyActivated: false,
      counts,
    };
  }
}

function createIdMap(items: Array<{ id: string }>) {
  return new Map(items.map((item) => [item.id, randomUUID()]));
}

function getMappedId(map: Map<string, string>, sourceId: string) {
  const id = map.get(sourceId);
  if (!id) {
    throw new Error(`Missing clone ID mapping for ${sourceId}`);
  }
  return id;
}

function nullableJson(value: Prisma.JsonValue | null) {
  return value === null
    ? Prisma.JsonNull
    : (JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue);
}

function requiredJson(value: Prisma.JsonValue) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function buildExplanationClone({
  source,
  targetId,
  lessonId,
}: {
  source: {
    targetType: Prisma.AiExplanationCreateManyInput["targetType"];
    contentJson: Prisma.JsonValue;
    imageFileId: string | null;
    source: Prisma.AiExplanationCreateManyInput["source"];
    reviewStatus: Prisma.AiExplanationCreateManyInput["reviewStatus"];
    targetContentHash: string | null;
    sourceContextHash: string | null;
    staleAt: Date | null;
  };
  targetId: string;
  lessonId: string;
}) {
  const id = randomUUID();
  return {
    targetId,
    id,
    data: {
      id,
      targetType: source.targetType,
      targetId,
      lessonId,
      contentJson: requiredJson(source.contentJson),
      imageFileId: source.imageFileId,
      source: source.source,
      reviewStatus: source.reviewStatus,
      aiGenerationId: null,
      targetContentHash: source.targetContentHash,
      sourceContextHash: source.sourceContextHash,
      staleAt: source.staleAt,
      regeneratedFromId: null,
    } satisfies Prisma.AiExplanationCreateManyInput,
  };
}

async function createManyIfNeeded<
  TDelegate extends {
    createMany(args: { data: never[] }): Promise<unknown>;
  },
>(delegate: TDelegate, data: Parameters<TDelegate["createMany"]>[0]["data"]) {
  if (data.length > 0) {
    await delegate.createMany({ data } as never);
  }
}

async function copyChunkEmbeddings({
  tx,
  chunks,
  chunkIdMap,
}: {
  tx: Prisma.TransactionClient;
  chunks: Array<{ id: string }>;
  chunkIdMap: Map<string, string>;
}) {
  if (chunks.length === 0) {
    return;
  }

  const mappings = chunks.map(
    (chunk) =>
      Prisma.sql`(${chunk.id}::uuid, ${getMappedId(chunkIdMap, chunk.id)}::uuid)`,
  );

  await tx.$executeRaw(
    Prisma.sql`
      UPDATE document_chunks AS target
      SET embedding = source.embedding,
          embedding_provider = source.embedding_provider,
          embedding_model = source.embedding_model,
          embedding_dimensions = source.embedding_dimensions
      FROM (
        VALUES ${Prisma.join(mappings)}
      ) AS mapping(source_id, target_id)
      JOIN document_chunks AS source
        ON source.id = mapping.source_id
      WHERE target.id = mapping.target_id
        AND source.embedding IS NOT NULL
    `,
  );
}

function emptyCloneCounts(): CloneCounts {
  return {
    chapters: 0,
    lessons: 0,
    sourceDocuments: 0,
    sourceDocumentPages: 0,
    lessonMaterials: 0,
    lessonDocuments: 0,
    documentChunks: 0,
    quizSets: 0,
    quizQuestions: 0,
    flashcardSets: 0,
    flashcards: 0,
    testSets: 0,
    testQuestions: 0,
    aiExplanations: 0,
    lessonProgress: 0,
    flashcardProgress: 0,
  };
}
