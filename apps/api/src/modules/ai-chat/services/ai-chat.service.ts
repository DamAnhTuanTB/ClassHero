import { createHash, randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AiChatMessageRole,
  AiChatMessageStatus,
  AiChatResponsePolicy,
  AiChatScopeType,
  AiChatSessionMode,
  AiGenerationStatus,
  AiGenerationType,
  Prisma,
} from "@prisma/client";
import {
  hasMalformedMathText,
  normalizeLearnerMathTextSyntax,
} from "@learning-path/shared";
import {
  throwBadRequest,
  throwConflict,
  throwForbidden,
} from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import type { EnvConfig } from "#api/config/env.validation";
import type {
  ListAiChatConversationsQueryDto,
  ListAiChatMessagesQueryDto,
  RenameAiChatConversationDto,
  SendAiChatMessageDto,
} from "#api/modules/ai-chat/dto/ai-chat.dto";
import type {
  ContinueAdminAiChatMessageDto,
  CreateAdminAiChatMessageDto,
  ListAdminAiChatMessagesQueryDto,
  ListAdminAiChatSessionsQueryDto,
  UpdateAdminAiChatSessionConfigurationDto,
} from "#api/modules/ai-chat/dto/admin-ai-chat.dto";
import {
  AdminAiChatAccessService,
  type AdminAiChatScopeItemInput,
} from "#api/modules/ai-chat/services/admin-ai-chat-access.service";
import { AiChatAccessService } from "#api/modules/ai-chat/services/ai-chat-access.service";
import { AiChatAttachmentService } from "#api/modules/ai-chat/services/ai-chat-attachment.service";
import { AiChatPolicyService } from "#api/modules/ai-chat/services/ai-chat-policy.service";
import {
  AI_CHAT_RESPONSE_PROMPT_VERSION,
  AiChatPromptService,
} from "#api/modules/ai-chat/services/ai-chat-prompt.service";
import {
  AiChatRetrievalService,
  resolveAiChatRetrievalChunkLimit,
} from "#api/modules/ai-chat/services/ai-chat-retrieval.service";
import { AiChatScopeManifestService } from "#api/modules/ai-chat/services/ai-chat-scope-manifest.service";
import type {
  AiChatAnswerAccess,
  AiChatConfigurationOverride,
  AiChatPreferredLesson,
  AiChatScopeAccess,
  AiChatSource,
  AiChatSseEvent,
  AdminAiChatSimulationSurface,
  PreparedAiChatTurn,
} from "#api/modules/ai-chat/types/ai-chat.types";
import {
  resolveAiChatActivityPolicy,
  type AiChatActivityState,
} from "#api/modules/ai-chat/utils/ai-chat-activity-policy";
import { resolveAiChatTurnSubjectKeys } from "#api/modules/ai-chat/utils/ai-chat-subject";
import { AiProviderCallService } from "#api/modules/ai/services/ai-provider-call.service";
import type { AiTextInput, AiTextOutput } from "#api/modules/ai/types/ai-text.types";
import { FilesService } from "#api/modules/files/services/files.service";
import {
  studentVisibleFlashcardWhere,
  studentVisibleQuizQuestionWhere,
  studentVisibleTestQuestionWhere,
} from "#api/modules/student-learning/selectors/student-visible-learning-content.where";
import { buildWholeFeatureUsageTarget } from "#api/modules/provider-operations/utils/provider-usage-target";
import { AiModelRoutingService } from "#api/modules/provider-operations/services/ai-model-routing.service";
import {
  AiChatRuntimeSettingsService,
  type ResolvedAiChatRuntimeSettings,
} from "#api/modules/provider-operations/services/ai-chat-runtime-settings.service";
import type { AiFeatureRoute } from "#api/modules/provider-operations/types/provider-operations.types";

const conversationSelect = {
  id: true,
  mode: true,
  scopeType: true,
  learningPathId: true,
  configurationOverrideJson: true,
  configurationVersion: true,
  title: true,
  summaryText: true,
  lastMessageAt: true,
  createdAt: true,
  updatedAt: true,
  learningPath: { select: { title: true } },
} satisfies Prisma.AiChatSessionSelect;

const messageInclude = {
  attachments: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      file: {
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          sizeBytes: true,
          objectKey: true,
          publicUrl: true,
          visibility: true,
        },
      },
    },
  },
  turnTraceAsAssistant: { select: { id: true } },
} satisfies Prisma.AiChatMessageInclude;

const adminMessageInclude = {
  ...messageInclude,
  aiGeneration: {
    select: {
      latencyMs: true,
      providerUsageEvents: {
        orderBy: [{ attempt: "asc" as const }, { createdAt: "asc" as const }],
        select: {
          operation: true,
          costVnd: true,
          rawUsageJson: true,
        },
      },
    },
  },
} satisfies Prisma.AiChatMessageInclude;

type PrepareResolvedAiChatTurnInput = {
  actorUserId: string;
  ownerMode: AiChatSessionMode;
  existingSession: {
    id: string;
    mode: AiChatSessionMode;
    scopeType: AiChatScopeType;
    learningPathId: string | null;
    configurationOverrideJson: Prisma.JsonValue | null;
    configurationVersion: number;
    title: string | null;
    summaryText: string | null;
    lastMessageAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    learningPath: { title: string } | null;
  } | null;
  scope: AiChatScopeAccess;
  scopeItems: AdminAiChatScopeItemInput[];
  question: string;
  attachmentFileIds: string[];
  surfaceLessonId?: string;
  preferredLessonIds?: string[];
  videoPlaybackSeconds?: number;
  targetType?: string;
  targetId?: string;
  simulationSurface?: AdminAiChatSimulationSurface;
  activityState?: AiChatActivityState;
  responsePolicy: AiChatResponsePolicy;
  answerAccess: AiChatAnswerAccess;
  routeSnapshot: AiFeatureRoute;
  runtimeSettings: ResolvedAiChatRuntimeSettings;
  configurationOverride: AiChatConfigurationOverride | null;
  traceAdminTurn: boolean;
};

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService<EnvConfig, true>,
    @Inject(AiChatAccessService) private readonly access: AiChatAccessService,
    @Inject(AdminAiChatAccessService)
    private readonly adminAccess: AdminAiChatAccessService,
    @Inject(AiChatPolicyService) private readonly policy: AiChatPolicyService,
    @Inject(AiChatRetrievalService)
    private readonly retrieval: AiChatRetrievalService,
    @Inject(AiChatAttachmentService)
    private readonly attachments: AiChatAttachmentService,
    @Inject(AiChatPromptService) private readonly prompts: AiChatPromptService,
    @Inject(AiChatScopeManifestService)
    private readonly scopeManifest: AiChatScopeManifestService,
    @Inject(AiProviderCallService)
    private readonly providerCalls: AiProviderCallService,
    @Inject(AiModelRoutingService)
    private readonly routing: AiModelRoutingService,
    @Inject(FilesService) private readonly files: FilesService,
    @Inject(AiChatRuntimeSettingsService)
    private readonly chatRuntimeSettings: AiChatRuntimeSettingsService,
  ) {}

  async getRuntimeSettings(studentUserId: string) {
    const settings = await this.chatRuntimeSettings.get();
    const usage = await this.getDailyQuotaUsage(studentUserId);
    return {
      ...settings,
      studentDailyMessageUsed: usage.messageCount,
      studentDailyMessageRemaining: Math.max(
        0,
        settings.studentDailyMessageLimit - usage.messageCount,
      ),
      studentDailyImageUsed: usage.imageCount,
      studentDailyImageRemaining: Math.max(
        0,
        settings.studentDailyImageLimit - usage.imageCount,
      ),
    };
  }

  async listConversations(studentUserId: string, query: ListAiChatConversationsQueryDto) {
    const libraryAccess = await this.access.resolveScope(
      studentUserId,
      AiChatScopeType.LIBRARY,
    );
    const rows = await this.prisma.aiChatSession.findMany({
      where: {
        studentUserId,
        deletedAt: null,
        OR: [
          { scopeType: AiChatScopeType.LIBRARY },
          { learningPathId: { in: libraryAccess.learningPathIds } },
        ],
        ...(query.scopeType ? { scopeType: query.scopeType } : {}),
        ...(query.learningPathId ? { learningPathId: query.learningPathId } : {}),
      },
      select: {
        ...conversationSelect,
        messages: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
          select: {
            role: true,
            contentJson: true,
            status: true,
            responsePolicy: true,
            sourceLearningPathIds: true,
          },
        },
      },
      orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: query.limit + 1,
    });
    const hasMore = rows.length > query.limit;
    const items = rows.slice(0, query.limit).map((row) => ({
      ...serializeConversation(row),
      preview:
        row.messages[0]?.role === AiChatMessageRole.ASSISTANT &&
        row.messages[0].sourceLearningPathIds.some(
          (pathId) => !libraryAccess.learningPathIds.includes(pathId),
        )
          ? "Nội dung từ khóa học đã hết quyền truy cập"
          : readMessageText(row.messages[0]?.contentJson).slice(0, 140),
      lastMessageStatus: row.messages[0]?.status ?? null,
    }));
    return {
      items,
      nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async getConversation(studentUserId: string, conversationId: string) {
    const { session, access } = await this.access.resolveConversation(
      studentUserId,
      conversationId,
    );
    return { ...serializeConversation(session), scopeLabel: access.label };
  }

  async listMessages(
    studentUserId: string,
    conversationId: string,
    query: ListAiChatMessagesQueryDto,
  ) {
    const { access } = await this.access.resolveConversation(
      studentUserId,
      conversationId,
    );
    const rows = await this.prisma.aiChatMessage.findMany({
      where: { sessionId: conversationId },
      include: messageInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: query.limit + 1,
    });
    const hasMore = rows.length > query.limit;
    const page = rows.slice(0, query.limit);
    const nextCursor = hasMore ? (page.at(-1)?.id ?? null) : null;
    return {
      items: await Promise.all(
        page
          .reverse()
          .map((message) => this.serializeMessage(message, access.learningPathIds)),
      ),
      nextCursor,
    };
  }

  async renameConversation(
    studentUserId: string,
    conversationId: string,
    dto: RenameAiChatConversationDto,
  ) {
    await this.access.resolveConversation(studentUserId, conversationId);
    const updated = await this.prisma.aiChatSession.update({
      where: { id: conversationId },
      data: { title: dto.title.trim() },
      select: conversationSelect,
    });
    return serializeConversation(updated);
  }

  async deleteConversation(studentUserId: string, conversationId: string) {
    await this.access.resolveConversation(studentUserId, conversationId);
    await this.prisma.aiChatSession.update({
      where: { id: conversationId },
      data: { deletedAt: new Date() },
    });
    return { id: conversationId, deleted: true };
  }

  async listAdminSessions(adminUserId: string, query: ListAdminAiChatSessionsQueryDto) {
    const rows = await this.prisma.aiChatSession.findMany({
      where: {
        adminUserId,
        mode: AiChatSessionMode.ADMIN_SIMULATION,
        deletedAt: null,
      },
      include: {
        scopeItems: {
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          include: {
            learningPath: { select: { title: true } },
            lesson: { select: { title: true } },
          },
        },
        messages: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
          select: { contentJson: true, status: true, surfaceLessonId: true },
        },
      },
      orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: query.limit + 1,
    });
    const hasMore = rows.length > query.limit;
    const items = rows.slice(0, query.limit).map(serializeAdminConversation);
    return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
  }

  async getAdminSession(adminUserId: string, conversationId: string) {
    const { session, access } = await this.adminAccess.resolveConversation(
      adminUserId,
      conversationId,
    );
    const [sessionUsage, lastMessage] = await Promise.all([
      this.prisma.providerUsageEvent.aggregate({
        where: {
          aiGeneration: {
            is: {
              type: AiGenerationType.CHAT,
              targetId: conversationId,
              targetType: {
                in: ["AI_CHAT_SESSION", "AI_CHAT_SESSION_TITLE"],
              },
            },
          },
        },
        _sum: { costVnd: true },
      }),
      this.prisma.aiChatMessage.findFirst({
        where: { sessionId: conversationId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { contentJson: true, status: true, surfaceLessonId: true },
      }),
    ]);
    return {
      ...serializeAdminConversation({
        ...session,
        messages: lastMessage ? [lastMessage] : [],
      }),
      scopeLabel: access.label,
      configurationOverride: readChatOverride(session.configurationOverrideJson),
      totalCostVnd: sessionUsage._sum.costVnd ?? 0,
    };
  }

  async listAdminMessages(
    adminUserId: string,
    conversationId: string,
    query: ListAdminAiChatMessagesQueryDto,
  ) {
    await this.adminAccess.resolveConversation(adminUserId, conversationId);
    const rows = await this.prisma.aiChatMessage.findMany({
      where: { sessionId: conversationId },
      include: adminMessageInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: query.limit + 1,
    });
    const hasMore = rows.length > query.limit;
    const page = rows.slice(0, query.limit);
    return {
      items: await Promise.all(
        page.reverse().map((message) => this.serializeAdminMessage(message)),
      ),
      nextCursor: hasMore ? (page.at(0)?.id ?? null) : null,
    };
  }

  async updateAdminSessionConfiguration(
    adminUserId: string,
    conversationId: string,
    dto: UpdateAdminAiChatSessionConfigurationDto,
  ) {
    const { session } = await this.adminAccess.resolveConversation(
      adminUserId,
      conversationId,
    );
    if (session.configurationVersion !== dto.expectedVersion) {
      throwConflict(
        "ADMIN_AI_CHAT_CONFIGURATION_VERSION_CONFLICT",
        "Cấu hình phiên đã thay đổi ở nơi khác. Vui lòng tải lại.",
        { currentVersion: session.configurationVersion },
      );
    }
    const configurationOverride = normalizeChatOverride(dto.configurationOverride);
    await this.routing.resolveChatOverride(configurationOverride);
    await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.aiChatSession.updateMany({
        where: {
          id: conversationId,
          adminUserId,
          mode: AiChatSessionMode.ADMIN_SIMULATION,
          configurationVersion: dto.expectedVersion,
          deletedAt: null,
        },
        data: {
          configurationOverrideJson: configurationOverride
            ? toInputJson(configurationOverride)
            : Prisma.JsonNull,
          configurationVersion: { increment: 1 },
        },
      });
      if (result.count !== 1) {
        throwConflict(
          "ADMIN_AI_CHAT_CONFIGURATION_VERSION_CONFLICT",
          "Cấu hình phiên đã thay đổi ở nơi khác. Vui lòng tải lại.",
        );
      }
      await transaction.auditLog.create({
        data: {
          actorUserId: adminUserId,
          action: "ADMIN_AI_CHAT_SESSION_CONFIGURATION_UPDATED",
          entityType: "AiChatSession",
          entityId: conversationId,
          before: toInputJson({
            configurationOverride: readChatOverride(session.configurationOverrideJson),
            configurationVersion: session.configurationVersion,
          }),
          after: toInputJson({
            configurationOverride,
            configurationVersion: session.configurationVersion + 1,
          }),
        },
      });
    });
    return this.getAdminSession(adminUserId, conversationId);
  }

  async renameAdminSession(
    adminUserId: string,
    conversationId: string,
    dto: RenameAiChatConversationDto,
  ) {
    await this.adminAccess.resolveConversation(adminUserId, conversationId);
    await this.prisma.aiChatSession.update({
      where: { id: conversationId },
      data: { title: dto.title.trim() },
    });
    return this.getAdminSession(adminUserId, conversationId);
  }

  async deleteAdminSession(adminUserId: string, conversationId: string) {
    await this.adminAccess.resolveConversation(adminUserId, conversationId);
    await this.prisma.aiChatSession.update({
      where: { id: conversationId },
      data: { deletedAt: new Date() },
    });
    return { id: conversationId, deleted: true };
  }

  async getAdminTurnTrace(
    adminUserId: string,
    conversationId: string,
    assistantMessageId: string,
  ) {
    await this.adminAccess.resolveConversation(adminUserId, conversationId);
    const trace = await this.prisma.aiChatTurnTrace.findFirst({
      where: { sessionId: conversationId, assistantMessageId },
      include: {
        aiGeneration: {
          include: {
            providerUsageEvents: {
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
              include: {
                catalogItem: {
                  select: { displayName: true, externalKey: true },
                },
              },
            },
          },
        },
      },
    });
    if (!trace) {
      throwBadRequest(
        "ADMIN_AI_CHAT_TRACE_NOT_FOUND",
        "Tin nhắn này không có trace của lượt mô phỏng.",
      );
    }
    const usageEvents = trace.aiGeneration.providerUsageEvents.map((event) => ({
      id: event.id,
      operation: event.operation,
      provider: event.provider,
      model: event.catalogItem?.externalKey ?? null,
      modelLabel: event.catalogItem?.displayName ?? null,
      providerRequestId: event.providerRequestId,
      status: event.status,
      attempt: event.attempt,
      cacheStatus: event.cacheStatus,
      reasoningEffort: event.reasoningEffort,
      promptTokens: event.promptTokens,
      cachedInputTokens: event.cachedInputTokens,
      cacheWriteInputTokens: event.cacheWriteInputTokens,
      completionTokens: event.completionTokens,
      totalTokens: event.totalTokens,
      costVnd: event.costVnd,
      estimatedCostUsd: event.estimatedCostUsd.toNumber(),
      latencyMs: event.latencyMs,
      timeToFirstTokenMs: readTimeToFirstToken(event.rawUsageJson),
      rawUsage: sanitizeTraceJson(event.rawUsageJson),
      errorCode: event.errorCode,
      startedAt: event.startedAt,
      finishedAt: event.finishedAt,
    }));
    return {
      id: trace.id,
      sessionId: trace.sessionId,
      userMessageId: trace.userMessageId,
      assistantMessageId: trace.assistantMessageId,
      aiGenerationId: trace.aiGenerationId,
      scopeSnapshot: trace.scopeSnapshotJson,
      defaultConfigurationVersion: trace.defaultConfigurationVersion,
      sessionConfigurationVersion: trace.sessionConfigurationVersion,
      configurationOverrideSnapshot: trace.configurationOverrideSnapshotJson,
      effectiveConfiguration: trace.effectiveConfigurationJson,
      providerRequest: sanitizeTraceJson(trace.providerRequestSnapshotJson),
      generation: {
        status: trace.aiGeneration.status,
        provider: trace.aiGeneration.provider,
        model: trace.aiGeneration.model,
        providerRequestId: trace.aiGeneration.providerRequestId,
        promptTokens: trace.aiGeneration.promptTokens,
        completionTokens: trace.aiGeneration.completionTokens,
        totalTokens: trace.aiGeneration.totalTokens,
        estimatedCostVnd: trace.aiGeneration.estimatedCostVnd,
        latencyMs: trace.aiGeneration.latencyMs,
        retryCount: trace.aiGeneration.retryCount,
        errorMessage: trace.aiGeneration.errorMessage,
        startedAt: trace.aiGeneration.startedAt,
        finishedAt: trace.aiGeneration.finishedAt,
      },
      aggregate: {
        callCount: usageEvents.length,
        totalCostVnd: usageEvents.reduce((sum, event) => sum + event.costVnd, 0),
        totalTokens: usageEvents.reduce((sum, event) => sum + event.totalTokens, 0),
        totalLatencyMs: usageEvents.reduce(
          (sum, event) => sum + (event.latencyMs ?? 0),
          0,
        ),
        timeToFirstTokenMs:
          usageEvents.find((event) => event.operation === "CHAT_RESPONSE_GENERATION")
            ?.timeToFirstTokenMs ?? null,
      },
      usageEvents,
      createdAt: trace.createdAt,
      updatedAt: trace.updatedAt,
    };
  }

  async prepareTurn(
    studentUserId: string,
    dto: SendAiChatMessageDto,
    conversationId?: string,
  ): Promise<PreparedAiChatTurn> {
    const question = dto.message.trim();
    if (!question) {
      throwBadRequest("AI_CHAT_EMPTY_MESSAGE", "Vui lòng nhập câu hỏi.");
    }
    const runtimeSettings = await this.chatRuntimeSettings.get();
    await this.assertDailyLimits(
      studentUserId,
      runtimeSettings.studentDailyMessageLimit,
      runtimeSettings.studentDailyImageLimit,
      dto.attachmentFileIds.length,
    );

    const existing = conversationId
      ? await this.access.resolveConversation(studentUserId, conversationId)
      : null;
    const scopeType = existing?.session.scopeType ?? dto.scopeType;
    if (!scopeType) {
      throwBadRequest("AI_CHAT_SCOPE_REQUIRED", "Vui lòng chọn phạm vi Chat AI.");
    }
    const scope = existing
      ? existing.access
      : await this.access.resolveScope(studentUserId, scopeType, dto.learningPathId);
    const [policyDecision, routeSnapshot] = await Promise.all([
      this.policy.resolveDecision(studentUserId, {
        activityType: dto.activityType,
        activityId: dto.activityId,
        targetType: dto.targetType,
        targetId: dto.targetId,
      }),
      this.routing.resolveChatOverride(null),
    ]);
    return this.prepareResolvedTurn({
      actorUserId: studentUserId,
      ownerMode: AiChatSessionMode.STUDENT,
      existingSession: existing?.session ?? null,
      scope,
      scopeItems: [],
      question,
      attachmentFileIds: dto.attachmentFileIds,
      surfaceLessonId: dto.surfaceLessonId,
      preferredLessonIds: dto.preferredLessonIds,
      videoPlaybackSeconds: dto.videoPlaybackSeconds,
      targetType: dto.targetType,
      targetId: dto.targetId,
      responsePolicy: policyDecision.policy,
      answerAccess: policyDecision.answerAccess,
      routeSnapshot,
      runtimeSettings,
      configurationOverride: null,
      traceAdminTurn: false,
    });
  }

  async prepareAdminTurn(
    adminUserId: string,
    dto: CreateAdminAiChatMessageDto | ContinueAdminAiChatMessageDto,
    conversationId?: string,
  ) {
    const question = dto.message.trim();
    if (!question) {
      throwBadRequest("AI_CHAT_EMPTY_MESSAGE", "Vui lòng nhập câu hỏi.");
    }
    const existing = conversationId
      ? await this.adminAccess.resolveConversation(adminUserId, conversationId)
      : null;
    const createdScope = existing
      ? null
      : await this.adminAccess.resolveNewScope({
          scopeType: (dto as CreateAdminAiChatMessageDto).scopeType,
          learningPathIds: (dto as CreateAdminAiChatMessageDto).learningPathIds,
          lessonId: (dto as CreateAdminAiChatMessageDto).lessonId,
        });
    const scope = existing?.access ?? createdScope!.access;
    const configurationOverride = existing
      ? readChatOverride(existing.session.configurationOverrideJson)
      : normalizeChatOverride((dto as CreateAdminAiChatMessageDto).configurationOverride);
    const surfaceLessonId =
      scope.scopeType === AiChatScopeType.LESSON
        ? scope.lessonIds?.[0]
        : dto.surfaceLessonId;
    const simulationContext = resolveAdminSimulationContext(dto, scope, surfaceLessonId);
    const [routeSnapshot, runtimeSettings] = await Promise.all([
      this.routing.resolveChatOverride(configurationOverride),
      this.chatRuntimeSettings.get(),
    ]);
    return this.prepareResolvedTurn({
      actorUserId: adminUserId,
      ownerMode: AiChatSessionMode.ADMIN_SIMULATION,
      existingSession: existing?.session ?? null,
      scope,
      scopeItems: createdScope?.items ?? [],
      question,
      attachmentFileIds: dto.attachmentFileIds,
      surfaceLessonId,
      videoPlaybackSeconds: dto.videoPlaybackSeconds,
      targetType: simulationContext.targetType,
      targetId: simulationContext.targetId,
      simulationSurface: simulationContext.simulationSurface,
      activityState: simulationContext.activityState,
      responsePolicy: simulationContext.policy,
      answerAccess: simulationContext.answerAccess,
      routeSnapshot,
      runtimeSettings,
      configurationOverride,
      traceAdminTurn: true,
    });
  }

  private async prepareResolvedTurn(input: PrepareResolvedAiChatTurnInput) {
    const targetContext = await this.resolveTargetContext({
      studentUserId: input.actorUserId,
      surfaceLessonId: input.surfaceLessonId,
      targetType: input.targetType,
      targetId: input.targetId,
      policy: input.responsePolicy,
      learningPathIds: input.scope.learningPathIds,
    });
    if (input.responsePolicy === AiChatResponsePolicy.BLOCKED) {
      throwForbidden(
        "AI_CHAT_BLOCKED_DURING_TEST",
        "Chat AI tạm khóa trong khi bạn đang làm bài thi.",
      );
    }
    const requestedPreferredLessonIds = normalizeAiChatPreferredLessonIds(
      input.surfaceLessonId,
      input.preferredLessonIds,
    );
    const requestedCtaLessonIds = normalizeAiChatPreferredLessonIds(
      undefined,
      input.preferredLessonIds,
    );
    const preferredLessonRows = requestedPreferredLessonIds.length
      ? await this.prisma.lesson.findMany({
          where: {
            learningPathId: { in: input.scope.learningPathIds },
            deletedAt: null,
            AND: [
              ...(input.scope.lessonIds?.length
                ? [{ id: { in: input.scope.lessonIds } }]
                : []),
              {
                OR: [
                  { id: { in: requestedPreferredLessonIds } },
                  ...(requestedCtaLessonIds.length
                    ? [{ sourceLessonId: { in: requestedCtaLessonIds } }]
                    : []),
                ],
              },
            ],
          },
          select: {
            id: true,
            sourceLessonId: true,
            title: true,
            learningPathId: true,
            customVideoSettings: true,
            learningPath: { select: { title: true } },
          },
        })
      : [];
    const allowedPreferredLessonRows = resolveAllowedAiChatPreferredLessonRows(
      input.surfaceLessonId,
      input.preferredLessonIds,
      preferredLessonRows,
    );
    const preferredLessons: AiChatPreferredLesson[] = allowedPreferredLessonRows.map(
      (lesson) => ({
        id: lesson.id,
        title: lesson.title,
        learningPathId: lesson.learningPathId,
        learningPathTitle: lesson.learningPath.title,
      }),
    );

    let videoSourceSeconds: number | undefined;
    if (input.surfaceLessonId) {
      const surfaceLesson = preferredLessonRows.find(
        (lesson) => lesson.id === input.surfaceLessonId,
      );
      if (!surfaceLesson) {
        throwForbidden(
          "AI_CHAT_LESSON_ACCESS_DENIED",
          "Buổi học hiện tại không thuộc phạm vi Chat AI được phép.",
        );
      }
      if (input.videoPlaybackSeconds !== undefined) {
        videoSourceSeconds = resolveVideoSourceSeconds(
          input.videoPlaybackSeconds,
          surfaceLesson.customVideoSettings,
        );
      }
    }

    const attachmentInput = await this.attachments.validateAndPrepare(
      input.actorUserId,
      input.attachmentFileIds,
      input.runtimeSettings,
    );
    const recentCount = this.config.get("AI_CHAT_RECENT_MESSAGE_COUNT", {
      infer: true,
    });
    const [historicalAttachmentInput, history] = await Promise.all([
      input.existingSession &&
      attachmentInput.inputImages.length === 0 &&
      this.prompts.referencesPreviousVisual(input.question)
        ? this.attachments.prepareMostRecentConversationImages(
            input.actorUserId,
            input.existingSession.id,
            input.runtimeSettings,
          )
        : Promise.resolve({ files: [], inputImages: [] }),
      input.existingSession
        ? this.prisma.aiChatMessage.findMany({
            where: {
              sessionId: input.existingSession.id,
              status: {
                in: [AiChatMessageStatus.COMPLETED, AiChatMessageStatus.REFUSED],
              },
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: recentCount,
            select: { role: true, contentJson: true },
          })
        : Promise.resolve([]),
    ]);
    const inputImages = [
      ...historicalAttachmentInput.inputImages,
      ...attachmentInput.inputImages,
    ];
    const initialTitle =
      input.existingSession?.title ?? createConversationTitle(input.question);
    const now = new Date();
    const created = await this.prisma.$transaction(async (transaction) => {
      if (input.ownerMode === AiChatSessionMode.STUDENT) {
        await this.lockAndAssertDailyLimits(
          transaction,
          input.actorUserId,
          input.runtimeSettings.studentDailyMessageLimit,
          input.runtimeSettings.studentDailyImageLimit,
          input.attachmentFileIds.length,
        );
      }
      const session = input.existingSession
        ? input.existingSession
        : await transaction.aiChatSession.create({
            data: {
              mode: input.ownerMode,
              studentUserId:
                input.ownerMode === AiChatSessionMode.STUDENT ? input.actorUserId : null,
              adminUserId:
                input.ownerMode === AiChatSessionMode.ADMIN_SIMULATION
                  ? input.actorUserId
                  : null,
              scopeType: input.scope.scopeType,
              learningPathId: input.scope.learningPathId,
              title: initialTitle,
              configurationOverrideJson: input.configurationOverride
                ? toInputJson(input.configurationOverride)
                : undefined,
              lastMessageAt: now,
              scopeItems:
                input.scopeItems.length > 0
                  ? {
                      create: input.scopeItems.map((item) => ({
                        learningPathId: item.learningPathId,
                        lessonId: item.lessonId,
                        sortOrder: item.sortOrder,
                      })),
                    }
                  : undefined,
            },
            select: conversationSelect,
          });
      const userMessage = await transaction.aiChatMessage.create({
        data: {
          sessionId: session.id,
          role: AiChatMessageRole.USER,
          status: AiChatMessageStatus.COMPLETED,
          responsePolicy: input.responsePolicy,
          surfaceLessonId: input.surfaceLessonId,
          targetType: input.targetType,
          targetId: input.targetId,
          contentJson: { text: input.question },
          contextJson: {
            scopeType: input.scope.scopeType,
            learningPathIds: input.scope.learningPathIds,
            lessonIds: input.scope.lessonIds ?? [],
            preferredLessonIds: preferredLessons.map((lesson) => lesson.id),
            policy: input.responsePolicy,
            answerAccess: input.answerAccess,
            simulationSurface: input.simulationSurface ?? null,
            activityState: input.activityState ?? null,
            videoPlaybackSeconds: input.videoPlaybackSeconds ?? null,
            videoSourceSeconds: videoSourceSeconds ?? null,
          },
          attachments: {
            create: attachmentInput.files.map((file, sortOrder) => ({
              fileId: file.id,
              sortOrder,
            })),
          },
        },
        select: { id: true },
      });
      const generation = await transaction.aiGeneration.create({
        data: {
          type: AiGenerationType.CHAT,
          status: AiGenerationStatus.RUNNING,
          createdByUserId: input.actorUserId,
          lessonId: input.surfaceLessonId,
          targetType: "AI_CHAT_SESSION",
          targetId: session.id,
          promptVersion: AI_CHAT_RESPONSE_PROMPT_VERSION,
          inputHash: hash(input.question),
          inputMetaJson: {
            scopeType: input.scope.scopeType,
            learningPathIds: input.scope.learningPathIds,
            lessonIds: input.scope.lessonIds ?? [],
            preferredLessonIds: preferredLessons.map((lesson) => lesson.id),
            imageCount: inputImages.length,
            policy: input.responsePolicy,
            answerAccess: input.answerAccess,
            simulationSurface: input.simulationSurface ?? null,
            activityState: input.activityState ?? null,
            videoPlaybackSeconds: input.videoPlaybackSeconds ?? null,
            videoSourceSeconds: videoSourceSeconds ?? null,
          },
          startedAt: now,
        },
        select: { id: true },
      });
      const assistant = await transaction.aiChatMessage.create({
        data: {
          sessionId: session.id,
          role: AiChatMessageRole.ASSISTANT,
          status: AiChatMessageStatus.GENERATING,
          responsePolicy: input.responsePolicy,
          surfaceLessonId: input.surfaceLessonId,
          targetType: input.targetType,
          targetId: input.targetId,
          contentJson: { text: "" },
          aiGenerationId: generation.id,
        },
        select: { id: true },
      });
      if (input.traceAdminTurn) {
        await transaction.aiChatTurnTrace.create({
          data: {
            sessionId: session.id,
            userMessageId: userMessage.id,
            assistantMessageId: assistant.id,
            aiGenerationId: generation.id,
            scopeSnapshotJson: toInputJson({
              scopeType: input.scope.scopeType,
              label: input.scope.label,
              learningPathIds: input.scope.learningPathIds,
              lessonIds: input.scope.lessonIds ?? [],
              preferredLessonIds: preferredLessons.map((lesson) => lesson.id),
              simulationContext: {
                surface: input.simulationSurface ?? null,
                activityState: input.activityState ?? null,
                targetType: input.targetType ?? null,
                targetId: input.targetId ?? null,
                policy: input.responsePolicy,
                answerAccess: input.answerAccess,
                videoPlaybackSeconds: input.videoPlaybackSeconds ?? null,
                videoSourceSeconds: videoSourceSeconds ?? null,
              },
            }),
            defaultConfigurationVersion: input.routeSnapshot.version,
            sessionConfigurationVersion: session.configurationVersion,
            configurationOverrideSnapshotJson: input.configurationOverride
              ? toInputJson(input.configurationOverride)
              : undefined,
            effectiveConfigurationJson: toInputJson({
              ...serializeEffectiveRoute(input.routeSnapshot),
              ...serializeChatRuntimeSettings(input.runtimeSettings),
            }),
          },
        });
      }
      await transaction.aiChatSession.update({
        where: { id: session.id },
        data: { lastMessageAt: now },
      });
      return {
        conversationId: session.id,
        configurationVersion: session.configurationVersion,
        userMessageId: userMessage.id,
        assistantMessageId: assistant.id,
        aiGenerationId: generation.id,
        initialTitle,
      };
    });

    try {
      const [sources, authorizedScopeManifest] = await Promise.all([
        this.retrieval.retrieve({
          query: [input.question, targetContext?.searchText]
            .filter((value): value is string => Boolean(value))
            .join("\n"),
          scopeQuery: input.question,
          learningPathIds: input.scope.learningPathIds,
          lessonIds: input.scope.lessonIds,
          surfaceLessonId: input.surfaceLessonId,
          preferredLessonIds: preferredLessons.map((lesson) => lesson.id),
          videoSourceSeconds,
          conversationId: created.conversationId,
          aiGenerationId: created.aiGenerationId,
          embeddingIdempotencyKey: `chat-retrieval:${input.actorUserId}:${randomUUID()}`,
          embeddingConfig: {
            provider: input.runtimeSettings.embeddingProvider,
            model: input.runtimeSettings.embeddingModel,
            dimensions: input.runtimeSettings.embeddingDimensions,
          },
          maxChunks: resolveAiChatRetrievalChunkLimit(input.scope.scopeType),
          maxTokens: this.config.get("AI_CHAT_MAX_CONTEXT_TOKENS", { infer: true }),
        }),
        inputImages.length > 0
          ? this.scopeManifest.build(input.scope, input.surfaceLessonId)
          : Promise.resolve(null),
      ]);
      const limitedHistory = limitChatHistory(
        history.reverse().map((message) => ({
          role: message.role,
          text: readMessageText(message.contentJson),
        })),
        this.config.get("AI_CHAT_MAX_HISTORY_TOKENS", { infer: true }),
      );
      const sourceLearningPathIds = [
        ...new Set([
          ...sources.map((source) => source.learningPathId),
          ...(targetContext ? [targetContext.learningPathId] : []),
        ]),
      ];
      const sourceLessonIds = [
        ...new Set([
          ...sources.map((source) => source.lessonId),
          ...(targetContext ? [targetContext.lessonId] : []),
        ]),
      ];
      const providerInput = this.prompts.build({
        question: input.question,
        policy: input.responsePolicy,
        answerAccess: input.answerAccess,
        scopeLabel: input.scope.label,
        subjectKeys: resolveAiChatTurnSubjectKeys({
          scopeSubjects: input.scope.subjects,
          targetLearningPathId: targetContext?.learningPathId,
          sourceLearningPathIds,
        }),
        sources,
        history: limitedHistory,
        inputImages,
        historyImageCount: historicalAttachmentInput.inputImages.length,
        maxTokens:
          input.routeSnapshot.maxOutputTokens ??
          this.config.get("AI_CHAT_MAX_OUTPUT_TOKENS", { infer: true }),
        targetContext: targetContext?.promptText,
        scopeManifest: authorizedScopeManifest?.text,
        preferredLessons,
      });
      await this.prisma.$transaction(async (transaction) => {
        await transaction.aiChatMessage.update({
          where: { id: created.assistantMessageId },
          data: {
            status: AiChatMessageStatus.GENERATING,
            contentJson: { text: "" },
            targetType: targetContext?.targetType ?? input.targetType,
            targetId: targetContext?.targetId ?? input.targetId,
            sourceLearningPathIds,
            sourceLessonIds,
            retrievedChunkIds: sources.map((source) => source.chunkId),
            contextJson: {
              sources: uniqueSourceLabels(sources),
              preferredLessons,
              answerAccess: input.answerAccess,
              videoPlaybackSeconds: input.videoPlaybackSeconds ?? null,
              videoSourceSeconds: videoSourceSeconds ?? null,
            },
          },
        });
        await transaction.aiGeneration.update({
          where: { id: created.aiGenerationId },
          data: {
            inputMetaJson: {
              scopeType: input.scope.scopeType,
              learningPathIds: input.scope.learningPathIds,
              lessonIds: input.scope.lessonIds ?? [],
              preferredLessonIds: preferredLessons.map((lesson) => lesson.id),
              sourceChunkIds: sources.map((source) => source.chunkId),
              videoPlaybackSeconds: input.videoPlaybackSeconds ?? null,
              videoSourceSeconds: videoSourceSeconds ?? null,
              imageCount: inputImages.length,
              currentImageCount: attachmentInput.files.length,
              historyImageCount: historicalAttachmentInput.inputImages.length,
              imageResponseMode: inputImages.length > 0 ? "SINGLE_PASS" : null,
              scopeManifestAuthorizedLearningPathCount:
                authorizedScopeManifest?.authorizedLearningPathCount ?? 0,
              scopeManifestListedLearningPathCount:
                authorizedScopeManifest?.listedLearningPathCount ?? 0,
              scopeManifestListedLessonCount:
                authorizedScopeManifest?.listedLessonCount ?? 0,
              scopeManifestTruncated: authorizedScopeManifest?.truncated ?? false,
              policy: input.responsePolicy,
              effectiveConfiguration: {
                ...serializeEffectiveRoute(input.routeSnapshot),
                ...serializeChatRuntimeSettings(input.runtimeSettings),
              },
            },
          },
        });
        if (input.traceAdminTurn) {
          await transaction.aiChatTurnTrace.update({
            where: { aiGenerationId: created.aiGenerationId },
            data: {
              providerRequestSnapshotJson: toInputJson(
                serializeProviderRequest(providerInput, {
                  history: limitedHistory,
                  sources,
                  imageCount: inputImages.length,
                  route: input.routeSnapshot,
                }),
              ),
            },
          });
        }
      });
      return {
        ...created,
        policy: input.responsePolicy,
        input: providerInput,
        sources,
        actorUserId: input.actorUserId,
        initialQuestion: input.question,
        shouldGenerateTitle: input.existingSession === null,
        countTowardDailyQuota: input.ownerMode === AiChatSessionMode.STUDENT,
        includeAdminMetrics: input.traceAdminTurn,
        routeSnapshot: input.routeSnapshot,
      } satisfies PreparedAiChatTurn;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Chat preparation failed";
      await this.prisma.$transaction([
        this.prisma.aiChatMessage.updateMany({
          where: {
            id: created.assistantMessageId,
            status: AiChatMessageStatus.GENERATING,
          },
          data: {
            status: AiChatMessageStatus.FAILED,
            errorCode: "AI_CHAT_PREPARATION_FAILED",
          },
        }),
        this.prisma.aiGeneration.updateMany({
          where: {
            id: created.aiGenerationId,
            status: AiGenerationStatus.RUNNING,
          },
          data: {
            status: AiGenerationStatus.FAILED,
            errorMessage: message,
            finishedAt: new Date(),
          },
        }),
      ]);
      throw error;
    }
  }

  async *streamTurn(turn: PreparedAiChatTurn): AsyncGenerator<AiChatSseEvent> {
    let settled = false;
    try {
      yield {
        type: "started",
        conversationId: turn.conversationId,
        userMessageId: turn.userMessageId,
        assistantMessageId: turn.assistantMessageId,
        policy: turn.policy,
        title: turn.initialTitle,
      };
      if (!turn.aiGenerationId) {
        throw new Error("AI chat turn is missing provider input.");
      }

      let fullText = "";
      let titlePromise: Promise<string | null> | null = null;
      let titleSettled = false;
      const responseStream = this.providerCalls.streamText(
        {
          feature: AiGenerationType.CHAT,
          aiGenerationId: turn.aiGenerationId,
          operation: "CHAT_RESPONSE_GENERATION",
          targetContext: buildWholeFeatureUsageTarget(
            AiGenerationType.CHAT,
            turn.conversationId,
          ),
          idempotencyKey: `ai-chat:${turn.assistantMessageId}`,
          routeSnapshot: turn.routeSnapshot,
        },
        turn.input,
      );
      const responseIterator = responseStream[Symbol.asyncIterator]();
      let nextResponse = responseIterator.next();

      while (true) {
        const responseRace = nextResponse.then((result) => ({
          kind: "response" as const,
          result,
        }));
        const winner =
          titlePromise && !titleSettled
            ? await Promise.race([
                responseRace,
                titlePromise.then((title) => ({
                  kind: "title" as const,
                  title,
                })),
              ])
            : await responseRace;

        if (winner.kind === "title") {
          titleSettled = true;
          if (winner.title) {
            yield {
              type: "title_updated",
              conversationId: turn.conversationId,
              title: winner.title,
            };
          }
          continue;
        }

        if (winner.result.done) break;
        const event = winner.result.value;
        if (!titlePromise && turn.shouldGenerateTitle) {
          titlePromise = this.generateAndPersistConversationTitle(turn);
        }
        if (event.type === "delta") {
          fullText += event.delta;
          yield {
            type: "delta",
            assistantMessageId: turn.assistantMessageId,
            delta: event.delta,
          };
        } else {
          const rawText = fullText.trim();
          const repairedAnswer = repairChatAnswerText(rawText);
          if (!repairedAnswer.valid) {
            const replacement = buildMalformedMathReplacement(turn.initialQuestion);
            await this.persistMalformedMathFailure(turn, replacement);
            settled = true;
            yield {
              type: "failed",
              assistantMessageId: turn.assistantMessageId,
              code: "AI_CHAT_MALFORMED_MATH",
              message: replacement,
            };
            return;
          }
          await this.prisma.$transaction([
            this.prisma.aiChatMessage.update({
              where: { id: turn.assistantMessageId },
              data: {
                status: AiChatMessageStatus.COMPLETED,
                contentJson: { text: repairedAnswer.text },
                ...(turn.countTowardDailyQuota
                  ? { dailyQuotaCountedAt: new Date() }
                  : {}),
              },
            }),
            this.prisma.aiGeneration.update({
              where: { id: turn.aiGenerationId! },
              data: {
                status: AiGenerationStatus.SUCCEEDED,
                provider: event.output.provider,
                model: event.output.model,
                providerRequestId: event.output.providerRequestId,
                promptTokens: event.output.usage?.promptTokens,
                completionTokens: event.output.usage?.completionTokens,
                totalTokens: event.output.usage?.totalTokens,
                latencyMs: event.output.latencyMs,
                outputHash: hash(repairedAnswer.text),
                outputJson: {
                  text: repairedAnswer.text,
                  autoRepairApplied: repairedAnswer.repaired,
                },
                finishedAt: new Date(),
              },
            }),
            this.prisma.aiChatSession.update({
              where: { id: turn.conversationId },
              data: { lastMessageAt: new Date() },
            }),
            ...(turn.countTowardDailyQuota
              ? [
                  this.prisma.aiChatMessageAttachment.updateMany({
                    where: {
                      messageId: turn.userMessageId,
                      dailyQuotaCountedAt: null,
                    },
                    data: { dailyQuotaCountedAt: new Date() },
                  }),
                ]
              : []),
          ]);
          settled = true;
        }
        nextResponse = responseIterator.next();
      }
      if (titlePromise && !titleSettled) {
        const title = await titlePromise;
        titleSettled = true;
        if (title) {
          yield {
            type: "title_updated",
            conversationId: turn.conversationId,
            title,
          };
        }
      }
      const message = await this.getMessageById(
        turn.assistantMessageId,
        turn.includeAdminMetrics,
      );
      yield { type: "completed", conversationId: turn.conversationId, message };
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI provider failed";
      await this.prisma.$transaction(async (transaction) => {
        await transaction.aiChatMessage.updateMany({
          where: {
            id: turn.assistantMessageId,
            status: AiChatMessageStatus.GENERATING,
          },
          data: {
            status: AiChatMessageStatus.FAILED,
            errorCode: "AI_CHAT_PROVIDER_FAILED",
            contentJson: { text: "" },
          },
        });
        if (turn.aiGenerationId) {
          await transaction.aiGeneration.updateMany({
            where: {
              id: turn.aiGenerationId,
              status: AiGenerationStatus.RUNNING,
            },
            data: {
              status: AiGenerationStatus.FAILED,
              errorMessage: message,
              finishedAt: new Date(),
            },
          });
        }
      });
      settled = true;
      yield {
        type: "failed",
        assistantMessageId: turn.assistantMessageId,
        code: "AI_CHAT_PROVIDER_FAILED",
        message: "Chat AI đang bận. Vui lòng thử lại sau.",
      };
    } finally {
      if (!settled && turn.aiGenerationId) {
        await this.prisma.$transaction(async (transaction) => {
          await transaction.aiChatMessage.updateMany({
            where: {
              id: turn.assistantMessageId,
              status: AiChatMessageStatus.GENERATING,
            },
            data: {
              status: AiChatMessageStatus.INTERRUPTED,
              errorCode: "AI_CHAT_STREAM_INTERRUPTED",
            },
          });
          await transaction.aiGeneration.updateMany({
            where: {
              id: turn.aiGenerationId!,
              status: AiGenerationStatus.RUNNING,
            },
            data: {
              status: AiGenerationStatus.FAILED,
              errorMessage: "Client disconnected before the AI stream completed.",
              finishedAt: new Date(),
            },
          });
        });
      }
    }
  }

  private async assertDailyLimits(
    studentUserId: string,
    messageLimit: number,
    imageLimit: number,
    incomingImageCount: number,
  ) {
    const { messageCount, imageCount } = await this.getDailyQuotaUsage(studentUserId);
    if (messageCount >= messageLimit) {
      throwForbidden(
        "AI_CHAT_DAILY_LIMIT_REACHED",
        `Bạn đã dùng hết ${messageLimit} câu hỏi Chat AI hôm nay.`,
      );
    }
    this.assertDailyImageLimit(imageCount, incomingImageCount, imageLimit);
  }

  private async getDailyQuotaUsage(studentUserId: string) {
    const start = startOfTodayInHoChiMinh();
    const [messageCount, imageCount] = await Promise.all([
      this.prisma.aiChatMessage.count({
        where: {
          role: AiChatMessageRole.ASSISTANT,
          status: AiChatMessageStatus.COMPLETED,
          dailyQuotaCountedAt: { gte: start },
          session: { studentUserId },
        },
      }),
      this.prisma.aiChatMessageAttachment.count({
        where: {
          dailyQuotaCountedAt: { gte: start },
          message: { session: { studentUserId } },
        },
      }),
    ]);
    return { messageCount, imageCount };
  }

  private async lockAndAssertDailyLimits(
    transaction: Prisma.TransactionClient,
    studentUserId: string,
    messageLimit: number,
    imageLimit: number,
    incomingImageCount: number,
  ) {
    await transaction.$queryRaw`
      SELECT "id"
      FROM "users"
      WHERE "id" = ${studentUserId}::uuid
      FOR UPDATE
    `;
    const start = startOfTodayInHoChiMinh();
    const [messageCount, imageCount] = await Promise.all([
      transaction.aiChatMessage.count({
        where: {
          role: AiChatMessageRole.ASSISTANT,
          status: AiChatMessageStatus.COMPLETED,
          dailyQuotaCountedAt: { gte: start },
          session: { studentUserId },
        },
      }),
      transaction.aiChatMessageAttachment.count({
        where: {
          dailyQuotaCountedAt: { gte: start },
          message: {
            session: { studentUserId },
          },
        },
      }),
    ]);
    if (messageCount >= messageLimit) {
      throwForbidden(
        "AI_CHAT_DAILY_LIMIT_REACHED",
        `Bạn đã dùng hết ${messageLimit} câu hỏi Chat AI hôm nay.`,
      );
    }
    this.assertDailyImageLimit(imageCount, incomingImageCount, imageLimit);
  }

  private assertDailyImageLimit(
    currentImageCount: number,
    incomingImageCount: number,
    imageLimit: number,
  ) {
    if (currentImageCount + incomingImageCount > imageLimit) {
      throwForbidden(
        "AI_CHAT_DAILY_IMAGE_LIMIT_REACHED",
        `Bạn chỉ được gửi tối đa ${imageLimit} ảnh trong các câu hỏi Chat AI mỗi ngày.`,
      );
    }
  }

  private async resolveTargetContext(input: {
    studentUserId: string;
    surfaceLessonId?: string;
    targetType?: string;
    targetId?: string;
    policy: AiChatResponsePolicy;
    learningPathIds: string[];
  }): Promise<{
    targetType: string;
    targetId: string;
    learningPathId: string;
    lessonId: string;
    searchText: string;
    promptText: string;
  } | null> {
    let targetType = input.targetType;
    let targetId = input.targetId;

    if ((!targetType || !targetId) && input.policy === AiChatResponsePolicy.HINT_ONLY) {
      const quizAttempt = await this.prisma.quizAttempt.findFirst({
        where: {
          studentUserId: input.studentUserId,
          status: "IN_PROGRESS",
          ...(input.surfaceLessonId ? { lessonId: input.surfaceLessonId } : {}),
        },
        orderBy: { startedAt: "desc" },
        select: {
          currentQuestionIndex: true,
          quizSet: {
            select: {
              questions: {
                where: { deletedAt: null },
                orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                select: { id: true },
              },
            },
          },
        },
      });
      const currentQuestion =
        quizAttempt?.quizSet.questions[quizAttempt.currentQuestionIndex];
      if (currentQuestion) {
        targetType = "QUIZ_QUESTION";
        targetId = currentQuestion.id;
      } else {
        const studySession = await this.prisma.flashcardStudySession.findFirst({
          where: {
            studentUserId: input.studentUserId,
            status: "IN_PROGRESS",
            ...(input.surfaceLessonId ? { lessonId: input.surfaceLessonId } : {}),
          },
          orderBy: { startedAt: "desc" },
          select: {
            reviewedCount: true,
            items: {
              orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
              select: { flashcardId: true },
            },
          },
        });
        const currentCard = studySession?.items[studySession.reviewedCount];
        if (currentCard) {
          targetType = "FLASHCARD";
          targetId = currentCard.flashcardId;
        }
      }
    }

    if (!targetType || !targetId) return null;
    if (targetType === "QUIZ_QUESTION") {
      const question = await this.prisma.quizQuestion.findFirst({
        where: { id: targetId, ...studentVisibleQuizQuestionWhere },
        select: {
          id: true,
          lesson: { select: { id: true, learningPathId: true } },
          questionJson: true,
          optionsJson: true,
          hintJson: true,
          correctAnswerJson: true,
          explanation: { select: { contentJson: true } },
        },
      });
      if (
        !question ||
        !input.learningPathIds.includes(question.lesson.learningPathId) ||
        (input.surfaceLessonId && question.lesson.id !== input.surfaceLessonId)
      ) {
        throwForbidden(
          "AI_CHAT_TARGET_ACCESS_DENIED",
          "Câu hỏi không thuộc phạm vi Chat AI được phép.",
        );
      }
      const questionText = flattenJsonText(question.questionJson)
        .join(" ")
        .slice(0, 2_000);
      const options = readAnswerOptions(question.optionsJson);
      const optionsText = formatAnswerOptions(options);
      const hintText = flattenJsonText(question.hintJson).join(" ").slice(0, 800);
      const answerText = flattenJsonText(question.correctAnswerJson);
      const correctOptionTexts = readCorrectOptionTexts(options, answerText);
      const explanationText = flattenJsonText(question.explanation?.contentJson)
        .join(" ")
        .slice(0, 2_000);
      return {
        targetType,
        targetId,
        learningPathId: question.lesson.learningPathId,
        lessonId: question.lesson.id,
        searchText: questionText,
        promptText:
          input.policy === AiChatResponsePolicy.HINT_ONLY
            ? `Đề: ${questionText}${optionsText ? `\nCác lựa chọn:\n${optionsText}` : ""}${hintText ? `\nGợi ý đã duyệt: ${hintText}` : ""}`
            : `Đề: ${questionText}${optionsText ? `\nCác lựa chọn:\n${optionsText}` : ""}\nĐáp án đã duyệt: ${[...answerText, ...correctOptionTexts].join(" ")}${explanationText ? `\nLời giải đã duyệt: ${explanationText}` : ""}`,
      };
    }
    if (targetType === "TEST_QUESTION") {
      const question = await this.prisma.testQuestion.findFirst({
        where: { id: targetId, ...studentVisibleTestQuestionWhere },
        select: {
          id: true,
          lesson: { select: { id: true, learningPathId: true } },
          questionJson: true,
          optionsJson: true,
          hintJson: true,
          correctAnswerJson: true,
          explanation: { select: { contentJson: true } },
        },
      });
      if (
        !question ||
        !input.learningPathIds.includes(question.lesson.learningPathId) ||
        (input.surfaceLessonId && question.lesson.id !== input.surfaceLessonId)
      ) {
        throwForbidden(
          "AI_CHAT_TARGET_ACCESS_DENIED",
          "Câu hỏi bài thi không thuộc phạm vi Chat AI được phép.",
        );
      }
      const questionText = flattenJsonText(question.questionJson)
        .join(" ")
        .slice(0, 2_000);
      const options = readAnswerOptions(question.optionsJson);
      const optionsText = formatAnswerOptions(options);
      const hintText = flattenJsonText(question.hintJson).join(" ").slice(0, 800);
      const answerText = flattenJsonText(question.correctAnswerJson);
      const correctOptionTexts = readCorrectOptionTexts(options, answerText);
      const explanationText = flattenJsonText(question.explanation?.contentJson)
        .join(" ")
        .slice(0, 2_000);
      return {
        targetType,
        targetId,
        learningPathId: question.lesson.learningPathId,
        lessonId: question.lesson.id,
        searchText: questionText,
        promptText:
          input.policy === AiChatResponsePolicy.HINT_ONLY
            ? `Đề bài thi: ${questionText}${optionsText ? `\nCác lựa chọn:\n${optionsText}` : ""}${hintText ? `\nGợi ý đã duyệt: ${hintText}` : ""}`
            : `Đề bài thi: ${questionText}${optionsText ? `\nCác lựa chọn:\n${optionsText}` : ""}\nĐáp án đã duyệt: ${[...answerText, ...correctOptionTexts].join(" ")}${explanationText ? `\nLời giải đã duyệt: ${explanationText}` : ""}`,
      };
    }
    if (targetType === "FLASHCARD") {
      const flashcard = await this.prisma.flashcard.findFirst({
        where: { id: targetId, ...studentVisibleFlashcardWhere },
        select: {
          id: true,
          lesson: { select: { id: true, learningPathId: true } },
          frontJson: true,
          hintJson: true,
          backJson: true,
          solutionJson: true,
        },
      });
      if (
        !flashcard ||
        !input.learningPathIds.includes(flashcard.lesson.learningPathId) ||
        (input.surfaceLessonId && flashcard.lesson.id !== input.surfaceLessonId)
      ) {
        throwForbidden(
          "AI_CHAT_TARGET_ACCESS_DENIED",
          "Flashcard không thuộc phạm vi Chat AI được phép.",
        );
      }
      const front = flattenJsonText(flashcard.frontJson).join(" ").slice(0, 2_000);
      const hint = flattenJsonText(flashcard.hintJson).join(" ").slice(0, 800);
      const answer = [
        ...flattenJsonText(flashcard.backJson),
        ...flattenJsonText(flashcard.solutionJson),
      ];
      return {
        targetType,
        targetId,
        learningPathId: flashcard.lesson.learningPathId,
        lessonId: flashcard.lesson.id,
        searchText: front,
        promptText:
          input.policy === AiChatResponsePolicy.HINT_ONLY
            ? `Mặt trước: ${front}${hint ? `\nGợi ý đã duyệt: ${hint}` : ""}`
            : `Mặt trước: ${front}\nMặt sau/lời giải đã duyệt: ${answer.join(" ")}`,
      };
    }
    throwBadRequest("AI_CHAT_TARGET_INVALID", "Loại nội dung cần hỏi chưa được hỗ trợ.");
  }

  private async persistMalformedMathFailure(
    turn: PreparedAiChatTurn,
    replacement: string,
  ) {
    await this.prisma.$transaction([
      this.prisma.aiChatMessage.update({
        where: { id: turn.assistantMessageId },
        data: {
          status: AiChatMessageStatus.FAILED,
          contentJson: { text: replacement },
          errorCode: "AI_CHAT_MALFORMED_MATH",
        },
      }),
      this.prisma.aiGeneration.update({
        where: { id: turn.aiGenerationId! },
        data: {
          status: AiGenerationStatus.FAILED,
          errorMessage:
            "Chat output still had malformed LaTeX after deterministic auto-repair.",
          finishedAt: new Date(),
        },
      }),
    ]);
  }

  private async generateAndPersistConversationTitle(
    turn: PreparedAiChatTurn,
  ): Promise<string | null> {
    let titleGenerationId: string | null = null;
    try {
      const generation = await this.prisma.aiGeneration.create({
        data: {
          type: AiGenerationType.CHAT,
          status: AiGenerationStatus.RUNNING,
          createdByUserId: turn.actorUserId,
          targetType: "AI_CHAT_SESSION_TITLE",
          targetId: turn.conversationId,
          promptVersion: "ai-chat-title-v3",
          inputHash: hash(turn.initialQuestion),
          inputMetaJson: {
            conversationId: turn.conversationId,
            source: "FIRST_USER_MESSAGE",
          },
          startedAt: new Date(),
        },
        select: { id: true },
      });
      titleGenerationId = generation.id;
      let rawTitle = "";
      let completedOutput: AiTextOutput | null = null;
      for await (const event of this.providerCalls.streamText(
        {
          feature: AiGenerationType.CHAT,
          aiGenerationId: generation.id,
          operation: "CHAT_TITLE_GENERATION",
          targetContext: buildWholeFeatureUsageTarget(
            AiGenerationType.CHAT,
            turn.conversationId,
          ),
          idempotencyKey: `ai-chat-title:${turn.conversationId}`,
          routeSnapshot: turn.routeSnapshot
            ? {
                ...turn.routeSnapshot,
                reasoningEffort: "low",
                fallbackReasoningEffort: turn.routeSnapshot.fallbackReasoningEffort
                  ? "low"
                  : null,
              }
            : undefined,
          maxOutputTokensOverride: 128,
        },
        this.prompts.buildConversationTitle(turn.initialQuestion),
      )) {
        if (event.type === "delta") {
          rawTitle += event.delta;
        } else {
          completedOutput = event.output;
          if (!rawTitle) rawTitle = event.output.text;
        }
      }
      if (!completedOutput) {
        throw new Error("AI title stream ended without completion metadata.");
      }
      const title = normalizeAiConversationTitle(rawTitle);
      if (!title) {
        throw new Error("AI returned an empty conversation title.");
      }
      const [updated] = await this.prisma.$transaction([
        this.prisma.aiChatSession.updateMany({
          where: {
            id: turn.conversationId,
            title: turn.initialTitle,
          },
          data: { title },
        }),
        this.prisma.aiGeneration.update({
          where: { id: generation.id },
          data: {
            status: AiGenerationStatus.SUCCEEDED,
            provider: completedOutput.provider,
            model: completedOutput.model,
            providerRequestId: completedOutput.providerRequestId,
            promptTokens: completedOutput.usage?.promptTokens,
            completionTokens: completedOutput.usage?.completionTokens,
            totalTokens: completedOutput.usage?.totalTokens,
            latencyMs: completedOutput.latencyMs,
            outputHash: hash(title),
            outputJson: { title },
            finishedAt: new Date(),
          },
        }),
      ]);
      return updated.count > 0 ? title : null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (titleGenerationId) {
        await this.prisma.aiGeneration.updateMany({
          where: {
            id: titleGenerationId,
            status: AiGenerationStatus.RUNNING,
          },
          data: {
            status: AiGenerationStatus.FAILED,
            errorMessage: message,
            finishedAt: new Date(),
          },
        });
      }
      this.logger.warn(
        `AI conversation title generation failed for ${turn.conversationId}: ${message}`,
      );
      return null;
    }
  }

  private async getMessageById(messageId: string, includeAdminMetrics = false) {
    if (includeAdminMetrics) {
      const message = await this.prisma.aiChatMessage.findUniqueOrThrow({
        where: { id: messageId },
        include: adminMessageInclude,
      });
      return this.serializeAdminMessage(message);
    }
    const message = await this.prisma.aiChatMessage.findUniqueOrThrow({
      where: { id: messageId },
      include: messageInclude,
    });
    return this.serializeMessage(message);
  }

  private async serializeMessage(
    message: Prisma.AiChatMessageGetPayload<{ include: typeof messageInclude }>,
    allowedLearningPathIds?: string[],
  ) {
    const isRevokedSource =
      message.role === AiChatMessageRole.ASSISTANT &&
      allowedLearningPathIds !== undefined &&
      message.sourceLearningPathIds.some(
        (pathId) => !allowedLearningPathIds.includes(pathId),
      );
    return {
      id: message.id,
      role: message.role,
      status: message.status,
      responsePolicy: message.responsePolicy,
      text: isRevokedSource
        ? "Nội dung này tạm ẩn vì bạn không còn quyền truy cập khóa học nguồn."
        : readMessageText(message.contentJson),
      errorCode: message.errorCode,
      turnTraceId: message.turnTraceAsAssistant?.id ?? null,
      sources: isRevokedSource ? [] : readSourceLabels(message.contextJson),
      attachments: await Promise.all(
        message.attachments.map(async (attachment) => ({
          id: attachment.file.id,
          name: attachment.file.originalName,
          mimeType: attachment.file.mimeType,
          sizeBytes: Number(attachment.file.sizeBytes),
          url: await this.files.resolveAccessUrl(attachment.file),
        })),
      ),
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };
  }

  private async serializeAdminMessage(
    message: Prisma.AiChatMessageGetPayload<{
      include: typeof adminMessageInclude;
    }>,
  ) {
    const serialized = await this.serializeMessage(message);
    if (message.role !== AiChatMessageRole.ASSISTANT || !message.aiGeneration) {
      return { ...serialized, turnMetrics: null };
    }
    const timeToFirstTokenMs =
      message.aiGeneration.providerUsageEvents
        .filter((event) => event.operation === "CHAT_RESPONSE_GENERATION")
        .map((event) => readTimeToFirstToken(event.rawUsageJson))
        .find((value) => value !== null) ?? null;
    return {
      ...serialized,
      turnMetrics: {
        totalCostVnd: message.aiGeneration.providerUsageEvents.reduce(
          (total, event) => total + event.costVnd,
          0,
        ),
        timeToFirstTokenMs,
        responseLatencyMs: message.aiGeneration.latencyMs,
      },
    };
  }
}

export function resolveAdminSimulationContext(
  dto: CreateAdminAiChatMessageDto | ContinueAdminAiChatMessageDto,
  scope: AiChatScopeAccess,
  surfaceLessonId?: string,
): {
  simulationSurface?: AdminAiChatSimulationSurface;
  activityState?: AiChatActivityState;
  targetType?: string;
  targetId?: string;
  policy: AiChatResponsePolicy;
  answerAccess: AiChatAnswerAccess;
} {
  const surface = dto.simulationSurface;
  if (
    dto.surfaceLessonId &&
    (scope.scopeType === AiChatScopeType.COURSE_SET ||
      (scope.scopeType === AiChatScopeType.LESSON &&
        dto.surfaceLessonId !== scope.lessonIds?.[0]))
  ) {
    throwBadRequest(
      "ADMIN_AI_CHAT_SURFACE_LESSON_INVALID",
      "Buổi học hiện tại không phù hợp với phạm vi mô phỏng.",
    );
  }
  if (!surface) {
    if (
      dto.activityState ||
      dto.targetType ||
      dto.targetId ||
      dto.videoPlaybackSeconds !== undefined
    ) {
      throwBadRequest(
        "ADMIN_AI_CHAT_SIMULATION_CONTEXT_INVALID",
        "Target mô phỏng chỉ được gửi khi đã chọn một tab ngữ cảnh.",
      );
    }
    return {
      policy: AiChatResponsePolicy.FULL_ANSWER,
      answerAccess: "FULL_SCOPE",
    };
  }
  if (
    !surfaceLessonId ||
    (scope.scopeType !== AiChatScopeType.LESSON &&
      scope.scopeType !== AiChatScopeType.COURSE)
  ) {
    throwBadRequest(
      "ADMIN_AI_CHAT_SIMULATION_LESSON_REQUIRED",
      "Vui lòng chọn buổi học hiện tại để mô phỏng màn học sinh.",
    );
  }
  if (surface === "VIDEO_SUMMARY" || surface === "KNOWLEDGE") {
    if (dto.activityState || dto.targetType || dto.targetId) {
      throwBadRequest(
        "ADMIN_AI_CHAT_SIMULATION_TARGET_NOT_ALLOWED",
        "Tóm tắt video và Sinh kiến thức không nhận target câu hỏi.",
      );
    }
    if (surface === "VIDEO_SUMMARY" && dto.videoPlaybackSeconds === undefined) {
      throwBadRequest(
        "ADMIN_AI_CHAT_VIDEO_PLAYBACK_REQUIRED",
        "Vui lòng nhập mốc phát video để mô phỏng ngữ cảnh hiện tại.",
      );
    }
    if (surface === "KNOWLEDGE" && dto.videoPlaybackSeconds !== undefined) {
      throwBadRequest(
        "ADMIN_AI_CHAT_VIDEO_PLAYBACK_NOT_ALLOWED",
        "Mốc phát video chỉ dùng cho bề mặt Tóm tắt video.",
      );
    }
    return {
      simulationSurface: surface,
      policy: AiChatResponsePolicy.FULL_ANSWER,
      answerAccess: "FULL_SCOPE",
    };
  }

  const expectedTargetType =
    surface === "QUIZ"
      ? "QUIZ_QUESTION"
      : surface === "FLASHCARD"
        ? "FLASHCARD"
        : "TEST_QUESTION";
  if (dto.videoPlaybackSeconds !== undefined) {
    throwBadRequest(
      "ADMIN_AI_CHAT_VIDEO_PLAYBACK_NOT_ALLOWED",
      "Mốc phát video chỉ dùng cho bề mặt Video.",
    );
  }
  if (!dto.targetId || dto.targetType !== expectedTargetType || !dto.activityState) {
    throwBadRequest(
      "ADMIN_AI_CHAT_SIMULATION_TARGET_REQUIRED",
      "Vui lòng chọn đúng một câu hoặc thẻ và trạng thái mô phỏng.",
    );
  }
  const decision = resolveAiChatActivityPolicy({
    kind: surface,
    state: dto.activityState,
  });
  if (!decision) {
    throwBadRequest(
      "ADMIN_AI_CHAT_SIMULATION_STATE_INVALID",
      "Trạng thái mô phỏng không đúng hành vi của học sinh.",
    );
  }
  return {
    simulationSurface: surface,
    activityState: dto.activityState,
    targetType: dto.targetType,
    targetId: dto.targetId,
    ...decision,
  };
}

export function resolveVideoSourceSeconds(
  playbackSeconds: number,
  customVideoSettings: unknown,
) {
  const settings =
    customVideoSettings &&
    typeof customVideoSettings === "object" &&
    !Array.isArray(customVideoSettings)
      ? (customVideoSettings as Record<string, unknown>)
      : {};
  const offset =
    settings.isDisabled === true
      ? 0
      : typeof settings.startTimeInSeconds === "number" &&
          Number.isFinite(settings.startTimeInSeconds)
        ? Math.max(0, settings.startTimeInSeconds)
        : 5;
  return Math.round((Math.max(0, playbackSeconds) + offset) * 100) / 100;
}

function serializeConversation(
  row: Prisma.AiChatSessionGetPayload<{ select: typeof conversationSelect }>,
) {
  return {
    id: row.id,
    scopeType: row.scopeType,
    learningPathId: row.learningPathId,
    title: row.title ?? "Cuộc trò chuyện mới",
    scopeLabel:
      row.scopeType === AiChatScopeType.LIBRARY
        ? "Các khóa học đã mua"
        : (row.learningPath?.title ?? "Khóa học"),
    lastMessageAt: row.lastMessageAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function serializeAdminConversation(row: {
  id: string;
  scopeType: AiChatScopeType;
  title: string | null;
  configurationVersion: number;
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  scopeItems: Array<{
    learningPathId: string;
    lessonId: string | null;
    learningPath: { title: string };
    lesson: { title: string } | null;
  }>;
  messages: Array<{
    contentJson: Prisma.JsonValue;
    status: AiChatMessageStatus;
    surfaceLessonId: string | null;
  }>;
}) {
  return {
    id: row.id,
    scopeType: row.scopeType,
    title: row.title ?? "Phiên mô phỏng mới",
    scopeLabel: buildAdminScopeLabel(row.scopeType, row.scopeItems),
    scopeItems: row.scopeItems.map((item) => ({
      learningPathId: item.learningPathId,
      learningPathTitle: item.learningPath.title,
      lessonId: item.lessonId,
      lessonTitle: item.lesson?.title ?? null,
    })),
    lastSurfaceLessonId: row.messages[0]?.surfaceLessonId ?? null,
    configurationVersion: row.configurationVersion,
    preview: readMessageText(row.messages[0]?.contentJson).slice(0, 140),
    lastMessageStatus: row.messages[0]?.status ?? null,
    lastMessageAt: row.lastMessageAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function buildAdminScopeLabel(
  scopeType: AiChatScopeType,
  items: Array<{
    learningPath: { title: string };
    lesson: { title: string } | null;
  }>,
) {
  const first = items[0];
  if (scopeType === AiChatScopeType.LESSON) {
    return first
      ? `${first.learningPath.title} / ${first.lesson?.title ?? "Buổi học"}`
      : "Buổi học";
  }
  if (scopeType === AiChatScopeType.COURSE) {
    return first?.learningPath.title ?? "Khóa học";
  }
  return `${items.length} khóa học`;
}

function normalizeChatOverride(
  value: AiChatConfigurationOverride | null | undefined,
): AiChatConfigurationOverride | null {
  if (!value) return null;
  const normalized: AiChatConfigurationOverride = {};
  if (value.primaryCatalogItemId !== undefined) {
    normalized.primaryCatalogItemId = value.primaryCatalogItemId;
  }
  if (value.fallbackCatalogItemId !== undefined) {
    normalized.fallbackCatalogItemId = value.fallbackCatalogItemId;
  }
  if (value.temperature !== undefined) normalized.temperature = value.temperature;
  if (value.reasoningEffort !== undefined) {
    normalized.reasoningEffort = value.reasoningEffort;
  }
  if (value.maxInputTokens !== undefined) {
    normalized.maxInputTokens = value.maxInputTokens;
  }
  if (value.maxOutputTokens !== undefined) {
    normalized.maxOutputTokens = value.maxOutputTokens;
  }
  if (value.fallbackTemperature !== undefined) {
    normalized.fallbackTemperature = value.fallbackTemperature;
  }
  if (value.fallbackReasoningEffort !== undefined) {
    normalized.fallbackReasoningEffort = value.fallbackReasoningEffort;
  }
  if (value.fallbackMaxOutputTokens !== undefined) {
    normalized.fallbackMaxOutputTokens = value.fallbackMaxOutputTokens;
  }
  return Object.keys(normalized).length > 0 ? normalized : null;
}

function readChatOverride(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const object = value as Record<string, unknown>;
  return normalizeChatOverride({
    ...(typeof object.primaryCatalogItemId === "string"
      ? { primaryCatalogItemId: object.primaryCatalogItemId }
      : {}),
    ...(typeof object.fallbackCatalogItemId === "string" ||
    object.fallbackCatalogItemId === null
      ? { fallbackCatalogItemId: object.fallbackCatalogItemId }
      : {}),
    ...(typeof object.temperature === "number" || object.temperature === null
      ? { temperature: object.temperature }
      : {}),
    ...(typeof object.reasoningEffort === "string" || object.reasoningEffort === null
      ? { reasoningEffort: object.reasoningEffort }
      : {}),
    ...(typeof object.maxInputTokens === "number"
      ? { maxInputTokens: object.maxInputTokens }
      : {}),
    ...(typeof object.maxOutputTokens === "number"
      ? { maxOutputTokens: object.maxOutputTokens }
      : {}),
    ...(typeof object.fallbackTemperature === "number" ||
    object.fallbackTemperature === null
      ? { fallbackTemperature: object.fallbackTemperature }
      : {}),
    ...(typeof object.fallbackReasoningEffort === "string" ||
    object.fallbackReasoningEffort === null
      ? { fallbackReasoningEffort: object.fallbackReasoningEffort }
      : {}),
    ...(typeof object.fallbackMaxOutputTokens === "number" ||
    object.fallbackMaxOutputTokens === null
      ? { fallbackMaxOutputTokens: object.fallbackMaxOutputTokens }
      : {}),
  });
}

function serializeEffectiveRoute(route: AiFeatureRoute) {
  return {
    feature: route.feature,
    purpose: route.purpose ?? null,
    defaultConfigurationVersion: route.version,
    temperature: route.temperature,
    reasoningEffort: route.reasoningEffort,
    maxInputTokens: route.maxInputTokens ?? null,
    maxOutputTokens: route.maxOutputTokens,
    fallbackTemperature: route.fallbackTemperature ?? null,
    fallbackReasoningEffort: route.fallbackReasoningEffort ?? null,
    fallbackMaxInputTokens: route.fallbackMaxInputTokens ?? route.maxInputTokens ?? null,
    fallbackMaxOutputTokens: route.fallbackMaxOutputTokens ?? null,
    candidates: route.candidates.map((candidate, index) => ({
      order: index,
      catalogItemId: candidate.catalogItemId,
      provider: candidate.provider,
      model: candidate.model,
      available: candidate.available,
      maxInputTokens: candidate.maxInputTokens,
      priceVersionId: candidate.priceVersionId,
    })),
  };
}

function serializeChatRuntimeSettings(settings: ResolvedAiChatRuntimeSettings) {
  return {
    embedding: {
      catalogItemId: settings.embeddingCatalogItemId,
      provider: settings.embeddingProvider,
      model: settings.embeddingModel,
      dimensions: settings.embeddingDimensions,
    },
    imageInput: {
      maxImagesPerMessage: settings.maxImagesPerMessage,
      maxImageBytes: settings.maxImageBytes,
      allowedImageMimeTypes: settings.allowedImageMimeTypes,
    },
    studentDailyMessageLimit: settings.studentDailyMessageLimit,
    studentDailyImageLimit: settings.studentDailyImageLimit,
    chatRuntimeSettingsVersion: settings.version,
  };
}

function startOfTodayInHoChiMinh(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return new Date(Date.UTC(year, month - 1, day) - 7 * 60 * 60 * 1_000);
}

function serializeProviderRequest(
  providerInput: AiTextInput,
  context: {
    history: Array<{ role: string; text: string }>;
    sources: AiChatSource[];
    imageCount: number;
    route: AiFeatureRoute;
  },
) {
  const candidate = context.route.candidates.find((item) => item.available);
  return {
    provider: candidate?.provider ?? null,
    model: candidate?.model ?? context.route.model,
    systemPrompt: providerInput.systemPrompt,
    userPrompt: providerInput.userPrompt,
    orderedHistory: context.history,
    ragContext: context.sources.map((source, order) => ({
      order,
      chunkId: source.chunkId,
      sourceType: source.sourceType,
      learningPathId: source.learningPathId,
      learningPathTitle: source.learningPathTitle,
      lessonId: source.lessonId,
      lessonTitle: source.lessonTitle,
      score: source.score,
      content: source.content,
      startSeconds: source.startSeconds ?? null,
      endSeconds: source.endSeconds ?? null,
    })),
    imageReferences: Array.from({ length: context.imageCount }, (_, order) => ({
      order,
      detail: providerInput.inputImages?.[order]?.detail ?? "auto",
      binaryContent: "[REDACTED]",
    })),
    contextSerialization: providerInput.contextSerialization ?? null,
    maxTokens: context.route.maxOutputTokens ?? providerInput.maxTokens ?? null,
    temperature: context.route.temperature ?? providerInput.temperature ?? null,
    reasoningEffort:
      context.route.reasoningEffort ?? providerInput.reasoningEffort ?? null,
    promptCache: providerInput.promptCache ?? null,
  };
}

function toInputJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function readTimeToFirstToken(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = (value as Record<string, unknown>).timeToFirstTokenMs;
  return typeof candidate === "number" ? candidate : null;
}

const sensitiveTraceKeys = new Set([
  "authorization",
  "apikey",
  "token",
  "accesstoken",
  "refreshtoken",
  "bearertoken",
  "authtoken",
  "providertoken",
  "credential",
  "credentials",
  "password",
  "secret",
  "clientsecret",
  "privatekey",
  "signedurl",
  "objectkey",
  "providerfileid",
  "filedata",
  "base64",
]);

function isSensitiveTraceKey(key: string) {
  return sensitiveTraceKeys.has(key.replace(/[_-]/gu, "").toLowerCase());
}

export function sanitizeTraceJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sanitizeTraceJson(item));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      isSensitiveTraceKey(key) ? "[REDACTED]" : sanitizeTraceJson(item),
    ]),
  );
}

function readMessageText(value: Prisma.JsonValue | undefined): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  return typeof value.text === "string" ? value.text : "";
}

function createConversationTitle(question: string) {
  const compact = question.replace(/\s+/gu, " ").trim();
  return compact.length <= 80 ? compact : `${compact.slice(0, 77)}…`;
}

export function normalizeAiConversationTitle(value: string) {
  const firstLine = value.normalize("NFC").trim().split(/\r?\n/u)[0] ?? "";
  const compact = firstLine
    .replace(/^(?:tiêu đề|title)\s*[:-]\s*/iu, "")
    .replace(/[.!?,:;-]+$/gu, "")
    .replace(/^[#*_`"'“”‘’]+|[#*_`"'“”‘’]+$/gu, "")
    .replace(/[^\p{Script=Latin}\p{Number}\s]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  if (!compact) return null;
  const withinWordLimit = compact.split(" ").slice(0, 8).join(" ");
  return withinWordLimit.length <= 80
    ? withinWordLimit
    : `${withinWordLimit.slice(0, 77).trimEnd()}…`;
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function flattenJsonText(value: Prisma.JsonValue | null | undefined): string[] {
  if (typeof value === "string") return value.trim().length >= 1 ? [value] : [];
  if (Array.isArray(value)) return value.flatMap((item) => flattenJsonText(item));
  if (!value || typeof value !== "object") return [];
  const text = typeof value.text === "string" ? value.text.trim() : "";
  const latex =
    value.attrs &&
    typeof value.attrs === "object" &&
    !Array.isArray(value.attrs) &&
    typeof value.attrs.latex === "string"
      ? value.attrs.latex.trim()
      : "";
  const nested = Object.entries(value).flatMap(([key, item]) =>
    key === "type" || key === "id" || key === "text" || key === "attrs"
      ? []
      : flattenJsonText(item),
  );
  return [text, latex, ...nested].filter(Boolean);
}

type AnswerOption = { id: string; textParts: string[] };

function readAnswerOptions(value: Prisma.JsonValue | null | undefined): AnswerOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((option) => {
    if (!option || typeof option !== "object" || Array.isArray(option)) return [];
    const id = typeof option.id === "string" ? option.id.trim() : "";
    if (!id) return [];
    const content = option.richText ?? option.text ?? option.content;
    const textParts = flattenJsonText(content).filter((part) => part.trim().length >= 1);
    return textParts.length >= 1 ? [{ id, textParts }] : [];
  });
}

function formatAnswerOptions(options: AnswerOption[]) {
  return options
    .map((option) => `${option.id}. ${option.textParts.join(" ")}`)
    .join("\n");
}

function readCorrectOptionTexts(options: AnswerOption[], answerTexts: string[]) {
  const correctIds = new Set(answerTexts.map(normalize));
  return options.flatMap((option) =>
    correctIds.has(normalize(option.id))
      ? [...option.textParts, option.textParts.join(" ")]
      : [],
  );
}

export function normalizeAiChatPreferredLessonIds(
  surfaceLessonId?: string,
  preferredLessonIds: string[] = [],
) {
  return [
    ...new Set(
      [surfaceLessonId, ...preferredLessonIds].filter((lessonId): lessonId is string =>
        Boolean(lessonId),
      ),
    ),
  ];
}

export function resolveAllowedAiChatPreferredLessonRows<
  T extends { id: string; sourceLessonId: string | null },
>(
  surfaceLessonId: string | undefined,
  preferredLessonIds: string[] | undefined,
  rows: T[],
) {
  const exactLessonById = new Map(rows.map((lesson) => [lesson.id, lesson]));
  const deliveryLessonBySourceId = new Map(
    rows.flatMap((lesson) =>
      lesson.sourceLessonId ? [[lesson.sourceLessonId, lesson] as const] : [],
    ),
  );
  const resolvedLessonIds = new Set<string>();

  return normalizeAiChatPreferredLessonIds(
    surfaceLessonId,
    preferredLessonIds ?? [],
  ).flatMap((requestedLessonId) => {
    const lesson =
      exactLessonById.get(requestedLessonId) ??
      (requestedLessonId === surfaceLessonId
        ? undefined
        : deliveryLessonBySourceId.get(requestedLessonId));
    if (!lesson || resolvedLessonIds.has(lesson.id)) return [];
    resolvedLessonIds.add(lesson.id);
    return [lesson];
  });
}

function uniqueSourceLabels(sources: AiChatSource[]) {
  const unique = new Map<
    string,
    Pick<
      AiChatSource,
      "learningPathId" | "learningPathTitle" | "lessonId" | "lessonTitle"
    >
  >();
  for (const source of sources) {
    unique.set(`${source.learningPathId}:${source.lessonId}`, {
      learningPathId: source.learningPathId,
      learningPathTitle: source.learningPathTitle,
      lessonId: source.lessonId,
      lessonTitle: source.lessonTitle,
    });
  }
  return [...unique.values()];
}

function readSourceLabels(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const sources = value.sources;
  if (!Array.isArray(sources)) return [];
  return sources.flatMap((source) => {
    if (!source || typeof source !== "object" || Array.isArray(source)) return [];
    const learningPathId = source.learningPathId;
    const learningPathTitle = source.learningPathTitle;
    const lessonId = source.lessonId;
    const lessonTitle = source.lessonTitle;
    return typeof learningPathId === "string" &&
      typeof learningPathTitle === "string" &&
      typeof lessonId === "string" &&
      typeof lessonTitle === "string"
      ? [{ learningPathId, learningPathTitle, lessonId, lessonTitle }]
      : [];
  });
}

const malformedMathReplacement =
  "Câu trả lời vừa tạo có công thức chưa thể hiển thị an toàn. Bạn hãy gửi lại câu hỏi để AI trình bày lại nhé.";

export function buildMalformedMathReplacement(studentQuestion: string) {
  if (
    /(?:ảnh|hình).*(?:mờ|nhòe|không rõ|khuất)|(?:mờ|nhòe|không rõ|khuất).*(?:ảnh|hình)/iu.test(
      studentQuestion,
    )
  ) {
    return "Mình chưa đọc chắc các ký hiệu hoặc chỉ số trong ảnh nên sẽ không đoán. Bạn hãy chụp lại gần hơn, đủ sáng và lấy nét rõ toàn bộ công thức nhé.";
  }
  return malformedMathReplacement;
}

export function repairChatAnswerText(value: string) {
  const raw = value.trim();
  const text = normalizeChatAnswerLayout(
    normalizeLearnerMathTextSyntax(normalizeChatMathDelimiters(raw)),
  ).trim();
  return {
    text,
    repaired: text !== raw,
    valid: !hasMalformedMathText(text),
  };
}

export function normalizeChatMathDelimiters(value: string) {
  return value
    .split(/(```[\s\S]*?```|`[^`\n]*`)/gu)
    .map((segment, index) => {
      if (index % 2 === 1) return segment;
      return segment
        .replace(/\\+\[([\s\S]*?)\\+\]/gu, (_match, latex: string) => {
          const normalized = latex.trim();
          return `$$\n${normalized}\n$$`;
        })
        .replace(/\\+\(([\s\S]*?)\\+\)/gu, (_match, latex: string) => {
          return `$${latex.trim()}$`;
        });
    })
    .join("");
}

export function normalizeChatAnswerLayout(value: string) {
  return value
    .split(/\n{2,}/u)
    .map((block) => formatDenseProseBlock(block))
    .join("\n\n");
}

function formatDenseProseBlock(block: string) {
  const trimmed = block.trim();
  if (
    trimmed.length < 220 ||
    trimmed.includes("\n") ||
    /^(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|>|```)/u.test(trimmed)
  ) {
    return block;
  }
  const sentences = trimmed.split(/(?<=[.!?…])\s+(?=[A-ZÀ-Ỹ0-9#*_])/u);
  if (sentences.length < 4) return block;

  const paragraphs: string[] = [];
  for (let index = 0; index < sentences.length; index += 2) {
    paragraphs.push(sentences.slice(index, index + 2).join(" "));
  }
  return paragraphs.join("\n\n");
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/đ/giu, "d")
    .toLowerCase()
    .replace(/\s+/gu, " ")
    .trim();
}

export function limitChatHistory(
  messages: Array<{ role: string; text: string }>,
  maxTokens: number,
) {
  const selected: Array<{ role: string; text: string }> = [];
  let usedTokens = 0;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]!;
    const remainingTokens = maxTokens - usedTokens;
    if (remainingTokens <= 0) break;
    const estimatedTokens = Math.max(1, Math.ceil(message.text.length / 4));
    const text =
      estimatedTokens <= remainingTokens
        ? message.text
        : message.text.slice(-remainingTokens * 4);
    selected.unshift({ ...message, text });
    usedTokens += Math.min(estimatedTokens, remainingTokens);
  }
  return selected;
}
