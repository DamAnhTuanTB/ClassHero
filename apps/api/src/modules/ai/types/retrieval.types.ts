/**
 * Types cho RetrievalService — vector search context retrieval.
 *
 * Xem docs/06-ai-rag-spec.md §4.
 */

/**
 * Input cho retrieveContext().
 */
export interface RetrievalInput {
  /** Lesson hiện tại — chỉ lấy chunks trong lesson này */
  lessonId: string;

  /** Giới hạn thêm vào đúng các lesson_documents admin đã chọn. */
  documentIds?: string[];

  /** Câu hỏi/query của user hoặc prompt */
  query: string;

  /**
   * Số chunks tối đa trả về.
   * Default: 6 cho chat, 10 cho quiz/test generation.
   */
  topK?: number;

  /**
   * Ngưỡng similarity tối thiểu (0-1).
   * Chunks dưới ngưỡng bị loại.
   * Default: 0.25
   */
  minScore?: number;

  /** Bật keyword search fallback (default true) */
  includeKeywordSearch?: boolean;

  /** Token budget tối đa cho tổng context (default 3000) */
  maxContextTokens?: number;
}

/**
 * Một chunk đã retrieved với similarity score.
 */
export interface RetrievedChunk {
  /** document_chunks.id */
  chunkId: string;

  /** lesson_documents.id */
  documentId: string;

  /** lessons.id */
  lessonId: string;

  /** Nội dung gốc (LaTeX/MMD — dùng cho AI prompt và UI rendering) */
  content: string;

  /** Cosine similarity score (0-1, higher = more relevant) */
  score: number;

  /** Vị trí chunk trong document */
  chunkIndex: number;

  /** Số tokens ước tính của chunk */
  tokenCount: number;

  /** Metadata bổ sung (page range, heading, etc.) */
  metadataJson: unknown;

  /** Chunk được tìm qua vector, keyword, hoặc cả hai */
  matchSource: "vector" | "keyword" | "both";
}

/**
 * Output từ retrieveContext().
 */
export interface RetrievalOutput {
  /** Chunks đã sắp xếp theo score giảm dần */
  chunks: RetrievedChunk[];

  /** Query gốc */
  query: string;

  /** Tổng token count của tất cả chunks trả về */
  totalTokens: number;

  /** Thời gian search (ms) */
  searchLatencyMs: number;

  /** Số chunks từ keyword search */
  keywordMatchCount: number;
}

/** Default values */
export const RETRIEVAL_DEFAULTS = {
  topK: 6,
  minScore: 0.25,
  maxTopK: 20,
  includeKeywordSearch: true,
  maxContextTokens: 3000,
} as const;
