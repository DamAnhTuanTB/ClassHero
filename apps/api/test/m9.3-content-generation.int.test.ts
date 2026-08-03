import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  AiProviderName,
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
import { AuthTokenService } from "#api/modules/auth/services/auth-token.service";
import { BackgroundJobQueueService } from "#api/modules/jobs/services/background-job-queue.service";
import { LessonContentGenerationService } from "#api/workers/services/lesson-content-generation.service";
import { createTestCourseCatalogRelation } from "./helpers/course-catalog-fixture";

const runId = randomUUID();
const ids = {
  admin: randomUUID(), student: randomUUID(), path: randomUUID(), lesson: randomUUID(),
  file: randomUUID(), document: randomUUID(), chunk: randomUUID(),
};
const queueMock = { enqueue: vi.fn(async (jobId: string) => ({ jobId })) };
const sourceText = "Số hữu tỉ biểu diễn được dưới dạng phân số với mẫu khác không. Phép cộng số hữu tỉ cần quy đồng mẫu số trước khi cộng tử số.";
const commonQuestion = {
  difficulty: Difficulty.MEDIUM,
  prompt: "Hãy vận dụng kiến thức đã học để giải quyết yêu cầu mới sau đây.",
  hint: "Xác định quy tắc phù hợp trước khi trả lời.",
  explanation: "Áp dụng đúng định nghĩa và quy tắc trong buổi học sẽ thu được đáp án.",
  sourceChunkIds: [ids.chunk],
};
const allQuestions = [
  { ...commonQuestion, questionType: QuestionType.MULTIPLE_CHOICE, options: [{ id: "A", text: "Kết quả phù hợp" }, { id: "B", text: "Kết quả không phù hợp" }], correctOptionIds: ["A"] },
  { ...commonQuestion, questionType: QuestionType.TRUE_FALSE, correctAnswer: true },
  { ...commonQuestion, questionType: QuestionType.MULTI_STATEMENT_TRUE_FALSE, statements: [{ id: "S1", text: "Mệnh đề thứ nhất", value: true }, { id: "S2", text: "Mệnh đề thứ hai", value: false }] },
  { ...commonQuestion, questionType: QuestionType.TEXT_INPUT, acceptedAnswers: ["một phần hai"], caseSensitive: false, exactMatch: true, keywords: [] },
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
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true, forbidNonWhitelisted: true, transform: true,
      exceptionFactory: createValidationException,
    }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();
    server = app.getHttpServer();
    prisma = app.get(PrismaService);
    await createFixture(prisma);
    const tokens = app.get(AuthTokenService, { strict: false });
    adminToken = await tokens.signAccessToken({ id: ids.admin, role: UserRole.ADMIN });
    studentToken = await tokens.signAccessToken({ id: ids.student, role: UserRole.STUDENT });
  });

  afterAll(async () => {
    if (prisma) await cleanup(prisma);
    if (app) await app.close();
  });

  it("enforces RBAC, validates ratios, queues three distinct generation types and persists all item forms", async () => {
    await request(server)
      .post(`/api/v1/admin/lessons/${ids.lesson}/quiz-sets/generate-ai`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ questionCount: 4, difficulty: Difficulty.MEDIUM, questionTypes: Object.values(QuestionType) })
      .expect(403);

    await request(server)
      .post(`/api/v1/admin/lessons/${ids.lesson}/test-sets/generate-ai`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ questionCount: 4, durationSeconds: 600, difficultyRatio: { easy: 0.2, medium: 0.2, hard: 0.2 } })
      .expect(400);

    await request(server)
      .post(`/api/v1/admin/lessons/${ids.lesson}/quiz-sets/generate-ai`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ questionCount: 1, difficulty: Difficulty.MEDIUM })
      .expect(400);

    const quizJob = await enqueue("quiz-sets", {
      questionCount: 4, difficulty: Difficulty.MEDIUM, questionTypes: Object.values(QuestionType),
    });
    const flashcardJob = await enqueue("flashcard-sets", { cardCount: 3, difficulty: Difficulty.MIXED });
    const testJob = await enqueue("test-sets", {
      questionCount: 4, durationSeconds: 600,
      difficultyRatio: { easy: 0, medium: 1, hard: 0 }, questionTypes: Object.values(QuestionType),
    });
    expect(queueMock.enqueue).toHaveBeenCalledTimes(3);

    const outputs = {
      generated_quiz: { title: "Quiz AI", questions: allQuestions },
      generated_flashcards: {
        title: "Flashcard AI",
        cards: [Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD].map((difficulty) => ({
          difficulty, front: `Khái niệm ${difficulty}`, back: `Nội dung ${difficulty}`,
          explanation: `Giải thích ${difficulty}`, sourceChunkIds: [ids.chunk],
        })),
      },
      generated_test: { title: "Test AI", questions: allQuestions },
    };
    const aiService = {
      generateStructured: vi.fn(async (input: { outputName: keyof typeof outputs }) => ({
        data: outputs[input.outputName], provider: AiProviderName.OPENAI,
        model: "gpt-4.1-mini-test", usage: { promptTokens: 100, completionTokens: 100, totalTokens: 200 },
      })),
    };
    const generationContext = {
      retrieve: vi.fn(async (input: { sourceHash: string }) => ({
        lessonId: ids.lesson, lessonTitle: "Số hữu tỉ", documentIds: [ids.document],
        sourceHash: input.sourceHash, query: "test", totalTokens: 40, searchLatencyMs: 1, keywordMatchCount: 1,
        chunks: [{ chunkId: ids.chunk, documentId: ids.document, lessonId: ids.lesson, content: sourceText, score: 0.9, chunkIndex: 0, tokenCount: 40, metadataJson: { printedPage: 12 }, matchSource: "both" as const }],
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

    const quiz = await prisma.quizSet.findFirstOrThrow({
      where: { lessonId: ids.lesson, source: "AI" }, include: { questions: { include: { explanation: true } } },
    });
    expect(new Set(quiz.questions.map((question) => question.questionType))).toEqual(new Set(Object.values(QuestionType)));
    expect(quiz.questions.every((question) => question.reviewStatus === ReviewStatus.NEEDS_REVIEW && question.explanation?.reviewStatus === ReviewStatus.NEEDS_REVIEW)).toBe(true);
    expect(quiz.questions[0]?.sourceMetadataJson).toMatchObject({ sourceChunkIds: [ids.chunk] });

    const flashcards = await prisma.flashcardSet.findFirstOrThrow({
      where: { lessonId: ids.lesson, source: "AI" }, include: { flashcards: { include: { explanation: true } } },
    });
    expect(new Set(flashcards.flashcards.map((card) => card.difficulty))).toEqual(new Set([Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD]));
    expect(flashcards.flashcards.every((card) => card.hintJson === null)).toBe(true);

    const test = await prisma.testSet.findFirstOrThrow({
      where: { lessonId: ids.lesson, source: "AI" }, include: { questions: { include: { explanation: true } } },
    });
    expect(new Set(test.questions.map((question) => question.questionType))).toEqual(new Set(Object.values(QuestionType)));

    await review("quiz-sets", quiz.id);
    await review("flashcard-sets", flashcards.id);
    await review("test-sets", test.id);
    expect((await prisma.quizQuestion.count({ where: { quizSetId: quiz.id, reviewStatus: ReviewStatus.APPROVED } }))).toBe(4);
    expect((await prisma.flashcard.count({ where: { flashcardSetId: flashcards.id, reviewStatus: ReviewStatus.APPROVED } }))).toBe(3);
    expect((await prisma.testQuestion.count({ where: { testSetId: test.id, reviewStatus: ReviewStatus.APPROVED } }))).toBe(4);
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

async function executionContext(prisma: PrismaService, jobId: string): Promise<AiGenerationExecutionContext> {
  const job = await prisma.backgroundJob.findUniqueOrThrow({ where: { id: jobId }, include: { aiGenerations: true } });
  const generation = job.aiGenerations[0]!;
  return {
    backgroundJobId: job.id, aiGenerationId: generation.id, type: generation.type,
    ownerUserId: job.ownerUserId, lessonId: job.lessonId, targetType: generation.targetType,
    targetId: generation.targetId, inputMeta: job.inputMeta, attempt: 1, maxAttempts: job.maxAttempts,
  };
}

async function createFixture(prisma: PrismaClient) {
  await prisma.user.createMany({ data: [
    { id: ids.admin, role: UserRole.ADMIN, status: UserStatus.ACTIVE, email: `m9-3-admin-${runId}@example.com`, username: `m9_3_admin_${runId.slice(0, 8)}`, passwordHash: "test" },
    { id: ids.student, role: UserRole.STUDENT, status: UserStatus.ACTIVE, email: `m9-3-student-${runId}@example.com`, username: `m9_3_student_${runId.slice(0, 8)}`, passwordHash: "test" },
  ] });
  await prisma.file.create({ data: {
    id: ids.file, provider: FileProvider.MINIO_LOCAL, purpose: FilePurpose.LESSON_DOCUMENT,
    bucket: "test", objectKey: `m9.3/${runId}.pdf`, originalName: "source.pdf", mimeType: "application/pdf",
    sizeBytes: BigInt(1024), visibility: FileVisibility.PRIVATE, status: FileStatus.UPLOADED, uploadedById: ids.admin,
  } });
  const catalog = await createTestCourseCatalogRelation(prisma, 7);
  await prisma.learningPath.create({ data: {
    id: ids.path, ...catalog, title: "M9.3 Path", slug: `m9-3-${runId}`, originalPriceVnd: 1_000_000,
    status: PublishStatus.DRAFT,
    createdBy: { connect: { id: ids.admin } },
    updatedBy: { connect: { id: ids.admin } },
  } });
  await prisma.lesson.create({ data: {
    id: ids.lesson, learningPathId: ids.path, orderIndex: 1, title: "Số hữu tỉ",
    status: PublishStatus.DRAFT, createdById: ids.admin, updatedById: ids.admin,
  } });
  await prisma.lessonDocument.create({ data: {
    id: ids.document, lessonId: ids.lesson, fileId: ids.file, title: "Nguồn",
    status: DocumentStatus.READY, contentHash: "m9-3-doc", chunkCount: 1, processedAt: new Date(),
  } });
  await prisma.documentChunk.create({ data: {
    id: ids.chunk, documentId: ids.document, lessonId: ids.lesson, chunkIndex: 0,
    content: sourceText, contentHash: "m9-3-chunk", tokenCount: 40, metadataJson: { printedPage: 12 },
  } });
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
