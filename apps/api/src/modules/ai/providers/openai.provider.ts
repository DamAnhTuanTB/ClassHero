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

import type {
  AiEmbeddingInput,
  AiEmbeddingOutput,
} from "#api/modules/ai/types/ai-embedding.types";
import type { AiProvider } from "#api/modules/ai/types/ai-provider.interface";
import type {
  AiStructuredInput,
  AiTextInput,
  AiTextOutput,
} from "#api/modules/ai/types/ai-text.types";
import type { AiOpenAiConfig } from "#api/modules/ai/utils/ai-config.helper";
import {
  assertEmbeddingInput,
  assertEmbeddingOutput,
} from "#api/modules/ai/utils/embedding-validation";

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
    assertEmbeddingInput(input);

    const model = input.model ?? this.config.embeddingModel;
    const dimensions = input.dimensions ?? this.config.embeddingDimensions;

    const startTime = Date.now();

    try {
      const response = await this.client.embeddings.create({
        model,
        input: input.texts,
        dimensions,
      });

      const sortedData = [...response.data].sort(
        (left, right) => left.index - right.index,
      );
      const hasInvalidIndexes = sortedData.some(
        (item, index) => item.index !== index,
      );
      if (hasInvalidIndexes) {
        throw new Error(
          "OpenAI embedding response indexes do not match the input order.",
        );
      }

      const output: AiEmbeddingOutput = {
        vectors: sortedData.map((item) => item.embedding),
        model: response.model,
        dimensions,
        usage: {
          promptTokens: response.usage?.prompt_tokens,
          totalTokens: response.usage?.total_tokens,
        },
      };
      assertEmbeddingOutput({
        output,
        expectedCount: input.texts.length,
        expectedSpace: { model, dimensions },
      });

      const latencyMs = Date.now() - startTime;
      this.logger.debug(
        `Embedding created: ${input.texts.length} texts, model=${response.model}, ` +
          `dimensions=${dimensions}, tokens=${response.usage?.prompt_tokens ?? "n/a"}, ` +
          `latency=${latencyMs}ms`,
      );

      return output;
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
