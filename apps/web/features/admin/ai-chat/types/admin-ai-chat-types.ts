import type {
  AiChatMessage,
  AiChatMessageStatus,
  AiChatScopeType,
  AiChatSseEvent,
} from "@/features/ai-chat/types/ai-chat-types";

export type AdminAiChatConfigurationOverride = {
  primaryCatalogItemId?: string;
  fallbackCatalogItemId?: string | null;
  temperature?: number | null;
  reasoningEffort?: string | null;
  maxInputTokens?: number;
  maxOutputTokens?: number;
  fallbackTemperature?: number | null;
  fallbackReasoningEffort?: string | null;
  fallbackMaxOutputTokens?: number | null;
};

export type AdminAiChatScopeItem = {
  learningPathId: string;
  learningPathTitle: string;
  lessonId: string | null;
  lessonTitle: string | null;
};

export type AdminAiChatSession = {
  id: string;
  scopeType: Extract<AiChatScopeType, "LESSON" | "COURSE" | "COURSE_SET">;
  title: string;
  scopeLabel: string;
  scopeItems: AdminAiChatScopeItem[];
  lastSurfaceLessonId: string | null;
  configurationVersion: number;
  configurationOverride?: AdminAiChatConfigurationOverride | null;
  preview: string;
  lastMessageStatus: AiChatMessageStatus | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminAiChatSessionDetail = AdminAiChatSession & {
  totalCostVnd: number;
};

export type AdminAiChatScopeOptions = {
  learningPaths: Array<{
    id: string;
    title: string;
    status: string;
    domain: { name: string };
    _count: { lessons: number };
  }>;
  lessons: Array<{
    id: string;
    learningPathId: string;
    title: string;
    status: string;
    orderIndex: number;
    chapter: { title: string; orderIndex: number } | null;
  }>;
};

export type AdminAiChatSimulationSurface =
  "VIDEO_SUMMARY" | "KNOWLEDGE" | "QUIZ" | "FLASHCARD" | "TEST";

export type AdminAiChatActivityState =
  "UNANSWERED" | "ANSWER_REVEALED" | "IN_PROGRESS" | "SUBMITTED";

export type AdminAiChatTargetType = "QUIZ_QUESTION" | "FLASHCARD" | "TEST_QUESTION";

export type AdminAiChatLessonContextItem = {
  id: string;
  difficulty: string;
  sortOrder: number;
  questionType?: string;
  questionJson?: unknown;
  frontJson?: unknown;
};

export type AdminAiChatLessonContextSet = {
  id: string;
  title: string;
  durationSeconds?: number;
  questions?: AdminAiChatLessonContextItem[];
  flashcards?: AdminAiChatLessonContextItem[];
};

export type AdminAiChatLessonContextOptions = {
  lessonId: string;
  surfaces: {
    videoSummary: { available: boolean };
    knowledge: { available: boolean };
  };
  quizSets: AdminAiChatLessonContextSet[];
  flashcardSets: AdminAiChatLessonContextSet[];
  testSets: AdminAiChatLessonContextSet[];
};

export type AdminAiChatUsageEvent = {
  id: string;
  operation: string | null;
  provider: string;
  model: string | null;
  modelLabel: string | null;
  providerRequestId: string | null;
  status: string;
  attempt: number;
  cacheStatus: string | null;
  reasoningEffort: string | null;
  promptTokens: number;
  cachedInputTokens: number;
  cacheWriteInputTokens: number;
  completionTokens: number;
  totalTokens: number;
  costVnd: number;
  estimatedCostUsd: number;
  latencyMs: number | null;
  timeToFirstTokenMs: number | null;
  rawUsage: unknown;
  errorCode: string | null;
  startedAt: string;
  finishedAt: string | null;
};

export type AdminAiChatTurnTrace = {
  id: string;
  sessionId: string;
  userMessageId: string;
  assistantMessageId: string;
  aiGenerationId: string;
  scopeSnapshot: unknown;
  defaultConfigurationVersion: number;
  sessionConfigurationVersion: number;
  configurationOverrideSnapshot: unknown;
  effectiveConfiguration: unknown;
  providerRequest: unknown;
  generation: {
    status: string;
    provider: string | null;
    model: string | null;
    providerRequestId: string | null;
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    estimatedCostVnd: number | null;
    latencyMs: number | null;
    retryCount: number;
    errorMessage: string | null;
    startedAt: string | null;
    finishedAt: string | null;
  };
  aggregate: {
    callCount: number;
    totalCostVnd: number;
    totalTokens: number;
    totalLatencyMs: number;
    timeToFirstTokenMs: number | null;
  };
  usageEvents: AdminAiChatUsageEvent[];
  createdAt: string;
  updatedAt: string;
};

export type { AiChatMessage, AiChatSseEvent };
