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
import {
  RETRIEVAL_DEFAULTS,
  type RetrievalInput,
  type RetrievalOutput,
  type RetrievedChunk,
} from "#api/modules/ai/types/retrieval.types";
import { assertEmbeddingOutput } from "#api/modules/ai/utils/embedding-validation";
import { extractKeywords } from "#api/modules/ai/utils/keyword-extractor";
import { AiService } from "#api/modules/ai/services/ai.service";

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
    const query = input.query.trim();
    if (!query) {
      throw new Error("Retrieval query must not be empty.");
    }
    const topK = Math.min(
      Math.max(1, Math.trunc(input.topK ?? RETRIEVAL_DEFAULTS.topK)),
      RETRIEVAL_DEFAULTS.maxTopK,
    );
    const minScore = Math.min(
      1,
      Math.max(0, input.minScore ?? RETRIEVAL_DEFAULTS.minScore),
    );
    const includeKeywordSearch =
      input.includeKeywordSearch ?? RETRIEVAL_DEFAULTS.includeKeywordSearch;
    const maxTokens = Math.max(
      1,
      Math.trunc(input.maxContextTokens ?? RETRIEVAL_DEFAULTS.maxContextTokens),
    );
    const documentIds = [...new Set(input.documentIds ?? [])];
    const documentFilter =
      documentIds.length > 0
        ? Prisma.sql`AND chunk.document_id IN (${Prisma.join(
            documentIds.map((documentId) => Prisma.sql`${documentId}::uuid`),
          )})`
        : Prisma.empty;

    // 1. Get embedding config (provider, model, dimensions)
    const embConfig = this.aiService.getEmbeddingConfig();

    // 2. Embed the query
    const embResult = await this.aiService.createEmbedding({
      texts: [query],
    });
    assertEmbeddingOutput({
      output: embResult,
      expectedCount: 1,
      expectedSpace: embConfig,
    });
    const queryVector = embResult.vectors[0];
    if (!queryVector) {
      throw new Error("Embedding provider did not return a query vector.");
    }
    const vectorString = `[${queryVector.join(",")}]`;

    // 3. Vector search with pgvector cosine distance
    const vectorRows = await this.prisma.$queryRaw<RawChunkRow[]>`
      SELECT
        chunk.id,
        chunk.document_id,
        chunk.lesson_id,
        chunk.content,
        chunk.chunk_index,
        chunk.token_count,
        chunk.metadata_json,
        1 - (chunk.embedding <=> ${vectorString}::vector) AS score
      FROM document_chunks AS chunk
      JOIN lesson_documents AS document
        ON document.id = chunk.document_id
      WHERE chunk.lesson_id = ${input.lessonId}::uuid
        AND document.lesson_id = ${input.lessonId}::uuid
        AND document.replaced_at IS NULL
        AND document.status = 'READY'::"DocumentStatus"
        ${documentFilter}
        AND chunk.embedding IS NOT NULL
        AND chunk.embedding_provider = ${embConfig.provider}::"AiProviderName"
        AND chunk.embedding_model = ${embConfig.model}
        AND chunk.embedding_dimensions = ${embConfig.dimensions}
        AND 1 - (chunk.embedding <=> ${vectorString}::vector) >= ${minScore}
      ORDER BY chunk.embedding <=> ${vectorString}::vector, chunk.id
      LIMIT ${topK}
    `;

    // 4. Keyword search fallback
    let keywordRows: RawChunkRow[] = [];
    if (includeKeywordSearch) {
      const keywords = extractKeywords(query);
      if (keywords.length > 0) {
        const keywordConditions = keywords.map(
          (keyword) =>
            Prisma.sql`chunk.content ILIKE ${`%${escapeLikePattern(keyword)}%`} ESCAPE '\'`,
        );
        const orClause = Prisma.sql`(${Prisma.join(keywordConditions, " OR ")})`;

        keywordRows = await this.prisma.$queryRaw<RawChunkRow[]>`
          SELECT
            chunk.id,
            chunk.document_id,
            chunk.lesson_id,
            chunk.content,
            chunk.chunk_index,
            chunk.token_count,
            chunk.metadata_json,
            0.5 AS score
          FROM document_chunks AS chunk
          JOIN lesson_documents AS document
            ON document.id = chunk.document_id
          WHERE chunk.lesson_id = ${input.lessonId}::uuid
            AND document.lesson_id = ${input.lessonId}::uuid
            AND document.replaced_at IS NULL
            AND document.status = 'READY'::"DocumentStatus"
            ${documentFilter}
            AND ${orClause}
          ORDER BY chunk.document_id, chunk.chunk_index, chunk.id
          LIMIT ${topK}
        `;
      }
    }

    // 5. Merge and deduplicate
    const chunkMap = new Map<string, RetrievedChunk>();

    // Process vector results
    for (const row of vectorRows) {
      if (row.score >= minScore) {
        chunkMap.set(row.id, toRetrievedChunk(row, "vector"));
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
        chunkMap.set(row.id, toRetrievedChunk(row, "keyword"));
        keywordMatchCount++;
      }
    }

    // Sort by score descending
    const sortedChunks = Array.from(chunkMap.values()).sort((a, b) => {
      const scoreDifference = b.score - a.score;
      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      const documentDifference = a.documentId.localeCompare(b.documentId);
      return documentDifference !== 0 ? documentDifference : a.chunkIndex - b.chunkIndex;
    });

    // 6. Token budget cap and topK limit
    const finalChunks: RetrievedChunk[] = [];
    let currentTokens = 0;

    for (const chunk of sortedChunks) {
      if (finalChunks.length >= topK) break;

      const newTotal = currentTokens + chunk.tokenCount;
      if (newTotal > maxTokens) {
        continue;
      }

      finalChunks.push(chunk);
      currentTokens += chunk.tokenCount;
    }

    const searchLatencyMs = Date.now() - startTime;

    this.logger.debug(
      `[RETRIEVAL] lesson=${input.lessonId} query="${query.slice(0, 50)}..." ` +
        `vector=${vectorRows.length} keyword=${keywordRows.length} ` +
        `merged=${finalChunks.length} tokens=${currentTokens} latency=${searchLatencyMs}ms`,
    );

    return {
      chunks: finalChunks,
      query,
      totalTokens: currentTokens,
      searchLatencyMs,
      keywordMatchCount,
    };
  }
}

function toRetrievedChunk(
  row: RawChunkRow,
  matchSource: RetrievedChunk["matchSource"],
): RetrievedChunk {
  return {
    chunkId: row.id,
    documentId: row.document_id,
    lessonId: row.lesson_id,
    content: row.content,
    score: row.score,
    chunkIndex: row.chunk_index,
    tokenCount: row.token_count ?? estimateTokenCount(row.content),
    metadataJson: row.metadata_json,
    matchSource,
  };
}

function estimateTokenCount(content: string) {
  return Math.max(1, Math.ceil(content.length / 4));
}

function escapeLikePattern(keyword: string) {
  return keyword.replace(/[\\%_]/g, "\\$&");
}
