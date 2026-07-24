/**
 * RetrievalService — vector search context retrieval theo lesson.
 *
 * Flow (docs/06-ai-rag-spec.md §4.2):
 * 1. Embed query bằng AiService
 * 2. Raw SQL pgvector cosine search trong document_chunks
 * 3. Filter: lesson_id, provider, model, dimensions, minScore
 * 4. Trả topK chunks sắp xếp theo similarity
 *
 * Đặc điểm:
 * - Chỉ search trong 1 lesson — không leak context giữa lesson
 * - Trả content LaTeX gốc (cho AI prompt + UI rendering)
 * - Query embedding sẽ dùng cùng provider/model/dimensions với chunks
 */

import { Inject, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "#api/common/prisma/prisma.service";

import { extractKeywords } from "../utils/keyword-extractor";
import { AiService } from "./ai.service";
import {
  RETRIEVAL_DEFAULTS,
  type RetrievalInput,
  type RetrievalOutput,
  type RetrievedChunk,
} from "../types/retrieval.types";

interface RawChunkRow {
  id: string;
  document_id: string;
  lesson_id: string;
  content: string;
  chunk_index: number;
  token_count: number | null;
  metadata_json: unknown;
  score: number;
}

@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AiService) private readonly aiService: AiService,
  ) {}

  /**
   * Tìm context chunks liên quan nhất cho một query trong phạm vi lesson.
   *
   * @param input - lessonId, query, topK, minScore
   * @returns Chunks sắp xếp theo similarity giảm dần
   */
  async retrieveContext(input: RetrievalInput): Promise<RetrievalOutput> {
    const startTime = Date.now();

    const topK = Math.min(
      input.topK ?? RETRIEVAL_DEFAULTS.topK,
      RETRIEVAL_DEFAULTS.maxTopK,
    );
    const minScore = input.minScore ?? RETRIEVAL_DEFAULTS.minScore;
    const includeKeywordSearch =
      input.includeKeywordSearch ?? RETRIEVAL_DEFAULTS.includeKeywordSearch;
    const maxTokens =
      input.maxContextTokens ?? RETRIEVAL_DEFAULTS.maxContextTokens;

    // 1. Get embedding config (provider, model, dimensions)
    const embConfig = this.aiService.getEmbeddingConfig();

    // 2. Embed the query
    const embResult = await this.aiService.createEmbedding({
      texts: [input.query],
    });
    const queryVector = embResult.vectors[0];
    const vectorString = `[${queryVector.join(",")}]`;

    // 3. Vector search with pgvector cosine distance
    const vectorRows = await this.prisma.$queryRaw<RawChunkRow[]>`
      SELECT
        id,
        document_id,
        lesson_id,
        content,
        chunk_index,
        token_count,
        metadata_json,
        1 - (embedding <=> ${vectorString}::vector) AS score
      FROM document_chunks
      WHERE lesson_id = ${input.lessonId}::uuid
        AND embedding IS NOT NULL
        AND embedding_provider = ${embConfig.provider}::"AiProviderName"
        AND embedding_model = ${embConfig.model}
        AND embedding_dimensions = ${embConfig.dimensions}
      ORDER BY embedding <=> ${vectorString}::vector
      LIMIT ${topK}
    `;

    // 4. Keyword search fallback
    let keywordRows: RawChunkRow[] = [];
    if (includeKeywordSearch) {
      const keywords = extractKeywords(input.query);
      if (keywords.length > 0) {
        const keywordConditions = keywords.map(
          (kw) => Prisma.sql`content ILIKE ${"%" + kw + "%"}`
        );
        const orClause = Prisma.sql`(${Prisma.join(keywordConditions, " OR ")})`;

        keywordRows = await this.prisma.$queryRaw<RawChunkRow[]>`
          SELECT
            id,
            document_id,
            lesson_id,
            content,
            chunk_index,
            token_count,
            metadata_json,
            0.5 AS score
          FROM document_chunks
          WHERE lesson_id = ${input.lessonId}::uuid
            AND ${orClause}
          LIMIT ${topK}
        `;
      }
    }

    // 5. Merge and deduplicate
    const chunkMap = new Map<string, RetrievedChunk>();

    // Process vector results
    for (const row of vectorRows) {
      if (row.score >= minScore) {
        chunkMap.set(row.id, {
          chunkId: row.id,
          documentId: row.document_id,
          lessonId: row.lesson_id,
          content: row.content,
          score: row.score,
          chunkIndex: row.chunk_index,
          tokenCount: row.token_count ?? 0,
          metadataJson: row.metadata_json,
          matchSource: "vector",
        });
      }
    }

    // Process keyword results
    let keywordMatchCount = 0;
    for (const row of keywordRows) {
      const existing = chunkMap.get(row.id);
      if (existing) {
        // Boost score if found by both
        existing.score = Math.min(1.0, existing.score + 0.15);
        existing.matchSource = "both";
        keywordMatchCount++;
      } else {
        chunkMap.set(row.id, {
          chunkId: row.id,
          documentId: row.document_id,
          lessonId: row.lesson_id,
          content: row.content,
          score: row.score,
          chunkIndex: row.chunk_index,
          tokenCount: row.token_count ?? 0,
          metadataJson: row.metadata_json,
          matchSource: "keyword",
        });
        keywordMatchCount++;
      }
    }

    // Sort by score descending
    const sortedChunks = Array.from(chunkMap.values()).sort(
      (a, b) => b.score - a.score,
    );

    // 6. Token budget cap and topK limit
    const finalChunks: RetrievedChunk[] = [];
    let currentTokens = 0;

    for (const chunk of sortedChunks) {
      if (finalChunks.length >= topK) break;

      const newTotal = currentTokens + chunk.tokenCount;
      if (finalChunks.length > 0 && newTotal > maxTokens) {
        continue;
      }

      finalChunks.push(chunk);
      currentTokens += chunk.tokenCount;
    }

    const searchLatencyMs = Date.now() - startTime;

    this.logger.debug(
      `[RETRIEVAL] lesson=${input.lessonId} query="${input.query.slice(0, 50)}..." ` +
        `vector=${vectorRows.length} keyword=${keywordRows.length} ` +
        `merged=${finalChunks.length} tokens=${currentTokens} latency=${searchLatencyMs}ms`,
    );

    return {
      chunks: finalChunks,
      query: input.query,
      totalTokens: currentTokens,
      searchLatencyMs,
      keywordMatchCount,
    };
  }
}
