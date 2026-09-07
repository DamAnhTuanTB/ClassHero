import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  BackgroundJobQueue,
  BackgroundJobStatus,
  DocumentStatus,
  FileProvider,
  FilePurpose,
  FileStatus,
  FileVisibility,
  LessonDocumentKind,
  PrismaClient,
  PublishStatus,
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
import { AuthTokenService } from "#api/modules/auth/services/auth-token.service";
import { BackgroundJobQueueService } from "#api/modules/jobs/services/background-job-queue.service";
import { createTestCourseCatalogRelation } from "./helpers/course-catalog-fixture";

const testRunId = randomUUID();
const ids = {
  adminUser: randomUUID(),
  learningPath: randomUUID(),
  chapter: randomUUID(),
  lessonOne: randomUUID(),
  lessonTwo: randomUUID(),
  sourceFile: randomUUID(),
  replacementFile: randomUUID(),
  supplementFile: randomUUID(),
};

const cleanupIds = {
  lessonIds: new Set<string>(),
  sourceDocumentIds: new Set<string>(),
  lessonDocumentIds: new Set<string>(),
  jobIds: new Set<string>(),
};
const backgroundJobQueueMock = {
  enqueue: vi.fn(async (jobId: string) => ({ jobId })),
  enqueueMany: vi.fn(async (jobIds: string[]) => jobIds.map((jobId) => ({ jobId }))),
};

describe("M4.2 document API integration", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let httpServer: Parameters<typeof request>[0];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(BackgroundJobQueueService)
      .useValue(backgroundJobQueueMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: createValidationException,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();

    httpServer = app.getHttpServer();
    prisma = app.get(PrismaService);

    await createFixtureData(prisma);

    const authTokenService = app.get(AuthTokenService, { strict: false });
    accessToken = await authTokenService.signAccessToken({
      id: ids.adminUser,
      role: UserRole.ADMIN,
    });
  });

  afterAll(async () => {
    await cleanupFixtureData(prisma);
    await app.close();
  });

  it("creates source document, saves page ranges, preserves supplements, and exposes job status", async () => {
    const createSourceResponse = await request(httpServer)
      .post(`/api/v1/admin/learning-paths/${ids.learningPath}/source-documents`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        fileId: ids.sourceFile,
        title: "Source PDF",
      })
      .expect(201);

    const sourceDocument = createSourceResponse.body.data;
    cleanupIds.sourceDocumentIds.add(sourceDocument.id);
    cleanupIds.jobIds.add(sourceDocument.processingJobId);

    expect(sourceDocument.status).toBe(DocumentStatus.PROCESSING);
    expect(sourceDocument.processingJob.status).toBe("QUEUED");

    await prisma.backgroundJob.update({
      where: { id: sourceDocument.processingJobId },
      data: {
        status: BackgroundJobStatus.FAILED,
        finishedAt: new Date(),
        errorMessage: "Retry fixture",
      },
    });
    await prisma.sourceDocument.update({
      where: { id: sourceDocument.id },
      data: { status: DocumentStatus.FAILED },
    });

    const retryResponse = await request(httpServer)
      .post(`/api/v1/admin/source-documents/${sourceDocument.id}/process`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(201);

    cleanupIds.jobIds.add(retryResponse.body.data.processingJobId);
    expect(retryResponse.body.data.status).toBe(DocumentStatus.PROCESSING);
    expect(retryResponse.body.data.processingJob.status).toBe(BackgroundJobStatus.QUEUED);
    expect(retryResponse.body.data.processingJobId).not.toBe(
      sourceDocument.processingJobId,
    );

    await prisma.sourceDocument.update({
      where: { id: sourceDocument.id },
      data: {
        pageCount: 10,
        processedAt: new Date(),
        status: DocumentStatus.READY,
      },
    });
    await prisma.sourceDocumentPage.createMany({
      data: Array.from({ length: 10 }, (_, index) => ({
        id: randomUUID(),
        sourceDocumentId: sourceDocument.id,
        pageNumber: index + 1,
        status: DocumentStatus.READY,
        text: `Page ${index + 1} text`,
        textSource: "text_layer",
      })),
    });

    const pagesResponse = await request(httpServer)
      .get(`/api/v1/admin/source-documents/${sourceDocument.id}/pages`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(pagesResponse.body.data).toHaveLength(10);
    expect(pagesResponse.body.data[0].textPreview).toBe("Page 1 text");

    const rangesResponse = await request(httpServer)
      .put(`/api/v1/admin/source-documents/${sourceDocument.id}/lesson-page-ranges`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        ranges: [
          { lessonId: ids.lessonOne, pageStart: 1, pageEnd: 3 },
          { lessonId: ids.lessonTwo, pageStart: 5, pageEnd: 7 },
        ],
      })
      .expect(200);

    expect(rangesResponse.body.data.ranges).toHaveLength(2);
    expect(rangesResponse.body.data.lessonDocuments).toHaveLength(2);
    expect(
      rangesResponse.body.data.lessonDocuments.every(
        (document: { kind: LessonDocumentKind }) =>
          document.kind === LessonDocumentKind.PRIMARY_FROM_SOURCE,
      ),
    ).toBe(true);
    expect(rangesResponse.body.data.warnings).toEqual([
      expect.objectContaining({ code: "PAGE_RANGE_GAP" }),
    ]);

    for (const document of rangesResponse.body.data.lessonDocuments) {
      cleanupIds.lessonDocumentIds.add(document.id);
      cleanupIds.jobIds.add(document.processingJobId);
    }
    const lessonOnePageRangeDocument = rangesResponse.body.data.lessonDocuments.find(
      (document: { lessonId: string }) => document.lessonId === ids.lessonOne,
    );
    expect(lessonOnePageRangeDocument).toBeDefined();

    const supplementResponse = await request(httpServer)
      .post(`/api/v1/admin/lessons/${ids.lessonOne}/documents`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        fileId: ids.supplementFile,
        title: "Supplement",
        kind: LessonDocumentKind.SUPPLEMENT,
      })
      .expect(201);

    cleanupIds.lessonDocumentIds.add(supplementResponse.body.data.id);
    cleanupIds.jobIds.add(supplementResponse.body.data.processingJobId);
    expect(supplementResponse.body.data.kind).toBe(LessonDocumentKind.SUPPLEMENT);

    const homeworkResponse = await request(httpServer)
      .post(`/api/v1/admin/lessons/${ids.lessonOne}/documents`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        fileId: ids.supplementFile,
        title: "Homework",
        kind: LessonDocumentKind.HOMEWORK,
      })
      .expect(201);

    cleanupIds.lessonDocumentIds.add(homeworkResponse.body.data.id);
    cleanupIds.jobIds.add(homeworkResponse.body.data.processingJobId);
    expect(homeworkResponse.body.data.kind).toBe(LessonDocumentKind.HOMEWORK);

    const secondHomeworkResponse = await request(httpServer)
      .post(`/api/v1/admin/lessons/${ids.lessonOne}/documents`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        fileId: ids.supplementFile,
        title: "Homework 2",
        kind: LessonDocumentKind.HOMEWORK,
      })
      .expect(201);

    cleanupIds.lessonDocumentIds.add(secondHomeworkResponse.body.data.id);
    cleanupIds.jobIds.add(secondHomeworkResponse.body.data.processingJobId);
    expect(secondHomeworkResponse.body.data.kind).toBe(LessonDocumentKind.HOMEWORK);

    const uploadedPrimaryResponse = await request(httpServer)
      .post(`/api/v1/admin/lessons/${ids.lessonOne}/documents`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        fileId: ids.supplementFile,
        title: "Uploaded primary document",
        kind: LessonDocumentKind.PRIMARY_FROM_SOURCE,
      })
      .expect(201);

    cleanupIds.lessonDocumentIds.add(uploadedPrimaryResponse.body.data.id);
    cleanupIds.jobIds.add(uploadedPrimaryResponse.body.data.processingJobId);
    expect(uploadedPrimaryResponse.body.data).toEqual(
      expect.objectContaining({
        kind: LessonDocumentKind.PRIMARY_FROM_SOURCE,
        sourceDocumentId: null,
      }),
    );

    backgroundJobQueueMock.enqueueMany.mockClear();
    const storageOnlySupplementResponse = await request(httpServer)
      .post(`/api/v1/admin/lessons/${ids.lessonOne}/documents`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        fileId: ids.supplementFile,
        title: "Reference handout",
        kind: LessonDocumentKind.SUPPLEMENT,
        processingMode: "STORAGE_ONLY",
      })
      .expect(201);

    cleanupIds.lessonDocumentIds.add(storageOnlySupplementResponse.body.data.id);
    expect(storageOnlySupplementResponse.body.data.kind).toBe(
      LessonDocumentKind.SUPPLEMENT,
    );
    expect(storageOnlySupplementResponse.body.data.status).toBe(DocumentStatus.READY);
    expect(storageOnlySupplementResponse.body.data.processingJobId).toBeNull();
    expect(storageOnlySupplementResponse.body.data.processingJob).toBeNull();
    expect(storageOnlySupplementResponse.body.data.chunkCount).toBe(0);
    expect(storageOnlySupplementResponse.body.data.metadataJson).toEqual(
      expect.objectContaining({
        processingMode: "storage_only",
        source: "uploaded_supplement_document",
      }),
    );

    const storageOnlyJobCount = await prisma.backgroundJob.count({
      where: {
        resourceId: storageOnlySupplementResponse.body.data.id,
      },
    });
    expect(storageOnlyJobCount).toBe(0);
    expect(backgroundJobQueueMock.enqueueMany).not.toHaveBeenCalled();

    const replaceResponse = await request(httpServer)
      .post(`/api/v1/admin/lessons/${ids.lessonOne}/primary-document/replace`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        fileId: ids.replacementFile,
        title: "Replacement",
      })
      .expect(201);

    cleanupIds.lessonDocumentIds.add(replaceResponse.body.data.id);
    cleanupIds.jobIds.add(replaceResponse.body.data.processingJobId);
    expect(replaceResponse.body.data.kind).toBe(LessonDocumentKind.PRIMARY_FROM_SOURCE);
    const replacementJob = await prisma.backgroundJob.findUniqueOrThrow({
      where: {
        id: replaceResponse.body.data.processingJobId,
      },
      select: {
        inputMeta: true,
      },
    });
    expect(replacementJob.inputMeta).toEqual(
      expect.objectContaining({
        action: "LESSON_PRIMARY_UPLOAD_PROCESSING",
      }),
    );

    const lessonDocumentsResponse = await request(httpServer)
      .get(`/api/v1/admin/lessons/${ids.lessonOne}/documents`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(lessonDocumentsResponse.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: LessonDocumentKind.PRIMARY_FROM_SOURCE }),
        expect.objectContaining({ kind: LessonDocumentKind.SUPPLEMENT }),
      ]),
    );
    expect(
      lessonDocumentsResponse.body.data.filter(
        (document: { kind: LessonDocumentKind }) =>
          document.kind === LessonDocumentKind.PRIMARY_FROM_SOURCE,
      ),
    ).toHaveLength(3);
    expect(
      lessonDocumentsResponse.body.data.filter(
        (document: { kind: LessonDocumentKind }) =>
          document.kind === LessonDocumentKind.HOMEWORK,
      ),
    ).toHaveLength(2);

    await request(httpServer)
      .delete(
        `/api/v1/admin/lessons/${ids.lessonOne}/documents/${lessonOnePageRangeDocument.id}`,
      )
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(409);

    await request(httpServer)
      .delete(
        `/api/v1/admin/lessons/${ids.lessonOne}/documents/${uploadedPrimaryResponse.body.data.id}`,
      )
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    const documentsAfterDirectPrimaryDelete = await request(httpServer)
      .get(`/api/v1/admin/lessons/${ids.lessonOne}/documents`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(
      documentsAfterDirectPrimaryDelete.body.data.filter(
        (document: { kind: LessonDocumentKind }) =>
          document.kind === LessonDocumentKind.PRIMARY_FROM_SOURCE,
      ),
    ).toHaveLength(2);

    const learningPathDocumentsResponse = await request(httpServer)
      .get(`/api/v1/admin/learning-paths/${ids.learningPath}/lesson-documents`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(learningPathDocumentsResponse.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          lessonId: ids.lessonOne,
          kind: LessonDocumentKind.PRIMARY_FROM_SOURCE,
        }),
        expect.objectContaining({
          lessonId: ids.lessonOne,
          kind: LessonDocumentKind.SUPPLEMENT,
        }),
        expect.objectContaining({
          lessonId: ids.lessonTwo,
          kind: LessonDocumentKind.PRIMARY_FROM_SOURCE,
        }),
      ]),
    );

    const jobResponse = await request(httpServer)
      .get(`/api/v1/jobs/${replaceResponse.body.data.processingJobId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(jobResponse.body.data.queue).toBe(BackgroundJobQueue.DOCUMENT_PROCESSING);
    expect(jobResponse.body.data.resourceType).toBe("LESSON_DOCUMENT");
  });

  it("rejects invalid source ranges before writing mappings", async () => {
    const sourceDocument = await prisma.sourceDocument.create({
      data: {
        learningPathId: ids.learningPath,
        fileId: ids.sourceFile,
        title: "Invalid range source",
        status: DocumentStatus.READY,
        pageCount: 3,
      },
    });
    cleanupIds.sourceDocumentIds.add(sourceDocument.id);

    await request(httpServer)
      .put(`/api/v1/admin/source-documents/${sourceDocument.id}/lesson-page-ranges`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        ranges: [{ lessonId: ids.lessonOne, pageStart: 4, pageEnd: 2 }],
      })
      .expect(400);

    const rangeCount = await prisma.lessonDocumentPageRange.count({
      where: { sourceDocumentId: sourceDocument.id },
    });
    expect(rangeCount).toBe(0);
  });

  it("creates and updates a lesson with an optional source page range", async () => {
    const sourceDocument = await createReadySourceDocument(prisma, {
      pageCount: 6,
      title: "Lesson editor ready source",
    });

    const createResponse = await request(httpServer)
      .post(`/api/v1/admin/chapters/${ids.chapter}/lessons`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        completionMinScore: 7,
        sourceDocumentPageRange: {
          pageEnd: 2,
          pageStart: 1,
          sourceDocumentId: sourceDocument.id,
        },
        status: PublishStatus.DRAFT,
        title: "Lesson with source pages",
        trialEnabled: false,
      })
      .expect(201);

    const createdLesson = createResponse.body.data;
    cleanupIds.lessonIds.add(createdLesson.id);

    const createdDocument = await prisma.lessonDocument.findFirstOrThrow({
      where: {
        lessonId: createdLesson.id,
        replacedAt: null,
      },
      select: {
        id: true,
        kind: true,
        processingJobId: true,
        sourceDocumentId: true,
        metadataJson: true,
      },
    });
    cleanupIds.lessonDocumentIds.add(createdDocument.id);
    cleanupIds.jobIds.add(createdDocument.processingJobId!);

    expect(createdDocument.kind).toBe(LessonDocumentKind.PRIMARY_FROM_SOURCE);
    expect(createdDocument.sourceDocumentId).toBe(sourceDocument.id);
    expect(createdDocument.metadataJson).toEqual(
      expect.objectContaining({ pageEnd: 2, pageStart: 1 }),
    );

    await request(httpServer)
      .patch(`/api/v1/admin/lessons/${createdLesson.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        sourceDocumentPageRange: {
          pageEnd: 4,
          pageStart: 3,
          sourceDocumentId: sourceDocument.id,
        },
      })
      .expect(200);

    const updatedRange = await prisma.lessonDocumentPageRange.findFirstOrThrow({
      where: {
        lessonId: createdLesson.id,
        sourceDocumentId: sourceDocument.id,
      },
      select: {
        pageEnd: true,
        pageStart: true,
      },
    });

    expect(updatedRange).toEqual({ pageEnd: 4, pageStart: 3 });
  });

  it("creates a top-level lesson with source extractions when no chapter is selected", async () => {
    const sourceDocument = await createReadySourceDocument(prisma, {
      pageCount: 4,
      title: "Top-level lesson source",
    });

    const createResponse = await request(httpServer)
      .post(`/api/v1/admin/learning-paths/${ids.learningPath}/lessons`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        chapterId: null,
        completionMinScore: 7,
        sourceDocumentExtractions: [
          {
            pageEnd: 4,
            pageStart: 1,
            sourceDocumentId: sourceDocument.id,
          },
        ],
        status: PublishStatus.DRAFT,
        title: "Top-level lesson with source pages",
        trialEnabled: false,
      })
      .expect(201);

    const createdLesson = createResponse.body.data;
    cleanupIds.lessonIds.add(createdLesson.id);
    expect(createdLesson.chapterId).toBeNull();

    const createdDocument = await prisma.lessonDocument.findFirstOrThrow({
      where: {
        lessonId: createdLesson.id,
        replacedAt: null,
      },
      select: {
        id: true,
        pageRangeId: true,
        processingJobId: true,
        sourceDocumentId: true,
      },
    });
    cleanupIds.lessonDocumentIds.add(createdDocument.id);
    if (createdDocument.processingJobId) {
      cleanupIds.jobIds.add(createdDocument.processingJobId);
    }

    expect(createdDocument.pageRangeId).not.toBeNull();
    expect(createdDocument.sourceDocumentId).toBe(sourceDocument.id);

    const lessonDocumentsResponse = await request(httpServer)
      .get(`/api/v1/admin/lessons/${createdLesson.id}/documents`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(lessonDocumentsResponse.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: createdDocument.id })]),
    );

    const learningPathDocumentsResponse = await request(httpServer)
      .get(`/api/v1/admin/learning-paths/${ids.learningPath}/lesson-documents`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(learningPathDocumentsResponse.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: createdDocument.id })]),
    );

    await request(httpServer)
      .put(`/api/v1/admin/source-documents/${sourceDocument.id}/lesson-page-ranges`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        ranges: [
          {
            lessonId: createdLesson.id,
            pageEnd: 3,
            pageStart: 1,
          },
        ],
      })
      .expect(200);
  });

  it("supports multiple source documents and multiple non-overlapping extractions per lesson", async () => {
    const beforeSources = await prisma.sourceDocument.count({
      where: {
        learningPathId: ids.learningPath,
        deletedAt: null,
      },
    });
    const firstCreatedSource = await request(httpServer)
      .post(`/api/v1/admin/learning-paths/${ids.learningPath}/source-documents`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        fileId: ids.sourceFile,
        title: "Additional source A",
      })
      .expect(201);
    const secondCreatedSource = await request(httpServer)
      .post(`/api/v1/admin/learning-paths/${ids.learningPath}/source-documents`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        fileId: ids.replacementFile,
        title: "Additional source B",
      })
      .expect(201);

    for (const response of [firstCreatedSource, secondCreatedSource]) {
      cleanupIds.sourceDocumentIds.add(response.body.data.id);
      cleanupIds.jobIds.add(response.body.data.processingJobId);
    }

    const listedSources = await request(httpServer)
      .get(`/api/v1/admin/learning-paths/${ids.learningPath}/source-documents`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(listedSources.body.data).toHaveLength(beforeSources + 2);
    const listedSourceIds = listedSources.body.data.map(
      (item: { id: string }) => item.id,
    );
    expect(listedSourceIds).toEqual(
      expect.arrayContaining([
        firstCreatedSource.body.data.id,
        secondCreatedSource.body.data.id,
      ]),
    );
    expect(listedSourceIds.indexOf(firstCreatedSource.body.data.id)).toBeLessThan(
      listedSourceIds.indexOf(secondCreatedSource.body.data.id),
    );

    const readySource = await createReadySourceDocument(prisma, {
      pageCount: 12,
      title: "Multiple extraction source",
    });
    const createResponse = await request(httpServer)
      .post(`/api/v1/admin/chapters/${ids.chapter}/lessons`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        completionMinScore: 7,
        sourceDocumentExtractions: [
          {
            pageEnd: 3,
            pageStart: 1,
            sortOrder: 0,
            sourceDocumentId: readySource.id,
          },
          {
            pageEnd: 7,
            pageStart: 5,
            sortOrder: 1,
            sourceDocumentId: readySource.id,
          },
        ],
        status: PublishStatus.DRAFT,
        title: "Lesson with multiple extractions",
        trialEnabled: false,
      })
      .expect(201);
    const lessonId = createResponse.body.data.id;
    cleanupIds.lessonIds.add(lessonId);

    const ranges = await prisma.lessonDocumentPageRange.findMany({
      where: { lessonId },
      orderBy: { pageStart: "asc" },
    });
    expect(ranges.map((range) => [range.pageStart, range.pageEnd])).toEqual([
      [1, 3],
      [5, 7],
    ]);

    const documents = await prisma.lessonDocument.findMany({
      where: {
        lessonId,
        replacedAt: null,
      },
      orderBy: { sortOrder: "asc" },
    });
    expect(documents).toHaveLength(2);
    expect(documents.every((document) => Boolean(document.pageRangeId))).toBe(true);
    for (const document of documents) {
      cleanupIds.lessonDocumentIds.add(document.id);
      if (document.processingJobId) {
        cleanupIds.jobIds.add(document.processingJobId);
      }
    }

    const overlapResponse = await request(httpServer)
      .patch(`/api/v1/admin/lessons/${lessonId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        sourceDocumentExtractions: [
          {
            id: ranges[0]!.id,
            pageEnd: 5,
            pageStart: 1,
            sortOrder: 0,
            sourceDocumentId: readySource.id,
          },
          {
            id: ranges[1]!.id,
            pageEnd: 8,
            pageStart: 5,
            sortOrder: 1,
            sourceDocumentId: readySource.id,
          },
        ],
      })
      .expect(400);

    expect(overlapResponse.body.error.code).toBe("LESSON_SOURCE_EXTRACTION_OVERLAP");
  });

  it("rejects page range mapping until the source document is fully ready", async () => {
    const processingSourceDocument = await prisma.sourceDocument.create({
      data: {
        fileId: ids.sourceFile,
        learningPathId: ids.learningPath,
        pageCount: 2,
        status: DocumentStatus.PROCESSING,
        title: "Processing source",
      },
    });
    cleanupIds.sourceDocumentIds.add(processingSourceDocument.id);

    await request(httpServer)
      .put(
        `/api/v1/admin/source-documents/${processingSourceDocument.id}/lesson-page-ranges`,
      )
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        ranges: [{ lessonId: ids.lessonOne, pageEnd: 1, pageStart: 1 }],
      })
      .expect(400)
      .expect((response) => {
        expect(response.body.error.code).toBe("SOURCE_DOCUMENT_NOT_READY");
      });

    const reviewSourceDocument = await createReadySourceDocument(prisma, {
      pageCount: 2,
      title: "Review source",
      warningPageNumber: 2,
    });

    const listedSources = await request(httpServer)
      .get(`/api/v1/admin/learning-paths/${ids.learningPath}/source-documents`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const reviewSource = listedSources.body.data.find(
      (source: { id: string }) => source.id === reviewSourceDocument.id,
    );
    expect(reviewSource.readiness).toMatchObject({
      isEligibleForExtraction: false,
      status: "NEEDS_CONFIRMATION",
      warningPageCount: 1,
    });

    await request(httpServer)
      .patch(`/api/v1/admin/lessons/${ids.lessonOne}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        sourceDocumentPageRange: {
          pageEnd: 2,
          pageStart: 1,
          sourceDocumentId: reviewSourceDocument.id,
        },
      })
      .expect(400)
      .expect((response) => {
        expect(response.body.error.code).toBe("SOURCE_DOCUMENT_PAGE_REVIEW_REQUIRED");
      });

    const rangeCount = await prisma.lessonDocumentPageRange.count({
      where: {
        sourceDocumentId: {
          in: [processingSourceDocument.id, reviewSourceDocument.id],
        },
      },
    });
    expect(rangeCount).toBe(0);
  });
});

async function createFixtureData(prisma: PrismaClient) {
  await prisma.user.create({
    data: {
      id: ids.adminUser,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      email: `m4-2-admin-${testRunId}@example.com`,
      username: `m4_2_admin_${testRunId.slice(0, 8)}`,
      passwordHash: "test-only",
      fullName: "M4.2 Test Admin",
    },
  });

  await prisma.file.createMany({
    data: [
      buildFile(ids.sourceFile, "source.pdf"),
      buildFile(ids.replacementFile, "replacement.pdf"),
      buildFile(ids.supplementFile, "supplement.pdf"),
    ],
  });

  const courseCatalog = await createTestCourseCatalogRelation(prisma, 7);
  await prisma.learningPath.create({
    data: {
      id: ids.learningPath,
      ...courseCatalog,
      title: "M4.2 Integration Path",
      slug: `m4-2-integration-${testRunId}`,
      originalPriceVnd: 1_000_000,
      status: PublishStatus.DRAFT,
      createdBy: { connect: { id: ids.adminUser } },
      updatedBy: { connect: { id: ids.adminUser } },
    },
  });

  await prisma.learningPathChapter.create({
    data: {
      id: ids.chapter,
      learningPathId: ids.learningPath,
      orderIndex: 1,
      title: "Chapter 1",
      status: PublishStatus.DRAFT,
      createdById: ids.adminUser,
      updatedById: ids.adminUser,
    },
  });

  await prisma.lesson.createMany({
    data: [
      buildLesson(ids.lessonOne, 1, "Lesson 1"),
      buildLesson(ids.lessonTwo, 2, "Lesson 2"),
    ],
  });
}

function buildFile(id: string, originalName: string) {
  return {
    id,
    provider: FileProvider.MINIO_LOCAL,
    purpose: FilePurpose.LESSON_DOCUMENT,
    bucket: "learning-path-test",
    objectKey: `test/m4.2/${testRunId}/${originalName}`,
    originalName,
    mimeType: "application/pdf",
    sizeBytes: BigInt(1024),
    visibility: FileVisibility.PRIVATE,
    status: FileStatus.UPLOADED,
    uploadedById: ids.adminUser,
    checksum: `checksum-${id}`,
  };
}

function buildLesson(id: string, orderIndex: number, title: string) {
  return {
    id,
    learningPathId: ids.learningPath,
    chapterId: ids.chapter,
    orderIndex,
    title,
    completionMinScore: 7,
    status: PublishStatus.DRAFT,
    createdById: ids.adminUser,
    updatedById: ids.adminUser,
  };
}

async function createReadySourceDocument(
  prisma: PrismaClient,
  {
    pageCount,
    title,
    warningPageNumber,
  }: { pageCount: number; title: string; warningPageNumber?: number },
) {
  const sourceDocument = await prisma.sourceDocument.create({
    data: {
      fileId: ids.sourceFile,
      learningPathId: ids.learningPath,
      pageCount,
      processedAt: new Date(),
      status: DocumentStatus.READY,
      title,
    },
  });
  cleanupIds.sourceDocumentIds.add(sourceDocument.id);

  await prisma.sourceDocumentPage.createMany({
    data: Array.from({ length: pageCount }, (_, index) => {
      const pageNumber = index + 1;

      return {
        id: randomUUID(),
        metadataJson: {
          printedPage: {
            confidence: 0.95,
            pdfPageNumber: pageNumber,
            printedPageLabel: String(pageNumber),
            printedPageNumber: pageNumber,
            source: "admin_verified",
            warning: warningPageNumber === pageNumber ? "ambiguous" : null,
          },
        },
        pageNumber,
        sourceDocumentId: sourceDocument.id,
        status: DocumentStatus.READY,
        text: `Ready page ${pageNumber}`,
        textSource: "paid_ocr",
      };
    }),
  });

  return sourceDocument;
}

async function cleanupFixtureData(prisma: PrismaClient) {
  const lessonIds = [ids.lessonOne, ids.lessonTwo, ...cleanupIds.lessonIds];

  await prisma.documentChunk.deleteMany({
    where: { lessonId: { in: lessonIds } },
  });
  await prisma.lessonDocumentPageRange.deleteMany({
    where: {
      OR: [
        { lessonId: { in: lessonIds } },
        { sourceDocumentId: { in: [...cleanupIds.sourceDocumentIds] } },
      ],
    },
  });
  await prisma.lessonDocument.deleteMany({
    where: {
      OR: [
        { id: { in: [...cleanupIds.lessonDocumentIds] } },
        { lessonId: { in: lessonIds } },
      ],
    },
  });
  await prisma.sourceDocumentPage.deleteMany({
    where: { sourceDocumentId: { in: [...cleanupIds.sourceDocumentIds] } },
  });
  await prisma.sourceDocument.deleteMany({
    where: { id: { in: [...cleanupIds.sourceDocumentIds] } },
  });
  await prisma.backgroundJob.deleteMany({
    where: {
      OR: [{ id: { in: [...cleanupIds.jobIds] } }, { ownerUserId: ids.adminUser }],
    },
  });
  await prisma.lesson.deleteMany({
    where: { id: { in: lessonIds } },
  });
  await prisma.learningPathChapter.deleteMany({ where: { id: ids.chapter } });
  await prisma.learningPath.deleteMany({ where: { id: ids.learningPath } });
  await prisma.file.deleteMany({
    where: { id: { in: [ids.sourceFile, ids.replacementFile, ids.supplementFile] } },
  });
  await prisma.user.deleteMany({ where: { id: ids.adminUser } });
}
