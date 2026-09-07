/**
 * AiProvider interface — abstraction layer cho mọi AI provider.
 *
 * Xem docs/06-ai-rag-spec.md §2.2 cho spec gốc.
 * Xem docs/03-technical-architecture.md §9 cho kiến trúc AI/RAG.
 *
 * Rules:
 * - Mọi call AI đi qua AiProvider abstraction.
 * - Không gọi trực tiếp OpenAI/Gemini SDK rải rác trong code.
 * - Không trộn embedding của nhiều provider/model/dimension trong cùng retrieval space.
 */

import { AiProviderName } from "@prisma/client";

import type {
  AiEmbeddingInput,
  AiEmbeddingOutput,
} from "#api/modules/ai/types/ai-embedding.types";
import type {
  AiStructuredInput,
  AiStructuredOutput,
  AiOutputSchema,
  AiTextInput,
  AiTextOutput,
} from "#api/modules/ai/types/ai-text.types";

export const AI_PROVIDER_REGISTRY = Symbol("AI_PROVIDER_REGISTRY");

export interface AiProvider {
  /** Tên provider, khớp với Prisma AiProviderName enum. */
  readonly name: AiProviderName;

  /** Tạo embedding vectors cho danh sách texts. */
  createEmbedding(input: AiEmbeddingInput): Promise<AiEmbeddingOutput>;

  /** Tạo text completion và trả metadata usage/provider. */
  generateText(input: AiTextInput): Promise<AiTextOutput>;

  /**
   * Tạo structured output. `schema` ràng buộc request gửi provider;
   * `validationSchema` có thể dung sai hơn khi backend cần giữ output hợp lệ
   * về cấu trúc nhưng không muốn loại cả kết quả vì một ràng buộc tạo sinh.
   */
  generateStructured<TOutput>(
    input: AiStructuredInput,
    schema: AiOutputSchema<TOutput>,
    validationSchema?: AiOutputSchema<TOutput>,
  ): Promise<AiStructuredOutput<TOutput>>;
}

/** Map lưu trữ các provider đã register. */
export type AiProviderRegistry = Map<AiProviderName, AiProvider>;
