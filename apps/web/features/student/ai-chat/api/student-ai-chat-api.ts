import { apiRequest } from "@/lib/api-client";
import { streamAiChatRequest } from "@/features/ai-chat/api/stream-ai-chat";
import type {
  AiChatConversation,
  AiChatActiveActivity,
  AiChatMessage,
  AiChatRuntimeSettings,
  AiChatScopeType,
  AiChatSseEvent,
  AiChatTarget,
} from "@/features/student/ai-chat/types/ai-chat-types";

export function getAiChatRuntimeSettings(token: string) {
  return apiRequest<AiChatRuntimeSettings>("/student/ai-chat/settings", { token });
}

export function listAiChatConversations(token: string) {
  return apiRequest<{ items: AiChatConversation[]; nextCursor: string | null }>(
    "/student/ai-chat/conversations",
    { token },
  );
}

export function listAiChatMessages(conversationId: string, token: string) {
  return apiRequest<{ items: AiChatMessage[]; nextCursor: string | null }>(
    `/student/ai-chat/conversations/${encodeURIComponent(conversationId)}/messages?limit=100`,
    { token },
  );
}

export function uploadAiChatImage(file: File, token: string) {
  const form = new FormData();
  form.set("purpose", "CHAT_IMAGE");
  form.set("file", file);
  return apiRequest<{ id: string }>("/files/upload", {
    method: "POST",
    body: form,
    token,
  });
}

export async function streamAiChatMessage(input: {
  token: string;
  conversationId?: string;
  scopeType: AiChatScopeType;
  learningPathId?: string;
  surfaceLessonId?: string;
  preferredLessonIds?: string[];
  videoPlaybackSeconds?: number;
  target?: AiChatTarget;
  activeActivity?: AiChatActiveActivity;
  message: string;
  attachmentFileIds: string[];
  onEvent: (event: AiChatSseEvent) => void;
}) {
  const path = input.conversationId
    ? `/student/ai-chat/conversations/${encodeURIComponent(input.conversationId)}/messages/stream`
    : "/student/ai-chat/conversations/messages/stream";
  await streamAiChatRequest({
    token: input.token,
    path,
    payload: {
      ...(!input.conversationId ? { scopeType: input.scopeType } : {}),
      ...(!input.conversationId && input.learningPathId
        ? { learningPathId: input.learningPathId }
        : {}),
      ...(input.surfaceLessonId ? { surfaceLessonId: input.surfaceLessonId } : {}),
      ...(input.preferredLessonIds?.length
        ? { preferredLessonIds: input.preferredLessonIds }
        : {}),
      ...(input.videoPlaybackSeconds !== undefined
        ? { videoPlaybackSeconds: input.videoPlaybackSeconds }
        : {}),
      ...(input.target ?? {}),
      ...(input.activeActivity ?? {}),
      message: input.message,
      attachmentFileIds: input.attachmentFileIds,
    },
    fallbackErrorCode: "AI_CHAT_REQUEST_FAILED",
    fallbackErrorMessage: "Chưa thể gửi câu hỏi tới Chat AI.",
    onEvent: input.onEvent,
  });
}
