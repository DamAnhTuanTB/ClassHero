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

  private supportsTemperature(model: string): boolean {
    const m = model.toLowerCase();
    // Các model reasoning o-series (o1, o2, o3...) hoặc gpt-5.x đều không hỗ trợ temperature
    if (/^(o[1-9]|gpt-5)/.test(m)) {
      return false;
    }
    return true;
  }

  private supportsReasoningEffort(model: string): boolean {
    return /^(o[1-9]|gpt-5)/u.test(model.toLowerCase());
  }

  private get generationRequestOptions(): { timeout: number } {
    return {
      timeout: this.config.generationRequestTimeoutMs ?? this.config.requestTimeoutMs,
    };
  }

  async generateText(input: AiTextInput): Promise<AiTextOutput> {
    const startedAt = Date.now();
    const modelToUse = input.model ?? this.config.chatModel;
    const response = await this.client.responses.create(
      {
        model: modelToUse,
        instructions: input.systemPrompt,
        input: buildAiUserPrompt(input),
        ...(input.temperature === undefined || !this.supportsTemperature(modelToUse)
          ? {}
          : { temperature: input.temperature }),
        ...(input.reasoningEffort && this.supportsReasoningEffort(modelToUse)
          ? { reasoning: { effort: input.reasoningEffort } }
          : {}),
        ...(input.maxTokens === undefined ? {} : { max_output_tokens: input.maxTokens }),
      },
      this.generationRequestOptions,
    );
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
    const modelToUse = input.model ?? this.config.structuredModel;
    const response = await this.client.responses.parse(
      {
        model: modelToUse,
        instructions: input.systemPrompt,
        input: buildAiUserPrompt(input),
        text: {
          format: buildAiStructuredTextFormat(
            schema,
            input.outputName,
            input.schemaReferenceStrategy,
          ),
        },
        ...(input.temperature === undefined || !this.supportsTemperature(modelToUse)
          ? {}
          : { temperature: input.temperature }),
        ...(input.reasoningEffort && this.supportsReasoningEffort(modelToUse)
          ? { reasoning: { effort: input.reasoningEffort } }
          : {}),
        ...(input.maxTokens === undefined ? {} : { max_output_tokens: input.maxTokens }),
      },
      this.generationRequestOptions,
    );

    if (response.output_parsed === null) {
      const responseDiagnostics = response as typeof response & {
        finish_reason?: unknown;
        refusal?: unknown;
      };
      this.logger.error(
        `OpenAI Structured Generation Failed: ${JSON.stringify(
          {
            output_text: response.output_text,
            model: response.model,
            usage: response.usage,
            id: response.id,
            finish_reason: responseDiagnostics.finish_reason,
            refusal: responseDiagnostics.refusal,
          },
          null,
          2,
        )}`,
      );
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
