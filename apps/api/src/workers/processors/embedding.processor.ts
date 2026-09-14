/**
 * EmbeddingProcessor — xử lý EMBEDDING job trên BullMQ queue.
 *
 * Flow (docs/06-ai-rag-spec.md §3.4):
 * 1. Load backgroundJob → validate queue = EMBEDDING
 * 2. Resolve nguồn lesson document hoặc persisted video summary
 * 3. Load source chunks chưa có embedding (embedding IS NULL)
 * 4. Batch gọi AiService.createEmbedding() (50 texts/batch)
 * 5. Lưu vector bằng raw SQL (Prisma Unsupported type)
 * 6. Cập nhật lesson_documents embedding metadata khi nguồn là tài liệu
 * 7. Log ai_generations record
 * 8. Update backgroundJob status = SUCCEEDED
 */

import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import {
  AiGenerationStatus,
  AiGenerationType,
  AiProviderName,
  BackgroundJobQueue,
  BackgroundJobStatus,
  DocumentStatus,
  Prisma,
} from "@prisma/client";
import { Job, UnrecoverableError } from "bullmq";
import { PrismaService } from "#api/common/prisma/prisma.service";
import type {
  BackgroundJobBullmqData,
  BackgroundJobBullmqResult,
} from "#api/jobs/background-job-queues";
import { getJobErrorMessage } from "#api/jobs/job-error";
import { toJobJson } from "#api/jobs/job-json";
import { AiService } from "#api/modules/ai/services/ai.service";
import { RealtimeJobSnapshotPublisherService } from "#api/modules/realtime/services/realtime-job-snapshot-publisher.service";
import { assertEmbeddingOutput } from "#api/modules/ai/utils/embedding-validation";
import { stripLatexForEmbedding } from "#api/workers/utils/strip-latex";

const EMBEDDING_BATCH_SIZE = 50;

const embeddingJobSelect = {
  id: true,
  queue: true,
  status: true,
  lessonId: true,
  resourceType: true,
  resourceId: true,
  inputMeta: true,
  result: true,
  attempts: true,
  maxAttempts: true,
} satisfies Prisma.BackgroundJobSelect;

type EmbeddingJobRecord = Prisma.BackgroundJobGetPayload<{
  select: typeof embeddingJobSelect;
}>;

interface ChunkToEmbed {
  id: string;
  content: string;
  chunkIndex: number;
}

interface EmbeddingRunSummary {
  embeddedCount: number;
  totalPromptTokens: number;
  totalTokens: number;
  latencyMs: number;
  model: string;
  dimensions: number;
}

interface EmbeddingExecution {
  result: BackgroundJobBullmqResult;
  summary: EmbeddingRunSummary;
}

@Injectable()
export class EmbeddingProcessor {
  private readonly logger = new Logger(EmbeddingProcessor.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AiService) private readonly aiService: AiService,
    @Optional()
    @Inject(RealtimeJobSnapshotPublisherService)
    private readonly realtimeJobs?: RealtimeJobSnapshotPublisherService,
  ) {}

  async process(
    job: Job<BackgroundJobBullmqData, BackgroundJobBullmqResult>,
  ): Promise<BackgroundJobBullmqResult> {
    const backgroundJob = await this.prisma.backgroundJob.findUnique({
      where: { id: job.data.backgroundJobId },
      select: embeddingJobSelect,
    });

    if (!backgroundJob) {
      throw new UnrecoverableError(
        `Durable background job ${job.data.backgroundJobId} was not found`,
      );
    }

    if (backgroundJob.queue !== BackgroundJobQueue.EMBEDDING) {
      throw new UnrecoverableError(
        `Job ${backgroundJob.id} belongs to ${backgroundJob.queue}, not EMBEDDING`,
      );
    }

    if (backgroundJob.status === BackgroundJobStatus.CANCELLED) {
      throw new UnrecoverableError(
        `Job ${backgroundJob.id} was cancelled`,
      );
    }

    if (backgroundJob.status === BackgroundJobStatus.SUCCEEDED) {
      return this.buildSkippedResult(backgroundJob);
    }

    const attempt = job.attemptsMade + 1;
    const maxAttempts = this.resolveMaxAttempts(job, backgroundJob);

    await this.prisma.backgroundJob.update({
      where: { id: backgroundJob.id },
      data: {
        status: BackgroundJobStatus.RUNNING,
        bullmqJobId: String(job.id ?? backgroundJob.id),
        attempts: attempt,
        errorMessage: null,
        startedAt: new Date(),
        finishedAt: null,
      },
    });
    await this.realtimeJobs?.publishById(backgroundJob.id);

    let aiGenerationId: string | null = null;
    try {
      const aiGeneration = await this.startAiGeneration(backgroundJob, attempt);
      aiGenerationId = aiGeneration.id;
      const execution = await this.handleEmbedding(backgroundJob);
      const finishedAt = new Date();

      await Promise.all([
        this.prisma.backgroundJob.update({
          where: { id: backgroundJob.id },
          data: {
            status: BackgroundJobStatus.SUCCEEDED,
            result: toJobJson(execution.result),
            errorMessage: null,
            finishedAt,
          },
        }),
        this.prisma.aiGeneration.update({
          where: { id: aiGeneration.id },
          data: {
            status: AiGenerationStatus.SUCCEEDED,
            provider: AiProviderName.OPENAI,
            model: execution.summary.model,
            promptTokens: execution.summary.totalPromptTokens,
            totalTokens: execution.summary.totalTokens,
            latencyMs: execution.summary.latencyMs,
            retryCount: Math.max(attempt - 1, 0),
            outputJson: toJobJson(execution.result),
            errorMessage: null,
            finishedAt,
          },
        }),
      ]);

      return execution.result;
    } catch (error) {
      await this.markAttemptFailed({
        record: backgroundJob,
        aiGenerationId,
        error,
        attempt,
        maxAttempts,
      });
      throw error;
    }
  }

  private async handleEmbedding(
    record: EmbeddingJobRecord,
  ): Promise<EmbeddingExecution> {
    const lessonDocumentId = this.readLessonDocumentId(record);
    const summaryHash = this.readSummaryHash(record);
    const isVideoSummary = record.resourceType === "video_summary";
    const lessonId = record.lessonId;

    if (!isVideoSummary && !lessonDocumentId) {
      throw new UnrecoverableError(
        `EMBEDDING job ${record.id} missing lessonDocumentId in inputMeta`,
      );
    }

    if (!lessonId) {
      throw new UnrecoverableError(
        `EMBEDDING job ${record.id} missing lessonId`,
      );
    }

    if (isVideoSummary && !summaryHash) {
      throw new UnrecoverableError(
        `EMBEDDING job ${record.id} missing summaryHash in inputMeta`,
      );
    }

    if (isVideoSummary && !record.resourceId) {
      throw new UnrecoverableError(
        `EMBEDDING job ${record.id} missing video summary resourceId`,
      );
    }

    if (
      !isVideoSummary &&
      (record.resourceType !== "lesson_document" ||
        record.resourceId !== lessonDocumentId)
    ) {
      throw new UnrecoverableError(
        `EMBEDDING job ${record.id} has inconsistent lesson document metadata`,
      );
    }

    const lessonDocument = isVideoSummary
      ? null
      : await this.prisma.lessonDocument.findFirst({
          where: {
            id: lessonDocumentId,
            lessonId,
            replacedAt: null,
          },
          select: {
            id: true,
            chunkCount: true,
          },
        });

    if (!isVideoSummary && !lessonDocument) {
      throw new UnrecoverableError(
        `Active lesson document ${lessonDocumentId} was not found in lesson ${lessonId}`,
      );
    }

    if (isVideoSummary) {
      const summaryExists = await this.prisma.lessonVideoSummary.findFirst({
        where: {
          id: record.resourceId!,
          lessonId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!summaryExists) {
        throw new UnrecoverableError(
          `Video summary ${record.resourceId} was not found in lesson ${lessonId}`,
        );
      }
    }

    // Check AI provider availability
    if (!this.aiService.isProviderAvailable(AiProviderName.OPENAI)) {
      throw new UnrecoverableError(
        "OpenAI provider is not available. Set OPENAI_API_KEY in .env to enable embedding.",
      );
    }

    const embeddingConfig = this.aiService.getEmbeddingConfig();
    const startedAt = new Date();

    if (lessonDocumentId && !isVideoSummary) {
      await this.prisma.lessonDocument.update({
        where: { id: lessonDocumentId },
        data: {
          status: DocumentStatus.PROCESSING,
          extractError: null,
        },
      });
    }

    // Load chunks chưa có embedding hoặc thuộc vector space cũ.
    const chunks = await this.loadChunksNeedingEmbedding({
      lessonDocumentId,
      lessonId,
      videoSummaryId: record.resourceId ?? undefined,
      summaryHash,
      sourceType: isVideoSummary ? "VIDEO_SUMMARY" : "LESSON_DOCUMENT",
      model: embeddingConfig.model,
      dimensions: embeddingConfig.dimensions,
    });

    if (chunks.length === 0) {
      this.logger.log(
        `[EMBEDDING] No chunks without embedding for ${isVideoSummary ? `video summary=${record.resourceId}` : `document=${lessonDocumentId}`}`,
      );

      if (lessonDocumentId && lessonDocument) {
        await this.prisma.lessonDocument.update({
          where: { id: lessonDocumentId },
          data: {
            status: DocumentStatus.READY,
            extractError: null,
            embeddingProvider:
              lessonDocument.chunkCount > 0 ? AiProviderName.OPENAI : null,
            embeddingModel:
              lessonDocument.chunkCount > 0 ? embeddingConfig.model : null,
            embeddingDimensions:
              lessonDocument.chunkCount > 0 ? embeddingConfig.dimensions : null,
          },
        });
      }

      const latencyMs = Date.now() - startedAt.getTime();
      return {
        result: {
          status: "SKIPPED",
          queue: record.queue,
          resourceType: record.resourceType,
          resourceId: record.resourceId,
          action: "EMBEDDING",
          message: "All chunks already have embeddings",
          handledAt: new Date().toISOString(),
        },
        summary: {
          embeddedCount: 0,
          totalPromptTokens: 0,
          totalTokens: 0,
          latencyMs,
          model: embeddingConfig.model,
          dimensions: embeddingConfig.dimensions,
        },
      };
    }

    this.logger.log(
      `[EMBEDDING] Starting: ${chunks.length} chunks for ${isVideoSummary ? `video summary=${record.resourceId}` : `document=${lessonDocumentId}`}, lesson=${lessonId}`,
    );

    let totalPromptTokens = 0;
    let totalTokens = 0;
    let embeddedCount = 0;

    // Batch embedding
    const batches = this.splitIntoBatches(chunks, EMBEDDING_BATCH_SIZE);

    for (const [batchIndex, batch] of batches.entries()) {
      this.logger.debug(
        `[EMBEDDING] Batch ${batchIndex + 1}/${batches.length}: ${batch.length} chunks`,
      );

      // Strip LaTeX markup before embedding for better search quality
      const textsForEmbedding = batch.map((chunk) => {
        const normalizedContent = stripLatexForEmbedding(chunk.content).trim();
        return normalizedContent || chunk.content;
      });

      const result = await this.aiService.createEmbedding({
        texts: textsForEmbedding,
      });
      assertEmbeddingOutput({
        output: result,
        expectedCount: batch.length,
        expectedSpace: embeddingConfig,
      });

      // Save vectors via raw SQL
      await this.saveEmbeddingBatch(batch, result.vectors, {
        sourceType: isVideoSummary ? "VIDEO_SUMMARY" : "LESSON_DOCUMENT",
        summaryHash,
        provider: AiProviderName.OPENAI,
        model: result.model,
        dimensions: result.dimensions,
      });

      embeddedCount += batch.length;
      totalPromptTokens += result.usage?.promptTokens ?? 0;
      totalTokens += result.usage?.totalTokens ?? 0;
    }

    const finishedAt = new Date();
    const latencyMs = finishedAt.getTime() - startedAt.getTime();

    // Update lesson_documents embedding metadata
    if (lessonDocumentId && !isVideoSummary) {
      await this.prisma.lessonDocument.update({
        where: { id: lessonDocumentId },
        data: {
          status: DocumentStatus.READY,
          extractError: null,
          embeddingProvider: AiProviderName.OPENAI,
          embeddingModel: embeddingConfig.model,
          embeddingDimensions: embeddingConfig.dimensions,
        },
      });
    }

    this.logger.log(
      `[EMBEDDING] Completed: ${embeddedCount} chunks embedded for ${isVideoSummary ? `video summary=${record.resourceId}` : `document=${lessonDocumentId}`}, ` +
        `tokens=${totalTokens}, latency=${latencyMs}ms`,
    );

    const summary: EmbeddingRunSummary = {
      embeddedCount,
      totalPromptTokens,
      totalTokens,
      latencyMs,
      model: embeddingConfig.model,
      dimensions: embeddingConfig.dimensions,
    };

    return {
      result: {
        status: "SUCCEEDED",
        queue: record.queue,
        resourceType: record.resourceType,
        resourceId: record.resourceId,
        action: "EMBEDDING",
        message: `Embedded ${embeddedCount} chunks (${totalTokens} tokens, ${latencyMs}ms)`,
        handledAt: new Date().toISOString(),
        details: summary,
      },
      summary,
    };
  }

  private async startAiGeneration(
    record: EmbeddingJobRecord,
    attempt: number,
  ): Promise<{ id: string }> {
    const embeddingConfig = this.aiService.getEmbeddingConfig();
    const existing = await this.prisma.aiGeneration.findFirst({
      where: {
        backgroundJobId: record.id,
        type: AiGenerationType.EMBEDDING,
      },
      select: {
        id: true,
        startedAt: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
    const startedAt = existing?.startedAt ?? new Date();
    const data = {
      status: AiGenerationStatus.RUNNING,
      provider: AiProviderName.OPENAI,
      model: embeddingConfig.model,
      retryCount: Math.max(attempt - 1, 0),
      errorMessage: null,
      startedAt,
      finishedAt: null,
    } satisfies Prisma.AiGenerationUpdateInput;

    if (existing) {
      return this.prisma.aiGeneration.update({
        where: { id: existing.id },
        data,
        select: { id: true },
      });
    }

    return this.prisma.aiGeneration.create({
      data: {
        type: AiGenerationType.EMBEDDING,
        backgroundJobId: record.id,
        lessonId: record.lessonId,
        targetType:
          record.resourceType === "video_summary"
            ? "VIDEO_SUMMARY"
            : "LESSON_DOCUMENT",
        targetId: record.resourceId,
        inputMetaJson: {
          lessonDocumentId: this.readLessonDocumentId(record) ?? null,
          videoSummaryId:
            record.resourceType === "video_summary" ? record.resourceId : null,
          summaryHash: this.readSummaryHash(record) ?? null,
          dimensions: embeddingConfig.dimensions,
        },
        ...data,
      },
      select: { id: true },
    });
  }

  private async loadChunksNeedingEmbedding(params: {
    lessonDocumentId?: string;
    lessonId: string;
    videoSummaryId?: string;
    summaryHash?: string;
    sourceType: "LESSON_DOCUMENT" | "VIDEO_SUMMARY";
    model: string;
    dimensions: number;
  }): Promise<ChunkToEmbed[]> {
    if (params.sourceType === "VIDEO_SUMMARY") {
      if (!params.videoSummaryId || !params.summaryHash) return [];
      return this.prisma.$queryRaw<ChunkToEmbed[]>`
        SELECT id, content, chunk_index AS "chunkIndex"
        FROM video_summary_chunks
        WHERE video_summary_id = ${params.videoSummaryId}::uuid
          AND lesson_id = ${params.lessonId}::uuid
          AND summary_hash = ${params.summaryHash}
          AND (
            embedding IS NULL
            OR embedding_provider IS DISTINCT FROM ${AiProviderName.OPENAI}::"AiProviderName"
            OR embedding_model IS DISTINCT FROM ${params.model}
            OR embedding_dimensions IS DISTINCT FROM ${params.dimensions}
          )
        ORDER BY chunk_index ASC
      `;
    }

    if (!params.lessonDocumentId) return [];
    const chunks = await this.prisma.$queryRaw<ChunkToEmbed[]>`
      SELECT id, content, chunk_index AS "chunkIndex"
      FROM document_chunks
      WHERE document_id = ${params.lessonDocumentId}::uuid
        AND lesson_id = ${params.lessonId}::uuid
        AND (
          embedding IS NULL
          OR embedding_provider IS DISTINCT FROM ${AiProviderName.OPENAI}::"AiProviderName"
          OR embedding_model IS DISTINCT FROM ${params.model}
          OR embedding_dimensions IS DISTINCT FROM ${params.dimensions}
        )
      ORDER BY chunk_index ASC
    `;

    return chunks;
  }

  private async saveEmbeddingBatch(
    chunks: ChunkToEmbed[],
    vectors: number[][],
    meta: {
      sourceType: "LESSON_DOCUMENT" | "VIDEO_SUMMARY";
      summaryHash?: string;
      provider: AiProviderName;
      model: string;
      dimensions: number;
    },
  ): Promise<void> {
    if (vectors.length !== chunks.length) {
      throw new Error(
        `Cannot persist ${vectors.length} embedding vectors for ${chunks.length} chunks.`,
      );
    }

    // Prisma Unsupported("vector(1536)") cannot be written via Prisma client.
    for (const [index, chunk] of chunks.entries()) {
      const vector = vectors[index];
      if (!vector) {
        throw new Error(`Embedding vector at index ${index} is missing.`);
      }
      if (vector.length !== meta.dimensions) {
        throw new Error(
          `Embedding vector at index ${index} has ${vector.length} dimensions, expected ${meta.dimensions}.`,
        );
      }

      const vectorString = `[${vector.join(",")}]`;
      const updatedRows =
        meta.sourceType === "VIDEO_SUMMARY"
          ? await this.prisma.$executeRaw`
              UPDATE video_summary_chunks
              SET embedding = ${vectorString}::vector,
                  embedding_provider = ${meta.provider}::"AiProviderName",
                  embedding_model = ${meta.model},
                  embedding_dimensions = ${meta.dimensions}
              WHERE id = ${chunk.id}::uuid
                AND summary_hash = ${meta.summaryHash}
            `
          : await this.prisma.$executeRaw`
              UPDATE document_chunks
              SET embedding = ${vectorString}::vector,
                  embedding_provider = ${meta.provider}::"AiProviderName",
                  embedding_model = ${meta.model},
                  embedding_dimensions = ${meta.dimensions}
              WHERE id = ${chunk.id}::uuid
            `;

      if (updatedRows !== 1) {
        throw new Error(
          `Embedding chunk ${chunk.id} was not updated exactly once.`,
        );
      }
    }
  }

  private splitIntoBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];

    for (let index = 0; index < items.length; index += batchSize) {
      batches.push(items.slice(index, index + batchSize));
    }

    return batches;
  }

  private readLessonDocumentId(record: EmbeddingJobRecord): string | undefined {
    if (
      !record.inputMeta ||
      typeof record.inputMeta !== "object" ||
      Array.isArray(record.inputMeta)
    ) {
      return undefined;
    }

    const lessonDocumentId = record.inputMeta.lessonDocumentId;
    return typeof lessonDocumentId === "string"
      ? lessonDocumentId
      : undefined;
  }

  private readSummaryHash(record: EmbeddingJobRecord): string | undefined {
    if (
      !record.inputMeta ||
      typeof record.inputMeta !== "object" ||
      Array.isArray(record.inputMeta)
    ) {
      return undefined;
    }

    const summaryHash = record.inputMeta.summaryHash;
    return typeof summaryHash === "string" ? summaryHash : undefined;
  }

  private resolveMaxAttempts(
    job: Job<BackgroundJobBullmqData, BackgroundJobBullmqResult>,
    record: EmbeddingJobRecord,
  ): number {
    const bullmqAttempts =
      typeof job.opts.attempts === "number" && job.opts.attempts > 0
        ? job.opts.attempts
        : record.maxAttempts;

    return Math.max(record.maxAttempts, bullmqAttempts, 1);
  }

  private buildSkippedResult(
    record: EmbeddingJobRecord,
  ): BackgroundJobBullmqResult {
    return {
      status: "SKIPPED",
      queue: record.queue,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      action: "EMBEDDING",
      message: "Job already succeeded",
      handledAt: new Date().toISOString(),
    };
  }

  private async markAttemptFailed(params: {
    record: EmbeddingJobRecord;
    aiGenerationId: string | null;
    error: unknown;
    attempt: number;
    maxAttempts: number;
  }): Promise<void> {
    const { record, aiGenerationId, error, attempt, maxAttempts } = params;
    const message = getJobErrorMessage(error);
    const isFinalAttempt =
      error instanceof UnrecoverableError || attempt >= maxAttempts;
    const finishedAt = isFinalAttempt ? new Date() : null;

    const updates: Array<Promise<unknown>> = [
      this.prisma.backgroundJob.update({
        where: { id: record.id },
        data: {
          status: isFinalAttempt
            ? BackgroundJobStatus.FAILED
            : BackgroundJobStatus.QUEUED,
          errorMessage: message,
          finishedAt,
        },
      }),
    ];

    if (aiGenerationId) {
      updates.push(
        this.prisma.aiGeneration.update({
          where: { id: aiGenerationId },
          data: {
            status: isFinalAttempt
              ? AiGenerationStatus.FAILED
              : AiGenerationStatus.QUEUED,
            errorMessage: message,
            retryCount: Math.max(attempt - 1, 0),
            finishedAt,
          },
        }),
      );
    }

    const lessonDocumentId = this.readLessonDocumentId(record);
    if (lessonDocumentId && record.lessonId) {
      updates.push(
        this.prisma.lessonDocument.updateMany({
          where: {
            id: lessonDocumentId,
            lessonId: record.lessonId,
            replacedAt: null,
          },
          data: {
            status: isFinalAttempt
              ? DocumentStatus.FAILED
              : DocumentStatus.PROCESSING,
            extractError: message,
          },
        }),
      );
    }

    await Promise.all(updates);

    if (isFinalAttempt) {
      this.logger.error(
        `[EMBEDDING] Job ${record.id} permanently failed after ${attempt} attempts: ${message}`,
      );
    } else {
      this.logger.warn(
        `[EMBEDDING] Job ${record.id} attempt ${attempt}/${maxAttempts} failed: ${message}`,
      );
    }
  }
}
