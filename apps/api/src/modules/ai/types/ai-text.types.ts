/**
 * AI text generation input/output types.
 *
 * Dùng cho interface AiProvider.generateText() và AiProvider.generateStructured().
 * Xem docs/06-ai-rag-spec.md §2.2 cho spec gốc.
 *
 * M9.1 dùng các type này cho OpenAI Responses API và lifecycle log.
 */

import type { AiProviderName } from "@prisma/client";
import type { ZodType } from "zod";

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
  reasoningEffort?: string;
  maxTokens?: number;
  /** Model runtime resolved by provider-operations; embedding does not use this field. */
  model?: string;
  metadata?: Record<string, unknown>;
}

export interface AiTokenUsage {
  promptTokens?: number;
  cachedInputTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface AiProviderOutputMetadata {
  provider: AiProviderName;
  model: string;
  usage?: AiTokenUsage;
  providerRequestId?: string;
  latencyMs?: number;
}

export interface AiTextOutput extends AiProviderOutputMetadata {
  text: string;
}

export interface AiStructuredInput extends AiTextInput {
  outputName: string;
  promptVersion: string;
  schemaVersion: string;
}

export type AiOutputSchema<TOutput> = ZodType<TOutput>;

export interface AiStructuredOutput<TOutput>
  extends AiProviderOutputMetadata {
  data: TOutput;
}
