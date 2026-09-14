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
import OpenAI, { toFile } from "openai";

import type {
  AiEmbeddingInput,
  AiEmbeddingOutput,
} from "#api/modules/ai/types/ai-embedding.types";
import type { AiProvider } from "#api/modules/ai/types/ai-provider.interface";
import type {
  AiInputFile,
  AiOutputSchema,
  AiProviderOutputMetadata,
  AiStructuredInput,
  AiStructuredOutput,
  AiTextInput,
  AiTextOutput,
  AiTextStreamEvent,
  AiTokenUsage,
} from "#api/modules/ai/types/ai-text.types";
import type { AiOpenAiConfig } from "#api/modules/ai/utils/ai-config.helper";
import { resolveAiStructuredTextFormat } from "#api/modules/ai/utils/ai-structured-output-format";
import {
  assertEmbeddingInput,
  assertEmbeddingOutput,
} from "#api/modules/ai/utils/embedding-validation";
import {
  AiProviderOutputError,
  assertAiOutputName,
  parseAiStructuredOutput,
} from "#api/modules/ai/utils/ai-output-validation";
import {
  buildOpenAiResponseInput,
  buildOpenAiStructuredResponseRequest,
  buildOpenAiTextResponseRequest,
  type OpenAiPreparedInputFile,
} from "#api/modules/ai/utils/openai-response-request";

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

  private get generationRequestOptions(): { timeout: number } {
    return {
      timeout: this.config.generationRequestTimeoutMs ?? this.config.requestTimeoutMs,
    };
  }

  async generateText(input: AiTextInput): Promise<AiTextOutput> {
    const startedAt = Date.now();
    const modelToUse = input.model ?? this.config.chatModel;
    const preparedInput = await this.prepareResponseInput(input);
    try {
      const response = await this.client.responses.create(
        buildOpenAiTextResponseRequest({
          request: input,
          model: modelToUse,
          contractVersion: "ai-text-v1",
          responseInput: preparedInput.input,
        }),
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
        providerUsageRaw: response.usage,
        providerRequestId: response.id,
        latencyMs: Date.now() - startedAt,
        inputFileOperations: preparedInput.operations,
      };
    } finally {
      await preparedInput.cleanup();
    }
  }

  async *streamText(input: AiTextInput): AsyncGenerator<AiTextStreamEvent> {
    const startedAt = Date.now();
    const modelToUse = input.model ?? this.config.chatModel;
    const preparedInput = await this.prepareResponseInput(input);
    let fullText = "";
    let timeToFirstTokenMs: number | undefined;
    let completedResponse:
      | Extract<
          import("openai/resources/responses/responses").ResponseStreamEvent,
          { type: "response.completed" }
        >["response"]
      | null = null;

    try {
      const stream = await this.client.responses.create(
        {
          ...buildOpenAiTextResponseRequest({
            request: input,
            model: modelToUse,
            contractVersion: "ai-text-stream-v1",
            responseInput: preparedInput.input,
          }),
          stream: true,
        },
        this.generationRequestOptions,
      );

      for await (const event of stream) {
        if (event.type === "response.output_text.delta" && event.delta) {
          timeToFirstTokenMs ??= Date.now() - startedAt;
          fullText += event.delta;
          yield { type: "delta", delta: event.delta };
        } else if (event.type === "response.completed") {
          completedResponse = event.response;
        } else if (
          event.type === "response.failed" ||
          event.type === "response.incomplete" ||
          event.type === "error"
        ) {
          throw new Error(`OpenAI stream ended with ${event.type}.`);
        }
      }

      const text = fullText.trim();
      if (!text || !completedResponse) {
        throw new Error("OpenAI returned an incomplete or empty text stream.");
      }

      yield {
        type: "completed",
        output: {
          text,
          provider: this.name,
          model: completedResponse.model ?? modelToUse,
          usage: toTokenUsage(completedResponse.usage),
          providerUsageRaw: completedResponse.usage,
          providerRequestId: completedResponse.id,
          latencyMs: Date.now() - startedAt,
          timeToFirstTokenMs,
          inputFileOperations: preparedInput.operations,
        },
      };
    } finally {
      await preparedInput.cleanup();
    }
  }

  async generateStructured<TOutput>(
    input: AiStructuredInput,
    schema: AiOutputSchema<TOutput>,
    validationSchema: AiOutputSchema<TOutput> = schema,
  ): Promise<AiStructuredOutput<TOutput>> {
    assertAiOutputName(input.outputName);
    const startedAt = Date.now();
    const modelToUse = input.model ?? this.config.structuredModel;
    const structuredTextFormatResolution = resolveAiStructuredTextFormat(
      schema,
      input.outputName,
      input.schemaReferenceStrategy,
      validationSchema,
    );
    const structuredTextFormat = structuredTextFormatResolution.format;
    const preparedInput = await this.prepareResponseInput(input);
    try {
      const response = await this.client.responses.parse(
        buildOpenAiStructuredResponseRequest({
          request: input,
          model: modelToUse,
          structuredTextFormat,
          responseInput: preparedInput.input,
        }),
        this.generationRequestOptions,
      );

      if (response.output_parsed === null) {
        const latencyMs = Date.now() - startedAt;
        const failure = buildOpenAiStructuredOutputError({
          responseStatus: response.status ?? null,
          incompleteReason: response.incomplete_details?.reason ?? null,
          hasRefusal: hasOpenAiRefusal(response.output),
          providerRequestId: response.id,
          model: response.model ?? modelToUse,
          usage: toTokenUsage(response.usage),
          providerUsageRaw: response.usage,
          latencyMs,
          maxOutputTokens: response.max_output_tokens ?? input.maxTokens,
          inputFileOperations: preparedInput.operations,
        });
        this.logger.error(
          `OpenAI Structured Generation Failed: ${JSON.stringify(
            {
              code: failure.code,
              responseStatus: failure.details.responseStatus,
              incompleteReason: failure.details.incompleteReason,
              hasRefusal: failure.details.hasRefusal,
              outputTextLength: response.output_text?.length ?? 0,
              maxOutputTokens: failure.details.maxOutputTokens,
              model: failure.details.model,
              usage: failure.details.usage,
              providerRequestId: failure.details.providerRequestId,
              latencyMs,
            },
            null,
            2,
          )}`,
        );
        throw failure;
      }

      const data = parseAiStructuredOutput(validationSchema, response.output_parsed);
      const usage = toTokenUsage(response.usage);
      if (usage?.promptTokens !== undefined) {
        const cachedTokens = usage.cachedInputTokens ?? 0;
        const cacheWriteTokens = usage.cacheWriteInputTokens ?? 0;
        const uncachedTokens = Math.max(
          0,
          usage.promptTokens - cachedTokens - cacheWriteTokens,
        );
        const hitRatio = usage.promptTokens === 0 ? 0 : cachedTokens / usage.promptTokens;
        this.logger.debug(
          `[PROMPT_CACHE] output=${input.outputName} model=${response.model ?? modelToUse} ` +
            `prompt=${input.promptVersion} schema=${input.schemaVersion} ` +
            `strategy=${input.schemaReferenceStrategy ?? "inline"} ` +
            `resolvedStrategy=${structuredTextFormatResolution.resolvedReferenceStrategy} ` +
            `schemaBytes=${structuredTextFormatResolution.schemaBytes} ` +
            `input=${usage.promptTokens} ` +
            `cached=${cachedTokens} cacheWrite=${cacheWriteTokens} ` +
            `uncached=${uncachedTokens} ` +
            `hitRatio=${hitRatio.toFixed(4)}`,
        );
      }

      return {
        data,
        provider: this.name,
        model: response.model ?? this.config.structuredModel,
        usage,
        providerUsageRaw: response.usage,
        providerRequestId: response.id,
        latencyMs: Date.now() - startedAt,
        inputFileOperations: preparedInput.operations,
      };
    } finally {
      await preparedInput.cleanup();
    }
  }

  private async prepareResponseInput(input: AiTextInput) {
    assertInputFiles(input.inputFiles ?? []);
    const operations: NonNullable<AiTextOutput["inputFileOperations"]> = [];
    const ownedFileIds: string[] = [];
    const files: OpenAiPreparedInputFile[] = [];
    for (const file of input.inputFiles ?? []) {
      if (file.fileData) {
        const startedAt = Date.now();
        const uploaded = await this.client.files.create({
          file: await toFile(decodeFileData(file.fileData), file.filename, {
            type: file.mimeType,
          }),
          purpose: "user_data",
        });
        ownedFileIds.push(uploaded.id);
        operations.push({
          providerFileId: uploaded.id,
          uploadLatencyMs: Date.now() - startedAt,
          cleanupStatus: "failed",
        });
        files.push({
          type: "input_file",
          file_id: uploaded.id,
          detail: file.detail,
        });
      } else if (file.fileId) {
        operations.push({
          providerFileId: file.fileId,
          uploadLatencyMs: 0,
          cleanupStatus: "not_owned",
        });
        files.push({
          type: "input_file",
          file_id: file.fileId,
          detail: file.detail,
        });
      } else {
        files.push({
          type: "input_file",
          file_url: file.fileUrl!,
          detail: file.detail,
        });
      }
    }
    const responseInput = buildOpenAiResponseInput(input, files);
    return {
      input: responseInput,
      operations,
      cleanup: async () => {
        await Promise.all(
          ownedFileIds.map(async (fileId) => {
            const operation = operations.find((item) => item.providerFileId === fileId);
            try {
              await this.client.files.delete(fileId);
              if (operation) operation.cleanupStatus = "deleted";
            } catch (error) {
              this.logger.warn(
                `OpenAI temporary file cleanup failed for ${fileId}: ${error instanceof Error ? error.message : String(error)}`,
              );
            }
          }),
        );
      },
    };
  }
}

function assertInputFiles(files: AiInputFile[]) {
  for (const file of files) {
    const variants = [file.fileId, file.fileData, file.fileUrl].filter(Boolean);
    if (variants.length !== 1) {
      throw new Error(
        `AI input file ${file.filename} must define exactly one of fileId, fileData, or fileUrl.`,
      );
    }
    if (file.mimeType === "application/pdf" && file.detail === undefined) {
      throw new Error(`PDF input file ${file.filename} must set detail explicitly.`);
    }
  }
}

function decodeFileData(value: string) {
  const dataUrl = value.match(/^data:[^;]+;base64,(.+)$/su);
  return Buffer.from(dataUrl?.[1] ?? value, "base64");
}

function toTokenUsage(
  usage:
    | {
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
        input_tokens_details?: {
          cached_tokens?: number;
          cache_write_tokens?: number;
        } | null;
        output_tokens_details?: { reasoning_tokens?: number } | null;
      }
    | null
    | undefined,
): AiTokenUsage | undefined {
  if (!usage) {
    return undefined;
  }

  return {
    promptTokens: usage.input_tokens,
    cachedInputTokens: usage.input_tokens_details?.cached_tokens,
    cacheWriteInputTokens: usage.input_tokens_details?.cache_write_tokens,
    completionTokens: usage.output_tokens,
    reasoningTokens: usage.output_tokens_details?.reasoning_tokens,
    totalTokens: usage.total_tokens,
  };
}

export function buildOpenAiStructuredOutputError(input: {
  responseStatus: string | null;
  incompleteReason: string | null;
  hasRefusal: boolean;
  providerRequestId?: string;
  model: string;
  usage?: AiTokenUsage;
  providerUsageRaw?: unknown;
  inputFileOperations?: AiProviderOutputMetadata["inputFileOperations"];
  latencyMs?: number;
  maxOutputTokens?: number;
}) {
  const details = {
    provider: AiProviderName.OPENAI,
    model: input.model,
    ...(input.providerRequestId ? { providerRequestId: input.providerRequestId } : {}),
    ...(input.usage ? { usage: input.usage } : {}),
    ...(input.providerUsageRaw === undefined
      ? {}
      : { providerUsageRaw: input.providerUsageRaw }),
    ...(input.inputFileOperations
      ? { inputFileOperations: input.inputFileOperations }
      : {}),
    ...(input.latencyMs === undefined ? {} : { latencyMs: input.latencyMs }),
    responseStatus: input.responseStatus,
    incompleteReason: input.incompleteReason,
    hasRefusal: input.hasRefusal,
    ...(input.maxOutputTokens === undefined
      ? {}
      : { maxOutputTokens: input.maxOutputTokens }),
  };

  if (input.incompleteReason === "max_output_tokens") {
    const limitText = input.maxOutputTokens
      ? ` ${input.maxOutputTokens.toLocaleString("vi-VN")}`
      : "";
    return new AiProviderOutputError(
      "OPENAI_INCOMPLETE_MAX_OUTPUT_TOKENS",
      `OpenAI đã dừng trước khi hoàn thành dữ liệu vì chạm giới hạn${limitText} token đầu ra; giới hạn này bao gồm cả token suy luận. Hãy tăng giới hạn token hoặc giảm mức suy luận rồi tạo lại.`,
      details,
    );
  }
  if (input.incompleteReason === "content_filter") {
    return new AiProviderOutputError(
      "OPENAI_INCOMPLETE_CONTENT_FILTER",
      "OpenAI đã dừng phản hồi do bộ lọc an toàn. Hãy kiểm tra nội dung nguồn và yêu cầu bổ sung rồi tạo lại.",
      details,
    );
  }
  if (input.hasRefusal) {
    return new AiProviderOutputError(
      "OPENAI_REFUSED",
      "OpenAI đã từ chối tạo nội dung cho yêu cầu này. Hãy kiểm tra nội dung nguồn và yêu cầu bổ sung rồi tạo lại.",
      details,
    );
  }
  return new AiProviderOutputError(
    "OPENAI_STRUCTURED_OUTPUT_MISSING",
    "OpenAI không trả về dữ liệu có cấu trúc hoàn chỉnh. Hãy kiểm tra cấu hình rồi tạo lại.",
    details,
  );
}

function hasOpenAiRefusal(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.some((item) => {
    if (!item || typeof item !== "object" || !("content" in item)) return false;
    const content = (item as { content?: unknown }).content;
    return (
      Array.isArray(content) &&
      content.some(
        (part) =>
          part !== null &&
          typeof part === "object" &&
          "type" in part &&
          (part as { type?: unknown }).type === "refusal",
      )
    );
  });
}
