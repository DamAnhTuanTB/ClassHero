export type AiChatScopeType = "LIBRARY" | "COURSE" | "LESSON" | "COURSE_SET";
export type AiChatMessageStatus =
  "GENERATING" | "COMPLETED" | "REFUSED" | "FAILED" | "INTERRUPTED";
export type AiChatResponsePolicy = "HINT_ONLY" | "FULL_ANSWER" | "BLOCKED";

export type AiChatTarget =
  | { targetType: "QUIZ_QUESTION"; targetId: string }
  | { targetType: "FLASHCARD"; targetId: string }
  | { targetType: "TEST_QUESTION"; targetId: string };

export type AiChatActiveActivity =
  | {
      activityType: "QUIZ_ATTEMPT";
      activityId: string;
      targetType: "QUIZ_QUESTION";
      targetId: string;
    }
  | {
      activityType: "FLASHCARD_STUDY_SESSION";
      activityId: string;
      targetType: "FLASHCARD";
      targetId: string;
    };

export type AiChatRuntimeSettings = {
  embeddingCatalogItemId: string | null;
  embeddingProvider: "OPENAI";
  embeddingModel: string;
  embeddingDimensions: number;
  maxImagesPerMessage: number;
  maxImageBytes: number;
  allowedImageMimeTypes: Array<"image/jpeg" | "image/png" | "image/webp">;
  studentDailyMessageLimit: number;
  studentDailyImageLimit: number;
  studentDailyMessageUsed: number;
  studentDailyMessageRemaining: number;
  studentDailyImageUsed: number;
  studentDailyImageRemaining: number;
  version: number;
};

export type AiChatConversation = {
  id: string;
  scopeType: AiChatScopeType;
  learningPathId: string | null;
  title: string;
  scopeLabel: string;
  preview?: string;
  lastMessageStatus?: AiChatMessageStatus | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiChatAttachment = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  url: string | null;
};

export type AiChatMessageSource = {
  learningPathId: string;
  learningPathTitle: string;
  lessonId: string;
  lessonTitle: string;
};

export type AiChatTurnMetrics = {
  totalCostVnd: number;
  timeToFirstTokenMs: number | null;
  responseLatencyMs: number | null;
};

export type AiChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  status: AiChatMessageStatus;
  responsePolicy: AiChatResponsePolicy;
  text: string;
  errorCode: string | null;
  turnTraceId?: string | null;
  turnMetrics?: AiChatTurnMetrics | null;
  sources: AiChatMessageSource[];
  attachments: AiChatAttachment[];
  createdAt: string;
  updatedAt: string;
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
  | { type: "completed"; conversationId: string; message: AiChatMessage }
  | { type: "failed"; assistantMessageId: string; code: string; message: string };

export type PendingChatImage = {
  localId: string;
  file: File;
  previewUrl: string;
};
