import {
  AiChatMessageRole,
  AiChatMessageStatus,
  AiChatResponsePolicy,
  AiChatScopeType,
  AiGenerationType,
  AiModelPurpose,
  AiProviderName,
  ProviderCatalogCategory,
  ProviderCatalogStatus,
  ReviewStatus,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { AiProviderCallService } from "#api/modules/ai/services/ai-provider-call.service";
import { AdminAiChatAccessService } from "#api/modules/ai-chat/services/admin-ai-chat-access.service";
import { AiChatRetrievalService } from "#api/modules/ai-chat/services/ai-chat-retrieval.service";
import {
  AiChatService,
  resolveAdminSimulationContext,
  sanitizeTraceJson,
} from "#api/modules/ai-chat/services/ai-chat.service";
import { resolveAiChatActivityPolicy } from "#api/modules/ai-chat/utils/ai-chat-activity-policy";
import { AiModelRoutingService } from "#api/modules/provider-operations/services/ai-model-routing.service";
import { AiChatRuntimeSettingsService } from "#api/modules/provider-operations/services/ai-chat-runtime-settings.service";

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PATH_ID = "22222222-2222-4222-8222-222222222222";
const SECOND_PATH_ID = "77777777-7777-4777-8777-777777777777";
const LESSON_ID = "33333333-3333-4333-8333-333333333333";
const GENERATION_ID = "44444444-4444-4444-8444-444444444444";
const TEST_QUESTION_ID = "88888888-8888-4888-8888-888888888888";

describe("M9.34 Admin Chat AI simulation", () => {
  it("uses one activity-state policy table for Student Chat and Admin simulation", () => {
    expect(resolveAiChatActivityPolicy({ kind: "QUIZ", state: "UNANSWERED" })).toEqual({
      policy: AiChatResponsePolicy.HINT_ONLY,
      answerAccess: "HINT_ONLY",
    });
    expect(
      resolveAiChatActivityPolicy({
        kind: "FLASHCARD",
        state: "ANSWER_REVEALED",
      }),
    ).toEqual({
      policy: AiChatResponsePolicy.FULL_ANSWER,
      answerAccess: "FULL_CURRENT_TARGET",
    });
    expect(resolveAiChatActivityPolicy({ kind: "TEST", state: "IN_PROGRESS" })).toEqual({
      policy: AiChatResponsePolicy.BLOCKED,
      answerAccess: "BLOCKED",
    });
    expect(resolveAiChatActivityPolicy({ kind: "TEST", state: "SUBMITTED" })).toEqual({
      policy: AiChatResponsePolicy.FULL_ANSWER,
      answerAccess: "FULL_SCOPE",
    });
    expect(resolveAiChatActivityPolicy({ kind: "QUIZ", state: "SUBMITTED" })).toEqual({
      policy: AiChatResponsePolicy.FULL_ANSWER,
      answerAccess: "FULL_SCOPE",
    });
    expect(
      resolveAiChatActivityPolicy({ kind: "FLASHCARD", state: "SUBMITTED" }),
    ).toEqual({
      policy: AiChatResponsePolicy.FULL_ANSWER,
      answerAccess: "FULL_SCOPE",
    });
    expect(resolveAiChatActivityPolicy({ kind: "TEST", state: "UNANSWERED" })).toBeNull();
  });

  it("returns the authoritative total provider cost for the whole Admin chat session", async () => {
    const aggregate = vi.fn(async () => ({ _sum: { costVnd: 2_475 } }));
    const findFirst = vi.fn(async () => ({
      contentJson: { text: "Giải thích định lý Pythagoras" },
      status: AiChatMessageStatus.COMPLETED,
      surfaceLessonId: LESSON_ID,
    }));
    const service = new AiChatService(
      {
        providerUsageEvent: { aggregate },
        aiChatMessage: { findFirst },
      } as never,
      {} as never,
      {} as never,
      {
        resolveConversation: vi.fn(async () => ({
          session: {
            id: SESSION_ID,
            scopeType: AiChatScopeType.LESSON,
            title: "Định lý Pythagoras",
            configurationVersion: 1,
            configurationOverrideJson: null,
            lastMessageAt: new Date("2026-09-14T07:30:00.000Z"),
            createdAt: new Date("2026-09-14T07:00:00.000Z"),
            updatedAt: new Date("2026-09-14T07:30:00.000Z"),
            scopeItems: [
              {
                learningPathId: PATH_ID,
                lessonId: LESSON_ID,
                learningPath: { title: "Toán 9" },
                lesson: { title: "Định lý Pythagoras" },
              },
            ],
          },
          access: { label: "Toán 9 / Định lý Pythagoras" },
        })),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.getAdminSession(ADMIN_ID, SESSION_ID)).resolves.toMatchObject({
      id: SESSION_ID,
      totalCostVnd: 2_475,
      lastSurfaceLessonId: LESSON_ID,
    });
    expect(aggregate).toHaveBeenCalledWith({
      where: {
        aiGeneration: {
          is: {
            type: AiGenerationType.CHAT,
            targetId: SESSION_ID,
            targetType: {
              in: ["AI_CHAT_SESSION", "AI_CHAT_SESSION_TITLE"],
            },
          },
        },
      },
      _sum: { costVnd: true },
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: { sessionId: SESSION_ID },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { contentJson: true, status: true, surfaceLessonId: true },
    });
  });

  it("returns cost, TTFT and completion latency with each Admin response", async () => {
    const findMany = vi.fn(async () => [
      {
        id: GENERATION_ID,
        role: AiChatMessageRole.ASSISTANT,
        status: AiChatMessageStatus.COMPLETED,
        responsePolicy: AiChatResponsePolicy.FULL_ANSWER,
        contentJson: { text: "Bình phương cạnh huyền bằng tổng hai bình phương." },
        errorCode: null,
        sourceLearningPathIds: [PATH_ID],
        contextJson: { sources: [] },
        attachments: [],
        turnTraceAsAssistant: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
        aiGeneration: {
          latencyMs: 950,
          providerUsageEvents: [
            {
              operation: "EMBEDDING_GENERATION",
              costVnd: 50,
              rawUsageJson: null,
            },
            {
              operation: "CHAT_RESPONSE_GENERATION",
              costVnd: 1_200,
              rawUsageJson: { timeToFirstTokenMs: 180 },
            },
          ],
        },
        createdAt: new Date("2026-09-14T07:30:00.000Z"),
        updatedAt: new Date("2026-09-14T07:30:01.000Z"),
      },
    ]);
    const service = new AiChatService(
      { aiChatMessage: { findMany } } as never,
      {} as never,
      {} as never,
      { resolveConversation: vi.fn(async () => ({})) } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.listAdminMessages(ADMIN_ID, SESSION_ID, { limit: 50 }),
    ).resolves.toMatchObject({
      items: [
        {
          turnMetrics: {
            totalCostVnd: 1_250,
            timeToFirstTokenMs: 180,
            responseLatencyMs: 950,
          },
        },
      ],
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionId: SESSION_ID },
        include: expect.objectContaining({
          aiGeneration: expect.any(Object),
        }),
      }),
    );
  });

  it("simulates a Student lesson surface without narrowing the course scope", () => {
    const scope = {
      scopeType: AiChatScopeType.COURSE,
      learningPathId: PATH_ID,
      learningPathIds: [PATH_ID],
      label: "Toán 9",
    };

    expect(
      resolveAdminSimulationContext(
        {
          scopeType: AiChatScopeType.COURSE,
          learningPathIds: [PATH_ID],
          surfaceLessonId: LESSON_ID,
          message: "Cho tôi một gợi ý",
          attachmentFileIds: [],
          simulationSurface: "QUIZ",
          activityState: "UNANSWERED",
          targetType: "QUIZ_QUESTION",
          targetId: "55555555-5555-4555-8555-555555555555",
        },
        scope,
        LESSON_ID,
      ),
    ).toEqual({
      simulationSurface: "QUIZ",
      activityState: "UNANSWERED",
      targetType: "QUIZ_QUESTION",
      targetId: "55555555-5555-4555-8555-555555555555",
      policy: AiChatResponsePolicy.HINT_ONLY,
      answerAccess: "HINT_ONLY",
    });

    expect(() =>
      resolveAdminSimulationContext(
        {
          scopeType: AiChatScopeType.COURSE,
          learningPathIds: [PATH_ID],
          message: "Cho tôi một gợi ý",
          attachmentFileIds: [],
          simulationSurface: "QUIZ",
          activityState: "UNANSWERED",
          targetType: "QUIZ_QUESTION",
          targetId: "55555555-5555-4555-8555-555555555555",
        },
        scope,
      ),
    ).toThrow(/chọn buổi học hiện tại/iu);
  });

  it("lists only Student-visible lesson context without exposing approved answers", async () => {
    const findFirst = vi.fn(async () => ({
      id: LESSON_ID,
      summary: {
        id: "summary",
        reviewStatus: ReviewStatus.APPROVED,
        deletedAt: null,
      },
      videoSummary: {
        id: "video-summary",
        reviewStatus: ReviewStatus.APPROVED,
        staleAt: null,
        deletedAt: null,
      },
      quizSets: [
        {
          id: "quiz-set",
          title: "Bộ quiz chính",
          questions: [
            {
              id: "quiz-question",
              questionType: "SINGLE_CHOICE",
              questionJson: { text: "Cạnh huyền là cạnh nào?" },
              difficulty: "EASY",
              sortOrder: 0,
            },
          ],
        },
      ],
      flashcardSets: [],
      testSets: [],
    }));
    const service = new AdminAiChatAccessService({ lesson: { findFirst } } as never);

    await expect(service.listLessonSimulationContext(LESSON_ID)).resolves.toEqual({
      lessonId: LESSON_ID,
      surfaces: {
        videoSummary: { available: true },
        knowledge: { available: true },
      },
      quizSets: [
        {
          id: "quiz-set",
          title: "Bộ quiz chính",
          questions: [
            {
              id: "quiz-question",
              questionType: "SINGLE_CHOICE",
              questionJson: { text: "Cạnh huyền là cạnh nào?" },
              difficulty: "EASY",
              sortOrder: 0,
            },
          ],
        },
      ],
      flashcardSets: [],
      testSets: [],
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          quizSets: expect.objectContaining({
            where: expect.objectContaining({
              deletedAt: null,
              isReserve: false,
              reviewStatus: ReviewStatus.APPROVED,
            }),
            select: expect.objectContaining({
              questions: expect.objectContaining({
                where: expect.objectContaining({
                  deletedAt: null,
                  reviewStatus: ReviewStatus.APPROVED,
                  publishedAt: { not: null },
                }),
              }),
            }),
          }),
        }),
      }),
    );
  });

  it("blocks an in-progress Test simulation before attachments, persistence, retrieval or provider work", async () => {
    const attachments = { validateAndPrepare: vi.fn() };
    const retrieval = { retrieve: vi.fn() };
    const transaction = vi.fn();
    const targetLookup = vi.fn(async () => ({
      id: TEST_QUESTION_ID,
      lesson: { id: LESSON_ID, learningPathId: PATH_ID },
      questionJson: { text: "Tính cạnh huyền." },
      optionsJson: null,
      hintJson: null,
      correctAnswerJson: { text: "5" },
      explanation: null,
    }));
    const service = new AiChatService(
      {
        lesson: {
          findMany: vi.fn(async () => [
            {
              id: LESSON_ID,
              title: "Định lý Pythagoras",
              learningPathId: PATH_ID,
              customVideoSettings: null,
              learningPath: { title: "Toán 9" },
            },
          ]),
        },
        testQuestion: {
          findFirst: targetLookup,
        },
        $transaction: transaction,
      } as never,
      {} as never,
      {} as never,
      {
        resolveNewScope: vi.fn(async () => ({
          access: {
            scopeType: AiChatScopeType.LESSON,
            learningPathId: PATH_ID,
            learningPathIds: [PATH_ID],
            lessonIds: [LESSON_ID],
            label: "Toán 9 / Định lý Pythagoras",
          },
          items: [{ learningPathId: PATH_ID, lessonId: LESSON_ID, sortOrder: 0 }],
        })),
      } as never,
      {} as never,
      retrieval as never,
      attachments as never,
      {} as never,
      {} as never,
      {} as never,
      { resolveChatOverride: vi.fn(async () => ({})) } as never,
      {} as never,
      { get: vi.fn(async () => ({})) } as never,
    );

    await expect(
      service.prepareAdminTurn(ADMIN_ID, {
        scopeType: AiChatScopeType.LESSON,
        learningPathIds: [PATH_ID],
        lessonId: LESSON_ID,
        message: "Gợi ý đáp án",
        attachmentFileIds: [],
        simulationSurface: "TEST",
        activityState: "IN_PROGRESS",
        targetType: "TEST_QUESTION",
        targetId: TEST_QUESTION_ID,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "AI_CHAT_BLOCKED_DURING_TEST" }),
    });
    expect(attachments.validateAndPrepare).not.toHaveBeenCalled();
    expect(retrieval.retrieve).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
    expect(targetLookup).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: TEST_QUESTION_ID,
          deletedAt: null,
          reviewStatus: ReviewStatus.APPROVED,
          publishedAt: { not: null },
        },
      }),
    );
  });

  it("keeps embedding, image limits and successful daily quotas in a separate Chat runtime setting", async () => {
    const runtime = new AiChatRuntimeSettingsService(
      {
        aiChatRuntimeSetting: {
          findUnique: vi.fn(async () => ({
            embeddingCatalogItemId: "99999999-9999-4999-8999-999999999999",
            embeddingCatalogItem: {
              id: "99999999-9999-4999-8999-999999999999",
              provider: AiProviderName.OPENAI,
              externalKey: "text-embedding-3-small",
              status: ProviderCatalogStatus.ACTIVE,
              capabilitiesJson: {
                features: ["EMBEDDING"],
                dimensions: [1536],
              },
            },
            maxImagesPerMessage: 3,
            maxImageBytes: BigInt(2 * 1024 * 1024),
            allowedImageMimeTypes: ["image/jpeg", "image/png"],
            studentDailyMessageLimit: 9,
            studentDailyImageLimit: 12,
            version: 4,
          })),
        },
      } as never,
      {
        get: vi.fn((key: string) =>
          key === "OPENAI_EMBEDDING_DIMENSIONS" ? 1536 : "fallback",
        ),
      } as never,
    );

    await expect(runtime.get()).resolves.toMatchObject({
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: 1536,
      maxImagesPerMessage: 3,
      maxImageBytes: 2 * 1024 * 1024,
      allowedImageMimeTypes: ["image/jpeg", "image/png"],
      studentDailyMessageLimit: 9,
      studentDailyImageLimit: 12,
      version: 4,
    });
  });

  it("reports daily usage only from quota timestamps written after successful AI responses", async () => {
    const messageCount = vi.fn(async () => 4);
    const imageCount = vi.fn(async () => 7);
    const service = new AiChatService(
      {
        aiChatMessage: { count: messageCount },
        aiChatMessageAttachment: { count: imageCount },
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {
        get: vi.fn(async () => ({
          studentDailyMessageLimit: 10,
          studentDailyImageLimit: 12,
        })),
      } as never,
    );

    await expect(service.getRuntimeSettings(ADMIN_ID)).resolves.toMatchObject({
      studentDailyMessageUsed: 4,
      studentDailyMessageRemaining: 6,
      studentDailyImageUsed: 7,
      studentDailyImageRemaining: 5,
    });
    expect(messageCount).toHaveBeenCalledWith({
      where: expect.objectContaining({
        role: "ASSISTANT",
        status: "COMPLETED",
        dailyQuotaCountedAt: { gte: expect.any(Date) },
      }),
    });
    expect(imageCount).toHaveBeenCalledWith({
      where: expect.objectContaining({
        dailyQuotaCountedAt: { gte: expect.any(Date) },
      }),
    });
  });

  it("normalizes a lesson scope without creating an Admin-only chat runtime", async () => {
    const service = new AdminAiChatAccessService({
      lesson: {
        findFirst: vi.fn(async () => ({
          id: LESSON_ID,
          title: "Định lý Pythagoras",
          learningPathId: PATH_ID,
          learningPath: {
            title: "Toán 9",
            domain: { name: "Toán", slug: "toan-hoc" },
          },
        })),
      },
    } as never);

    await expect(
      service.resolveNewScope({
        scopeType: AiChatScopeType.LESSON,
        learningPathIds: [PATH_ID],
        lessonId: LESSON_ID,
      }),
    ).resolves.toEqual({
      access: {
        scopeType: AiChatScopeType.LESSON,
        learningPathId: PATH_ID,
        learningPathIds: [PATH_ID],
        lessonIds: [LESSON_ID],
        label: "Toán 9 / Định lý Pythagoras",
        subjects: [{ learningPathId: PATH_ID, key: "MATH" }],
      },
      items: [{ learningPathId: PATH_ID, lessonId: LESSON_ID, sortOrder: 0 }],
    });
  });

  it("rejects duplicate courses before a multi-course simulation is persisted", async () => {
    const service = new AdminAiChatAccessService({} as never);
    await expect(
      service.resolveNewScope({
        scopeType: AiChatScopeType.COURSE_SET,
        learningPathIds: [PATH_ID, PATH_ID],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "ADMIN_AI_CHAT_SCOPE_DUPLICATE" }),
    });
  });

  it("normalizes an ordered course set for the shared retrieval runtime", async () => {
    const service = new AdminAiChatAccessService({
      learningPath: {
        findMany: vi.fn(async () => [
          {
            id: SECOND_PATH_ID,
            title: "Vật lý 9",
            domain: { name: "Vật lí", slug: "vat-ly" },
          },
          {
            id: PATH_ID,
            title: "Toán 9",
            domain: { name: "Toán", slug: "toan-hoc" },
          },
        ]),
      },
    } as never);

    await expect(
      service.resolveNewScope({
        scopeType: AiChatScopeType.COURSE_SET,
        learningPathIds: [PATH_ID, SECOND_PATH_ID],
      }),
    ).resolves.toEqual({
      access: {
        scopeType: AiChatScopeType.COURSE_SET,
        learningPathId: null,
        learningPathIds: [PATH_ID, SECOND_PATH_ID],
        label: "2 khóa học: Toán 9, Vật lý 9",
        subjects: [
          { learningPathId: PATH_ID, key: "MATH" },
          { learningPathId: SECOND_PATH_ID, key: "PHYSICS" },
        ],
      },
      items: [
        { learningPathId: PATH_ID, lessonId: null, sortOrder: 0 },
        { learningPathId: SECOND_PATH_ID, lessonId: null, sortOrder: 1 },
      ],
    });
  });

  it("rejects a persisted simulation when its lesson is no longer available", async () => {
    const service = new AdminAiChatAccessService({
      aiChatSession: {
        findFirst: vi.fn(async () => ({
          id: ADMIN_ID,
          scopeType: AiChatScopeType.LESSON,
          learningPathId: null,
          learningPath: null,
          scopeItems: [
            {
              learningPathId: PATH_ID,
              lessonId: LESSON_ID,
              learningPath: { title: "Toán 9", deletedAt: null },
              lesson: {
                title: "Định lý Pythagoras",
                deletedAt: new Date(),
              },
            },
          ],
        })),
      },
    } as never);

    await expect(service.resolveConversation(ADMIN_ID, ADMIN_ID)).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "ADMIN_AI_CHAT_SCOPE_UNAVAILABLE",
      }),
    });
  });

  it("keeps primary and fallback session parameters independent by capability", async () => {
    const primary = createCatalogItem();
    const fallback = createCatalogItem({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      externalKey: "gpt-reasoning-test",
      aiConfiguration: "REASONING_EFFORT",
    });
    const routing = new AiModelRoutingService(
      {
        aiFeatureModelConfig: {
          findUnique: vi.fn(async () => ({
            version: 7,
            primaryCatalogItem: primary,
            fallbackCatalogItem: fallback,
            temperature: { toNumber: () => 0.2 },
            reasoningEffort: null,
            maxInputTokens: 20_000,
            maxOutputTokens: 2_000,
            fallbackTemperature: null,
            fallbackReasoningEffort: "medium",
            fallbackMaxOutputTokens: 1_000,
          })),
        },
      } as never,
      {
        get: vi.fn((key: string) => (key === "OPENAI_API_KEY" ? "configured" : null)),
      } as never,
    );

    await expect(
      routing.resolveChatOverride({
        temperature: 0.4,
        maxOutputTokens: 512,
        fallbackReasoningEffort: "high",
        fallbackMaxOutputTokens: 640,
      }),
    ).resolves.toMatchObject({
      feature: AiGenerationType.CHAT,
      purpose: AiModelPurpose.TEXT,
      version: 7,
      model: "gpt-test",
      maxInputTokens: 20_000,
      maxOutputTokens: 512,
      temperature: 0.4,
      reasoningEffort: null,
      fallbackTemperature: null,
      fallbackReasoningEffort: "high",
      fallbackMaxOutputTokens: 640,
      candidates: [
        expect.objectContaining({ model: "gpt-test", available: true }),
        expect.objectContaining({ model: "gpt-reasoning-test", available: true }),
      ],
    });
  });

  it("uses the fallback model's own controls when a stream fails before its first delta", async () => {
    let attempt = 0;
    const streamText = vi.fn((resolvedInput: unknown) =>
      (async function* () {
        attempt += 1;
        if (attempt === 1) {
          throw Object.assign(new Error("provider unavailable"), { status: 503 });
        }
        yield {
          type: "completed" as const,
          output: {
            text: "fallback completed",
            provider: AiProviderName.OPENAI,
            model: "gpt-temperature-fallback",
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          },
        };
        void resolvedInput;
      })(),
    );
    const usage = {
      reserveAndStart: vi
        .fn()
        .mockResolvedValueOnce({ id: "usage-primary" })
        .mockResolvedValueOnce({ id: "usage-fallback" }),
      fail: vi.fn(async () => ({ costVnd: 0, costMeasured: false })),
      succeed: vi.fn(async () => ({ costVnd: 0 })),
    };
    const service = new AiProviderCallService(
      { streamText } as never,
      {} as never,
      usage as never,
      {} as never,
    );
    const candidate = (
      id: string,
      model: string,
      aiConfiguration: "TEMPERATURE" | "REASONING_EFFORT",
    ) => ({
      catalogItemId: id,
      priceVersionId: `${id}-price`,
      category: ProviderCatalogCategory.AI_MODEL,
      provider: AiProviderName.OPENAI,
      model,
      maxInputTokens: 10_000,
      available: true,
      capabilitiesJson: { aiConfiguration },
      rates: [],
    });
    const events = [];
    for await (const event of service.streamText(
      {
        feature: AiGenerationType.CHAT,
        targetContext: { version: 1, kind: "CHAT_THREAD", entityId: ADMIN_ID },
        routeSnapshot: {
          feature: AiGenerationType.CHAT,
          purpose: AiModelPurpose.TEXT,
          version: 7,
          model: "gpt-reasoning-primary",
          temperature: null,
          reasoningEffort: "high",
          maxInputTokens: 10_000,
          maxOutputTokens: 900,
          fallbackTemperature: 0.7,
          fallbackReasoningEffort: null,
          fallbackMaxOutputTokens: 640,
          candidates: [
            candidate("primary", "gpt-reasoning-primary", "REASONING_EFFORT"),
            candidate("fallback", "gpt-temperature-fallback", "TEMPERATURE"),
          ],
          hasConfiguration: true,
        },
      },
      { systemPrompt: "system", userPrompt: "user" },
    )) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(streamText).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        model: "gpt-reasoning-primary",
        reasoningEffort: "high",
        temperature: undefined,
        maxTokens: 900,
      }),
      AiProviderName.OPENAI,
    );
    expect(streamText).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        model: "gpt-temperature-fallback",
        reasoningEffort: undefined,
        temperature: 0.7,
        maxTokens: 640,
      }),
      AiProviderName.OPENAI,
    );
    expect(usage.fail).toHaveBeenCalledWith(
      "usage-primary",
      expect.objectContaining({ status: 503 }),
      { rates: [] },
    );
    expect(usage.succeed).toHaveBeenCalledWith(
      "usage-fallback",
      expect.objectContaining({ totalTokens: 15 }),
    );
  });

  it("correlates paid embedding retrieval with the same turn generation", async () => {
    const createEmbedding = vi.fn(async () => ({ vectors: [[0.1, 0.2]] }));
    const service = new AiChatRetrievalService(
      {
        learningPath: { findMany: vi.fn(async () => []) },
        lesson: { findMany: vi.fn(async () => []) },
        $queryRaw: vi.fn(async () => []),
      } as never,
      {
        getEmbeddingConfig: vi.fn(() => ({
          provider: AiProviderName.OPENAI,
          model: "text-embedding-test",
          dimensions: 2,
        })),
        createEmbedding,
      } as never,
    );

    await service.retrieve({
      query: "định lý Pythagoras",
      learningPathIds: [PATH_ID],
      lessonIds: [LESSON_ID],
      conversationId: ADMIN_ID,
      aiGenerationId: GENERATION_ID,
      embeddingIdempotencyKey: "m9.34-correlation",
      embeddingConfig: {
        provider: AiProviderName.OPENAI,
        model: "text-embedding-test",
        dimensions: 2,
      },
      maxChunks: 8,
      maxTokens: 1_000,
    });

    expect(createEmbedding).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: AiGenerationType.CHAT,
        aiGenerationId: GENERATION_ID,
        operation: "EMBEDDING_GENERATION",
      }),
      { texts: ["định lý Pythagoras"] },
      {
        provider: AiProviderName.OPENAI,
        model: "text-embedding-test",
        dimensions: 2,
      },
    );
  });

  it("keeps token limits visible while redacting authentication material", () => {
    expect(
      sanitizeTraceJson({
        maxTokens: 1_200,
        inputTokens: 450,
        accessToken: "secret-access-token",
        api_key: "secret-api-key",
        nested: { signedUrl: "https://private.example/file" },
      }),
    ).toEqual({
      maxTokens: 1_200,
      inputTokens: 450,
      accessToken: "[REDACTED]",
      api_key: "[REDACTED]",
      nested: { signedUrl: "[REDACTED]" },
    });
  });
});

function createCatalogItem(
  input: {
    id?: string;
    externalKey?: string;
    aiConfiguration?: "TEMPERATURE" | "REASONING_EFFORT";
  } = {},
) {
  return {
    id: input.id ?? "55555555-5555-4555-8555-555555555555",
    category: ProviderCatalogCategory.AI_MODEL,
    provider: AiProviderName.OPENAI,
    externalKey: input.externalKey ?? "gpt-test",
    status: ProviderCatalogStatus.ACTIVE,
    capabilitiesJson: {
      features: [AiGenerationType.CHAT],
      aiConfiguration: input.aiConfiguration ?? "TEMPERATURE",
      reasoningEffortLevels:
        input.aiConfiguration === "REASONING_EFFORT"
          ? ["low", "medium", "high"]
          : undefined,
    },
    priceVersions: [
      {
        id: "66666666-6666-4666-8666-666666666666",
        effectiveFrom: new Date(),
        rates: [],
      },
    ],
  };
}
