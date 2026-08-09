import { describe, it, expect, beforeEach, vi } from "vitest";
import { AiProviderName } from "@prisma/client";
import { z } from "zod";

import type { AiEmbeddingInput } from "#api/modules/ai/types/ai-embedding.types";
import type { AiProvider } from "#api/modules/ai/types/ai-provider.interface";
import type { AiOpenAiConfig } from "#api/modules/ai/utils/ai-config.helper";

// Mock OpenAI SDK
const mockEmbeddingsCreate = vi.fn();
const mockResponsesCreate = vi.fn();
const mockResponsesParse = vi.fn();
vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      embeddings = { create: mockEmbeddingsCreate };
      responses = {
        create: mockResponsesCreate,
        parse: mockResponsesParse,
      };
      constructor() {}
    },
  };
});

describe("OpenAiProvider", () => {
  let provider: AiProvider;
  const testConfig: AiOpenAiConfig = {
    apiKey: "test-api-key",
    requestTimeoutMs: 60_000,
    structuredModel: "gpt-4.1-mini",
    chatModel: "gpt-4.1-mini",
    embeddingModel: "text-embedding-3-small",
    embeddingDimensions: 1536,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const { OpenAiProvider } = await import("#api/modules/ai/providers/openai.provider");
    provider = new OpenAiProvider(testConfig);
  });

  describe("name", () => {
    it("should be OPENAI", () => {
      expect(provider.name).toBe(AiProviderName.OPENAI);
    });
  });

  describe("createEmbedding", () => {
    const mockInput: AiEmbeddingInput = {
      texts: ["Hello world", "Test embedding"],
    };

    const mockResponse = {
      data: [
        { embedding: new Array(1536).fill(0.1), index: 0 },
        { embedding: new Array(1536).fill(0.2), index: 1 },
      ],
      model: "text-embedding-3-small",
      usage: {
        prompt_tokens: 5,
        total_tokens: 5,
      },
    };

    it("should create embeddings successfully", async () => {
      mockEmbeddingsCreate.mockResolvedValueOnce(mockResponse);

      const result = await provider.createEmbedding(mockInput);

      expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
        model: "text-embedding-3-small",
        input: ["Hello world", "Test embedding"],
        dimensions: 1536,
      });

      expect(result.vectors).toHaveLength(2);
      expect(result.model).toBe("text-embedding-3-small");
      expect(result.dimensions).toBe(1536);
      expect(result.usage).toEqual({
        promptTokens: 5,
        totalTokens: 5,
      });
    });

    it("should use custom model when provided", async () => {
      mockEmbeddingsCreate.mockResolvedValueOnce({
        ...mockResponse,
        data: [{ embedding: new Array(3072).fill(0.1), index: 0 }],
        model: "text-embedding-3-large",
      });

      const customInput: AiEmbeddingInput = {
        texts: ["test"],
        model: "text-embedding-3-large",
        dimensions: 3072,
      };

      await provider.createEmbedding(customInput);

      expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
        model: "text-embedding-3-large",
        input: ["test"],
        dimensions: 3072,
      });
    });

    it("should reject empty embedding input", async () => {
      await expect(provider.createEmbedding({ texts: [] })).rejects.toThrow(
        "must contain at least one text",
      );
      expect(mockEmbeddingsCreate).not.toHaveBeenCalled();
    });

    it("should reject an incomplete provider response", async () => {
      mockEmbeddingsCreate.mockResolvedValueOnce({
        ...mockResponse,
        data: [mockResponse.data[0]],
      });

      await expect(provider.createEmbedding(mockInput)).rejects.toThrow(
        "returned 1 vectors for 2 inputs",
      );
    });

    it("should reject a vector with the wrong dimensions", async () => {
      mockEmbeddingsCreate.mockResolvedValueOnce({
        ...mockResponse,
        data: [{ embedding: new Array(100).fill(0.1), index: 0 }, mockResponse.data[1]],
      });

      await expect(provider.createEmbedding(mockInput)).rejects.toThrow(
        "has 100 dimensions, expected 1536",
      );
    });

    it("should restore provider output to input index order", async () => {
      mockEmbeddingsCreate.mockResolvedValueOnce({
        ...mockResponse,
        data: [mockResponse.data[1], mockResponse.data[0]],
      });

      const result = await provider.createEmbedding(mockInput);

      expect(result.vectors[0]?.[0]).toBe(0.1);
      expect(result.vectors[1]?.[0]).toBe(0.2);
    });

    it("should throw on API error", async () => {
      mockEmbeddingsCreate.mockRejectedValueOnce(new Error("Rate limit exceeded"));

      await expect(provider.createEmbedding(mockInput)).rejects.toThrow(
        "Rate limit exceeded",
      );
    });

    it("should handle single text input", async () => {
      const singleResponse = {
        data: [{ embedding: new Array(1536).fill(0.5), index: 0 }],
        model: "text-embedding-3-small",
        usage: { prompt_tokens: 2, total_tokens: 2 },
      };

      mockEmbeddingsCreate.mockResolvedValueOnce(singleResponse);

      const result = await provider.createEmbedding({ texts: ["single"] });

      expect(result.vectors).toHaveLength(1);
      expect(result.vectors[0]).toHaveLength(1536);
    });
  });

  describe("generateText", () => {
    it("returns text with provider usage metadata", async () => {
      mockResponsesCreate.mockResolvedValueOnce({
        id: "resp-text-1",
        model: "gpt-4.1-mini-2025-04-14",
        output_text: "  Xin chào em.  ",
        usage: {
          input_tokens: 12,
          output_tokens: 5,
          total_tokens: 17,
        },
      });

      await expect(
        provider.generateText({
          systemPrompt: "Bạn là trợ giảng.",
          userPrompt: "Giải thích ngắn.",
          contextChunks: [{ id: "chunk-1", content: "2 + 2 = 4" }],
          maxTokens: 100,
        }),
      ).resolves.toMatchObject({
        text: "Xin chào em.",
        provider: AiProviderName.OPENAI,
        model: "gpt-4.1-mini-2025-04-14",
        providerRequestId: "resp-text-1",
        usage: {
          promptTokens: 12,
          completionTokens: 5,
          totalTokens: 17,
        },
      });
      expect(mockResponsesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gpt-4.1-mini",
          instructions: "Bạn là trợ giảng.",
          input: expect.stringContaining('<chunk id="chunk-1">'),
          max_output_tokens: 100,
        }),
      );
    });

    it("rejects an empty text response", async () => {
      mockResponsesCreate.mockResolvedValueOnce({
        id: "resp-empty",
        model: "gpt-4.1-mini",
        output_text: "  ",
        usage: null,
      });

      await expect(
        provider.generateText({ systemPrompt: "test", userPrompt: "test" }),
      ).rejects.toThrow("empty text response");
    });
  });

  describe("generateStructured", () => {
    const schema = z.object({
      status: z.literal("ok"),
      value: z.number().int().positive(),
    });

    it("returns only output that passes the Zod schema", async () => {
      mockResponsesParse.mockResolvedValueOnce({
        id: "resp-structured-1",
        model: "gpt-4.1-mini-2025-04-14",
        output_parsed: { status: "ok", value: 2 },
        usage: {
          input_tokens: 20,
          output_tokens: 8,
          total_tokens: 28,
        },
      });

      await expect(
        provider.generateStructured(
          {
            systemPrompt: "Return structured output.",
            userPrompt: "Return value two.",
            outputName: "m9_1_smoke",
            promptVersion: "m9.1-v1",
            schemaVersion: "m9.1-v1",
            temperature: 0,
          },
          schema,
        ),
      ).resolves.toMatchObject({
        data: { status: "ok", value: 2 },
        provider: AiProviderName.OPENAI,
        providerRequestId: "resp-structured-1",
        usage: { totalTokens: 28 },
      });
      expect(mockResponsesParse).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gpt-4.1-mini",
          temperature: 0,
          text: { format: expect.any(Object) },
        }),
      );
    });

    it("uses the Responses API reasoning object for supported models", async () => {
      mockResponsesParse.mockResolvedValueOnce({
        id: "resp-reasoning-1",
        model: "gpt-5.4",
        output_parsed: { status: "ok", value: 2 },
        usage: null,
      });

      await provider.generateStructured(
        {
          systemPrompt: "Review carefully.",
          userPrompt: "Return value two.",
          outputName: "reasoning_smoke",
          promptVersion: "v1",
          schemaVersion: "v1",
          model: "gpt-5.4",
          reasoningEffort: "medium",
          temperature: 0.1,
        },
        schema,
      );

      expect(mockResponsesParse).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gpt-5.4",
          reasoning: { effort: "medium" },
        }),
      );
      expect(mockResponsesParse.mock.calls[0]?.[0]).not.toHaveProperty(
        "reasoning_effort",
      );
      expect(mockResponsesParse.mock.calls[0]?.[0]).not.toHaveProperty("temperature");
    });

    it("rejects parsed data that fails local Zod validation", async () => {
      mockResponsesParse.mockResolvedValueOnce({
        id: "resp-invalid",
        model: "gpt-4.1-mini",
        output_parsed: { status: "ok", value: -1 },
        usage: null,
      });

      await expect(
        provider.generateStructured(
          {
            systemPrompt: "test",
            userPrompt: "test",
            outputName: "test_output",
            promptVersion: "v1",
            schemaVersion: "v1",
          },
          schema,
        ),
      ).rejects.toMatchObject({ code: "AI_OUTPUT_INVALID" });
    });

    it("rejects refusal or incomplete output", async () => {
      mockResponsesParse.mockResolvedValueOnce({
        id: "resp-refusal",
        model: "gpt-4.1-mini",
        output_parsed: null,
        usage: null,
      });

      await expect(
        provider.generateStructured(
          {
            systemPrompt: "test",
            userPrompt: "test",
            outputName: "test_output",
            promptVersion: "v1",
            schemaVersion: "v1",
          },
          schema,
        ),
      ).rejects.toThrow("did not return a parsed structured output");
    });
  });
});
