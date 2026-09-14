import { ApiRequestError, getApiBaseUrl } from "@/lib/api-client";
import type { AiChatSseEvent } from "@/features/ai-chat/types/ai-chat-types";

export async function streamAiChatRequest(input: {
  token: string;
  path: string;
  payload: Record<string, unknown>;
  fallbackErrorCode: string;
  fallbackErrorMessage: string;
  onEvent: (event: AiChatSseEvent) => void;
}) {
  const response = await fetch(`${getApiBaseUrl()}${input.path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.token}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(input.payload),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { code?: string; message?: string; details?: unknown };
    } | null;
    throw new ApiRequestError({
      statusCode: response.status,
      code: payload?.error?.code ?? input.fallbackErrorCode,
      message: payload?.error?.message ?? input.fallbackErrorMessage,
      details: payload?.error?.details,
    });
  }
  if (!response.body) throw new Error("Trình duyệt không hỗ trợ response streaming.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/gu, "\n");
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const data = frame
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (data) input.onEvent(JSON.parse(data) as AiChatSseEvent);
    }
    if (done) break;
  }
}
