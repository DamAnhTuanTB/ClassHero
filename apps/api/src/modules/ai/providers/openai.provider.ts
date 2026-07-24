/**
 * OpenAI provider implementation.
 *
 * Provider chính cho embedding (M5.1).
 * generateText/generateStructured có implementation cơ bản — sẽ hoàn thiện ở M9.1.
 *
 * Xem docs/06-ai-rag-spec.md §2.2 cho spec.
 */

import { Logger } from "@nestjs/common";
import { AiProviderName } from "@prisma/client";
import OpenAI from "openai";

import type { AiEmbeddingInput, AiEmbeddingOutput } from "../types/ai-embedding.types";
import type { AiProvider } from "../types/ai-provider.interface";
import type { AiStructuredInput, AiTextInput, AiTextOutput } from "../types/ai-text.types";
import type { AiOpenAiConfig } from "../utils/ai-config.helper";

export class OpenAiProvider implements AiProvider {
  readonly name = AiProviderName.OPENAI;
  private readonly client: OpenAI;
  private readonly logger = new Logger(OpenAiProvider.name);
  private readonly config: AiOpenAiConfig;

  constructor(config: AiOpenAiConfig) {
    this.config = config;
    this.client = new OpenAI({ apiKey: config.apiKey });
  }

  async createEmbedding(input: AiEmbeddingInput): Promise<AiEmbeddingOutput> {
    const model = input.model ?? this.config.embeddingModel;
    const dimensions = input.dimensions ?? this.config.embeddingDimensions;

    const startTime = Date.now();

    try {
      const response = await this.client.embeddings.create({
        model,
        input: input.texts,
        dimensions,
      });

      const latencyMs = Date.now() - startTime;

      this.logger.debug(
        `Embedding created: ${input.texts.length} texts, model=${response.model}, ` +
          `dimensions=${dimensions}, tokens=${response.usage?.prompt_tokens ?? "n/a"}, ` +
          `latency=${latencyMs}ms`,
      );

      return {
        vectors: response.data.map((d) => d.embedding),
        model: response.model,
        dimensions,
        usage: {
          promptTokens: response.usage?.prompt_tokens,
          totalTokens: response.usage?.total_tokens,
        },
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      this.logger.error(
        `Embedding failed after ${latencyMs}ms: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Text completion — stub cho M5.1.
   * TODO: Implement đầy đủ ở M9.1.
   */
  async generateText(_input: AiTextInput): Promise<AiTextOutput> {
    throw new Error(
      "OpenAiProvider.generateText() is not yet implemented. Will be completed in M9.1.",
    );
  }

  /**
   * Structured output — stub cho M5.1.
   * TODO: Implement đầy đủ ở M9.1.
   */
  async generateStructured<TOutput>(
    _input: AiStructuredInput,
    _schema: unknown,
  ): Promise<TOutput> {
    throw new Error(
      "OpenAiProvider.generateStructured() is not yet implemented. Will be completed in M9.1.",
    );
  }
}
