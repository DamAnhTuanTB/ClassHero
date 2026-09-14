import type { AiChatSseEvent } from "#api/modules/ai-chat/types/ai-chat.types";

export type AiChatStreamingResponse = {
  destroyed: boolean;
  status(code: number): AiChatStreamingResponse;
  setHeader(name: string, value: string): void;
  flushHeaders(): void;
  write(chunk: string): boolean;
  end(): void;
};

export async function writeAiChatStream(
  response: AiChatStreamingResponse,
  events: AsyncGenerator<AiChatSseEvent>,
) {
  response.status(200);
  response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  response.setHeader("Cache-Control", "no-cache, no-transform");
  response.setHeader("Connection", "keep-alive");
  response.setHeader("X-Accel-Buffering", "no");
  response.flushHeaders();
  for await (const event of events) {
    if (response.destroyed) break;
    response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  }
  if (!response.destroyed) response.end();
}
