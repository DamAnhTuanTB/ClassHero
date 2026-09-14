import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { NestFactory } from "@nestjs/core";
import {
  AiChatMessageRole,
  AiGenerationType,
  BackgroundJobQueue,
  BackgroundJobStatus,
  DocumentStatus,
  EnrollmentStatus,
  FileProvider,
  FilePurpose,
  FileStatus,
  FileVisibility,
  LessonDocumentKind,
  Prisma,
  PublishStatus,
} from "@prisma/client";
import { AppModule } from "#api/app.module";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { AiProviderCallService } from "#api/modules/ai/services/ai-provider-call.service";
import { AiChatRetrievalService } from "#api/modules/ai-chat/services/ai-chat-retrieval.service";
import { StoredFileCleanupService } from "#api/modules/files/services/stored-file-cleanup.service";
import { BackgroundJobQueueService } from "#api/modules/jobs/services/background-job-queue.service";
import { AiChatRuntimeSettingsService } from "#api/modules/provider-operations/services/ai-chat-runtime-settings.service";
import { DOCUMENT_CHUNKING_PROFILE } from "#api/workers/utils/chunking";

const BASE_URL = process.env.M44_BASE_URL ?? "http://localhost:4000/api/v1";
const OUTPUT_PATH = process.env.M44_OUTPUT_PATH ?? "/tmp/m4.4-live-chunk-retrieval.json";
const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const STUDENT_EMAIL = "student1@example.com";
const STUDENT_PASSWORD = "Student123!";
const COURSE_FIXTURES = [
  {
    courseTitle: "Toán 7",
    imagePath: "/tmp/m96c-images/math-cyclic-square.png",
    imageExpectedGroups: [
      ["abcd", "a, b, c, d"],
      ["đường tròn", "hình tròn"],
    ],
    documents: [
      { marker: "TOANSEVENALPHA", ratio: "7/13" },
      { marker: "TOANSEVENBETA", ratio: "11/17" },
    ],
  },
  {
    courseTitle: "Toán 12",
    imagePath: "/tmp/m96c-images/math-cyclic-square.png",
    imageExpectedGroups: [
      ["abcd", "a, b, c, d"],
      ["đường tròn", "hình tròn"],
    ],
    documents: [
      { marker: "TOANTWELVEALPHA", ratio: "19/31" },
      { marker: "TOANTWELVEBETA", ratio: "23/37" },
    ],
  },
  {
    courseTitle: "Hóa học 12",
    imagePath: "/tmp/m96c-images/chemistry-equation.png",
    imageExpectedGroups: [
      ["h2o", "h_{2}o"],
      ["phương trình", "phản ứng"],
    ],
    documents: [
      { marker: "CHEMTWELVEALPHA", ratio: "5/19" },
      { marker: "CHEMTWELVEBETA", ratio: "17/23" },
    ],
  },
  {
    courseTitle: "Vật lý 12",
    imagePath: "/tmp/m96c-images/physics-circuit.png",
    imageExpectedGroups: [
      ["6ω", "6ohm", "6ôm", "6omega", "điệntrở6"],
      ["12v"],
    ],
    documents: [
      { marker: "PHYSTWELVEALPHA", ratio: "3/11" },
      { marker: "PHYSTWELVEBETA", ratio: "13/29" },
    ],
  },
] as const;

type JsonRecord = Record<string, unknown>;

type SseEvent = JsonRecord & {
  type?: string;
  conversationId?: string;
};

type FixtureIds = {
  courseId: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
  marker: string;
  ratio: string;
  fileId: string;
  sourceDocumentId: string;
  pageRangeId: string;
  lessonDocumentId: string;
  processingJobId: string;
};

type CourseTarget = {
  courseId: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
  existingActivePrimaryDocuments: number;
  existingPrimaryChunkIds: string[];
  imagePath: string;
  imageExpectedGroups: string[][];
  documents: Array<{ marker: string; ratio: string }>;
};

type LiveSummary = {
  startedAt: string;
  finishedAt?: string;
  fixture?: JsonRecord;
  retrieval?: JsonRecord;
  http?: JsonRecord;
  providerUsage?: JsonRecord;
  cleanup?: JsonRecord;
  error?: string;
};

async function main() {
  if (process.env.M44_ALLOW_PAID_LIVE_TEST !== "1") {
    throw new Error(
      "Set M44_ALLOW_PAID_LIVE_TEST=1 only after the owner approves paid live calls.",
    );
  }

  const startedAt = new Date();
  const summary: LiveSummary = { startedAt: startedAt.toISOString() };
  const conversationIds: string[] = [];
  const backgroundJobIds: string[] = [];
  const fixtureIds: FixtureIds[] = [];
  const uploadedImageFileIds: string[] = [];
  const createdEnrollmentIds: string[] = [];
  const httpSummaries: JsonRecord[] = [];
  summary.http = { courses: httpSummaries };
  let refreshToken: string | null = null;
  let application: Awaited<
    ReturnType<typeof NestFactory.createApplicationContext>
  > | null = null;

  try {
    await assertApiIsHealthy();
    // The separately running API remains the Redis subscriber under test. This
    // command-only Nest context does not own a Socket.IO server, so it must not
    // subscribe and misclassify successful gateway emits as malformed payloads.
    process.env.REALTIME_JOB_EVENTS_ENABLED = "false";
    application = await NestFactory.createApplicationContext(AppModule, {
      logger: ["error", "warn"],
    });
    const prisma = application.get(PrismaService);
    const queue = application.get(BackgroundJobQueueService);
    const retrieval = application.get(AiChatRetrievalService);
    const runtimeSettings = application.get(AiChatRuntimeSettingsService);

    const targets = await resolveCourseTargets(prisma);
    createdEnrollmentIds.push(...(await ensureStudentEnrollments(prisma, targets)));
    for (const target of targets) {
      for (const document of target.documents) {
        fixtureIds.push(await createFixture(prisma, target, document));
      }
    }
    backgroundJobIds.push(...fixtureIds.map((fixture) => fixture.processingJobId));
    await Promise.all(
      fixtureIds.map((fixture) => queue.enqueue(fixture.processingJobId)),
    );

    const fixtureRuns = await Promise.all(
      fixtureIds.map(async (fixture) => ({
        fixture,
        worker: await waitForFixtureEmbedding(prisma, fixture, 300_000),
      })),
    );
    for (const run of fixtureRuns) {
      backgroundJobIds.push(run.worker.embeddingJobId);
      assertChunkInvariants(run.worker.chunks, run.fixture);
    }
    await assertMultiplePrimaryDocumentsRemainActive(prisma, targets);

    summary.fixture = {
      profile: DOCUMENT_CHUNKING_PROFILE,
      courseCount: targets.length,
      documentCount: fixtureRuns.length,
      courses: targets.map((target) => ({
        courseId: target.courseId,
        courseTitle: target.courseTitle,
        lessonId: target.lessonId,
        lessonTitle: target.lessonTitle,
        activePrimaryDocumentsBefore: target.existingActivePrimaryDocuments,
        activePrimaryDocumentsDuringTest:
          target.existingActivePrimaryDocuments + target.documents.length,
        realPrimaryChunkCount: target.existingPrimaryChunkIds.length,
        documents: fixtureRuns
          .filter((run) => run.fixture.courseId === target.courseId)
          .map(({ fixture, worker }) => ({
            lessonDocumentId: fixture.lessonDocumentId,
            marker: fixture.marker,
            ratio: fixture.ratio,
            processingJobId: fixture.processingJobId,
            embeddingJobId: worker.embeddingJobId,
            processingStatus: worker.processingStatus,
            embeddingStatus: worker.embeddingStatus,
            documentStatus: worker.documentStatus,
            chunkCount: worker.chunks.length,
            tokenCounts: worker.chunks.map((chunk) => chunk.tokenCount),
            overlapTokenCounts: worker.chunks.map((chunk) =>
              readNumber(chunk.metadataJson, "overlapTokenCount"),
            ),
            pageRanges: worker.chunks.map((chunk) => ({
              start: readNumber(chunk.metadataJson, "chunkPageStart"),
              end: readNumber(chunk.metadataJson, "chunkPageEnd"),
            })),
            embeddingModel: worker.chunks[0]?.embeddingModel ?? null,
            embeddingDimensions: worker.chunks[0]?.embeddingDimensions ?? null,
          })),
      })),
    };

    const settings = await runtimeSettings.get();
    const embeddingConfig = {
      provider: settings.embeddingProvider,
      model: settings.embeddingModel,
      dimensions: settings.embeddingDimensions,
    };
    assert(
      fixtureRuns.every(({ worker }) =>
        worker.chunks.every(
          (chunk) =>
            chunk.embeddingModel === embeddingConfig.model &&
            chunk.embeddingDimensions === embeddingConfig.dimensions,
        ),
      ),
      "Worker embeddings do not match the active Chat embedding space.",
    );

    const fallbackRetrieval = new AiChatRetrievalService(prisma, {
      createEmbedding: async () => {
        throw new Error("Intentional live-test vector outage");
      },
    } as unknown as AiProviderCallService);
    const retrievalSummaries: JsonRecord[] = [];
    for (const target of targets) {
      const courseRuns = fixtureRuns.filter(
        (run) => run.fixture.courseId === target.courseId,
      );
      const documentChunkIds = courseRuns.map((run) =>
        run.worker.chunks.map((chunk) => chunk.id),
      );
      const [firstDocument, secondDocument] = target.documents;
      assert(firstDocument && secondDocument, "Each course needs two fixture documents.");
      const semanticSources = await retrieval.retrieve({
        query: `So sánh hai quy tắc hiệu chỉnh ${firstDocument.marker} và ${secondDocument.marker}, bao gồm hai tỉ số ${firstDocument.ratio} và ${secondDocument.ratio}.`,
        scopeQuery: "zzzz-no-keyword-match",
        learningPathIds: [target.courseId],
        lessonIds: [target.lessonId],
        surfaceLessonId: target.lessonId,
        embeddingIdempotencyKey: `m44-live-semantic:${randomUUID()}`,
        embeddingConfig,
        maxChunks: 12,
        maxTokens: 6_000,
      });
      assertIncludesEveryFixture(
        semanticSources,
        documentChunkIds,
        `${target.courseTitle} semantic-only retrieval`,
      );
      assertIncludesAny(
        semanticSources,
        target.existingPrimaryChunkIds,
        `${target.courseTitle} semantic-only retrieval from the real primary document`,
      );

      const hybridSources = await retrieval.retrieve({
        query: `Hai mệnh đề ${firstDocument.marker} và ${secondDocument.marker} có các tỉ số ${firstDocument.ratio} và ${secondDocument.ratio} dùng để làm gì?`,
        learningPathIds: [target.courseId],
        lessonIds: [target.lessonId],
        surfaceLessonId: target.lessonId,
        embeddingIdempotencyKey: `m44-live-hybrid:${randomUUID()}`,
        embeddingConfig,
        maxChunks: 12,
        maxTokens: 6_000,
      });
      assertIncludesEveryFixture(
        hybridSources,
        documentChunkIds,
        `${target.courseTitle} hybrid retrieval`,
      );

      const boundarySources = await retrieval.retrieve({
        query: `Mệnh đề cầu nối ${firstDocument.marker}BRIDGE giữa cuối trang trước và đầu trang sau giữ vai trò gì?`,
        scopeQuery: "zzzz-no-keyword-match",
        learningPathIds: [target.courseId],
        lessonIds: [target.lessonId],
        surfaceLessonId: target.lessonId,
        embeddingIdempotencyKey: `m44-live-boundary:${randomUUID()}`,
        embeddingConfig,
        maxChunks: 12,
        maxTokens: 6_000,
      });
      const overlapChunkIds = new Set(
        courseRuns[0]!.worker.chunks
          .filter((chunk) => readNumber(chunk.metadataJson, "overlapTokenCount") > 0)
          .map((chunk) => chunk.id),
      );
      assert(
        boundarySources.some((source) => overlapChunkIds.has(source.chunkId)),
        `${target.courseTitle} boundary semantic retrieval missed the overlap.`,
      );

      const keywordFallbackSources = await fallbackRetrieval.retrieve({
        query: `${firstDocument.marker} ${secondDocument.marker}`,
        learningPathIds: [target.courseId],
        lessonIds: [target.lessonId],
        surfaceLessonId: target.lessonId,
        embeddingIdempotencyKey: `m44-live-keyword-fallback:${randomUUID()}`,
        embeddingConfig,
        maxChunks: 12,
        maxTokens: 6_000,
      });
      assertIncludesEveryFixture(
        keywordFallbackSources,
        documentChunkIds,
        `${target.courseTitle} keyword fallback after vector outage`,
      );

      const allChunkIds = documentChunkIds.flat();
      retrievalSummaries.push({
        courseTitle: target.courseTitle,
        semanticOnly: summarizeSources(semanticSources, allChunkIds),
        realPrimarySemantic: summarizeSources(
          semanticSources,
          target.existingPrimaryChunkIds,
        ),
        hybrid: summarizeSources(hybridSources, allChunkIds),
        boundary: summarizeSources(boundarySources, allChunkIds),
        keywordFallback: summarizeSources(keywordFallbackSources, allChunkIds),
      });
    }
    summary.retrieval = { courses: retrievalSummaries };

    const login = await loginStudent();
    refreshToken = login.refreshToken;
    for (const target of targets) {
      const imageFileId = await uploadChatImage(login.accessToken, target.imagePath);
      uploadedImageFileIds.push(imageFileId);
      const courseRuns = fixtureRuns.filter(
        (run) => run.fixture.courseId === target.courseId,
      );
      const documentChunkIds = courseRuns.map((run) =>
        run.worker.chunks.map((chunk) => chunk.id),
      );
      const [firstDocument, secondDocument] = target.documents;
      assert(firstDocument && secondDocument, "Each course needs two fixture documents.");
      const firstTurn = await streamChat(login.accessToken, undefined, {
        scopeType: "COURSE",
        learningPathId: target.courseId,
        surfaceLessonId: target.lessonId,
        message: `Dựa trên tất cả tài liệu chính của buổi học, hãy so sánh ${firstDocument.marker} có tỉ số ${firstDocument.ratio} với ${secondDocument.marker} có tỉ số ${secondDocument.ratio}. Đồng thời đọc và mô tả ngắn các ký hiệu, dữ kiện chính trong ảnh em đính kèm; nếu ảnh không liên quan trực tiếp đến buổi học thì nói rõ.`,
        attachmentFileIds: [imageFileId],
      });
      const conversationId = readConversationId(firstTurn.events);
      conversationIds.push(conversationId);
      assertSuccessfulSse(firstTurn, `${target.courseTitle} first Chat turn`);
      const firstTurnQuality = await assertLatestAssistantQuality(
        prisma,
        conversationId,
        target,
        documentChunkIds,
      );

      const followUpTurn = await streamChat(login.accessToken, conversationId, {
        message: `Giải thích tiếp vai trò của ${firstDocument.marker}BRIDGE ở ranh giới hai trang và phân biệt với ${firstDocument.marker}ISOLATED.`,
        attachmentFileIds: [],
      });
      assertSuccessfulSse(followUpTurn, `${target.courseTitle} follow-up Chat turn`);
      const followUpQuality = await assertLatestFollowUpQuality(
        prisma,
        conversationId,
        target,
        firstDocument.marker,
        documentChunkIds[0] ?? [],
      );

      httpSummaries.push({
        courseTitle: target.courseTitle,
        conversationId,
        image: {
          filename: basename(target.imagePath),
          fileId: imageFileId,
          visualGroundTruthPassed: true,
        },
        firstTurn: summarizeSse(firstTurn),
        firstTurnQuality,
        followUpTurn: summarizeSse(followUpTurn),
        followUpQuality,
        persistedAssistantMessages: await prisma.aiChatMessage.count({
          where: {
            sessionId: conversationId,
            role: AiChatMessageRole.ASSISTANT,
          },
        }),
      });
    }
    summary.providerUsage = await summarizeProviderUsage(prisma, startedAt);
    summary.finishedAt = new Date().toISOString();
  } catch (error) {
    summary.error = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    if (refreshToken) {
      await logoutStudent(refreshToken).catch(() => undefined);
    }
    if (application) {
      const prisma = application.get(PrismaService);
      const storedFileCleanup = application.get(StoredFileCleanupService);
      summary.providerUsage ??= await summarizeProviderUsage(prisma, startedAt).catch(
        (error) => ({
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      summary.cleanup = await cleanupFixture(
        prisma,
        storedFileCleanup,
        fixtureIds,
        conversationIds,
        backgroundJobIds,
        createdEnrollmentIds,
        uploadedImageFileIds,
      ).catch((error) => ({
        completed: false,
        error: error instanceof Error ? error.message : String(error),
      }));
      await application.close();
    }
    summary.finishedAt ??= new Date().toISOString();
    await writeFile(OUTPUT_PATH, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    process.stdout.write(`${JSON.stringify(summary)}\n`);
  }
}

async function resolveCourseTargets(prisma: PrismaService): Promise<CourseTarget[]> {
  const targets: CourseTarget[] = [];
  const requestedCourseTitles = new Set(
    (process.env.M44_COURSE_TITLES ?? "")
      .split(",")
      .map((title) => title.trim())
      .filter(Boolean),
  );
  const fixtures = COURSE_FIXTURES.filter(
    (fixture) =>
      requestedCourseTitles.size === 0 ||
      requestedCourseTitles.has(fixture.courseTitle),
  );
  assert(fixtures.length > 0, "No configured course matched M44_COURSE_TITLES.");
  for (const fixture of fixtures) {
    const learningPath = await prisma.learningPath.findFirst({
      where: {
        title: fixture.courseTitle,
        status: PublishStatus.PUBLISHED,
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        lessons: {
          where: { status: PublishStatus.PUBLISHED, deletedAt: null },
          orderBy: { orderIndex: "asc" },
          take: 1,
          select: { id: true, title: true },
        },
      },
    });
    assert(learningPath, `Published course ${fixture.courseTitle} was not found.`);
    const lesson = learningPath.lessons[0];
    assert(lesson, `Course ${fixture.courseTitle} has no published lesson.`);
    const existingPrimaryDocuments = await prisma.lessonDocument.findMany({
      where: {
        lessonId: lesson.id,
        kind: LessonDocumentKind.PRIMARY_FROM_SOURCE,
        replacedAt: null,
      },
      select: {
        chunks: { select: { id: true } },
      },
    });
    const existingActivePrimaryDocuments = existingPrimaryDocuments.length;
    const existingPrimaryChunkIds = existingPrimaryDocuments.flatMap((document) =>
      document.chunks.map((chunk) => chunk.id),
    );
    assert(
      existingActivePrimaryDocuments >= 1,
      `Course ${fixture.courseTitle} does not have its expected real primary document.`,
    );
    assert(
      existingPrimaryChunkIds.length > 0,
      `Course ${fixture.courseTitle} has no chunks in its real primary document.`,
    );
    targets.push({
      courseId: learningPath.id,
      courseTitle: learningPath.title,
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      existingActivePrimaryDocuments,
      existingPrimaryChunkIds,
      imagePath: fixture.imagePath,
      imageExpectedGroups: fixture.imageExpectedGroups.map((group) => [...group]),
      documents: fixture.documents.map((document) => ({ ...document })),
    });
  }
  return targets;
}

async function ensureStudentEnrollments(prisma: PrismaService, targets: CourseTarget[]) {
  const student = await prisma.user.findUnique({
    where: { email: STUDENT_EMAIL },
    select: { id: true },
  });
  assert(student, `Student ${STUDENT_EMAIL} was not found.`);
  const createdIds: string[] = [];
  for (const target of targets) {
    const existing = await prisma.enrollment.findFirst({
      where: {
        studentUserId: student.id,
        learningPathId: target.courseId,
        status: EnrollmentStatus.ACTIVE,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (existing) continue;
    const enrollment = await prisma.enrollment.create({
      data: {
        studentUserId: student.id,
        learningPathId: target.courseId,
        status: EnrollmentStatus.ACTIVE,
        startsAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000),
      },
      select: { id: true },
    });
    createdIds.push(enrollment.id);
  }
  return createdIds;
}

async function assertMultiplePrimaryDocumentsRemainActive(
  prisma: PrismaService,
  targets: CourseTarget[],
) {
  for (const target of targets) {
    const count = await prisma.lessonDocument.count({
      where: {
        lessonId: target.lessonId,
        kind: LessonDocumentKind.PRIMARY_FROM_SOURCE,
        replacedAt: null,
      },
    });
    assert(
      count === target.existingActivePrimaryDocuments + target.documents.length,
      `${target.courseTitle} did not retain all primary documents (expected ${target.existingActivePrimaryDocuments + target.documents.length}, received ${count}).`,
    );
  }
}

async function createFixture(
  prisma: PrismaService,
  target: CourseTarget,
  document: { marker: string; ratio: string },
): Promise<FixtureIds> {
  const suffix = randomUUID();
  const file = await prisma.file.create({
    data: {
      provider: FileProvider.MINIO_LOCAL,
      purpose: FilePurpose.LESSON_DOCUMENT,
      bucket: "live-test-fixtures",
      objectKey: `m4.4/chunk-retrieval/${suffix}.pdf`,
      originalName: `m4.4-live-${document.marker}-${suffix}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 1n,
      visibility: FileVisibility.PRIVATE,
      status: FileStatus.READY,
      uploadedById: ADMIN_ID,
      metadataJson: {
        liveTest: "m4.4-multi-course-primary-retrieval",
        marker: document.marker,
      },
    },
  });
  const sourceDocument = await prisma.sourceDocument.create({
    data: {
      learningPathId: target.courseId,
      fileId: file.id,
      title: `M4.4 live ${document.marker} ${suffix}`,
      status: DocumentStatus.READY,
      pageCount: 3,
      contentHash: `m44-live-source-${suffix}`,
      processedAt: new Date(),
      metadataJson: {
        liveTest: "m4.4-multi-course-primary-retrieval",
        marker: document.marker,
      },
    },
  });

  const pageTexts = buildFixturePageTexts(document.marker, document.ratio);
  await prisma.sourceDocumentPage.createMany({
    data: pageTexts.map((text, index) => ({
      sourceDocumentId: sourceDocument.id,
      pageNumber: index + 1,
      status: DocumentStatus.READY,
      text,
      textSource: "live_test_verified_text",
      qualityScore: 1,
      metadataJson: {
        printedPage: {
          pdfPageNumber: index + 1,
          printedPageNumber: index + 101,
          printedPageLabel: `LT-${index + 1}`,
          source: "admin_verified",
          confidence: 1,
          evidenceLineIds: [],
          evidenceText: null,
          warning: null,
        },
      },
    })),
  });
  const pageRange = await prisma.lessonDocumentPageRange.create({
    data: {
      lessonId: target.lessonId,
      sourceDocumentId: sourceDocument.id,
      pageStart: 1,
      pageEnd: 3,
      createdById: ADMIN_ID,
      metadataJson: {
        liveTest: "m4.4-multi-course-primary-retrieval",
        marker: document.marker,
      },
    },
  });
  const lessonDocument = await prisma.lessonDocument.create({
    data: {
      lessonId: target.lessonId,
      fileId: file.id,
      sourceDocumentId: sourceDocument.id,
      pageRangeId: pageRange.id,
      kind: LessonDocumentKind.PRIMARY_FROM_SOURCE,
      title: `M4.4 live primary ${document.marker} ${suffix}`,
      status: DocumentStatus.PROCESSING,
      metadataJson: {
        liveTest: "m4.4-multi-course-primary-retrieval",
        marker: document.marker,
        ratio: document.ratio,
      },
    },
  });
  const processingJob = await prisma.backgroundJob.create({
    data: {
      queue: BackgroundJobQueue.DOCUMENT_PROCESSING,
      status: BackgroundJobStatus.QUEUED,
      idempotencyKey: `m44-live-chunking:${suffix}`,
      ownerUserId: ADMIN_ID,
      lessonId: target.lessonId,
      resourceType: "LESSON_DOCUMENT",
      resourceId: lessonDocument.id,
      inputMeta: {
        action: "LESSON_CHUNKING_FROM_SOURCE",
        lessonId: target.lessonId,
        lessonDocumentId: lessonDocument.id,
        sourceDocumentId: sourceDocument.id,
        pageRangeId: pageRange.id,
      },
      maxAttempts: 1,
    },
  });
  await prisma.lessonDocument.update({
    where: { id: lessonDocument.id },
    data: { processingJobId: processingJob.id },
  });

  return {
    courseId: target.courseId,
    courseTitle: target.courseTitle,
    lessonId: target.lessonId,
    lessonTitle: target.lessonTitle,
    marker: document.marker,
    ratio: document.ratio,
    fileId: file.id,
    sourceDocumentId: sourceDocument.id,
    pageRangeId: pageRange.id,
    lessonDocumentId: lessonDocument.id,
    processingJobId: processingJob.id,
  };
}

function buildFixturePageTexts(marker: string, ratio: string) {
  const pageOneSentences = Array.from(
    { length: 9 },
    (_, index) =>
      `Bước ${index + 1} của quy tắc ${marker} theo dõi một đại lượng qua nhiều lần quan sát; người học phải so sánh trạng thái trước và sau, giữ nguyên thứ tự dữ kiện, rồi ghi lại sai lệch để không làm mất quan hệ nhân quả.`,
  );
  const pageTwoSentences = Array.from(
    { length: 9 },
    (_, index) =>
      `Lần hiệu chỉnh ${index + 1} ở trang kế tiếp dùng tỉ số ${ratio} của ${marker} để đưa đại lượng lệch về cùng mốc tham chiếu; phép tính chỉ hợp lệ khi câu kết luận cuối trang trước được giữ làm ngữ cảnh cho dữ kiện đầu trang này.`,
  );
  const pageThreeSentences = Array.from(
    { length: 5 },
    (_, index) =>
      `Ví dụ độc lập ${index + 1} của chủ đề ${marker}ISOLATED phân loại ba nhóm dữ kiện và không sử dụng bất kỳ kết quả truyền tiếp nào từ phần phía trước.`,
  );

  return [
    [
      `\\section*{QUY TẮC CẦU NỐI ${marker}}`,
      ...pageOneSentences,
      `Mệnh đề cầu nối ${marker}BRIDGE khẳng định rằng đại lượng cuối trang là điều kiện đầu vào bắt buộc của phép hiệu chỉnh ở trang sau.`,
    ].join("\n\n"),
    pageTwoSentences.join("\n\n"),
    [`\\section*{CHỦ ĐỀ ĐỘC LẬP ${marker}ISOLATED}`, ...pageThreeSentences].join("\n\n"),
  ];
}

async function waitForFixtureEmbedding(
  prisma: PrismaService,
  ids: FixtureIds,
  timeoutMs: number,
) {
  const deadline = Date.now() + timeoutMs;
  let lastState = "not-started";

  while (Date.now() < deadline) {
    const [document, processingJob, embeddingJob] = await Promise.all([
      prisma.lessonDocument.findUnique({
        where: { id: ids.lessonDocumentId },
        select: {
          status: true,
          extractError: true,
          chunks: {
            orderBy: { chunkIndex: "asc" },
            select: {
              id: true,
              content: true,
              tokenCount: true,
              metadataJson: true,
              embeddingProvider: true,
              embeddingModel: true,
              embeddingDimensions: true,
            },
          },
        },
      }),
      prisma.backgroundJob.findUnique({
        where: { id: ids.processingJobId },
        select: { status: true, errorMessage: true },
      }),
      prisma.backgroundJob.findFirst({
        where: {
          queue: BackgroundJobQueue.EMBEDDING,
          resourceType: "lesson_document",
          resourceId: ids.lessonDocumentId,
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, errorMessage: true },
      }),
    ]);

    lastState = JSON.stringify({
      document: document?.status,
      processingJob: processingJob?.status,
      embeddingJob: embeddingJob?.status,
      chunks: document?.chunks.length ?? 0,
    });
    if (
      document?.status === DocumentStatus.READY &&
      processingJob?.status === BackgroundJobStatus.SUCCEEDED &&
      embeddingJob?.status === BackgroundJobStatus.SUCCEEDED &&
      document.chunks.length > 0 &&
      document.chunks.every((chunk) => chunk.embeddingModel && chunk.embeddingDimensions)
    ) {
      return {
        documentStatus: document.status,
        processingStatus: processingJob.status,
        embeddingStatus: embeddingJob.status,
        embeddingJobId: embeddingJob.id,
        chunks: document.chunks,
      };
    }
    if (
      processingJob?.status === BackgroundJobStatus.FAILED ||
      embeddingJob?.status === BackgroundJobStatus.FAILED ||
      document?.status === DocumentStatus.FAILED
    ) {
      throw new Error(
        `Fixture worker failed: ${processingJob?.errorMessage ?? embeddingJob?.errorMessage ?? document?.extractError ?? lastState}`,
      );
    }
    await delay(500);
  }

  throw new Error(`Timed out waiting for worker pipeline: ${lastState}`);
}

function assertChunkInvariants(
  chunks: Array<{
    content: string;
    tokenCount: number | null;
    metadataJson: Prisma.JsonValue | null;
  }>,
  fixture: FixtureIds,
) {
  assert(chunks.length >= 3, `Expected at least 3 chunks, received ${chunks.length}.`);
  assert(
    chunks.every(
      (chunk) =>
        chunk.tokenCount !== null &&
        chunk.tokenCount <= DOCUMENT_CHUNKING_PROFILE.maxTokens,
    ),
    "At least one normal fixture chunk exceeded the hard token limit.",
  );
  assert(
    chunks.every(
      (chunk) =>
        readString(chunk.metadataJson, "chunkingVersion") ===
        DOCUMENT_CHUNKING_PROFILE.version,
    ),
    "Chunking profile version was not persisted on every chunk.",
  );
  const overlapChunk = chunks.find(
    (chunk) => readNumber(chunk.metadataJson, "overlapTokenCount") > 0,
  );
  assert(overlapChunk, "Expected an overlap chunk across the physical page boundary.");
  assert(
    overlapChunk.content.includes(`${fixture.marker}BRIDGE`),
    "The physical-page overlap did not carry the bridge sentence.",
  );
  assert(
    readNumber(overlapChunk.metadataJson, "chunkPageStart") === 1 &&
      readNumber(overlapChunk.metadataJson, "chunkPageEnd") === 2,
    "Overlapped chunk did not preserve its two-page provenance.",
  );
  const independentSection = chunks.find((chunk) =>
    chunk.content.includes(`${fixture.marker}ISOLATED`),
  );
  assert(independentSection, "Independent semantic section chunk was not created.");
  assert(
    readNumber(independentSection.metadataJson, "overlapTokenCount") === 0 &&
      !independentSection.content.includes(`${fixture.marker}BRIDGE`),
    "Overlap leaked across a new semantic section.",
  );
}

async function assertApiIsHealthy() {
  const response = await fetch(`${BASE_URL}/health`, {
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) {
    throw new Error(`API health check failed with HTTP ${response.status}.`);
  }
}

async function loginStudent() {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: STUDENT_EMAIL,
      password: STUDENT_PASSWORD,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = (await response.json()) as JsonRecord;
  const data = asRecord(payload.data) ?? payload;
  const accessToken = typeof data.accessToken === "string" ? data.accessToken : null;
  const refreshToken = typeof data.refreshToken === "string" ? data.refreshToken : null;
  if (!response.ok || !accessToken || !refreshToken) {
    throw new Error(`Student login failed with HTTP ${response.status}.`);
  }
  return { accessToken, refreshToken };
}

async function logoutStudent(refreshToken: string) {
  await fetch(`${BASE_URL}/auth/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    signal: AbortSignal.timeout(10_000),
  });
}

async function uploadChatImage(accessToken: string, imagePath: string) {
  const buffer = await readFile(imagePath);
  const form = new FormData();
  form.append("purpose", "CHAT_IMAGE");
  form.append(
    "file",
    new Blob([buffer], { type: "image/png" }),
    basename(imagePath),
  );
  const response = await fetch(`${BASE_URL}/files/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  const payload = (await response.json()) as JsonRecord;
  const data = asRecord(payload.data);
  const fileId = data?.id;
  assert(
    response.ok && typeof fileId === "string",
    `Chat image upload failed for ${basename(imagePath)} with HTTP ${response.status}.`,
  );
  return fileId;
}

async function streamChat(
  accessToken: string,
  conversationId: string | undefined,
  body: JsonRecord,
) {
  const endpoint = conversationId
    ? `/student/ai-chat/conversations/${conversationId}/messages/stream`
    : "/student/ai-chat/conversations/messages/stream";
  const startedAt = performance.now();
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  const streamed = await readSseStream(response, startedAt);
  return {
    status: response.status,
    durationMs: Math.round(performance.now() - startedAt),
    events: streamed.events,
    firstDeltaAtMs: streamed.firstDeltaAtMs,
    completedAtMs: streamed.completedAtMs,
    rawPreview: streamed.raw.slice(0, 500),
  };
}

async function readSseStream(response: Response, startedAt: number) {
  if (!response.body) {
    const raw = await response.text();
    return {
      raw,
      events: parseSseLines(raw),
      firstDeltaAtMs: null,
      completedAtMs: null,
    };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const events: SseEvent[] = [];
  let raw = "";
  let pending = "";
  let firstDeltaAtMs: number | null = null;
  let completedAtMs: number | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const decoded = decoder.decode(value, { stream: true });
    raw += decoded;
    pending += decoded;
    const lines = pending.split("\n");
    pending = lines.pop() ?? "";
    for (const event of parseSseLines(lines.join("\n"))) {
      const atMs = Math.round(performance.now() - startedAt);
      events.push(event);
      if (event.type === "delta" && firstDeltaAtMs === null) {
        firstDeltaAtMs = atMs;
      }
      if (event.type === "completed") completedAtMs = atMs;
    }
  }
  const flushed = decoder.decode();
  raw += flushed;
  const trailing = `${pending}${flushed}`;
  if (trailing) {
    events.push(...parseSseLines(trailing));
  }

  return { raw, events, firstDeltaAtMs, completedAtMs };
}

function parseSseLines(raw: string): SseEvent[] {
  const events: SseEvent[] = [];
  for (const line of raw.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    try {
      const parsed: unknown = JSON.parse(line.slice(6));
      const event = asRecord(parsed);
      if (event) events.push(event as SseEvent);
    } catch {
      // Production emits one JSON object per data line; malformed data is ignored
      // here and will fail the required event assertions below.
    }
  }
  return events;
}

function assertSuccessfulSse(
  turn: Awaited<ReturnType<typeof streamChat>>,
  label: string,
) {
  const eventTypes = turn.events.map((event) => event.type);
  const failedEvent = turn.events.findLast((event) => event.type === "failed");
  const streamedText = turn.events
    .filter((event) => event.type === "delta")
    .map((event) => (typeof event.delta === "string" ? event.delta : ""))
    .join("");
  const evidence = `events=${eventTypes.join(",") || "none"}; failed=${JSON.stringify(failedEvent ?? null)}; streamedTail=${streamedText.slice(-2_000)}; raw=${turn.rawPreview}`;
  assert(turn.status === 200, `${label} returned HTTP ${turn.status}; ${evidence}.`);
  assert(eventTypes.includes("started"), `${label} did not emit started; ${evidence}.`);
  assert(eventTypes.includes("delta"), `${label} did not stream any delta; ${evidence}.`);
  assert(
    eventTypes.includes("completed"),
    `${label} did not emit completed; ${evidence}.`,
  );
  assert(!eventTypes.includes("failed"), `${label} emitted failed; ${evidence}.`);
  assert(
    turn.firstDeltaAtMs !== null &&
      turn.completedAtMs !== null &&
      turn.firstDeltaAtMs < turn.completedAtMs,
    `${label} did not deliver delta events before completion in real time.`,
  );
}

function readConversationId(events: SseEvent[]) {
  const value = events.findLast(
    (event) => event.type === "completed" || event.type === "started",
  )?.conversationId;
  assert(typeof value === "string", "Chat SSE did not return a conversation ID.");
  return value;
}

async function assertLatestAssistantQuality(
  prisma: PrismaService,
  conversationId: string,
  target: CourseTarget,
  documentChunkIds: string[][],
) {
  const assistantMessage = await prisma.aiChatMessage.findFirst({
    where: {
      sessionId: conversationId,
      role: AiChatMessageRole.ASSISTANT,
    },
    orderBy: { createdAt: "desc" },
    select: {
      contentJson: true,
      retrievedChunkIds: true,
      sourceLearningPathIds: true,
      errorCode: true,
    },
  });
  assert(assistantMessage, "Persisted Chat answer was not found.");
  assert(assistantMessage.errorCode === null, "Persisted Chat answer has an error code.");
  assert(
    documentChunkIds.every((chunkIds) => {
      const ids = new Set(chunkIds);
      return assistantMessage.retrievedChunkIds.some((id) => ids.has(id));
    }),
    "Persisted Chat answer did not cite chunks from every primary fixture document.",
  );
  const text = readString(assistantMessage.contentJson, "text") ?? "";
  const normalizedText = text.toLocaleLowerCase("vi");
  assert(
    target.documents.every((document) =>
      normalizedText.includes(document.marker.toLocaleLowerCase("vi")),
    ),
    `${target.courseTitle} Chat answer omitted a primary-document marker.`,
  );
  assert(
    target.documents.every((document) => containsRatio(text, document.ratio)),
    `${target.courseTitle} Chat answer omitted or changed a ground-truth ratio.`,
  );
  const compactVisualText = compactForVisualAssertion(text);
  const missedVisualGroups = target.imageExpectedGroups.filter(
    (alternatives) =>
      !alternatives.some((expected) =>
        compactVisualText.includes(compactForVisualAssertion(expected)),
      ),
  );
  assert(
    missedVisualGroups.length === 0,
    `${target.courseTitle} Chat answer did not demonstrate the expected image understanding: ${JSON.stringify(missedVisualGroups)}.`,
  );
  const foreignMarkers = COURSE_FIXTURES.filter(
    (fixture) => fixture.courseTitle !== target.courseTitle,
  ).flatMap((fixture) => fixture.documents.map((document) => document.marker));
  assert(
    foreignMarkers.every(
      (marker) => !normalizedText.includes(marker.toLocaleLowerCase("vi")),
    ),
    `${target.courseTitle} Chat answer mixed in a marker from another course.`,
  );
  assert(
    assistantMessage.sourceLearningPathIds.length > 0 &&
      assistantMessage.sourceLearningPathIds.every((id) => id === target.courseId),
    `${target.courseTitle} Chat answer cited a source outside its course scope.`,
  );
  return {
    citedEveryPrimaryFixture: true,
    preservedBothMarkers: true,
    preservedBothRatios: true,
    visualGroundTruthGroups: target.imageExpectedGroups.length,
    visualGroundTruthPassed: true,
    foreignCourseMarkerCount: 0,
    sourceScopeCorrect: true,
    answerCharacters: text.length,
    answerText: text,
  };
}

async function assertLatestFollowUpQuality(
  prisma: PrismaService,
  conversationId: string,
  target: CourseTarget,
  marker: string,
  expectedChunkIds: string[],
) {
  const assistantMessage = await prisma.aiChatMessage.findFirst({
    where: {
      sessionId: conversationId,
      role: AiChatMessageRole.ASSISTANT,
    },
    orderBy: { createdAt: "desc" },
    select: {
      contentJson: true,
      retrievedChunkIds: true,
      sourceLearningPathIds: true,
      errorCode: true,
    },
  });
  assert(assistantMessage, "Persisted follow-up Chat answer was not found.");
  assert(
    assistantMessage.errorCode === null,
    "Persisted follow-up Chat answer has an error code.",
  );
  const text = readString(assistantMessage.contentJson, "text") ?? "";
  const normalizedText = text.toLocaleLowerCase("vi");
  for (const expected of [`${marker}BRIDGE`, `${marker}ISOLATED`]) {
    assert(
      normalizedText.includes(expected.toLocaleLowerCase("vi")),
      `${target.courseTitle} follow-up answer omitted ${expected}.`,
    );
  }
  const fixtureChunkIds = new Set(expectedChunkIds);
  assert(
    assistantMessage.retrievedChunkIds.some((id) => fixtureChunkIds.has(id)),
    `${target.courseTitle} follow-up answer did not cite the requested primary document.`,
  );
  assert(
    assistantMessage.sourceLearningPathIds.length > 0 &&
      assistantMessage.sourceLearningPathIds.every((id) => id === target.courseId),
    `${target.courseTitle} follow-up answer cited a source outside its course scope.`,
  );
  return {
    distinguishedBridgeAndIsolatedSections: true,
    citedRetrievedContext: true,
    sourceScopeCorrect: true,
    answerCharacters: text.length,
    answerText: text,
  };
}

function summarizeSources(
  sources: Array<{ chunkId: string; score: number }>,
  fixtureChunkIds: string[],
) {
  const fixtureIds = new Set(fixtureChunkIds);
  return {
    count: sources.length,
    fixtureMatches: sources.filter((source) => fixtureIds.has(source.chunkId)).length,
    fixtureRanks: sources.flatMap((source, index) =>
      fixtureIds.has(source.chunkId)
        ? [{ rank: index + 1, score: Number(source.score.toFixed(4)) }]
        : [],
    ),
  };
}

function summarizeSse(turn: Awaited<ReturnType<typeof streamChat>>) {
  const eventTypes = turn.events.map((event) => event.type ?? "unknown");
  return {
    httpStatus: turn.status,
    durationMs: turn.durationMs,
    firstDeltaAtMs: turn.firstDeltaAtMs,
    completedAtMs: turn.completedAtMs,
    eventCounts: Object.fromEntries(
      [...new Set(eventTypes)].map((type) => [
        type,
        eventTypes.filter((candidate) => candidate === type).length,
      ]),
    ),
  };
}

async function summarizeProviderUsage(prisma: PrismaService, startedAt: Date) {
  const events = await prisma.providerUsageEvent.findMany({
    where: {
      createdAt: { gte: startedAt },
      feature: { in: [AiGenerationType.CHAT, AiGenerationType.EMBEDDING] },
    },
    orderBy: { createdAt: "asc" },
    select: {
      feature: true,
      operation: true,
      status: true,
      promptTokens: true,
      completionTokens: true,
      totalTokens: true,
      requestCount: true,
      estimatedCostUsd: true,
      costVnd: true,
      cacheStatus: true,
    },
  });
  return {
    eventCount: events.length,
    requestCount: events.reduce((sum, event) => sum + event.requestCount, 0),
    promptTokens: events.reduce((sum, event) => sum + event.promptTokens, 0),
    completionTokens: events.reduce((sum, event) => sum + event.completionTokens, 0),
    totalTokens: events.reduce((sum, event) => sum + event.totalTokens, 0),
    estimatedCostUsd: Number(
      events.reduce((sum, event) => sum + Number(event.estimatedCostUsd), 0).toFixed(8),
    ),
    costVnd: events.reduce((sum, event) => sum + event.costVnd, 0),
    events: events.map((event) => ({
      feature: event.feature,
      operation: event.operation,
      status: event.status,
      totalTokens: event.totalTokens,
      requestCount: event.requestCount,
      estimatedCostUsd: Number(event.estimatedCostUsd),
      costVnd: event.costVnd,
      cacheStatus: event.cacheStatus,
    })),
  };
}

async function cleanupFixture(
  prisma: PrismaService,
  storedFileCleanup: StoredFileCleanupService,
  ids: FixtureIds[],
  conversationIds: string[],
  backgroundJobIds: string[],
  enrollmentIds: string[],
  uploadedImageFileIds: string[],
) {
  if (conversationIds.length > 0) {
    await prisma.aiChatSession.deleteMany({
      where: { id: { in: conversationIds } },
    });
  }
  if (ids.length > 0) {
    await prisma.lessonDocument.deleteMany({
      where: { id: { in: ids.map((item) => item.lessonDocumentId) } },
    });
    await prisma.lessonDocumentPageRange.deleteMany({
      where: { id: { in: ids.map((item) => item.pageRangeId) } },
    });
    await prisma.sourceDocument.deleteMany({
      where: { id: { in: ids.map((item) => item.sourceDocumentId) } },
    });
  }
  if (backgroundJobIds.length > 0) {
    await prisma.backgroundJob.deleteMany({
      where: { id: { in: backgroundJobIds } },
    });
  }
  if (ids.length > 0) {
    await prisma.file.deleteMany({
      where: { id: { in: ids.map((item) => item.fileId) } },
    });
  }
  if (enrollmentIds.length > 0) {
    await prisma.enrollment.deleteMany({ where: { id: { in: enrollmentIds } } });
  }
  const stagedImageFileIds = await prisma.$transaction((transaction) =>
    storedFileCleanup.stageDetachedFigureFiles(transaction, uploadedImageFileIds),
  );
  const imageCleanup = await storedFileCleanup.deleteStagedFiles(stagedImageFileIds);
  return {
    completed: true,
    conversationsDeleted: conversationIds.length,
    jobsDeleted: [...new Set(backgroundJobIds)].length,
    fixturesDeleted: ids.length,
    enrollmentsDeleted: enrollmentIds.length,
    uploadedImages: uploadedImageFileIds.length,
    imageFilesStaged: stagedImageFileIds.length,
    ...imageCleanup,
  };
}

function assertIncludesEveryFixture(
  sources: Array<{ chunkId: string }>,
  documentChunkIds: string[][],
  label: string,
) {
  assert(
    documentChunkIds.every((chunkIds) => {
      const ids = new Set(chunkIds);
      return sources.some((source) => ids.has(source.chunkId));
    }),
    `${label} did not return a chunk from every primary fixture document (received ${sources.length}: ${sources
      .map((source) => source.chunkId)
      .join(", ")}).`,
  );
}

function assertIncludesAny(
  sources: Array<{ chunkId: string }>,
  expectedChunkIds: string[],
  label: string,
) {
  const ids = new Set(expectedChunkIds);
  assert(
    sources.some((source) => ids.has(source.chunkId)),
    `${label} did not return any expected chunk.`,
  );
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function readNumber(value: unknown, key: string) {
  const candidate = asRecord(value)?.[key];
  return typeof candidate === "number" ? candidate : 0;
}

function readString(value: unknown, key: string) {
  const candidate = asRecord(value)?.[key];
  return typeof candidate === "string" ? candidate : null;
}

function containsRatio(text: string, ratio: string) {
  const [numerator, denominator] = ratio.split("/");
  if (!numerator || !denominator) return false;
  const compact = text.replace(/\s+/g, "").toLocaleLowerCase("vi");
  return [
    `${numerator}/${denominator}`,
    `\\frac{${numerator}}{${denominator}}`,
    `\\dfrac{${numerator}}{${denominator}}`,
  ].some((candidate) => compact.includes(candidate));
}

function compactForVisualAssertion(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[₂]/g, "2")
    .replace(/\\(?:mathrm|text)\{([^}]*)\}/g, "$1")
    .replace(/[\s*_`$\\{}()[\],.:;-]/g, "")
    .toLocaleLowerCase("vi");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

void main();
