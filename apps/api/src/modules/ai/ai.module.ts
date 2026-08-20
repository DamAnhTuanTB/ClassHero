/**
 * AiModule — NestJS module cho AI/RAG abstraction.
 *
 * Cung cấp AiService và AiProvider registry cho toàn bộ ứng dụng.
 * Module này là @Global() để module domain có thể inject AiService mà không cần import lại.
 *
 * Provider hiện tại: OpenAI (chính), Gemini (fallback khi có credential).
 *
 * Xem docs/03-technical-architecture.md §9 và docs/06-ai-rag-spec.md §2.
 */

import { Global, Logger, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AiProviderName } from "@prisma/client";

import type { EnvConfig } from "#api/config/env.validation";

import { OpenAiProvider } from "#api/modules/ai/providers/openai.provider";
import { GeminiProvider } from "#api/modules/ai/providers/gemini.provider";
import { AiProviderCallService } from "#api/modules/ai/services/ai-provider-call.service";
import { AiGenerationJobService } from "#api/modules/ai/services/ai-generation-job.service";
import { AiGenerationLifecycleService } from "#api/modules/ai/services/ai-generation-lifecycle.service";
import { AiService } from "#api/modules/ai/services/ai.service";
import { LessonSummaryContextService } from "#api/modules/ai/services/lesson-summary-context.service";
import { LessonContentGenerationContextService } from "#api/modules/ai/services/lesson-content-generation-context.service";
import { LessonContentGenerationJobService } from "#api/modules/ai/services/lesson-content-generation-job.service";
import { RetrievalService } from "#api/modules/ai/services/retrieval.service";
import {
  AI_PROVIDER_REGISTRY,
  type AiProviderRegistry,
} from "#api/modules/ai/types/ai-provider.interface";
import { getOpenAiConfig } from "#api/modules/ai/utils/ai-config.helper";
import { JobsModule } from "#api/modules/jobs/jobs.module";
import { FilesModule } from "#api/modules/files/files.module";
import { LessonSourcePacketService } from "#api/modules/ai/services/lesson-source-packet.service";

const logger = new Logger("AiModule");

@Global()
@Module({
  imports: [FilesModule, JobsModule],
  providers: [
    {
      provide: AI_PROVIDER_REGISTRY,
      useFactory: (configService: ConfigService<EnvConfig, true>): AiProviderRegistry => {
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

        // Tạm thời tắt Gemini fallback do chưa có API key hợp lệ
        // const geminiApiKey = configService.get("GEMINI_API_KEY", { infer: true });
        // if (geminiApiKey) {
        //   registry.set(
        //     AiProviderName.GEMINI,
        //     new GeminiProvider({
        //       apiKey: geminiApiKey,
        //       structuredModel: configService.get("GEMINI_STRUCTURED_MODEL", {
        //         infer: true,
        //       }),
        //       chatModel: configService.get("GEMINI_CHAT_MODEL", { infer: true }),
        //       requestTimeoutMs: configService.get("AI_PROVIDER_TIMEOUT_MS", {
        //         infer: true,
        //       }),
        //     }),
        //   );
        //   logger.log("Gemini provider registered as structured-output fallback");
        // }

        return registry;
      },
      inject: [ConfigService],
    },
    AiService,
    AiProviderCallService,
    AiGenerationJobService,
    AiGenerationLifecycleService,
    RetrievalService,
    LessonSummaryContextService,
    LessonContentGenerationContextService,
    LessonContentGenerationJobService,
    LessonSourcePacketService,
  ],
  exports: [
    AiService,
    AiProviderCallService,
    AiGenerationJobService,
    AiGenerationLifecycleService,
    RetrievalService,
    LessonSummaryContextService,
    LessonContentGenerationContextService,
    LessonContentGenerationJobService,
    LessonSourcePacketService,
    AI_PROVIDER_REGISTRY,
  ],
})
export class AiModule {}
