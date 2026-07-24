import { describe, it, expect, beforeEach, vi } from "vitest";
import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import { AiProviderName } from "@prisma/client";

import type { AiEmbeddingOutput } from "#api/modules/ai/types/ai-embedding.types";
import {
  AI_PROVIDER_REGISTRY,
  type AiProvider,
  type AiProviderRegistry,
} from "#api/modules/ai/types/ai-provider.interface";
import { AiService } from "#api/modules/ai/services/ai.service";

describe("AiService", () => {
  let service: AiService;
  let mockProvider: AiProvider;
  let registry: AiProviderRegistry;

  const mockEmbeddingOutput: AiEmbeddingOutput = {
    vectors: [new Array(1536).fill(0.1)],
    model: "text-embedding-3-small",
    dimensions: 1536,
    usage: { promptTokens: 3, totalTokens: 3 },
  };

  beforeEach(async () => {
    mockProvider = {
      name: AiProviderName.OPENAI,
      createEmbedding: vi.fn().mockResolvedValue(mockEmbeddingOutput),
      generateText: vi.fn(),
      generateStructured: vi.fn(),
    };

    registry = new Map<AiProviderName, AiProvider>();
    registry.set(AiProviderName.OPENAI, mockProvider);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: AI_PROVIDER_REGISTRY,
          useValue: registry,
        },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string) => {
              const config: Record<string, string | number> = {
                OPENAI_EMBEDDING_MODEL: "text-embedding-3-small",
                OPENAI_EMBEDDING_DIMENSIONS: 1536,
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  describe("getProvider", () => {
    it("should return registered provider", () => {
      const provider = service.getProvider(AiProviderName.OPENAI);
      expect(provider.name).toBe(AiProviderName.OPENAI);
    });

    it("should throw for unregistered provider", () => {
      expect(() => service.getProvider(AiProviderName.GEMINI)).toThrow(
        'AI provider "GEMINI" is not registered',
      );
    });
  });

  describe("getEmbeddingProvider", () => {
    it("should return OpenAI provider", () => {
      const provider = service.getEmbeddingProvider();
      expect(provider.name).toBe(AiProviderName.OPENAI);
    });
  });

  describe("createEmbedding", () => {
    it("should delegate to embedding provider", async () => {
      const input = { texts: ["test text"] };
      const result = await service.createEmbedding(input);

      expect(mockProvider.createEmbedding).toHaveBeenCalledWith(input);
      expect(result.vectors).toHaveLength(1);
      expect(result.model).toBe("text-embedding-3-small");
      expect(result.dimensions).toBe(1536);
    });
  });

  describe("getEmbeddingConfig", () => {
    it("should return current embedding config", () => {
      const config = service.getEmbeddingConfig();
      expect(config.model).toBe("text-embedding-3-small");
      expect(config.dimensions).toBe(1536);
    });
  });

  describe("isProviderAvailable", () => {
    it("should return true for registered provider", () => {
      expect(service.isProviderAvailable(AiProviderName.OPENAI)).toBe(true);
    });

    it("should return false for unregistered provider", () => {
      expect(service.isProviderAvailable(AiProviderName.GEMINI)).toBe(false);
    });
  });
});
