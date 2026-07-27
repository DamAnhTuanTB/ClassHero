/**
 * AiService — facade cho các module khác gọi AI.
 *
 * Module domain gọi AI thông qua AiService thay vì trực tiếp dùng provider.
 * AiService quản lý provider registry và expose các method tiện ích.
 *
 * Xem docs/03-technical-architecture.md §9 và docs/06-ai-rag-spec.md §2.2.
 */

import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AiProviderName } from "@prisma/client";

import type { EnvConfig } from "#api/config/env.validation";

import type {
  AiEmbeddingInput,
  AiEmbeddingOutput,
} from "#api/modules/ai/types/ai-embedding.types";
import {
  AI_PROVIDER_REGISTRY,
  type AiProvider,
  type AiProviderRegistry,
} from "#api/modules/ai/types/ai-provider.interface";
import type {
  AiStructuredInput,
  AiTextInput,
  AiTextOutput,
} from "#api/modules/ai/types/ai-text.types";
import { getEmbeddingConfig } from "#api/modules/ai/utils/ai-config.helper";
import {
  assertEmbeddingInput,
  assertEmbeddingOutput,
} from "#api/modules/ai/utils/embedding-validation";

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @Inject(AI_PROVIDER_REGISTRY)
    private readonly providerRegistry: AiProviderRegistry,
    private readonly configService: ConfigService<EnvConfig, true>,
  ) {
    const providerNames = [...this.providerRegistry.keys()].join(", ");
    this.logger.log(`AiService initialized with providers: [${providerNames}]`);
  }

  /**
   * Lấy provider theo tên.
   * Throw nếu provider chưa được register.
   */
  getProvider(name: AiProviderName): AiProvider {
    const provider = this.providerRegistry.get(name);

    if (!provider) {
      throw new Error(
        `AI provider "${name}" is not registered. Available: [${[...this.providerRegistry.keys()].join(", ")}]`,
      );
    }

    return provider;
  }

  /**
   * Lấy embedding provider mặc định (OPENAI).
   *
   * Rule: Không trộn provider trong cùng vector space.
   * Provider embedding mặc định luôn là OPENAI theo docs/06-ai-rag-spec.md §2.1.
   */
  getEmbeddingProvider(): AiProvider {
    return this.getProvider(AiProviderName.OPENAI);
  }

  /**
   * Tạo embedding bằng provider mặc định.
   *
   * Shorthand cho getEmbeddingProvider().createEmbedding().
   * Model và dimensions lấy từ config nếu không được override trong input.
   */
  async createEmbedding(input: AiEmbeddingInput): Promise<AiEmbeddingOutput> {
    assertEmbeddingInput(input);

    const embeddingConfig = this.getEmbeddingConfig();
    if (
      input.model !== undefined &&
      input.model !== embeddingConfig.model
    ) {
      throw new Error(
        `Embedding model override "${input.model}" does not match configured vector space "${embeddingConfig.model}".`,
      );
    }
    if (
      input.dimensions !== undefined &&
      input.dimensions !== embeddingConfig.dimensions
    ) {
      throw new Error(
        `Embedding dimensions override ${input.dimensions} does not match configured vector space ${embeddingConfig.dimensions}.`,
      );
    }

    const provider = this.getEmbeddingProvider();
    const output = await provider.createEmbedding({
      ...input,
      model: embeddingConfig.model,
      dimensions: embeddingConfig.dimensions,
    });
    assertEmbeddingOutput({
      output,
      expectedCount: input.texts.length,
      expectedSpace: embeddingConfig,
    });

    return output;
  }

  /**
   * Lấy embedding config hiện tại (model, dimensions).
   * Dùng cho retrieval service khi filter chunks theo provider/model/dimensions.
   */
  getEmbeddingConfig(): {
    provider: AiProviderName;
    model: string;
    dimensions: number;
  } {
    return {
      provider: AiProviderName.OPENAI,
      ...getEmbeddingConfig(this.configService),
    };
  }

  /**
   * Tạo text completion bằng provider chỉ định.
   * TODO: M9.1 sẽ thêm logic chọn provider, logging, budget guard.
   */
  async generateText(
    input: AiTextInput,
    providerName: AiProviderName = AiProviderName.OPENAI,
  ): Promise<AiTextOutput> {
    const provider = this.getProvider(providerName);
    return provider.generateText(input);
  }

  /**
   * Tạo structured output bằng provider chỉ định.
   * TODO: M9.1 sẽ thêm logic chọn provider, schema validation, logging, budget guard.
   */
  async generateStructured<TOutput>(
    input: AiStructuredInput,
    schema: unknown,
    providerName: AiProviderName = AiProviderName.OPENAI,
  ): Promise<TOutput> {
    const provider = this.getProvider(providerName);
    return provider.generateStructured<TOutput>(input, schema);
  }

  /**
   * Kiểm tra provider có available không (key đã cấu hình, provider đã register).
   */
  isProviderAvailable(name: AiProviderName): boolean {
    return this.providerRegistry.has(name);
  }
}
