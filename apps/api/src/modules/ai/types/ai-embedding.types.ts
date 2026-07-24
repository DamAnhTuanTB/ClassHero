/**
 * AI embedding input/output types.
 *
 * Dùng cho interface AiProvider.createEmbedding().
 * Xem docs/06-ai-rag-spec.md §2.2 cho spec gốc.
 */

export interface AiEmbeddingInput {
  /** Danh sách text cần embedding. Hỗ trợ batch. */
  texts: string[];
  /** Override model embedding. Nếu không set, dùng model mặc định từ config. */
  model?: string;
  /** Override dimensions. Nếu không set, dùng dimensions mặc định từ config. */
  dimensions?: number;
}

export interface AiEmbeddingOutput {
  /** Mảng vectors tương ứng với mỗi text input. */
  vectors: number[][];
  /** Model thực tế đã dùng (từ provider response). */
  model: string;
  /** Số dimensions của vector. */
  dimensions: number;
  /** Token usage nếu provider trả về. */
  usage?: {
    promptTokens?: number;
    totalTokens?: number;
  };
}
