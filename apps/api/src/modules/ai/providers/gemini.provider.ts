import { AiProviderName } from "@prisma/client";
import { z } from "zod";

import type {
  AiEmbeddingInput,
  AiEmbeddingOutput,
} from "#api/modules/ai/types/ai-embedding.types";
import type { AiProvider } from "#api/modules/ai/types/ai-provider.interface";
import type {
  AiOutputSchema,
  AiStructuredInput,
  AiStructuredOutput,
  AiTextInput,
  AiTextOutput,
} from "#api/modules/ai/types/ai-text.types";
import { parseAiStructuredOutput } from "#api/modules/ai/utils/ai-output-validation";
import { buildAiUserPrompt } from "#api/modules/ai/utils/ai-prompt";

type GeminiProviderConfig = {
  apiKey: string;
  structuredModel: string;
  chatModel: string;
  requestTimeoutMs: number;
};

type GeminiResponse = {
  responseId?: string;
  modelVersion?: string;
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    cachedContentTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

export class GeminiProvider implements AiProvider {
  readonly name = AiProviderName.GEMINI;

  constructor(private readonly config: GeminiProviderConfig) {}

  private supportsTemperature(model: string): boolean {
    const m = model.toLowerCase();
    // Các model Gemini có chữ 'thinking' (vd: gemini-2.0-flash-thinking) được cấu hình theo reasoning_effort, bỏ qua temperature
    if (m.includes("thinking") || m.includes("gemini-3")) {
      return false;
    }
    return true;
  }

  createEmbedding(_input: AiEmbeddingInput): Promise<AiEmbeddingOutput> {
    throw new Error(
      "Gemini embedding is disabled because the project uses one OpenAI vector space.",
    );
  }

  async generateText(input: AiTextInput): Promise<AiTextOutput> {
    const model = input.model ?? this.config.chatModel;
    const startedAt = Date.now();
    const response = await this.generate(model, {
      system_instruction: { parts: [{ text: input.systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: buildAiUserPrompt(input) }] }],
      generationConfig: {
        ...(input.temperature === undefined || !this.supportsTemperature(model) ? {} : { temperature: input.temperature }),
        ...(input.reasoningEffort ? { thinkingConfig: { thinkingLevel: input.reasoningEffort.toUpperCase() } } : {}),
        ...(input.maxTokens === undefined
          ? {}
          : { maxOutputTokens: input.maxTokens }),
      },
    });
    const text = readGeminiText(response);
    return {
      text,
      provider: this.name,
      model: response.modelVersion ?? model,
      providerRequestId: response.responseId,
      usage: toGeminiUsage(response),
      latencyMs: Date.now() - startedAt,
    };
  }

  async generateStructured<TOutput>(
    input: AiStructuredInput,
    schema: AiOutputSchema<TOutput>,
  ): Promise<AiStructuredOutput<TOutput>> {
    const model = input.model ?? this.config.structuredModel;
    const startedAt = Date.now();
    const response = await this.generate(model, {
      system_instruction: { parts: [{ text: input.systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: buildAiUserPrompt(input) }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: z.toJSONSchema(schema),
        ...(input.temperature === undefined || !this.supportsTemperature(model) ? {} : { temperature: input.temperature }),
        ...(input.reasoningEffort ? { thinkingConfig: { thinkingLevel: input.reasoningEffort.toUpperCase() } } : {}),
        ...(input.maxTokens === undefined
          ? {}
          : { maxOutputTokens: input.maxTokens }),
      },
    });
    const raw = readGeminiText(response);
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      throw new Error("Gemini returned invalid JSON for structured output.");
    }
    return {
      data: parseAiStructuredOutput(schema, value),
      provider: this.name,
      model: response.modelVersion ?? model,
      providerRequestId: response.responseId,
      usage: toGeminiUsage(response),
      latencyMs: Date.now() - startedAt,
    };
  }

  private async generate(model: string, body: unknown): Promise<GeminiResponse> {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), this.config.requestTimeoutMs);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(this.config.apiKey)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          signal: abortController.signal,
        },
      );
      if (!response.ok) {
        const error = new Error(
          `Gemini request failed (${response.status}): ${(await response.text()).slice(0, 500)}`,
        ) as Error & { status?: number };
        error.status = response.status;
        throw error;
      }
      return (await response.json()) as GeminiResponse;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function readGeminiText(response: GeminiResponse) {
  const text = response.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }
  return text;
}

function toGeminiUsage(response: GeminiResponse) {
  const usage = response.usageMetadata;
  if (!usage) return undefined;
  return {
    promptTokens: usage.promptTokenCount,
    cachedInputTokens: usage.cachedContentTokenCount,
    completionTokens: usage.candidatesTokenCount,
    totalTokens: usage.totalTokenCount,
  };
}
