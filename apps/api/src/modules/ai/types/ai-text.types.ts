/**
 * AI text generation input/output types.
 *
 * Dùng cho interface AiProvider.generateText() và AiProvider.generateStructured().
 * Xem docs/06-ai-rag-spec.md §2.2 cho spec gốc.
 *
 * M9.1 dùng các type này cho OpenAI Responses API và lifecycle log.
 */

import type { AiProviderName } from "@prisma/client";
import type { AiReasoningEffort } from "@learning-path/shared";
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
  /** Ordered file inputs placed before manifest/user text in one user message. */
  inputFiles?: AiInputFile[];
  /** Ordered provider-neutral text items placed after files and before userPrompt. */
  inputTextItems?: AiInputTextItem[];
  /** Optional visual references. Text remains the primary input. */
  inputImages?: AiInputImage[];
  contextChunks?: RetrievedChunk[];
  /** Summary uses JSON so chunk content cannot break XML-like delimiters. */
  contextSerialization?: "xml" | "json";
  temperature?: number;
  reasoningEffort?: AiReasoningEffort;
  maxTokens?: number;
  /** Model runtime resolved by provider-operations; embedding does not use this field. */
  model?: string;
  metadata?: Record<string, unknown>;
}

export interface AiInputFile {
  filename: string;
  mimeType: "application/pdf" | "application/json";
  detail?: "low" | "high" | "auto";
  fileId?: string;
  fileData?: string;
  fileUrl?: string;
}

export interface AiInputTextItem {
  id: "user_prompt" | "source_packet_manifest";
  text: string;
}

export interface AiInputImage {
  imageUrl: string;
  detail?: "low" | "high" | "auto" | "original";
}

export interface AiTokenUsage {
  promptTokens?: number;
  cachedInputTokens?: number;
  completionTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
}

export interface AiProviderOutputMetadata {
  provider: AiProviderName;
  model: string;
  usage?: AiTokenUsage;
  /** Exact provider usage object before normalization; kept for audit only. */
  providerUsageRaw?: unknown;
  providerRequestId?: string;
  latencyMs?: number;
  inputFileOperations?: Array<{
    providerFileId: string;
    uploadLatencyMs: number;
    cleanupStatus: "not_owned" | "deleted" | "failed";
  }>;
}

export interface AiTextOutput extends AiProviderOutputMetadata {
  text: string;
}

export type AiStructuredSchemaReferenceStrategy = "inline" | "ref" | "ref_v2";

export type AiPromptCacheRetention = "in_memory" | "24h";

export interface AiPromptCacheConfiguration {
  /** Short provider-neutral namespace; no lesson, document, user, or source data. */
  namespace: string;
  keyEnabled: boolean;
  retention: AiPromptCacheRetention;
}

export interface AiStructuredInput extends AiTextInput {
  outputName: string;
  promptVersion: string;
  schemaVersion: string;
  /**
   * Controls JSON Schema serialization only. `inline` preserves the OpenAI SDK
   * helper byte-for-byte; `ref` preserves the first `$defs/$ref` serializer;
   * `ref_v2` only compacts additional exact duplicate schema subtrees.
   */
  schemaReferenceStrategy?: AiStructuredSchemaReferenceStrategy;
  /** Summary-only cache routing policy. It never changes prompt/context content. */
  promptCache?: AiPromptCacheConfiguration;
}

export type AiOutputSchema<TOutput> = ZodType<TOutput>;

export interface AiStructuredOutput<TOutput> extends AiProviderOutputMetadata {
  data: TOutput;
}
