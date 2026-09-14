import { streamAiChatRequest } from "@/features/ai-chat/api/stream-ai-chat";
import { apiRequest } from "@/lib/api-client";
import type {
  AdminAiChatConfigurationOverride,
  AdminAiChatActivityState,
  AdminAiChatLessonContextOptions,
  AdminAiChatScopeOptions,
  AdminAiChatSession,
  AdminAiChatSessionDetail,
  AdminAiChatSimulationSurface,
  AdminAiChatTargetType,
  AdminAiChatTurnTrace,
  AiChatMessage,
  AiChatSseEvent,
} from "@/features/admin/ai-chat/types/admin-ai-chat-types";

const basePath = "/admin/ai-chat";

export const listAdminAiChatSessions = (token: string) =>
  apiRequest<{ items: AdminAiChatSession[]; nextCursor: string | null }>(
    `${basePath}/sessions`,
    { token },
  );

export const getAdminAiChatSession = (sessionId: string, token: string) =>
  apiRequest<AdminAiChatSessionDetail>(
    `${basePath}/sessions/${encodeURIComponent(sessionId)}`,
    { token },
  );

export const listAdminAiChatMessages = (sessionId: string, token: string) =>
  apiRequest<{ items: AiChatMessage[]; nextCursor: string | null }>(
    `${basePath}/sessions/${encodeURIComponent(sessionId)}/messages?limit=100`,
    { token },
  );

export const getAdminAiChatScopeOptions = (token: string, learningPathId?: string) =>
  apiRequest<AdminAiChatScopeOptions>(
    `${basePath}/scope-options${
      learningPathId ? `?learningPathId=${encodeURIComponent(learningPathId)}` : ""
    }`,
    { token },
  );

export const getAdminAiChatLessonContextOptions = (lessonId: string, token: string) =>
  apiRequest<AdminAiChatLessonContextOptions>(
    `${basePath}/lessons/${encodeURIComponent(lessonId)}/context-options`,
    { token },
  );

export const getAdminAiChatTurnTrace = (
  sessionId: string,
  assistantMessageId: string,
  token: string,
) =>
  apiRequest<AdminAiChatTurnTrace>(
    `${basePath}/sessions/${encodeURIComponent(sessionId)}/messages/${encodeURIComponent(assistantMessageId)}/trace`,
    { token },
  );

export const updateAdminAiChatSessionConfiguration = (
  sessionId: string,
  input: {
    configurationOverride: AdminAiChatConfigurationOverride | null;
    expectedVersion: number;
  },
  token: string,
) =>
  apiRequest<AdminAiChatSessionDetail>(
    `${basePath}/sessions/${encodeURIComponent(sessionId)}/configuration`,
    { method: "PATCH", body: input, token },
  );

export function uploadAdminAiChatImage(file: File, token: string) {
  const form = new FormData();
  form.set("purpose", "CHAT_IMAGE");
  form.set("file", file);
  return apiRequest<{ id: string }>("/files/upload", {
    method: "POST",
    body: form,
    token,
  });
}

export async function streamAdminAiChatMessage(input: {
  token: string;
  sessionId?: string;
  scopeType?: "LESSON" | "COURSE" | "COURSE_SET";
  learningPathIds?: string[];
  lessonId?: string;
  surfaceLessonId?: string;
  configurationOverride?: AdminAiChatConfigurationOverride | null;
  simulationSurface?: AdminAiChatSimulationSurface;
  videoPlaybackSeconds?: number;
  activityState?: AdminAiChatActivityState;
  targetType?: AdminAiChatTargetType;
  targetId?: string;
  message: string;
  attachmentFileIds: string[];
  onEvent: (event: AiChatSseEvent) => void;
}) {
  const path = input.sessionId
    ? `${basePath}/sessions/${encodeURIComponent(input.sessionId)}/messages/stream`
    : `${basePath}/sessions/messages/stream`;
  await streamAiChatRequest({
    token: input.token,
    path,
    payload: {
      ...(input.sessionId
        ? {}
        : {
            scopeType: input.scopeType,
            learningPathIds: input.learningPathIds,
            lessonId: input.lessonId,
            configurationOverride: input.configurationOverride,
          }),
      surfaceLessonId: input.surfaceLessonId,
      simulationSurface: input.simulationSurface,
      videoPlaybackSeconds: input.videoPlaybackSeconds,
      activityState: input.activityState,
      targetType: input.targetType,
      targetId: input.targetId,
      message: input.message,
      attachmentFileIds: input.attachmentFileIds,
    },
    fallbackErrorCode: "ADMIN_AI_CHAT_REQUEST_FAILED",
    fallbackErrorMessage: "Chưa thể gửi lượt mô phỏng tới Chat AI.",
    onEvent: input.onEvent,
  });
}
