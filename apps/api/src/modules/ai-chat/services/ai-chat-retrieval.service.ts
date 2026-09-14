import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  AiChatScopeType,
  AiGenerationType,
  AiProviderName,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { AiProviderCallService } from "#api/modules/ai/services/ai-provider-call.service";
import type { AiChatSource } from "#api/modules/ai-chat/types/ai-chat.types";
import { buildWholeFeatureUsageTarget } from "#api/modules/provider-operations/utils/provider-usage-target";
import { extractKeywords } from "#api/modules/ai/utils/keyword-extractor";

type RawChatChunk = {
  chunk_id: string;
  source_type: "LESSON_DOCUMENT" | "VIDEO_SUMMARY";
  lesson_id: string;
  lesson_title: string;
  learning_path_id: string;
  learning_path_title: string;
  content: string;
  token_count: number | null;
  score: number;
  start_seconds: number | null;
  end_seconds: number | null;
};

type ScopedLearningPathLabel = {
  id: string;
  title: string;
  domain: { name: string };
};

type ScopedLessonLabel = {
  id: string;
  title: string;
};

@Injectable()
export class AiChatRetrievalService {
  private readonly logger = new Logger(AiChatRetrievalService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AiProviderCallService)
    private readonly providerCalls: AiProviderCallService,
  ) {}

  async retrieve(input: {
    query: string;
    scopeQuery?: string;
    learningPathIds: string[];
    lessonIds?: string[];
    surfaceLessonId?: string;
    preferredLessonIds?: string[];
    videoSourceSeconds?: number;
    conversationId?: string;
    aiGenerationId?: string;
    embeddingIdempotencyKey: string;
    embeddingConfig: {
      provider: AiProviderName;
      model: string;
      dimensions: number;
    };
    maxChunks: number;
    maxTokens: number;
  }): Promise<AiChatSource[]> {
    const query = input.query.trim();
    const keywords = buildChatSearchKeywords(input.scopeQuery ?? query);
    if (!query || input.learningPathIds.length === 0) {
      return [];
    }
    const scopedPaths =
      input.learningPathIds.length > 1
        ? await this.prisma.learningPath.findMany({
            where: { id: { in: input.learningPathIds }, deletedAt: null },
            select: { id: true, title: true, domain: { select: { name: true } } },
          })
        : [];
    const explicitScopeIds = findExplicitlyMentionedLearningPathIds(
      input.scopeQuery?.trim() || query,
      scopedPaths,
    );
    const learningPathIds =
      explicitScopeIds.length > 0 ? explicitScopeIds : input.learningPathIds;
    const preferredLearningPathIds = explicitScopeIds;
    if (learningPathIds.length === 0) return [];
    const scopedLessons = await this.prisma.lesson.findMany({
      where: {
        learningPathId: { in: learningPathIds },
        deletedAt: null,
        ...(input.lessonIds?.length ? { id: { in: input.lessonIds } } : {}),
      },
      select: { id: true, title: true },
    });
    const explicitlyMentionedLessonIds = findExplicitlyMentionedLessonIds(
      input.scopeQuery?.trim() || query,
      scopedLessons,
    );
    const retrievalLessonIds =
      explicitlyMentionedLessonIds.length > 0
        ? explicitlyMentionedLessonIds
        : input.lessonIds;
    const pathFilter = Prisma.sql`lesson.learning_path_id IN (${Prisma.join(
      learningPathIds.map((id) => Prisma.sql`${id}::uuid`),
    )})`;
    const lessonFilter =
      retrievalLessonIds && retrievalLessonIds.length > 0
        ? Prisma.sql`AND lesson.id IN (${Prisma.join(
            retrievalLessonIds.map((id) => Prisma.sql`${id}::uuid`),
          )})`
        : Prisma.empty;
    const keywordFilter =
      keywords.length > 0
        ? Prisma.sql`(${Prisma.join(
            keywords.map(
              (keyword) =>
                Prisma.sql`chunk.content ILIKE ${`%${escapeLike(keyword)}%`} ESCAPE '\\'`,
            ),
            " OR ",
          )})`
        : Prisma.sql`FALSE`;
    const preferredLessonIds = [
      ...new Set(
        [input.surfaceLessonId, ...(input.preferredLessonIds ?? [])].filter(
          (lessonId): lessonId is string => Boolean(lessonId),
        ),
      ),
    ];
    const lessonBoost = preferredLessonIds.length
      ? Prisma.sql`CASE WHEN lesson.id IN (${Prisma.join(
          preferredLessonIds.map((lessonId) => Prisma.sql`${lessonId}::uuid`),
        )}) THEN 0.12 ELSE 0 END`
      : Prisma.sql`0`;
    const keywordMatchScore =
      keywords.length > 0
        ? Prisma.sql`(${Prisma.join(
            keywords.map(
              (keyword) =>
                Prisma.sql`CASE WHEN chunk.content ILIKE ${`%${escapeLike(keyword)}%`} ESCAPE '\\' THEN 0.04 ELSE 0 END`,
            ),
            " + ",
          )})`
        : Prisma.sql`0`;
    const currentVideoBlockCandidate =
      input.surfaceLessonId && input.videoSourceSeconds !== undefined
        ? Prisma.sql`
            SELECT
              chunk.id AS chunk_id,
              'VIDEO_SUMMARY'::text AS source_type,
              lesson.id AS lesson_id,
              lesson.title AS lesson_title,
              path.id AS learning_path_id,
              path.title AS learning_path_title,
              chunk.content,
              chunk.token_count,
              chunk.start_seconds,
              chunk.end_seconds,
              2::double precision AS score
            FROM video_summary_chunks AS chunk
            JOIN lesson_video_summaries AS video_summary
              ON video_summary.id = chunk.video_summary_id
            JOIN lessons AS lesson ON lesson.id = chunk.lesson_id
            JOIN learning_paths AS path ON path.id = lesson.learning_path_id
            WHERE lesson.id = ${input.surfaceLessonId}::uuid
              AND ${pathFilter}
              ${lessonFilter}
              AND video_summary.lesson_id = lesson.id
              AND video_summary.review_status = 'APPROVED'::"ReviewStatus"
              AND video_summary.stale_at IS NULL
              AND video_summary.deleted_at IS NULL
              AND lesson.deleted_at IS NULL
              AND path.deleted_at IS NULL
              AND chunk.start_seconds IS NOT NULL
              AND chunk.start_seconds <= ${input.videoSourceSeconds}
              AND (
                chunk.end_seconds IS NULL
                OR ${input.videoSourceSeconds} < chunk.end_seconds
              )
            UNION ALL
          `
        : Prisma.empty;

    const keywordRowsPromise = this.prisma.$queryRaw<RawChatChunk[]>`
      WITH candidates AS (
        ${currentVideoBlockCandidate}
        SELECT
          chunk.id AS chunk_id,
          'LESSON_DOCUMENT'::text AS source_type,
          lesson.id AS lesson_id,
          lesson.title AS lesson_title,
          path.id AS learning_path_id,
          path.title AS learning_path_title,
          chunk.content,
          chunk.token_count,
          NULL::double precision AS start_seconds,
          NULL::double precision AS end_seconds,
          (0.5 + ${keywordMatchScore} + ${lessonBoost})::double precision AS score
        FROM document_chunks AS chunk
        JOIN lesson_documents AS document ON document.id = chunk.document_id
        JOIN lessons AS lesson ON lesson.id = chunk.lesson_id
        JOIN learning_paths AS path ON path.id = lesson.learning_path_id
        WHERE ${pathFilter}
          ${lessonFilter}
          AND document.lesson_id = lesson.id
          AND document.replaced_at IS NULL
          AND document.status = 'READY'::"DocumentStatus"
          AND lesson.deleted_at IS NULL
          AND path.deleted_at IS NULL
          AND ${keywordFilter}

        UNION ALL

        SELECT
          chunk.id AS chunk_id,
          'VIDEO_SUMMARY'::text AS source_type,
          lesson.id AS lesson_id,
          lesson.title AS lesson_title,
          path.id AS learning_path_id,
          path.title AS learning_path_title,
          chunk.content,
          chunk.token_count,
          chunk.start_seconds,
          chunk.end_seconds,
          (0.5 + ${keywordMatchScore} + ${lessonBoost})::double precision AS score
        FROM video_summary_chunks AS chunk
        JOIN lesson_video_summaries AS video_summary
          ON video_summary.id = chunk.video_summary_id
        JOIN lessons AS lesson ON lesson.id = chunk.lesson_id
        JOIN learning_paths AS path ON path.id = lesson.learning_path_id
        WHERE ${pathFilter}
          ${lessonFilter}
          AND lesson.deleted_at IS NULL
          AND path.deleted_at IS NULL
          AND video_summary.lesson_id = lesson.id
          AND video_summary.review_status = 'APPROVED'::"ReviewStatus"
          AND video_summary.stale_at IS NULL
          AND video_summary.deleted_at IS NULL
          AND ${keywordFilter}
      )
      SELECT *
      FROM candidates
      ORDER BY score DESC, lesson_id, chunk_id
      LIMIT ${input.maxChunks}
    `;
    const vectorRowsPromise = (async () => {
      try {
        const embedding = await this.providerCalls.createEmbedding(
          {
            feature: AiGenerationType.CHAT,
            aiGenerationId: input.aiGenerationId,
            operation: "EMBEDDING_GENERATION",
            targetContext: buildWholeFeatureUsageTarget(
              AiGenerationType.CHAT,
              input.conversationId,
            ),
            idempotencyKey: input.embeddingIdempotencyKey,
          },
          { texts: [query] },
          input.embeddingConfig,
        );
        const vector = embedding.vectors[0];
        if (!vector) return [];
        return await this.prisma.$queryRaw<RawChatChunk[]>`
          WITH candidates AS (
            SELECT
              chunk.id AS chunk_id,
              'LESSON_DOCUMENT'::text AS source_type,
              lesson.id AS lesson_id,
              lesson.title AS lesson_title,
              path.id AS learning_path_id,
              path.title AS learning_path_title,
              chunk.content,
              chunk.token_count,
              NULL::double precision AS start_seconds,
              NULL::double precision AS end_seconds,
              (1 - (chunk.embedding <=> ${`[${vector.join(",")}]`}::vector) + ${lessonBoost})::double precision AS score
            FROM document_chunks AS chunk
            JOIN lesson_documents AS document ON document.id = chunk.document_id
            JOIN lessons AS lesson ON lesson.id = chunk.lesson_id
            JOIN learning_paths AS path ON path.id = lesson.learning_path_id
            WHERE ${pathFilter}
              ${lessonFilter}
              AND document.lesson_id = lesson.id
              AND document.replaced_at IS NULL
              AND document.status = 'READY'::"DocumentStatus"
              AND lesson.deleted_at IS NULL
              AND path.deleted_at IS NULL
              AND chunk.embedding IS NOT NULL
              AND chunk.embedding_provider = ${input.embeddingConfig.provider}::"AiProviderName"
              AND chunk.embedding_model = ${input.embeddingConfig.model}
              AND chunk.embedding_dimensions = ${input.embeddingConfig.dimensions}
              AND 1 - (chunk.embedding <=> ${`[${vector.join(",")}]`}::vector) >= 0.3

            UNION ALL

            SELECT
              chunk.id AS chunk_id,
              'VIDEO_SUMMARY'::text AS source_type,
              lesson.id AS lesson_id,
              lesson.title AS lesson_title,
              path.id AS learning_path_id,
              path.title AS learning_path_title,
              chunk.content,
              chunk.token_count,
              chunk.start_seconds,
              chunk.end_seconds,
              (1 - (chunk.embedding <=> ${`[${vector.join(",")}]`}::vector) + ${lessonBoost})::double precision AS score
            FROM video_summary_chunks AS chunk
            JOIN lesson_video_summaries AS video_summary
              ON video_summary.id = chunk.video_summary_id
            JOIN lessons AS lesson ON lesson.id = chunk.lesson_id
            JOIN learning_paths AS path ON path.id = lesson.learning_path_id
            WHERE ${pathFilter}
              ${lessonFilter}
              AND lesson.deleted_at IS NULL
              AND path.deleted_at IS NULL
              AND video_summary.lesson_id = lesson.id
              AND video_summary.review_status = 'APPROVED'::"ReviewStatus"
              AND video_summary.stale_at IS NULL
              AND video_summary.deleted_at IS NULL
              AND chunk.embedding IS NOT NULL
              AND chunk.embedding_provider = ${input.embeddingConfig.provider}::"AiProviderName"
              AND chunk.embedding_model = ${input.embeddingConfig.model}
              AND chunk.embedding_dimensions = ${input.embeddingConfig.dimensions}
              AND 1 - (chunk.embedding <=> ${`[${vector.join(",")}]`}::vector) >= 0.3
          )
          SELECT *
          FROM candidates
          ORDER BY score DESC, chunk_id
          LIMIT ${input.maxChunks}
        `;
      } catch (error) {
        this.logger.warn(
          `Vector chat retrieval unavailable; kept scoped keyword results: ${error instanceof Error ? error.message : String(error)}`,
        );
        return [];
      }
    })();

    const [rows, vectorRows] = await Promise.all([keywordRowsPromise, vectorRowsPromise]);
    const merged = new Map<string, RawChatChunk>();
    for (const row of rows) {
      const key = `${row.source_type}:${row.chunk_id}`;
      const existing = merged.get(key);
      if (!existing || row.score > existing.score) merged.set(key, row);
    }
    for (const row of vectorRows) {
      const key = `${row.source_type}:${row.chunk_id}`;
      const existing = merged.get(key);
      merged.set(key, {
        ...row,
        score: Math.max(
          existing?.score ?? 0,
          Math.min(1, row.score + (existing ? 0.12 : 0)),
        ),
      });
    }

    const ranked = diversifyPreferredLearningPaths(
      [...merged.values()].sort((a, b) => b.score - a.score),
      preferredLearningPathIds,
    );
    const result: AiChatSource[] = [];
    let tokens = 0;
    for (const row of ranked) {
      const estimatedTokens =
        row.token_count ?? Math.max(1, Math.ceil(row.content.length / 4));
      if (
        result.length >= input.maxChunks ||
        tokens + estimatedTokens > input.maxTokens
      ) {
        continue;
      }
      tokens += estimatedTokens;
      result.push({
        chunkId: row.chunk_id,
        sourceType: row.source_type,
        lessonId: row.lesson_id,
        lessonTitle: row.lesson_title,
        learningPathId: row.learning_path_id,
        learningPathTitle: row.learning_path_title,
        content: row.content,
        score: row.score,
        ...(preferredLessonIds.includes(row.lesson_id)
          ? { isPreferredLesson: true }
          : {}),
        ...(row.source_type === "VIDEO_SUMMARY" &&
        input.surfaceLessonId === row.lesson_id &&
        input.videoSourceSeconds !== undefined &&
        row.start_seconds !== null &&
        row.start_seconds <= input.videoSourceSeconds &&
        (row.end_seconds === null || input.videoSourceSeconds < row.end_seconds)
          ? { isCurrentVideoBlock: true }
          : {}),
        ...(row.start_seconds !== null ? { startSeconds: row.start_seconds } : {}),
        ...(row.end_seconds !== null ? { endSeconds: row.end_seconds } : {}),
      });
    }
    return result;
  }
}

export function resolveAiChatRetrievalChunkLimit(scopeType: AiChatScopeType) {
  if (scopeType === AiChatScopeType.LIBRARY || scopeType === AiChatScopeType.COURSE_SET) {
    return 24;
  }
  if (scopeType === AiChatScopeType.COURSE) return 16;
  return 8;
}

export function selectExplicitlyMentionedLearningPathIds(
  query: string,
  paths: ScopedLearningPathLabel[],
) {
  const matches = findExplicitlyMentionedLearningPathIds(query, paths);
  return matches.length > 0 ? matches : paths.map((path) => path.id);
}

export function selectExplicitlyMentionedLessonIds(
  query: string,
  lessons: ScopedLessonLabel[],
) {
  return findExplicitlyMentionedLessonIds(query, lessons);
}

export function buildChatSearchKeywords(query: string) {
  const keywords = new Map<string, string>();
  for (const keyword of extractKeywords(query)) {
    const normalized = normalizeSearchLabel(keyword);
    if (normalized && !keywords.has(normalized)) keywords.set(normalized, keyword);
    if (keywords.size >= 24) return [...keywords.values()];
  }
  return [...keywords.values()];
}

function findExplicitlyMentionedLearningPathIds(
  query: string,
  paths: ScopedLearningPathLabel[],
) {
  const normalizedQuery = normalizeSearchLabel(query);
  const titleMatches = paths.filter((path) =>
    containsNormalizedPhrase(normalizedQuery, normalizeSearchLabel(path.title)),
  );
  if (titleMatches.length > 0) return titleMatches.map((path) => path.id);
  return [
    ...new Set(
      paths
        .filter((path) => {
          const domainName = normalizeSearchLabel(path.domain.name);
          return domainName.length >= 3 && normalizedQuery.includes(domainName);
        })
        .map((path) => path.id),
    ),
  ];
}

function findExplicitlyMentionedLessonIds(query: string, lessons: ScopedLessonLabel[]) {
  const normalizedQuery = normalizeSearchLabel(query);
  return [
    ...new Set(
      lessons
        .filter((lesson) =>
          lessonReferenceLabels(lesson.title).some((label) =>
            containsNormalizedPhrase(normalizedQuery, label),
          ),
        )
        .map((lesson) => lesson.id),
    ),
  ];
}

function lessonReferenceLabels(title: string) {
  const normalizedTitle = normalizeSearchLabel(title);
  const numberedPrefix = normalizedTitle.match(/^(?:bai|buoi)\s+\d+[a-z]?\b/u)?.[0];
  return [
    ...new Set(
      [normalizedTitle, numberedPrefix].filter((label): label is string =>
        Boolean(label),
      ),
    ),
  ];
}

function containsNormalizedPhrase(normalizedText: string, normalizedPhrase: string) {
  return (
    normalizedPhrase.length >= 3 &&
    ` ${normalizedText} `.includes(` ${normalizedPhrase} `)
  );
}

function diversifyPreferredLearningPaths(
  rows: RawChatChunk[],
  preferredLearningPathIds: string[],
) {
  if (preferredLearningPathIds.length < 2) return rows;
  const preferredRows = preferredLearningPathIds
    .map((learningPathId) => rows.find((row) => row.learning_path_id === learningPathId))
    .filter((row): row is RawChatChunk => Boolean(row));
  const preferredChunkIds = new Set(preferredRows.map((row) => row.chunk_id));
  return [
    ...preferredRows,
    ...rows.filter((row) => !preferredChunkIds.has(row.chunk_id)),
  ];
}

function normalizeSearchLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/đ/giu, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/gu, (character) => `\\${character}`);
}
