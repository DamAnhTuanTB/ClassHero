/**
 * AI config helpers.
 *
 * Đọc config từ ConfigService và validate availability provider.
 */

import { ConfigService } from "@nestjs/config";

import type { EnvConfig } from "#api/config/env.validation";

export interface AiEmbeddingConfig {
  apiKey: string;
  model: string;
  dimensions: number;
}

export interface AiOpenAiConfig {
  apiKey: string;
  requestTimeoutMs: number;
  generationRequestTimeoutMs?: number;
  structuredModel: string;
  chatModel: string;
  embeddingModel: string;
  embeddingDimensions: number;
}

/**
 * Lấy OpenAI config từ env. Throw nếu OPENAI_API_KEY chưa cấu hình.
 */
export function getOpenAiConfig(
  configService: ConfigService<EnvConfig, true>,
): AiOpenAiConfig {
  const apiKey = configService.get("OPENAI_API_KEY", { infer: true });

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not configured. Set it in .env to use OpenAI provider.",
    );
  }

  return {
    apiKey,
    requestTimeoutMs: configService.get("AI_PROVIDER_TIMEOUT_MS", {
      infer: true,
    }),
    generationRequestTimeoutMs: configService.get("AI_GENERATION_TIMEOUT_MS", {
      infer: true,
    }),
    structuredModel: configService.get("OPENAI_STRUCTURED_MODEL", {
      infer: true,
    }),
    chatModel: configService.get("OPENAI_CHAT_MODEL", { infer: true }),
    embeddingModel: configService.get("OPENAI_EMBEDDING_MODEL", {
      infer: true,
    }),
    embeddingDimensions: configService.get("OPENAI_EMBEDDING_DIMENSIONS", {
      infer: true,
    }),
  };
}

/**
 * Lấy embedding config mặc định cho retrieval/worker.
 * Dùng khi cần biết model/dimensions hiện tại mà không cần API key.
 */
export function getEmbeddingConfig(configService: ConfigService<EnvConfig, true>): {
  model: string;
  dimensions: number;
} {
  return {
    model: configService.get("OPENAI_EMBEDDING_MODEL", { infer: true }),
    dimensions: configService.get("OPENAI_EMBEDDING_DIMENSIONS", {
      infer: true,
    }),
  };
}
