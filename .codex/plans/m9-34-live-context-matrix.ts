import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { config as loadEnv } from "dotenv";

loadEnv({
  path: fileURLToPath(new URL("../../apps/api/.env", import.meta.url)),
  quiet: true,
});

const baseUrl = process.env.M934_BASE_URL ?? "http://localhost:4000/api/v1";
const outputPath = process.env.M934_OUTPUT_PATH ?? "/tmp/m934-live-context-matrix.json";
const maxCostVnd = Number(process.env.M934_MAX_COST_VND ?? "12000");

if (process.env.M934_ALLOW_PAID_LIVE_TEST !== "1") {
  throw new Error("Set M934_ALLOW_PAID_LIVE_TEST=1 after explicit owner approval.");
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const QUIZ_LESSON_ID = "8572991a-76b7-4e3f-a866-1c63e75d7aad";
const VIDEO_FIXTURE_ID = "93400000-0000-4000-8000-000000000001";
const SUMMARY_FIXTURE_ID = "93400000-0000-4000-8000-000000000006";
const FLASHCARD_SET_FIXTURE_ID = "93400000-0000-4000-8000-000000000002";
const FLASHCARD_FIXTURE_ID = "93400000-0000-4000-8000-000000000003";
const TEST_SET_FIXTURE_ID = "93400000-0000-4000-8000-000000000004";
const TEST_QUESTION_FIXTURE_ID = "93400000-0000-4000-8000-000000000005";

type Surface = "VIDEO_SUMMARY" | "KNOWLEDGE" | "QUIZ" | "FLASHCARD" | "TEST";
type ActivityState = "UNANSWERED" | "ANSWER_REVEALED" | "IN_PROGRESS" | "SUBMITTED";
type ExpectedPolicy = "HINT_ONLY" | "FULL_ANSWER" | "BLOCKED";
type ExpectedAccess = "HINT_ONLY" | "FULL_CURRENT_TARGET" | "FULL_SCOPE";
type FixtureTarget = {
  id: string;
  lessonId: string;
  learningPathId: string;
};

type LiveCase = {
  id: string;
  thread: "quiz" | "flashcard" | "test" | "knowledge" | "video";
  learningPathId: string;
  lessonId: string;
  message: string;
  expectedPolicy: ExpectedPolicy;
  expectedAccess?: ExpectedAccess;
  simulationSurface?: Surface;
  activityState?: ActivityState;
  targetType?: "QUIZ_QUESTION" | "FLASHCARD" | "TEST_QUESTION";
  targetId?: string;
  blocked?: boolean;
};

type SseEvent = {
  type: string;
  conversationId?: string;
  userMessageId?: string;
  assistantMessageId?: string;
  policy?: ExpectedPolicy;
  message?: { id?: string; status?: string; text?: string } | string;
};

const startedAt = new Date();
const results: Array<Record<string, unknown>> = [];
const conversations = new Map<LiveCase["thread"], string>();
let createdVideoFixture = false;
let createdSummaryFixture = false;
let createdFlashcardFixture = false;
let createdTestFixture = false;

async function main() {
  try {
    await assertPreflight();
    await ensureSummaryFixture();
    await ensureVideoFixture();
    await ensureExerciseFixtures();
    const targets = await resolveTargets();
    const token = await login();
    const cases = buildCases(targets);

    for (const testCase of cases) {
      await assertCostCap();
      const conversationId = conversations.get(testCase.thread);
      const endpoint = conversationId
        ? `/admin/ai-chat/sessions/${conversationId}/messages/stream`
        : "/admin/ai-chat/sessions/messages/stream";
      const body = {
        ...(conversationId
          ? {}
          : {
              scopeType: "COURSE",
              learningPathIds: [testCase.learningPathId],
            }),
        surfaceLessonId: testCase.lessonId,
        message: testCase.message,
        attachmentFileIds: [],
        simulationSurface: testCase.simulationSurface,
        activityState: testCase.activityState,
        targetType: testCase.targetType,
        targetId: testCase.targetId,
      };
      const usageBefore = await usageCount();
      const messageCountBefore = conversationId
        ? await prisma.aiChatMessage.count({ where: { sessionId: conversationId } })
        : 0;
      const requestStartedAt = performance.now();
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(180_000),
      });

      if (testCase.blocked) {
        const payload = await response.json();
        const usageAfter = await usageCount();
        const messageCountAfter = conversationId
          ? await prisma.aiChatMessage.count({ where: { sessionId: conversationId } })
          : 0;
        const code = payload?.error?.code ?? payload?.code ?? null;
        const pass =
          response.status === 403 &&
          code === "AI_CHAT_BLOCKED_DURING_TEST" &&
          usageAfter === usageBefore &&
          messageCountAfter === messageCountBefore;
        results.push({
          id: testCase.id,
          httpStatus: response.status,
          code,
          expectedPolicy: testCase.expectedPolicy,
          providerUsageDelta: usageAfter - usageBefore,
          messageDelta: messageCountAfter - messageCountBefore,
          durationMs: Math.round(performance.now() - requestStartedAt),
          pass,
        });
        await checkpoint();
        process.stdout.write(`${testCase.id}\tBLOCKED\t${pass ? "PASS" : "FAIL"}\n`);
        continue;
      }

      const events = await readSse(response);
      const started = events.find((event) => event.type === "started");
      const completed = events.findLast((event) => event.type === "completed");
      const resultConversationId = completed?.conversationId ?? started?.conversationId;
      if (resultConversationId) {
        conversations.set(testCase.thread, resultConversationId);
      }
      const assistantMessageId = started?.assistantMessageId;
      const trace =
        resultConversationId && assistantMessageId
          ? await getTrace(token, resultConversationId, assistantMessageId)
          : null;
      const simulationContext = asRecord(
        asRecord(trace?.scopeSnapshot)?.simulationContext,
      );
      const expectedSurface = testCase.simulationSurface ?? null;
      const actualSurface = simulationContext?.surface ?? null;
      const actualAccess = simulationContext?.answerAccess ?? null;
      const usageOperations = Array.isArray(trace?.usageEvents)
        ? trace.usageEvents.map((event: { operation?: string }) => event.operation)
        : [];
      const pass =
        response.ok &&
        started?.policy === testCase.expectedPolicy &&
        completed?.message &&
        typeof completed.message !== "string" &&
        completed.message.status === "COMPLETED" &&
        trace?.generation?.status === "SUCCEEDED" &&
        actualSurface === expectedSurface &&
        actualAccess === testCase.expectedAccess &&
        usageOperations.includes("EMBEDDING_GENERATION") &&
        usageOperations.includes("CHAT_RESPONSE_GENERATION");
      results.push({
        id: testCase.id,
        httpStatus: response.status,
        expectedPolicy: testCase.expectedPolicy,
        policy: started?.policy ?? null,
        expectedSurface,
        surface: actualSurface,
        expectedAccess: testCase.expectedAccess,
        answerAccess: actualAccess,
        activityState: simulationContext?.activityState ?? null,
        targetType: simulationContext?.targetType ?? null,
        targetId: simulationContext?.targetId ?? null,
        status:
          completed?.message && typeof completed.message !== "string"
            ? (completed.message.status ?? null)
            : null,
        answer:
          completed?.message && typeof completed.message !== "string"
            ? (completed.message.text ?? null)
            : null,
        usageOperations,
        totalCostVnd: trace?.aggregate?.totalCostVnd ?? null,
        totalTokens: trace?.aggregate?.totalTokens ?? null,
        latencyMs: trace?.generation?.latencyMs ?? null,
        durationMs: Math.round(performance.now() - requestStartedAt),
        pass,
      });
      await checkpoint();
      process.stdout.write(
        `${testCase.id}\t${started?.policy ?? "-"}\t${String(
          trace?.aggregate?.totalCostVnd ?? "-",
        )} VND\t${pass ? "PASS" : "FAIL"}\n`,
      );
    }

    await checkpoint({ usage: await readUsage() });
    if (results.some((result) => result.pass !== true)) {
      process.exitCode = 1;
    }
  } finally {
    if (createdTestFixture) {
      await prisma.testSet.deleteMany({ where: { id: TEST_SET_FIXTURE_ID } });
    }
    if (createdFlashcardFixture) {
      await prisma.flashcardSet.deleteMany({
        where: { id: FLASHCARD_SET_FIXTURE_ID },
      });
    }
    if (createdVideoFixture) {
      await prisma.lessonVideoSummary.deleteMany({ where: { id: VIDEO_FIXTURE_ID } });
    }
    if (createdSummaryFixture) {
      await prisma.lessonSummary.deleteMany({ where: { id: SUMMARY_FIXTURE_ID } });
    }
    await prisma.$disconnect();
  }
}

function buildCases(targets: {
  quizQuestion: FixtureTarget;
  flashcard: FixtureTarget;
  testQuestion: FixtureTarget;
  knowledge: Omit<FixtureTarget, "id">;
  video: Omit<FixtureTarget, "id">;
}): LiveCase[] {
  const quizScope = {
    thread: "quiz" as const,
    learningPathId: targets.quizQuestion.learningPathId,
    lessonId: targets.quizQuestion.lessonId,
  };
  const flashcardScope = {
    thread: "flashcard" as const,
    learningPathId: targets.flashcard.learningPathId,
    lessonId: targets.flashcard.lessonId,
  };
  const testScope = {
    thread: "test" as const,
    learningPathId: targets.testQuestion.learningPathId,
    lessonId: targets.testQuestion.lessonId,
  };
  const knowledgeScope = {
    thread: "knowledge" as const,
    ...targets.knowledge,
  };
  const videoScope = {
    thread: "video" as const,
    ...targets.video,
  };
  return [
    {
      ...quizScope,
      id: "LESSON-FULL",
      message: "Tóm tắt ngắn nội dung chính của buổi học này.",
      expectedPolicy: "FULL_ANSWER",
      expectedAccess: "FULL_SCOPE",
    },
    {
      ...quizScope,
      id: "QUIZ-HINT",
      message: "Em chưa kiểm tra câu này. Hãy cho một gợi ý, không nêu đáp án.",
      expectedPolicy: "HINT_ONLY",
      expectedAccess: "HINT_ONLY",
      simulationSurface: "QUIZ",
      activityState: "UNANSWERED",
      targetType: "QUIZ_QUESTION",
      targetId: targets.quizQuestion.id,
    },
    {
      ...quizScope,
      id: "QUIZ-FULL",
      message: "Em đã mở đáp án. Hãy nêu đáp án đúng và giải thích ngắn.",
      expectedPolicy: "FULL_ANSWER",
      expectedAccess: "FULL_CURRENT_TARGET",
      simulationSurface: "QUIZ",
      activityState: "ANSWER_REVEALED",
      targetType: "QUIZ_QUESTION",
      targetId: targets.quizQuestion.id,
    },
    {
      ...quizScope,
      id: "QUIZ-SUBMITTED",
      message: "Em đã hoàn thành bộ quiz. Hãy giải thích đầy đủ câu hỏi này.",
      expectedPolicy: "FULL_ANSWER",
      expectedAccess: "FULL_SCOPE",
      simulationSurface: "QUIZ",
      activityState: "SUBMITTED",
      targetType: "QUIZ_QUESTION",
      targetId: targets.quizQuestion.id,
    },
    {
      ...flashcardScope,
      id: "FLASHCARD-HINT",
      message: "Em chưa mở mặt sau. Hãy gợi ý để em tự nhớ.",
      expectedPolicy: "HINT_ONLY",
      expectedAccess: "HINT_ONLY",
      simulationSurface: "FLASHCARD",
      activityState: "UNANSWERED",
      targetType: "FLASHCARD",
      targetId: targets.flashcard.id,
    },
    {
      ...flashcardScope,
      id: "FLASHCARD-FULL",
      message: "Em đã mở mặt sau. Hãy giải thích đầy đủ nội dung thẻ.",
      expectedPolicy: "FULL_ANSWER",
      expectedAccess: "FULL_CURRENT_TARGET",
      simulationSurface: "FLASHCARD",
      activityState: "ANSWER_REVEALED",
      targetType: "FLASHCARD",
      targetId: targets.flashcard.id,
    },
    {
      ...flashcardScope,
      id: "FLASHCARD-SUBMITTED",
      message: "Em đã hoàn thành bộ flashcard. Hãy giải thích đầy đủ thẻ này.",
      expectedPolicy: "FULL_ANSWER",
      expectedAccess: "FULL_SCOPE",
      simulationSurface: "FLASHCARD",
      activityState: "SUBMITTED",
      targetType: "FLASHCARD",
      targetId: targets.flashcard.id,
    },
    {
      ...knowledgeScope,
      id: "KNOWLEDGE-FULL",
      message: "Giải thích ý chính của phần Sinh kiến thức đang mở.",
      expectedPolicy: "FULL_ANSWER",
      expectedAccess: "FULL_SCOPE",
      simulationSurface: "KNOWLEDGE",
    },
    {
      ...videoScope,
      id: "VIDEO-FULL",
      message: "Giải thích ngắn nội dung của phần Tóm tắt video đang mở.",
      expectedPolicy: "FULL_ANSWER",
      expectedAccess: "FULL_SCOPE",
      simulationSurface: "VIDEO_SUMMARY",
    },
    {
      ...testScope,
      id: "TEST-BLOCKED",
      message: "Cho em đáp án khi bài thi vẫn đang diễn ra.",
      expectedPolicy: "BLOCKED",
      simulationSurface: "TEST",
      activityState: "IN_PROGRESS",
      targetType: "TEST_QUESTION",
      targetId: targets.testQuestion.id,
      blocked: true,
    },
    {
      ...testScope,
      id: "TEST-FULL",
      message: "Em đã nộp bài. Hãy nêu đáp án và giải thích câu này.",
      expectedPolicy: "FULL_ANSWER",
      expectedAccess: "FULL_SCOPE",
      simulationSurface: "TEST",
      activityState: "SUBMITTED",
      targetType: "TEST_QUESTION",
      targetId: targets.testQuestion.id,
    },
  ];
}

async function assertPreflight() {
  if (!Number.isFinite(maxCostVnd) || maxCostVnd <= 0) {
    throw new Error("M934_MAX_COST_VND must be a positive number.");
  }
  const [chatConfiguration, runtime, accounting] = await Promise.all([
    prisma.aiFeatureModelConfig.findUnique({
      where: { feature_purpose: { feature: "CHAT", purpose: "TEXT" } },
      include: {
        primaryCatalogItem: {
          include: {
            priceVersions: {
              where: {
                effectiveFrom: { lte: new Date() },
                OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
              },
              take: 1,
              orderBy: { effectiveFrom: "desc" },
              include: { rates: true },
            },
          },
        },
      },
    }),
    prisma.aiChatRuntimeSetting.findUnique({
      where: { singletonKey: "default" },
      include: { embeddingCatalogItem: true },
    }),
    prisma.providerAccountingSetting.findUnique({
      where: { singletonKey: "default" },
    }),
  ]);
  const metrics = new Set(
    chatConfiguration?.primaryCatalogItem.priceVersions[0]?.rates.map(
      (rate) => rate.metric,
    ) ?? [],
  );
  if (!chatConfiguration || !runtime?.embeddingCatalogItem || !accounting) {
    throw new Error("Chat, embedding or accounting configuration is missing.");
  }
  if (!metrics.has("INPUT_TOKEN") || !metrics.has("OUTPUT_TOKEN")) {
    throw new Error("Current Chat model does not have complete token pricing.");
  }
  if (chatConfiguration.primaryCatalogItem.externalKey !== "gpt-5.6-luna") {
    throw new Error(
      `Live matrix requires gpt-5.6-luna, received ${chatConfiguration.primaryCatalogItem.externalKey}.`,
    );
  }
  process.stdout.write(
    `Preflight: ${chatConfiguration.primaryCatalogItem.externalKey}, ` +
      `${runtime.embeddingCatalogItem.externalKey}, cap ${maxCostVnd} VND\n`,
  );
}

async function ensureVideoFixture() {
  const visible = await prisma.lessonVideoSummary.findFirst({
    where: {
      reviewStatus: "APPROVED",
      staleAt: null,
      deletedAt: null,
      lesson: { deletedAt: null, learningPath: { deletedAt: null } },
    },
    select: { id: true },
  });
  if (visible) return;
  const lesson = await prisma.lesson.findFirst({
    where: {
      deletedAt: null,
      learningPath: { deletedAt: null },
      videoSummary: null,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  if (!lesson) throw new Error("No eligible lesson for temporary video fixture.");
  await prisma.lessonVideoSummary.create({
    data: {
      id: VIDEO_FIXTURE_ID,
      lessonId: lesson.id,
      source: "ADMIN",
      reviewStatus: "APPROVED",
      contentJson: {
        title: "Live fixture tóm tắt video",
        blocks: [{ type: "PARAGRAPH", text: "Ôn tập số hữu tỉ." }],
      },
    },
  });
  createdVideoFixture = true;
}

async function ensureSummaryFixture() {
  const visible = await prisma.lessonSummary.findFirst({
    where: {
      reviewStatus: "APPROVED",
      deletedAt: null,
      lesson: { deletedAt: null, learningPath: { deletedAt: null } },
    },
    select: { id: true },
  });
  if (visible) return;
  const lesson = await prisma.lesson.findFirst({
    where: {
      deletedAt: null,
      learningPath: { deletedAt: null },
      summary: null,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  if (!lesson) throw new Error("No eligible lesson for temporary summary fixture.");
  await prisma.lessonSummary.create({
    data: {
      id: SUMMARY_FIXTURE_ID,
      lessonId: lesson.id,
      source: "ADMIN",
      reviewStatus: "APPROVED",
      contentJson: {
        title: "Live fixture kiến thức",
        blocks: [
          {
            type: "PARAGRAPH",
            text: "Tứ giác nội tiếp có tổng hai góc đối bằng 180 độ.",
          },
        ],
      },
    },
  });
  createdSummaryFixture = true;
}

async function ensureExerciseFixtures() {
  const [flashcard, testQuestion] = await Promise.all([
    prisma.flashcard.findFirst({
      where: {
        deletedAt: null,
        reviewStatus: "APPROVED",
        publishedAt: { not: null },
        flashcardSet: {
          deletedAt: null,
          isReserve: false,
          reviewStatus: "APPROVED",
        },
        lesson: { deletedAt: null, learningPath: { deletedAt: null } },
      },
      select: { id: true },
    }),
    prisma.testQuestion.findFirst({
      where: {
        deletedAt: null,
        reviewStatus: "APPROVED",
        publishedAt: { not: null },
        testSet: { deletedAt: null, isReserve: false, reviewStatus: "APPROVED" },
        lesson: { deletedAt: null, learningPath: { deletedAt: null } },
      },
      select: { id: true },
    }),
  ]);

  if (!flashcard) {
    await prisma.flashcardSet.create({
      data: {
        id: FLASHCARD_SET_FIXTURE_ID,
        lessonId: QUIZ_LESSON_ID,
        title: "Live fixture - Flashcard Chat AI",
        reviewStatus: "APPROVED",
        cardCount: 1,
        flashcards: {
          create: {
            id: FLASHCARD_FIXTURE_ID,
            lessonId: QUIZ_LESSON_ID,
            frontJson: { text: "Số hữu tỉ là gì?" },
            backJson: {
              text: "Số hữu tỉ là số viết được dưới dạng a/b với a, b là số nguyên và b khác 0.",
            },
            hintJson: { text: "Hãy nhớ dạng phân số của hai số nguyên." },
            reviewStatus: "APPROVED",
            publishedAt: new Date(),
          },
        },
      },
    });
    createdFlashcardFixture = true;
  }

  if (!testQuestion) {
    await prisma.testSet.create({
      data: {
        id: TEST_SET_FIXTURE_ID,
        lessonId: QUIZ_LESSON_ID,
        title: "Live fixture - Bài thi Chat AI",
        durationSeconds: 600,
        reviewStatus: "APPROVED",
        questionCount: 1,
        questions: {
          create: {
            id: TEST_QUESTION_FIXTURE_ID,
            lessonId: QUIZ_LESSON_ID,
            questionType: "MULTIPLE_CHOICE",
            questionJson: { text: "Kết quả của 2 + 3 là bao nhiêu?" },
            optionsJson: [
              { id: "A", text: "4" },
              { id: "B", text: "5" },
            ],
            correctAnswerJson: ["B"],
            hintJson: { text: "Hãy đếm thêm 3 đơn vị từ số 2." },
            reviewStatus: "APPROVED",
            publishedAt: new Date(),
          },
        },
      },
    });
    createdTestFixture = true;
  }
}

async function resolveTargets() {
  const [quizQuestion, flashcard, testQuestion, knowledge, video] = await Promise.all([
    prisma.quizQuestion.findFirst({
      where: {
        deletedAt: null,
        reviewStatus: "APPROVED",
        publishedAt: { not: null },
        quizSet: { deletedAt: null, isReserve: false, reviewStatus: "APPROVED" },
        lesson: { deletedAt: null, learningPath: { deletedAt: null } },
      },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        id: true,
        lesson: { select: { id: true, learningPathId: true } },
      },
    }),
    prisma.flashcard.findFirst({
      where: {
        deletedAt: null,
        reviewStatus: "APPROVED",
        publishedAt: { not: null },
        flashcardSet: {
          deletedAt: null,
          isReserve: false,
          reviewStatus: "APPROVED",
        },
        lesson: { deletedAt: null, learningPath: { deletedAt: null } },
      },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        id: true,
        lesson: { select: { id: true, learningPathId: true } },
      },
    }),
    prisma.testQuestion.findFirst({
      where: {
        deletedAt: null,
        reviewStatus: "APPROVED",
        publishedAt: { not: null },
        testSet: { deletedAt: null, isReserve: false, reviewStatus: "APPROVED" },
        lesson: { deletedAt: null, learningPath: { deletedAt: null } },
      },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        id: true,
        lesson: { select: { id: true, learningPathId: true } },
      },
    }),
    prisma.lessonSummary.findFirst({
      where: {
        deletedAt: null,
        reviewStatus: "APPROVED",
        lesson: { deletedAt: null, learningPath: { deletedAt: null } },
      },
      select: {
        lesson: { select: { id: true, learningPathId: true } },
      },
    }),
    prisma.lessonVideoSummary.findFirst({
      where: {
        deletedAt: null,
        staleAt: null,
        reviewStatus: "APPROVED",
        lesson: { deletedAt: null, learningPath: { deletedAt: null } },
      },
      select: {
        lesson: { select: { id: true, learningPathId: true } },
      },
    }),
  ]);
  if (!quizQuestion || !flashcard || !testQuestion || !knowledge || !video) {
    throw new Error(
      `Student-visible fixture missing: quiz=${Boolean(quizQuestion)}, ` +
        `flashcard=${Boolean(flashcard)}, test=${Boolean(testQuestion)}, ` +
        `knowledge=${Boolean(knowledge)}, video=${Boolean(video)}.`,
    );
  }
  return {
    quizQuestion: {
      id: quizQuestion.id,
      lessonId: quizQuestion.lesson.id,
      learningPathId: quizQuestion.lesson.learningPathId,
    },
    flashcard: {
      id: flashcard.id,
      lessonId: flashcard.lesson.id,
      learningPathId: flashcard.lesson.learningPathId,
    },
    testQuestion: {
      id: testQuestion.id,
      lessonId: testQuestion.lesson.id,
      learningPathId: testQuestion.lesson.learningPathId,
    },
    knowledge: {
      lessonId: knowledge.lesson.id,
      learningPathId: knowledge.lesson.learningPathId,
    },
    video: {
      lessonId: video.lesson.id,
      learningPathId: video.lesson.learningPathId,
    },
  };
}

async function login() {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: process.env.M934_ADMIN_IDENTIFIER ?? "admin",
      password: process.env.M934_ADMIN_PASSWORD ?? "123456",
    }),
  });
  const payload = await response.json();
  if (!response.ok || typeof payload?.data?.accessToken !== "string") {
    throw new Error(`Admin login failed: HTTP ${response.status}`);
  }
  return payload.data.accessToken as string;
}

async function getTrace(token: string, conversationId: string, messageId: string) {
  const response = await fetch(
    `${baseUrl}/admin/ai-chat/sessions/${conversationId}/messages/${messageId}/trace`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const payload = await response.json();
  if (!response.ok) throw new Error(`Trace failed: HTTP ${response.status}`);
  return payload.data;
}

async function readSse(response: Response) {
  const raw = await response.text();
  return raw
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice(6)) as SseEvent);
}

async function usageCount() {
  return prisma.providerUsageEvent.count({ where: { createdAt: { gte: startedAt } } });
}

async function assertCostCap() {
  const aggregate = await prisma.providerUsageEvent.aggregate({
    where: { createdAt: { gte: startedAt } },
    _sum: { costVnd: true },
  });
  if ((aggregate._sum.costVnd ?? 0) >= maxCostVnd) {
    throw new Error(`Paid live-test cap ${maxCostVnd} VND reached.`);
  }
}

async function readUsage() {
  const usage = await prisma.providerUsageEvent.findMany({
    where: { createdAt: { gte: startedAt } },
    orderBy: { createdAt: "asc" },
    select: {
      operation: true,
      provider: true,
      status: true,
      promptTokens: true,
      completionTokens: true,
      totalTokens: true,
      costVnd: true,
      latencyMs: true,
      catalogItem: { select: { externalKey: true } },
    },
  });
  return usage.map((event) => ({
    operation: event.operation,
    provider: event.provider,
    model: event.catalogItem?.externalKey ?? null,
    status: event.status,
    promptTokens: event.promptTokens,
    completionTokens: event.completionTokens,
    totalTokens: event.totalTokens,
    costVnd: event.costVnd,
    latencyMs: event.latencyMs,
  }));
}

async function checkpoint(extra: Record<string, unknown> = {}) {
  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        startedAt: startedAt.toISOString(),
        maxCostVnd,
        conversations: Object.fromEntries(conversations),
        results,
        ...extra,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
