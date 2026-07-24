/**
 * AI text generation input/output types.
 *
 * Dùng cho interface AiProvider.generateText() và AiProvider.generateStructured().
 * Xem docs/06-ai-rag-spec.md §2.2 cho spec gốc.
 *
 * M5.1 chỉ khai báo types. Implementation đầy đủ sẽ ở M9.1.
 */

export interface RetrievedChunk {
  id: string;
  content: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

export interface AiTextInput {
  systemPrompt: string;
  userPrompt: string;
  contextChunks?: RetrievedChunk[];
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, unknown>;
}

export interface AiTextOutput {
  text: string;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  providerRequestId?: string;
  latencyMs?: number;
}

export interface AiStructuredInput extends AiTextInput {
  outputName: string;
  promptVersion: string;
  schemaVersion: string;
}
