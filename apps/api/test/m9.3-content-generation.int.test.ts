import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  AiProviderName,
  ContentSource,
  Difficulty,
  DocumentStatus,
  FileProvider,
  FilePurpose,
  FileStatus,
  FileVisibility,
  PrismaClient,
  PublishStatus,
  QuestionType,
  ReviewStatus,
  UserRole,
  UserStatus,
} from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { AppModule } from "#api/app.module";
import { ApiResponseInterceptor } from "#api/common/api/api-response.interceptor";
import { HttpExceptionFilter } from "#api/common/errors/http-exception.filter";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { createValidationException } from "#api/common/validation/validation-error";
import type { AiService } from "#api/modules/ai/services/ai.service";
import type { LessonContentGenerationContextService } from "#api/modules/ai/services/lesson-content-generation-context.service";
import type { AiGenerationExecutionContext } from "#api/modules/ai/types/ai-generation.types";
import { compileLessonSummaryDiagramIntent } from "#api/modules/ai/utils/diagram-compilers/compile-diagram-intent";
import { AuthTokenService } from "#api/modules/auth/services/auth-token.service";
import { BackgroundJobQueueService } from "#api/modules/jobs/services/background-job-queue.service";
import { LessonContentGenerationService } from "#api/workers/services/lesson-content-generation.service";
import { createTestCourseCatalogRelation } from "./helpers/course-catalog-fixture";

const runId = randomUUID();
const ids = {
  admin: randomUUID(),
  student: randomUUID(),
  path: randomUUID(),
  lesson: randomUUID(),
  file: randomUUID(),
  sourceDocument: randomUUID(),
  pageRange: randomUUID(),
  document: randomUUID(),
  processingDocument: randomUUID(),
  chunk: randomUUID(),
  quizSet: randomUUID(),
  manualQuestion: randomUUID(),
};
const queueMock = { enqueue: vi.fn(async (jobId: string) => ({ jobId })) };
const sourceText =
  "Số hữu tỉ biểu diễn được dưới dạng phân số với mẫu khác không. Phép cộng số hữu tỉ cần quy đồng mẫu số trước khi cộng tử số.";
const commonQuestion = {
  difficulty: Difficulty.MEDIUM,
  hint: "Xác định quy tắc phù hợp trước khi trả lời.",
  example: {
    type: "example" as const,
    exampleKind: "STANDARD_EXERCISE" as const,
    problem: "Hãy vận dụng kiến thức đã học để giải quyết yêu cầu mới sau đây.",
    solution:
      "Áp dụng đúng định nghĩa và quy tắc của buổi học.\nThực hiện rồi đối chiếu kết quả.",
    answer: "Kết quả phù hợp.",
    geometryStatement: null,
    diagramSpec: null,
  },
};
const allQuestions = [
  {
    ...commonQuestion,
    questionType: QuestionType.MULTIPLE_CHOICE,
    options: [
      { id: "A", text: "Kết quả phù hợp" },
      { id: "B", text: "Kết quả không phù hợp" },
    ],
    correctOptionIds: ["A"],
  },
  { ...commonQuestion, questionType: QuestionType.TRUE_FALSE, correctAnswer: true },
  {
    ...commonQuestion,
    questionType: QuestionType.MULTI_STATEMENT_TRUE_FALSE,
    statements: [
      { id: "S1", text: "Mệnh đề thứ nhất", value: true },
      { id: "S2", text: "Mệnh đề thứ hai", value: false },
    ],
  },
  {
    ...commonQuestion,
    questionType: QuestionType.TEXT_INPUT,
    acceptedAnswers: ["một phần hai"],
    caseSensitive: false,
    exactMatch: true,
    keywords: [],
  },
];

describe("M9.3 API, PostgreSQL persistence and review integration", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let studentToken: string;
  let server: Parameters<typeof request>[0];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(BackgroundJobQueueService)
      .useValue(queueMock)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: createValidationException,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();
    server = app.getHttpServer();
    prisma = app.get(PrismaService);
    await createFixture(prisma);
    const tokens = app.get(AuthTokenService, { strict: false });
    adminToken = await tokens.signAccessToken({ id: ids.admin, role: UserRole.ADMIN });
    studentToken = await tokens.signAccessToken({
      id: ids.student,
      role: UserRole.STUDENT,
    });
  });

  afterAll(async () => {
    if (prisma) await cleanup(prisma);
    if (app) await app.close();
  });

  it("exposes admin-only M9.8 readiness without leaking source content", async () => {
    await request(server)
      .get(`/api/v1/admin/lessons/${ids.lesson}/ai-generation-panel`)
      .set("Authorization", `Bearer ${studentToken}`)
      .expect(403);

    const pending = await request(server)
      .get(`/api/v1/admin/lessons/${ids.lesson}/ai-generation-panel`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(pending.body.data).toMatchObject({
      lesson: { id: ids.lesson, title: "Số hữu tỉ" },
      readiness: {
        summaryReady: true,
        generationReady: false,
        readyDocumentCount: 1,
        embeddedDocumentCount: 0,
      },
      documents: expect.arrayContaining([
        expect.objectContaining({
          id: ids.document,
          title: "Nguồn",
          chunkCount: 1,
          pageRange: { pageStart: 5, pageEnd: 9 },
          canUseForSummary: true,
          unavailableReason: null,
          embeddingReady: false,
        }),
        expect.objectContaining({
          id: ids.processingDocument,
          title: "Phiếu đang xử lý",
          status: DocumentStatus.PROCESSING,
          pageRange: null,
          canUseForSummary: false,
          unavailableReason: "Đang xử lý",
        }),
      ]),
      jobs: { SUMMARY: null, QUIZ: null, FLASHCARD: null, TEST: null },
    });
    expect(JSON.stringify(pending.body.data)).not.toContain(sourceText);

    await prisma.lessonDocument.update({
      where: { id: ids.document },
      data: {
        embeddingProvider: AiProviderName.OPENAI,
        embeddingModel: "text-embedding-3-small",
        embeddingDimensions: 1536,
      },
    });
    const ready = await request(server)
      .get(`/api/v1/admin/lessons/${ids.lesson}/ai-generation-panel`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(ready.body.data.readiness).toMatchObject({
      summaryReady: true,
      generationReady: true,
      embeddedDocumentCount: 1,
      reason: null,
    });
  });

  it("enforces RBAC, validates ratios, queues three distinct generation types and persists all item forms", async () => {
    await request(server)
      .post(`/api/v1/admin/lessons/${ids.lesson}/quiz-sets/generate-ai`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        questionCount: 4,
        difficulty: Difficulty.MEDIUM,
        questionTypes: Object.values(QuestionType),
      })
      .expect(403);

    await request(server)
      .post(`/api/v1/admin/lessons/${ids.lesson}/test-sets/generate-ai`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        questionCount: 4,
        durationSeconds: 600,
        difficultyRatio: { easy: 0.2, medium: 0.2, hard: 0.2 },
      })
      .expect(400);

    await request(server)
      .post(`/api/v1/admin/lessons/${ids.lesson}/quiz-sets/generate-ai`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ questionCount: 1, difficulty: Difficulty.MIXED })
      .expect(400);

    const quizJob = await enqueue("quiz-sets", {
      targetQuizSetId: ids.quizSet,
      questionCount: 4,
      difficulty: Difficulty.MEDIUM,
      questionTypes: Object.values(QuestionType),
    });
    const flashcardJob = await enqueue("flashcard-sets", {
      cardCount: 3,
      difficulty: Difficulty.MIXED,
    });
    const testJob = await enqueue("test-sets", {
      questionCount: 4,
      durationSeconds: 600,
      difficultyRatio: { easy: 0, medium: 1, hard: 0 },
      questionTypes: Object.values(QuestionType),
    });
    expect(queueMock.enqueue).toHaveBeenCalledTimes(3);

    const outputs = {
      generated_quiz: { title: "Quiz AI", questions: allQuestions },
      generated_flashcards: {
        title: "Flashcard AI",
        cards: [Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD].map(
          (difficulty) => ({
            difficulty,
            front: `Khái niệm ${difficulty}`,
            back: `Nội dung ${difficulty}`,
            explanation: `Giải thích ${difficulty}`,
            sourceChunkIds: [ids.chunk],
          }),
        ),
      },
      generated_test: {
        title: "Test AI",
        questions: allQuestions.map(({ hint: _hint, ...question }) => ({
          ...question,
          sourceChunkIds: [ids.chunk],
        })),
      },
    };
    const aiService = {
      generateStructured: vi.fn(async (input: { outputName: keyof typeof outputs }) => ({
        data: outputs[input.outputName],
        provider: AiProviderName.OPENAI,
        model: "gpt-4.1-mini-test",
        usage: { promptTokens: 100, completionTokens: 100, totalTokens: 200 },
      })),
    };
    const generationContext = {
      retrieve: vi.fn(async (input: { sourceHash: string }) => ({
        lessonId: ids.lesson,
        lessonTitle: "Số hữu tỉ",
        documentIds: [ids.document],
        sourceHash: input.sourceHash,
        query: "test",
        totalTokens: 40,
        searchLatencyMs: 1,
        keywordMatchCount: 1,
        chunks: [
          {
            chunkId: ids.chunk,
            documentId: ids.document,
            lessonId: ids.lesson,
            content: sourceText,
            score: 0.9,
            chunkIndex: 0,
            tokenCount: 40,
            metadataJson: { printedPage: 12 },
            matchSource: "both" as const,
          },
        ],
      })),
    };
    const worker = new LessonContentGenerationService(
      prisma,
      aiService as unknown as AiService,
      generationContext as unknown as LessonContentGenerationContextService,
    );
    for (const jobId of [quizJob, flashcardJob, testJob]) {
      const context = await executionContext(prisma, jobId);
      const prepared = await worker.generate(context);
      await worker.persist(context, prepared);
    }

    const quiz = await prisma.quizSet.findUniqueOrThrow({
      where: { id: ids.quizSet },
      include: { questions: { include: { explanation: true } } },
    });
    const generatedQuizQuestions = quiz.questions.filter(
      (question) => question.id !== ids.manualQuestion,
    );
    expect(quiz.source).toBe("ADMIN");
    expect(quiz.questions).toHaveLength(5);
    expect(
      new Set(generatedQuizQuestions.map((question) => question.questionType)),
    ).toEqual(new Set(Object.values(QuestionType)));
    expect(
      generatedQuizQuestions.every(
        (question) =>
          question.reviewStatus === ReviewStatus.NEEDS_REVIEW &&
          question.explanation?.reviewStatus === ReviewStatus.NEEDS_REVIEW,
      ),
    ).toBe(true);
    const firstQuizMetadata = generatedQuizQuestions[0]?.sourceMetadataJson as Record<
      string,
      unknown
    >;
    expect(firstQuizMetadata).toMatchObject({
      exampleBlock: expect.objectContaining({ type: "example" }),
    });
    expect(firstQuizMetadata).not.toHaveProperty("sourceChunkIds");
    expect(firstQuizMetadata).not.toHaveProperty("sources");
    expect(firstQuizMetadata).not.toHaveProperty("sourceHash");

    const compiledDiagram = compileLessonSummaryDiagramIntent({
      intentVersion: 1,
      grade: 7,
      difficulty: "SIMPLE",
      caption: "Hình Quiz đã chỉnh bằng ExampleCore",
      family: "PLANE_GEOMETRY",
      archetype: "RIGHT_TRIANGLE_CONGRUENCE",
      variant: "SHARED_HYPOTENUSE_LEG",
      pointLabels: ["A", "B", "C", "D"],
      measures: [],
    });
    const updatedQuizQuestion = await request(server)
      .patch(`/api/v1/admin/quiz-questions/${generatedQuizQuestions[0]!.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        exampleBlock: {
          ...(firstQuizMetadata.exampleBlock as Record<string, unknown>),
          visual: { kind: "DIAGRAM_SPEC", spec: compiledDiagram.spec },
        },
      })
      .expect(200);
    expect(updatedQuizQuestion.body.data.sourceMetadataJson).toMatchObject({
      exampleBlock: {
        type: "example",
        visual: {
          kind: "DIAGRAM_SPEC",
          spec: { caption: "Hình Quiz đã chỉnh bằng ExampleCore" },
        },
      },
    });
    expect(updatedQuizQuestion.body.data.explanation.diagramSpecJson).toMatchObject({
      caption: "Hình Quiz đã chỉnh bằng ExampleCore",
    });
    expect(updatedQuizQuestion.body.data.sourceMetadataJson).not.toHaveProperty(
      "sourceChunkIds",
    );

    const flashcards = await prisma.flashcardSet.findFirstOrThrow({
      where: { lessonId: ids.lesson, source: "AI" },
      include: { flashcards: { include: { explanation: true } } },
    });
    expect(new Set(flashcards.flashcards.map((card) => card.difficulty))).toEqual(
      new Set([Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD]),
    );
    expect(flashcards.flashcards.every((card) => card.hintJson === null)).toBe(true);

    const test = await prisma.testSet.findFirstOrThrow({
      where: { lessonId: ids.lesson, source: "AI" },
      include: { questions: { include: { explanation: true } } },
    });
    expect(new Set(test.questions.map((question) => question.questionType))).toEqual(
      new Set(Object.values(QuestionType)),
    );

    await review("quiz-sets", quiz.id);
    await review("flashcard-sets", flashcards.id);
    await review("test-sets", test.id);
    expect(
      await prisma.quizQuestion.count({
        where: { quizSetId: quiz.id, reviewStatus: ReviewStatus.APPROVED },
      }),
    ).toBe(5);
    expect(
      await prisma.flashcard.count({
        where: { flashcardSetId: flashcards.id, reviewStatus: ReviewStatus.APPROVED },
      }),
    ).toBe(3);
    expect(
      await prisma.testQuestion.count({
        where: { testSetId: test.id, reviewStatus: ReviewStatus.APPROVED },
      }),
    ).toBe(4);

    for (const question of generatedQuizQuestions.slice(0, 2)) {
      await request(server)
        .delete(`/api/v1/admin/quiz-questions/${question.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
    }
    const quizGenerationId = generatedQuizQuestions[2]?.explanation?.aiGenerationId;
    if (!quizGenerationId) throw new Error("Generated Quiz question is missing lineage");
    const quizGeneration = await prisma.aiGeneration.findUniqueOrThrow({
      where: { id: quizGenerationId },
    });
    expect(quizGeneration.inputMetaJson).toMatchObject({
      generationAudit: {
        initialGeneratedCount: 4,
        deletedCount: 2,
        currentActiveCount: 2,
      },
    });
    expect(
      await prisma.quizQuestion.count({
        where: { quizSetId: quiz.id, deletedAt: null },
      }),
    ).toBe(3);
  });

  it("returns one recoverable latest job per generation type", async () => {
    const response = await request(server)
      .get(`/api/v1/admin/lessons/${ids.lesson}/ai-generation-panel`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    for (const type of ["QUIZ", "FLASHCARD", "TEST"] as const) {
      expect(response.body.data.jobs[type]).toMatchObject({
        type,
        jobId: expect.any(String),
        status: "QUEUED",
      });
    }
    expect(response.body.data.jobs.SUMMARY).toBeNull();
    expect(response.body.data.jobs.QUIZ).not.toHaveProperty("inputMeta");
    expect(response.body.data.jobs.QUIZ).not.toHaveProperty("outputJson");
  });

  async function enqueue(resource: string, body: unknown) {
    const response = await request(server)
      .post(`/api/v1/admin/lessons/${ids.lesson}/${resource}/generate-ai`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(body)
      .expect(202);
    return response.body.data.jobId as string;
  }

  async function review(resource: string, setId: string) {
    await request(server)
      .post(`/api/v1/admin/${resource}/${setId}/review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reviewStatus: ReviewStatus.APPROVED })
      .expect(201);
  }
});

async function executionContext(
  prisma: PrismaService,
  jobId: string,
): Promise<AiGenerationExecutionContext> {
  const job = await prisma.backgroundJob.findUniqueOrThrow({
    where: { id: jobId },
    include: { aiGenerations: true },
  });
  const generation = job.aiGenerations[0]!;
  return {
    backgroundJobId: job.id,
    aiGenerationId: generation.id,
    type: generation.type,
    ownerUserId: job.ownerUserId,
    lessonId: job.lessonId,
    targetType: generation.targetType,
    targetId: generation.targetId,
    inputMeta: job.inputMeta,
    attempt: 1,
    maxAttempts: job.maxAttempts,
  };
}

async function createFixture(prisma: PrismaClient) {
  await prisma.user.createMany({
    data: [
      {
        id: ids.admin,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        email: `m9-3-admin-${runId}@example.com`,
        username: `m9_3_admin_${runId.slice(0, 8)}`,
        passwordHash: "test",
      },
      {
        id: ids.student,
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        email: `m9-3-student-${runId}@example.com`,
        username: `m9_3_student_${runId.slice(0, 8)}`,
        passwordHash: "test",
      },
    ],
  });
  await prisma.file.create({
    data: {
      id: ids.file,
      provider: FileProvider.MINIO_LOCAL,
      purpose: FilePurpose.LESSON_DOCUMENT,
      bucket: "test",
      objectKey: `m9.3/${runId}.pdf`,
      originalName: "source.pdf",
      mimeType: "application/pdf",
      sizeBytes: BigInt(1024),
      visibility: FileVisibility.PRIVATE,
      status: FileStatus.UPLOADED,
      uploadedById: ids.admin,
    },
  });
  const catalog = await createTestCourseCatalogRelation(prisma, 7);
  await prisma.learningPath.create({
    data: {
      id: ids.path,
      ...catalog,
      title: "M9.3 Path",
      slug: `m9-3-${runId}`,
      originalPriceVnd: 1_000_000,
      status: PublishStatus.DRAFT,
      createdBy: { connect: { id: ids.admin } },
      updatedBy: { connect: { id: ids.admin } },
    },
  });
  await prisma.lesson.create({
    data: {
      id: ids.lesson,
      learningPathId: ids.path,
      orderIndex: 1,
      title: "Số hữu tỉ",
      status: PublishStatus.DRAFT,
      createdById: ids.admin,
      updatedById: ids.admin,
    },
  });
  await prisma.quizSet.create({
    data: {
      id: ids.quizSet,
      lessonId: ids.lesson,
      title: "Bộ câu hỏi 1",
      difficulty: Difficulty.MIXED,
      source: ContentSource.ADMIN,
      reviewStatus: ReviewStatus.APPROVED,
      questionCount: 1,
      createdById: ids.admin,
      updatedById: ids.admin,
    },
  });
  await prisma.quizQuestion.create({
    data: {
      id: ids.manualQuestion,
      quizSetId: ids.quizSet,
      lessonId: ids.lesson,
      questionType: QuestionType.TRUE_FALSE,
      questionJson: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Câu thủ công" }] },
        ],
      },
      correctAnswerJson: true,
      difficulty: Difficulty.EASY,
      reviewStatus: ReviewStatus.APPROVED,
      sortOrder: 0,
    },
  });
  await prisma.sourceDocument.create({
    data: {
      id: ids.sourceDocument,
      learningPathId: ids.path,
      fileId: ids.file,
      title: "Nguồn",
      status: DocumentStatus.READY,
      pageCount: 16,
      processedAt: new Date(),
    },
  });
  await prisma.lessonDocumentPageRange.create({
    data: {
      id: ids.pageRange,
      lessonId: ids.lesson,
      sourceDocumentId: ids.sourceDocument,
      pageStart: 5,
      pageEnd: 9,
      createdById: ids.admin,
    },
  });
  await prisma.lessonDocument.create({
    data: {
      id: ids.document,
      lessonId: ids.lesson,
      fileId: ids.file,
      sourceDocumentId: ids.sourceDocument,
      pageRangeId: ids.pageRange,
      title: "Nguồn",
      status: DocumentStatus.READY,
      contentHash: "m9-3-doc",
      chunkCount: 1,
      processedAt: new Date(),
    },
  });
  await prisma.lessonDocument.create({
    data: {
      id: ids.processingDocument,
      lessonId: ids.lesson,
      fileId: ids.file,
      title: "Phiếu đang xử lý",
      status: DocumentStatus.PROCESSING,
      chunkCount: 0,
      sortOrder: 1,
    },
  });
  await prisma.documentChunk.create({
    data: {
      id: ids.chunk,
      documentId: ids.document,
      lessonId: ids.lesson,
      chunkIndex: 0,
      content: sourceText,
      contentHash: "m9-3-chunk",
      tokenCount: 40,
      metadataJson: { printedPage: 12 },
    },
  });
}

async function cleanup(prisma: PrismaClient) {
  await prisma.auditLog.deleteMany({ where: { actorUserId: ids.admin } });
  await prisma.quizSet.deleteMany({ where: { lessonId: ids.lesson } });
  await prisma.flashcardSet.deleteMany({ where: { lessonId: ids.lesson } });
  await prisma.testSet.deleteMany({ where: { lessonId: ids.lesson } });
  await prisma.aiExplanation.deleteMany({ where: { lessonId: ids.lesson } });
  await prisma.aiGeneration.deleteMany({ where: { lessonId: ids.lesson } });
  await prisma.backgroundJob.deleteMany({ where: { lessonId: ids.lesson } });
  await prisma.documentChunk.deleteMany({ where: { lessonId: ids.lesson } });
  await prisma.lessonDocument.deleteMany({ where: { lessonId: ids.lesson } });
  await prisma.lesson.deleteMany({ where: { id: ids.lesson } });
  await prisma.learningPath.deleteMany({ where: { id: ids.path } });
  await prisma.file.deleteMany({ where: { id: ids.file } });
  await prisma.user.deleteMany({ where: { id: { in: [ids.admin, ids.student] } } });
}
