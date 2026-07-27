/**
 * AiModule — NestJS module cho AI/RAG abstraction.
 *
 * Cung cấp AiService và AiProvider registry cho toàn bộ ứng dụng.
 * Module này là @Global() để module domain có thể inject AiService mà không cần import lại.
 *
 * Provider hiện tại: OpenAI (chính).
 * Gemini sẽ thêm khi owner yêu cầu.
 *
 * Xem docs/03-technical-architecture.md §9 và docs/06-ai-rag-spec.md §2.
 */

import { Global, Logger, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AiProviderName } from "@prisma/client";

import type { EnvConfig } from "#api/config/env.validation";

import { OpenAiProvider } from "#api/modules/ai/providers/openai.provider";
import { AiService } from "#api/modules/ai/services/ai.service";
import { RetrievalService } from "#api/modules/ai/services/retrieval.service";
import {
  AI_PROVIDER_REGISTRY,
  type AiProviderRegistry,
} from "#api/modules/ai/types/ai-provider.interface";
import { getOpenAiConfig } from "#api/modules/ai/utils/ai-config.helper";

const logger = new Logger("AiModule");

@Global()
@Module({
  providers: [
    {
      provide: AI_PROVIDER_REGISTRY,
      useFactory: (
        configService: ConfigService<EnvConfig, true>,
      ): AiProviderRegistry => {
        const registry: AiProviderRegistry = new Map();

        // Register OpenAI provider nếu API key có sẵn
        const openAiApiKey = configService.get("OPENAI_API_KEY", {
          infer: true,
        });

        if (openAiApiKey) {
          const config = getOpenAiConfig(configService);
          const openAiProvider = new OpenAiProvider(config);
          registry.set(AiProviderName.OPENAI, openAiProvider);
          logger.log(
            `OpenAI provider registered (embedding: ${config.embeddingModel}, dimensions: ${config.embeddingDimensions})`,
          );
        } else {
          logger.warn(
            "OPENAI_API_KEY not configured. OpenAI provider will not be available. " +
              "Set OPENAI_API_KEY in .env to enable AI features.",
          );
        }

        // TODO: Register Gemini provider khi owner yêu cầu

        return registry;
      },
      inject: [ConfigService],
    },
    AiService,
    RetrievalService,
  ],
  exports: [AiService, RetrievalService, AI_PROVIDER_REGISTRY],
})
export class AiModule {}
