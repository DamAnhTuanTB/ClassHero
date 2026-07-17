import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  BackgroundJobQueue,
  DocumentStatus,
  FileProvider,
  FilePurpose,
  FileStatus,
  FileVisibility,
  LessonDocumentKind,
  PrismaClient,
  PublishStatus,
  Subject,
  UserRole,
  UserStatus,
} from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "#api/app.module";
import { ApiResponseInterceptor } from "#api/common/api/api-response.interceptor";
import { HttpExceptionFilter } from "#api/common/errors/http-exception.filter";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { createValidationException } from "#api/common/validation/validation-error";
import { AuthTokenService } from "#api/modules/auth/services/auth-token.service";

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
  sourceDocumentIds: new Set<string>(),
  lessonDocumentIds: new Set<string>(),
  jobIds: new Set<string>(),
};

describe("M4.2 document API integration", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let httpServer: Parameters<typeof request>[0];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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

    await prisma.sourceDocument.update({
      where: { id: sourceDocument.id },
      data: { pageCount: 10 },
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
    expect(replaceResponse.body.data.kind).toBe(
      LessonDocumentKind.PRIMARY_REPLACEMENT,
    );

    const lessonDocumentsResponse = await request(httpServer)
      .get(`/api/v1/admin/lessons/${ids.lessonOne}/documents`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(lessonDocumentsResponse.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: LessonDocumentKind.PRIMARY_REPLACEMENT }),
        expect.objectContaining({ kind: LessonDocumentKind.SUPPLEMENT }),
      ]),
    );
    expect(
      lessonDocumentsResponse.body.data.filter(
        (document: { kind: LessonDocumentKind }) =>
          document.kind === LessonDocumentKind.PRIMARY_FROM_SOURCE,
      ),
    ).toHaveLength(0);

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

  await prisma.learningPath.create({
    data: {
      id: ids.learningPath,
      subject: Subject.MATH,
      grade: 7,
      title: "M4.2 Integration Path",
      slug: `m4-2-integration-${testRunId}`,
      originalPriceVnd: 1_000_000,
      status: PublishStatus.DRAFT,
      createdById: ids.adminUser,
      updatedById: ids.adminUser,
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

async function cleanupFixtureData(prisma: PrismaClient) {
  await prisma.documentChunk.deleteMany({
    where: { lessonId: { in: [ids.lessonOne, ids.lessonTwo] } },
  });
  await prisma.lessonDocumentPageRange.deleteMany({
    where: {
      OR: [
        { lessonId: { in: [ids.lessonOne, ids.lessonTwo] } },
        { sourceDocumentId: { in: [...cleanupIds.sourceDocumentIds] } },
      ],
    },
  });
  await prisma.lessonDocument.deleteMany({
    where: {
      OR: [
        { id: { in: [...cleanupIds.lessonDocumentIds] } },
        { lessonId: { in: [ids.lessonOne, ids.lessonTwo] } },
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
      OR: [
        { id: { in: [...cleanupIds.jobIds] } },
        { ownerUserId: ids.adminUser },
      ],
    },
  });
  await prisma.lesson.deleteMany({
    where: { id: { in: [ids.lessonOne, ids.lessonTwo] } },
  });
  await prisma.learningPathChapter.deleteMany({ where: { id: ids.chapter } });
  await prisma.learningPath.deleteMany({ where: { id: ids.learningPath } });
  await prisma.file.deleteMany({
    where: { id: { in: [ids.sourceFile, ids.replacementFile, ids.supplementFile] } },
  });
  await prisma.user.deleteMany({ where: { id: ids.adminUser } });
}
