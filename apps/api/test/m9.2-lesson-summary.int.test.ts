import "reflect-metadata";
import { createHash, randomUUID } from "node:crypto";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  AiGenerationStatus,
  AiGenerationType,
  AiProviderName,
  BackgroundJobStatus,
  ContentSource,
  DocumentStatus,
  FileProvider,
  FilePurpose,
  FileStatus,
  FileVisibility,
  PrismaClient,
  ProviderCatalogCategory,
  ProviderCatalogStatus,
  PublishStatus,
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
import { AuthTokenService } from "#api/modules/auth/services/auth-token.service";
import type { AiService } from "#api/modules/ai/services/ai.service";
import { LessonSummaryContextService } from "#api/modules/ai/services/lesson-summary-context.service";
import type { AiGenerationExecutionContext } from "#api/modules/ai/types/ai-generation.types";
import {
  LESSON_SUMMARY_PROMPT_VERSION,
  LESSON_SUMMARY_SCHEMA_VERSION,
} from "#api/modules/ai/types/lesson-summary.types";
import { buildLessonSummarySourceTopics } from "#api/modules/ai/utils/lesson-summary-source-candidates";
import { BackgroundJobQueueService } from "#api/modules/jobs/services/background-job-queue.service";
import { LessonSummaryGenerationService } from "#api/workers/services/lesson-summary-generation.service";
import { createTestCourseCatalogRelation } from "./helpers/course-catalog-fixture";

const testRunId = randomUUID();
const ids = {
  adminUser: randomUUID(),
  studentUser: randomUUID(),
  learningPath: randomUUID(),
  lesson: randomUUID(),
  file: randomUUID(),
  document: randomUUID(),
  chunk: randomUUID(),
  reasoningModel: randomUUID(),
};
const reasoningModelKey = `m9-2-reasoning-${testRunId}`;
const queuedJobIds = new Set<string>();
const queueMock = {
  enqueue: vi.fn(async (jobId: string) => {
    queuedJobIds.add(jobId);
    return { jobId };
  }),
};
const manualContent = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Tóm tắt do admin soạn." }],
    },
  ],
};
const chunkContent =
  "Số hữu tỉ viết được dưới dạng a/b với a, b là số nguyên và b khác 0.\n\n" +
  "Ví dụ 1. Chứng minh số 1/2 là một số hữu tỉ.\n\n" +
  "Luyện tập 1. Viết số 0,25 dưới dạng phân số.\n\n" +
  "Vận dụng 1. Một chiếc áo giá 200 000 đồng được giảm 25%. Tính giá sau khi giảm.";
const sourceTopicId = buildLessonSummarySourceTopics([
  { id: ids.chunk, content: chunkContent },
])[0]!.id;
const generatedOutput = {
  title: "Số hữu tỉ",
  objectives: ["Nhận biết số hữu tỉ"],
  theorySections: [
    {
      sourceTopicId,
      displayHeading: buildLessonSummarySourceTopics([
        { id: ids.chunk, content: chunkContent },
      ])[0]!.sourceHeadingRaw,
      sourceChunkIds: [ids.chunk],
      units: [
        {
          theory: {
            type: "knowledge",
            title: "Khái niệm số hữu tỉ",
            content: "Số hữu tỉ viết được dưới dạng $a/b$ với $b \\ne 0$.",
            sourceChunkIds: [ids.chunk],
            diagramSpec: null,
          },
          illustration: {
            type: "example",
            exampleKind: "ILLUSTRATION",
            problem: "Chứng minh số $1/2$ là một số hữu tỉ.",
            solution: "Ta có mẫu số 2 khác 0.",
            answer: "$1/2$ là số hữu tỉ.",
            geometryStatement: null,
            diagramSpec: null,
          },
          notes: [
            {
              type: "note",
              content: "Mẫu số phải khác 0. Ví dụ: số $1/2$ có mẫu bằng 2.",
              sourceChunkIds: [ids.chunk],
            },
          ],
        },
      ],
    },
  ],
  applicationExercises: {
    displayHeading: "Bài tập vận dụng",
    standardExercise: {
      type: "example",
      exampleKind: "STANDARD_EXERCISE",
      problem: "Viết số $0,25$ dưới dạng phân số tối giản.",
      solution: "$0,25 = 1/4$.",
      answer: "$1/4$.",
      geometryStatement: null,
      diagramSpec: null,
    },
    realWorldExercise: {
      type: "example",
      exampleKind: "REAL_WORLD_EXERCISE",
      problem: "Một chiếc áo giá 200 000 đồng được giảm 25%. Tính giá sau khi giảm.",
      solution: "Số tiền giảm là 50 000 đồng.",
      answer: "150 000 đồng.",
      geometryStatement: null,
      diagramSpec: null,
    },
  },
};

describe("M9.2 lesson summary API and worker integration", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let studentToken: string;
  let httpServer: Parameters<typeof request>[0];

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

    httpServer = app.getHttpServer();
    prisma = app.get(PrismaService);
    await createFixtureData(prisma);

    const authTokens = app.get(AuthTokenService, { strict: false });
    adminToken = await authTokens.signAccessToken({
      id: ids.adminUser,
      role: UserRole.ADMIN,
    });
    studentToken = await authTokens.signAccessToken({
      id: ids.studentUser,
      role: UserRole.STUDENT,
    });
  });

  afterAll(async () => {
    await cleanupFixtureData(prisma);
    await app.close();
  });

  it("enforces admin RBAC and supports manual GET/PUT with audit", async () => {
    await request(httpServer)
      .get(`/api/v1/admin/lessons/${ids.lesson}/summary`)
      .set("Authorization", `Bearer ${studentToken}`)
      .expect(403);

    const empty = await request(httpServer)
      .get(`/api/v1/admin/lessons/${ids.lesson}/summary`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(empty.body.data).toBeNull();

    const updated = await request(httpServer)
      .put(`/api/v1/admin/lessons/${ids.lesson}/summary`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        contentJson: manualContent,
        source: ContentSource.ADMIN,
        reviewStatus: ReviewStatus.APPROVED,
      })
      .expect(200);
    expect(updated.body.data).toMatchObject({
      lessonId: ids.lesson,
      source: ContentSource.ADMIN,
      reviewStatus: ReviewStatus.APPROVED,
    });

    const audit = await prisma.auditLog.findFirst({
      where: {
        entityId: updated.body.data.id,
        action: "LESSON_SUMMARY_UPSERTED",
      },
    });
    expect(audit?.actorUserId).toBe(ids.adminUser);
  });

  it("saves reviewable blocks but blocks publish until the issue is accepted", async () => {
    const content = "Nội dung vẫn hiển thị để admin kiểm tra.";
    const issue = {
      id: "CONTENT_NEEDS_REVIEW-test",
      code: "CONTENT_NEEDS_REVIEW",
      path: "sections.0.blocks.0.content",
      message: "Khối kiến thức cần được kiểm tra lại.",
      suggestion: "Đối chiếu nội dung với tài liệu nguồn rồi sửa hoặc chấp nhận.",
      technicalDetails: "Fixture kiểm thử publish guard.",
      fingerprint: createHash("sha256").update(JSON.stringify(content)).digest("hex"),
      accepted: false,
    };
    const contentJson = {
      type: "lesson_summary_blocks",
      version: 2,
      data: {
        lessonId: ids.lesson,
        title: "Bản nháp cần review",
        objectives: null,
        sections: [
          {
            order: 1,
            sourceHeading: "Kiến thức",
            displayHeading: "Kiến thức",
            sourceChunkIds: [ids.chunk],
            blocks: [
              {
                type: "knowledge",
                title: "Nội dung chính",
                content,
                sourceChunkIds: [ids.chunk],
                reviewIssues: [issue],
              },
            ],
          },
          {
            order: 2,
            sourceHeading: "Bài tập vận dụng",
            displayHeading: "Bài tập vận dụng",
            sourceChunkIds: [ids.chunk],
            blocks: [
              {
                type: "example",
                problem: "Nêu nội dung vừa học.",
                solution: null,
                answer: "Nội dung chính.",
                sourceChunkIds: [ids.chunk],
              },
            ],
          },
        ],
      },
    };

    await request(httpServer)
      .put(`/api/v1/admin/lessons/${ids.lesson}/summary`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        contentJson,
        source: ContentSource.AI,
        reviewStatus: ReviewStatus.NEEDS_REVIEW,
      })
      .expect(200);

    const blocked = await request(httpServer)
      .put(`/api/v1/admin/lessons/${ids.lesson}/summary`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        contentJson,
        source: ContentSource.AI,
        reviewStatus: ReviewStatus.APPROVED,
      })
      .expect(400);
    expect(blocked.body.error).toMatchObject({
      code: "LESSON_SUMMARY_REVIEW_REQUIRED",
      details: {
        issues: [
          expect.objectContaining({
            code: "CONTENT_NEEDS_REVIEW",
            suggestion: expect.any(String),
          }),
        ],
      },
    });

    contentJson.data.sections[0]!.blocks[0]!.reviewIssues[0]!.accepted = true;
    await request(httpServer)
      .put(`/api/v1/admin/lessons/${ids.lesson}/summary`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        contentJson,
        source: ContentSource.AI,
        reviewStatus: ReviewStatus.APPROVED,
      })
      .expect(200);
  });

  it("never accepts an unrenderable diagram issue even when the client forges accepted=true", async () => {
    const issue = {
      id: "DIAGRAM_CANNOT_RENDER-test",
      code: "DIAGRAM_CANNOT_RENDER",
      path: "sections.0.blocks.0.visual.spec",
      message: "Dữ liệu hình vẽ chưa hợp lệ theo quy tắc vẽ.",
      suggestion: "Sửa dữ liệu hình vẽ hoặc xóa hình lỗi khỏi khối này.",
      technicalDetails: "Fixture kiểm thử hình không thể hiển thị.",
      fingerprint: createHash("sha256").update(JSON.stringify(null)).digest("hex"),
      resolution: "ACCEPT_OR_FIX",
      accepted: true,
    };
    const contentJson = {
      type: "lesson_summary_blocks",
      version: 2,
      data: {
        lessonId: ids.lesson,
        title: "Bản nháp có hình lỗi",
        objectives: null,
        sections: [
          {
            order: 1,
            sourceHeading: "Kiến thức",
            displayHeading: "Kiến thức",
            sourceChunkIds: [ids.chunk],
            blocks: [
              {
                type: "knowledge",
                title: "Nội dung chính",
                content: "Nội dung chữ vẫn sử dụng được.",
                sourceChunkIds: [ids.chunk],
                reviewIssues: [issue],
              },
            ],
          },
        ],
      },
    };

    const saved = await request(httpServer)
      .put(`/api/v1/admin/lessons/${ids.lesson}/summary`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        contentJson,
        source: ContentSource.AI,
        reviewStatus: ReviewStatus.NEEDS_REVIEW,
      })
      .expect(200);

    expect(
      saved.body.data.contentJson.data.sections[0].blocks[0].reviewIssues[0],
    ).toMatchObject({
      code: "DIAGRAM_CANNOT_RENDER",
      resolution: "FIX_ONLY",
      accepted: false,
    });

    const blocked = await request(httpServer)
      .put(`/api/v1/admin/lessons/${ids.lesson}/summary`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        contentJson,
        source: ContentSource.AI,
        reviewStatus: ReviewStatus.APPROVED,
      })
      .expect(400);

    expect(blocked.body.error).toMatchObject({
      code: "LESSON_SUMMARY_REVIEW_REQUIRED",
      details: {
        issues: [
          expect.objectContaining({
            code: "DIAGRAM_CANNOT_RENDER",
          }),
        ],
      },
    });
  });

  it("validates lesson-owned READY chunks before enqueue", async () => {
    const response = await request(httpServer)
      .post(`/api/v1/admin/lessons/${ids.lesson}/summary/generate-ai`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        documentIds: [randomUUID()],
        style: "student_friendly",
      })
      .expect(400);

    expect(response.body.error.code).toBe("AI_CONTEXT_NOT_FOUND");
    expect(queueMock.enqueue).not.toHaveBeenCalled();
  });

  it("previews the exact prompts and estimate without enqueueing or calling AI", async () => {
    const longSystemInstructions = "S".repeat(15_501);
    const response = await request(httpServer)
      .post(`/api/v1/admin/lessons/${ids.lesson}/summary/prompt-preview`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        documentIds: [ids.document],
        style: "academic",
        length: "detailed",
        targetWordCount: 350,
        extraInstructions: "Dùng câu ngắn",
        styleInstructions: "Dễ hiểu cho học sinh khối 7",
        systemInstructions: longSystemInstructions,
        userPrompt: "USER PREVIEW CUSTOM",
        model: reasoningModelKey,
        reasoningEffort: "xhigh",
        maxOutputTokens: 8_000,
      })
      .expect(200);

    expect(response.body.data).toMatchObject({
      promptVersion: LESSON_SUMMARY_PROMPT_VERSION,
      schemaVersion: LESSON_SUMMARY_SCHEMA_VERSION,
      systemPrompt: longSystemInstructions,
      userPrompt: "USER PREVIEW CUSTOM",
      inputPrompt: expect.stringContaining("Số hữu tỉ viết được"),
      openAiRequest: {
        model: expect.any(String),
        instructions: longSystemInstructions,
        input: expect.stringContaining("USER PREVIEW CUSTOM"),
        text: {
          format: {
            type: "json_schema",
            name: "lesson_summary_provider_contract",
            strict: true,
            schema: expect.objectContaining({
              type: "object",
              properties: expect.objectContaining({
                theorySections: expect.any(Object),
                applicationExercises: expect.any(Object),
              }),
            }),
          },
        },
        reasoning_effort: "xhigh",
        max_output_tokens: 8_000,
      },
      context: {
        documentCount: 1,
        chunkCount: 1,
        contextTokens: 25,
        maxContextTokens: 12_000,
        estimatedTokens: expect.any(Number),
      },
      configuration: {
        selectedModel: reasoningModelKey,
        resolvedModel: reasoningModelKey,
        reasoningEffort: "xhigh",
        maxOutputTokens: 8_000,
      },
    });
    expect(queueMock.enqueue).not.toHaveBeenCalled();

    const unsupported = await request(httpServer)
      .post(`/api/v1/admin/lessons/${ids.lesson}/summary/prompt-preview`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        documentIds: [ids.document],
        style: "academic",
        model: reasoningModelKey,
        reasoningEffort: "max",
        maxOutputTokens: 8_000,
      })
      .expect(400);
    expect(unsupported.body.error).toMatchObject({
      code: "AI_REASONING_EFFORT_NOT_SUPPORTED",
      details: {
        model: reasoningModelKey,
        reasoningEffort: "max",
        allowedReasoningEffortLevels: ["low", "xhigh"],
      },
    });
  });

  it("queues once for concurrent clicks, generates from chunks, and allows a later regeneration", async () => {
    const first = await request(httpServer)
      .post(`/api/v1/admin/lessons/${ids.lesson}/summary/generate-ai`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        documentIds: [ids.document],
        style: "student_friendly",
        styleInstructions: "Dễ hiểu cho học sinh khối 7",
        systemInstructions: "SYSTEM GENERATE CUSTOM",
        userPrompt: "USER GENERATE CUSTOM",
      })
      .expect(202);
    const duplicate = await request(httpServer)
      .post(`/api/v1/admin/lessons/${ids.lesson}/summary/generate-ai`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        documentIds: [ids.document],
        style: "student_friendly",
        styleInstructions: "Dễ hiểu cho học sinh khối 7",
        systemInstructions: "SYSTEM GENERATE CUSTOM",
        userPrompt: "USER GENERATE CUSTOM",
      })
      .expect(202);

    expect(duplicate.body.data.jobId).toBe(first.body.data.jobId);
    expect(queueMock.enqueue).toHaveBeenCalledTimes(1);

    const durable = await prisma.backgroundJob.findUniqueOrThrow({
      where: { id: first.body.data.jobId },
      include: { aiGenerations: true },
    });
    const generation = durable.aiGenerations[0];
    expect(generation?.type).toBe(AiGenerationType.SUMMARY);
    expect(durable.inputMeta).not.toHaveProperty("chunks");

    const rejectedOutput = structuredClone(generatedOutput);
    rejectedOutput.theorySections[0]!.units[0]!.theory.content +=
      " Ví dụ: 2/3 là số hữu tỉ.";
    (
      rejectedOutput.theorySections[0]!.units[0]!.theory as unknown as {
        diagramSpec: unknown;
      }
    ).diagramSpec = {
      kind: "INTENT",
      intent: {
        intentVersion: 1,
        grade: 7,
        difficulty: "MEDIUM",
        caption: "Hai tam giác vuông còn thiếu một nhãn điểm.",
        family: "PLANE_GEOMETRY",
        archetype: "RIGHT_TRIANGLE_CONGRUENCE",
        variant: "HYPOTENUSE_LEG",
        pointLabels: ["A", "B", "C", "A′", "B′"],
        measures: [],
      },
    };
    const aiServiceMock = {
      generateStructured: vi.fn().mockResolvedValue({
        data: rejectedOutput,
        provider: AiProviderName.OPENAI,
        model: "gpt-4.1-mini-test",
        usage: { promptTokens: 100, completionTokens: 80, totalTokens: 180 },
        latencyMs: 10,
      }),
    };
    const worker = new LessonSummaryGenerationService(
      prisma,
      aiServiceMock as unknown as AiService,
      app.get(LessonSummaryContextService),
    );
    const executionContext: AiGenerationExecutionContext = {
      backgroundJobId: durable.id,
      aiGenerationId: generation!.id,
      type: generation!.type,
      ownerUserId: durable.ownerUserId,
      lessonId: durable.lessonId,
      targetType: generation!.targetType,
      targetId: generation!.targetId,
      inputMeta: durable.inputMeta,
      attempt: 1,
      maxAttempts: durable.maxAttempts,
    };
    const prepared = await worker.generate(executionContext);
    const persisted = await worker.persist(executionContext, prepared);

    expect(aiServiceMock.generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining("SYSTEM GENERATE CUSTOM"),
        userPrompt: expect.stringContaining("USER GENERATE CUSTOM"),
        contextChunks: [expect.objectContaining({ id: ids.chunk })],
      }),
      expect.any(Object),
    );
    expect(aiServiceMock.generateStructured).toHaveBeenCalledTimes(1);
    expect(persisted).toMatchObject({
      resourceType: "LESSON_SUMMARY",
      resourceId: expect.any(String),
    });
    const summary = await prisma.lessonSummary.findUniqueOrThrow({
      where: { lessonId: ids.lesson },
    });
    expect(summary).toMatchObject({
      source: ContentSource.AI,
      reviewStatus: ReviewStatus.NEEDS_REVIEW,
      aiGenerationId: generation!.id,
      contentJson: expect.objectContaining({
        type: "lesson_summary_blocks",
        version: 2,
      }),
    });
    expect(JSON.stringify(summary.contentJson)).toContain("Bài tập vận dụng");
    expect(JSON.stringify(summary.contentJson)).toContain("DIAGRAM_NEEDS_REVIEW");
    expect(JSON.stringify(summary.contentJson)).toContain("INFERRED_POINT_LABEL");
    expect(JSON.stringify(summary.contentJson)).not.toContain("Cần admin kiểm tra");
    expect(JSON.stringify(summary.contentJson)).not.toContain("warningDetails");

    await prisma.$transaction([
      prisma.backgroundJob.update({
        where: { id: durable.id },
        data: { status: BackgroundJobStatus.SUCCEEDED, finishedAt: new Date() },
      }),
      prisma.aiGeneration.update({
        where: { id: generation!.id },
        data: { status: AiGenerationStatus.SUCCEEDED, finishedAt: new Date() },
      }),
    ]);

    const regenerated = await request(httpServer)
      .post(`/api/v1/admin/lessons/${ids.lesson}/summary/generate-ai`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ documentIds: [ids.document], style: "student_friendly" })
      .expect(202);
    expect(regenerated.body.data.jobId).not.toBe(first.body.data.jobId);
    expect(queueMock.enqueue).toHaveBeenCalledTimes(2);
  });
});

async function createFixtureData(prisma: PrismaClient) {
  await prisma.user.createMany({
    data: [
      {
        id: ids.adminUser,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        email: `m9-2-admin-${testRunId}@example.com`,
        username: `m9_2_admin_${testRunId.slice(0, 8)}`,
        passwordHash: "test-only",
      },
      {
        id: ids.studentUser,
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        email: `m9-2-student-${testRunId}@example.com`,
        username: `m9_2_student_${testRunId.slice(0, 8)}`,
        passwordHash: "test-only",
      },
    ],
  });
  await prisma.file.create({
    data: {
      id: ids.file,
      provider: FileProvider.MINIO_LOCAL,
      purpose: FilePurpose.LESSON_DOCUMENT,
      bucket: "learning-path-test",
      objectKey: `test/m9.2/${testRunId}/source.pdf`,
      originalName: "source.pdf",
      mimeType: "application/pdf",
      sizeBytes: BigInt(1024),
      visibility: FileVisibility.PRIVATE,
      status: FileStatus.UPLOADED,
      uploadedById: ids.adminUser,
    },
  });
  const courseCatalog = await createTestCourseCatalogRelation(prisma, 7);
  await prisma.learningPath.create({
    data: {
      id: ids.learningPath,
      ...courseCatalog,
      title: "M9.2 Integration Path",
      slug: `m9-2-integration-${testRunId}`,
      originalPriceVnd: 1_000_000,
      status: PublishStatus.DRAFT,
      createdBy: { connect: { id: ids.adminUser } },
      updatedBy: { connect: { id: ids.adminUser } },
    },
  });
  await prisma.lesson.create({
    data: {
      id: ids.lesson,
      learningPathId: ids.learningPath,
      orderIndex: 1,
      title: "Số hữu tỉ",
      status: PublishStatus.DRAFT,
      createdById: ids.adminUser,
      updatedById: ids.adminUser,
    },
  });
  await prisma.lessonDocument.create({
    data: {
      id: ids.document,
      lessonId: ids.lesson,
      fileId: ids.file,
      title: "Tài liệu số hữu tỉ",
      status: DocumentStatus.READY,
      contentHash: "m9-2-document-hash",
      chunkCount: 1,
      processedAt: new Date(),
    },
  });
  await prisma.documentChunk.create({
    data: {
      id: ids.chunk,
      documentId: ids.document,
      lessonId: ids.lesson,
      chunkIndex: 0,
      content: chunkContent,
      contentHash: "m9-2-chunk-hash",
      tokenCount: 25,
    },
  });
  await prisma.providerCatalogItem.create({
    data: {
      id: ids.reasoningModel,
      category: ProviderCatalogCategory.AI_MODEL,
      provider: AiProviderName.OPENAI,
      externalKey: reasoningModelKey,
      displayName: "M9.2 reasoning model",
      capabilitiesJson: {
        aiConfiguration: "REASONING_EFFORT",
        reasoningEffortLevels: ["low", "xhigh"],
      },
      status: ProviderCatalogStatus.ACTIVE,
    },
  });
}

async function cleanupFixtureData(prisma: PrismaClient) {
  await prisma.auditLog.deleteMany({
    where: {
      OR: [{ actorUserId: ids.adminUser }, { entityId: ids.lesson }],
    },
  });
  await prisma.lessonSummary.deleteMany({ where: { lessonId: ids.lesson } });
  await prisma.aiGeneration.deleteMany({ where: { lessonId: ids.lesson } });
  await prisma.backgroundJob.deleteMany({ where: { lessonId: ids.lesson } });
  await prisma.documentChunk.deleteMany({ where: { lessonId: ids.lesson } });
  await prisma.lessonDocument.deleteMany({ where: { lessonId: ids.lesson } });
  await prisma.lesson.deleteMany({ where: { id: ids.lesson } });
  await prisma.learningPath.deleteMany({ where: { id: ids.learningPath } });
  await prisma.file.deleteMany({ where: { id: ids.file } });
  await prisma.providerCatalogItem.deleteMany({ where: { id: ids.reasoningModel } });
  await prisma.user.deleteMany({
    where: { id: { in: [ids.adminUser, ids.studentUser] } },
  });
}
