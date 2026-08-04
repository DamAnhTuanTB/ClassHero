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
  AiStructuredOutput,
  AiOutputSchema,
  AiTextInput,
  AiTextOutput,
} from "#api/modules/ai/types/ai-text.types";
import type { AiOpenAiConfig } from "#api/modules/ai/utils/ai-config.helper";
import { buildAiStructuredTextFormat } from "#api/modules/ai/utils/ai-structured-output-format";
import {
  assertEmbeddingInput,
  assertEmbeddingOutput,
} from "#api/modules/ai/utils/embedding-validation";
import {
  AiOutputValidationError,
  assertAiOutputName,
  parseAiStructuredOutput,
} from "#api/modules/ai/utils/ai-output-validation";
import { buildAiUserPrompt } from "#api/modules/ai/utils/ai-prompt";

export class OpenAiProvider implements AiProvider {
  readonly name = AiProviderName.OPENAI;
  private readonly client: OpenAI;
  private readonly logger = new Logger(OpenAiProvider.name);
  private readonly config: AiOpenAiConfig;

  constructor(config: AiOpenAiConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      timeout: config.requestTimeoutMs,
      // BullMQ owns retries so one durable attempt maps to one provider call.
      maxRetries: 0,
    });
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
      const hasInvalidIndexes = sortedData.some((item, index) => item.index !== index);
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

  async generateText(input: AiTextInput): Promise<AiTextOutput> {
    const startedAt = Date.now();
    const response = await this.client.responses.create({
      model: input.model ?? this.config.chatModel,
      instructions: input.systemPrompt,
      input: buildAiUserPrompt(input),
      ...(input.temperature === undefined ? {} : { temperature: input.temperature }),
      ...(input.maxTokens === undefined ? {} : { max_output_tokens: input.maxTokens }),
    });
    const text = response.output_text.trim();

    if (!text) {
      throw new Error("OpenAI returned an empty text response.");
    }

    return {
      text,
      provider: this.name,
      model: response.model ?? this.config.chatModel,
      usage: toTokenUsage(response.usage),
      providerRequestId: response.id,
      latencyMs: Date.now() - startedAt,
    };
  }

  async generateStructured<TOutput>(
    input: AiStructuredInput,
    schema: AiOutputSchema<TOutput>,
  ): Promise<AiStructuredOutput<TOutput>> {
    assertAiOutputName(input.outputName);
    const startedAt = Date.now();
    const response = await this.client.responses.parse({
      model: input.model ?? this.config.structuredModel,
      instructions: input.systemPrompt,
      input: buildAiUserPrompt(input),
      text: {
        format: buildAiStructuredTextFormat(schema, input.outputName),
      },
      ...(input.temperature === undefined ? {} : { temperature: input.temperature }),
      ...(input.maxTokens === undefined ? {} : { max_output_tokens: input.maxTokens }),
    });

    if (response.output_parsed === null) {
      throw new AiOutputValidationError(
        "OpenAI did not return a parsed structured output. The response may have been refused or incomplete.",
      );
    }

    const data = parseAiStructuredOutput(schema, response.output_parsed);

    return {
      data,
      provider: this.name,
      model: response.model ?? this.config.structuredModel,
      usage: toTokenUsage(response.usage),
      providerRequestId: response.id,
      latencyMs: Date.now() - startedAt,
    };
  }
}

function toTokenUsage(
  usage:
    | {
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
        input_tokens_details?: { cached_tokens?: number } | null;
      }
    | null
    | undefined,
) {
  if (!usage) {
    return undefined;
  }

  return {
    promptTokens: usage.input_tokens,
    cachedInputTokens: usage.input_tokens_details?.cached_tokens,
    completionTokens: usage.output_tokens,
    totalTokens: usage.total_tokens,
  };
}
