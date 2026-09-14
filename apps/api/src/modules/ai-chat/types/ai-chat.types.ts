import type { AiChatResponsePolicy, AiChatScopeType, Prisma } from "@prisma/client";
import type { AiTextInput } from "#api/modules/ai/types/ai-text.types";
import type {
  AiFeatureRoute,
  AiFeatureRouteOverride,
} from "#api/modules/provider-operations/types/provider-operations.types";

export type AiChatScopeAccess = {
  scopeType: AiChatScopeType;
  learningPathId: string | null;
  learningPathIds: string[];
  label: string;
  lessonIds?: string[];
  subjects: AiChatScopeSubject[];
};

export type AiChatSubjectKey = "MATH" | "PHYSICS" | "CHEMISTRY" | "GENERAL";

export type AiChatScopeSubject = {
  learningPathId: string;
  key: AiChatSubjectKey;
};

export type AiChatConfigurationOverride = AiFeatureRouteOverride;

export const AI_CHAT_ACTIVE_ACTIVITY_TYPES = [
  "QUIZ_ATTEMPT",
  "FLASHCARD_STUDY_SESSION",
] as const;

export type AiChatActiveActivityType = (typeof AI_CHAT_ACTIVE_ACTIVITY_TYPES)[number];

export type AiChatActiveActivityContext = {
  activityType?: AiChatActiveActivityType;
  activityId?: string;
  targetType?: string;
  targetId?: string;
};

export type AiChatAnswerAccess =
  "BLOCKED" | "HINT_ONLY" | "FULL_SCOPE" | "FULL_CURRENT_TARGET";

export type AiChatPreferredLesson = {
  id: string;
  title: string;
  learningPathId: string;
  learningPathTitle: string;
};

export const ADMIN_AI_CHAT_SIMULATION_SURFACES = [
  "VIDEO_SUMMARY",
  "KNOWLEDGE",
  "QUIZ",
  "FLASHCARD",
  "TEST",
] as const;

export type AdminAiChatSimulationSurface =
  (typeof ADMIN_AI_CHAT_SIMULATION_SURFACES)[number];

export type AiChatSource = {
  chunkId: string;
  sourceType: "LESSON_DOCUMENT" | "VIDEO_SUMMARY";
  lessonId: string;
  lessonTitle: string;
  learningPathId: string;
  learningPathTitle: string;
  content: string;
  score: number;
  isPreferredLesson?: boolean;
  isCurrentVideoBlock?: boolean;
  startSeconds?: number;
  endSeconds?: number;
};

export type PreparedAiChatTurn = {
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  aiGenerationId: string | null;
  policy: AiChatResponsePolicy;
  input: AiTextInput;
  sources: AiChatSource[];
  actorUserId: string;
  initialQuestion: string;
  initialTitle: string;
  shouldGenerateTitle: boolean;
  countTowardDailyQuota: boolean;
  includeAdminMetrics?: boolean;
  routeSnapshot?: AiFeatureRoute;
};

export type AiChatSseEvent =
  | {
      type: "started";
      conversationId: string;
      userMessageId: string;
      assistantMessageId: string;
      policy: AiChatResponsePolicy;
      title: string;
    }
  | { type: "delta"; assistantMessageId: string; delta: string }
  | { type: "title_updated"; conversationId: string; title: string }
  | { type: "completed"; conversationId: string; message: unknown }
  | { type: "failed"; assistantMessageId: string; code: string; message: string };

export type JsonObject = Prisma.InputJsonObject;
