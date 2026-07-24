/**
 * EmbeddingProcessor — xử lý EMBEDDING job trên BullMQ queue.
 *
 * Flow (docs/06-ai-rag-spec.md §3.4):
 * 1. Load backgroundJob → validate queue = EMBEDDING
 * 2. Lấy lessonDocumentId từ inputMeta
 * 3. Load document_chunks chưa có embedding (embedding IS NULL)
 * 4. Batch gọi AiService.createEmbedding() (50 texts/batch)
 * 5. Lưu vector bằng raw SQL (Prisma Unsupported type)
 * 6. Cập nhật lesson_documents embedding metadata
 * 7. Log ai_generations record
 * 8. Update backgroundJob status = SUCCEEDED
 */

import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  AiGenerationStatus,
  AiGenerationType,
  AiProviderName,
  BackgroundJobQueue,
  BackgroundJobStatus,
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

@Injectable()
export class EmbeddingProcessor {
  private readonly logger = new Logger(EmbeddingProcessor.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AiService) private readonly aiService: AiService,
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
    const maxAttempts = Math.max(backgroundJob.maxAttempts, job.opts.attempts ?? 3);

    await this.prisma.backgroundJob.update({
      where: { id: backgroundJob.id },
      data: {
        status: BackgroundJobStatus.RUNNING,
        bullmqJobId: String(job.id ?? backgroundJob.id),
        attempts: attempt,
        errorMessage: null,
        startedAt: new Date(),
      },
    });

    try {
      const result = await this.handleEmbedding(backgroundJob);

      await this.prisma.backgroundJob.update({
        where: { id: backgroundJob.id },
        data: {
          status: BackgroundJobStatus.SUCCEEDED,
          result: toJobJson(result),
          errorMessage: null,
          finishedAt: new Date(),
        },
      });

      return result;
    } catch (error) {
      await this.markAttemptFailed(backgroundJob, error, attempt, maxAttempts);
      throw error;
    }
  }

  private async handleEmbedding(
    record: EmbeddingJobRecord,
  ): Promise<BackgroundJobBullmqResult> {
    const inputMeta = record.inputMeta as Record<string, unknown> | null;
    const lessonDocumentId = inputMeta?.lessonDocumentId as string | undefined;
    const lessonId = record.lessonId;

    if (!lessonDocumentId) {
      throw new UnrecoverableError(
        `EMBEDDING job ${record.id} missing lessonDocumentId in inputMeta`,
      );
    }

    if (!lessonId) {
      throw new UnrecoverableError(
        `EMBEDDING job ${record.id} missing lessonId`,
      );
    }

    // Check AI provider availability
    if (!this.aiService.isProviderAvailable(AiProviderName.OPENAI)) {
      throw new UnrecoverableError(
        "OpenAI provider is not available. Set OPENAI_API_KEY in .env to enable embedding.",
      );
    }

    // Load chunks chưa có embedding
    const chunks = await this.loadChunksWithoutEmbedding(lessonDocumentId);

    if (chunks.length === 0) {
      this.logger.log(
        `[EMBEDDING] No chunks without embedding for document=${lessonDocumentId}`,
      );

      return {
        status: "SKIPPED",
        queue: record.queue,
        resourceType: record.resourceType,
        resourceId: record.resourceId,
        action: "EMBEDDING",
        message: "All chunks already have embeddings",
        handledAt: new Date().toISOString(),
      };
    }

    this.logger.log(
      `[EMBEDDING] Starting: ${chunks.length} chunks for document=${lessonDocumentId}, lesson=${lessonId}`,
    );

    const startedAt = new Date();
    const embeddingConfig = this.aiService.getEmbeddingConfig();
    let totalPromptTokens = 0;
    let totalTokens = 0;
    let embeddedCount = 0;

    // Batch embedding
    const batches = this.splitIntoBatches(chunks, EMBEDDING_BATCH_SIZE);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      this.logger.debug(
        `[EMBEDDING] Batch ${i + 1}/${batches.length}: ${batch.length} chunks`,
      );

      // Strip LaTeX markup before embedding for better search quality
      const textsForEmbedding = batch.map((c) =>
        stripLatexForEmbedding(c.content),
      );

      const result = await this.aiService.createEmbedding({
        texts: textsForEmbedding,
      });

      // Save vectors via raw SQL
      await this.saveEmbeddingBatch(batch, result.vectors, {
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
    await this.prisma.lessonDocument.update({
      where: { id: lessonDocumentId },
      data: {
        embeddingProvider: AiProviderName.OPENAI,
        embeddingModel: embeddingConfig.model,
        embeddingDimensions: embeddingConfig.dimensions,
      },
    });

    // Log ai_generations record
    await this.prisma.aiGeneration.create({
      data: {
        type: AiGenerationType.EMBEDDING,
        status: AiGenerationStatus.SUCCEEDED,
        provider: AiProviderName.OPENAI,
        model: embeddingConfig.model,
        lessonId,
        backgroundJobId: record.id,
        promptTokens: totalPromptTokens,
        totalTokens,
        latencyMs,
        startedAt,
        finishedAt,
      },
    });

    this.logger.log(
      `[EMBEDDING] Completed: ${embeddedCount} chunks embedded for document=${lessonDocumentId}, ` +
        `tokens=${totalTokens}, latency=${latencyMs}ms`,
    );

    return {
      status: "SUCCEEDED",
      queue: record.queue,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      action: "EMBEDDING",
      message: `Embedded ${embeddedCount} chunks (${totalTokens} tokens, ${latencyMs}ms)`,
      handledAt: new Date().toISOString(),
      details: {
        embeddedCount,
        totalPromptTokens,
        totalTokens,
        latencyMs,
        model: embeddingConfig.model,
        dimensions: embeddingConfig.dimensions,
      },
    };
  }

  private async loadChunksWithoutEmbedding(
    lessonDocumentId: string,
  ): Promise<ChunkToEmbed[]> {
    // Use raw SQL to check embedding IS NULL since Prisma can't filter Unsupported types
    const chunks = await this.prisma.$queryRaw<ChunkToEmbed[]>`
      SELECT id, content, chunk_index AS "chunkIndex"
      FROM document_chunks
      WHERE document_id = ${lessonDocumentId}::uuid
        AND embedding IS NULL
      ORDER BY chunk_index ASC
    `;

    return chunks;
  }

  private async saveEmbeddingBatch(
    chunks: ChunkToEmbed[],
    vectors: number[][],
    meta: {
      provider: AiProviderName;
      model: string;
      dimensions: number;
    },
  ): Promise<void> {
    // Update each chunk with its embedding vector via raw SQL
    // Prisma Unsupported("vector(1536)") cannot be written via Prisma client
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const vector = vectors[i];
      const vectorString = `[${vector.join(",")}]`;

      await this.prisma.$executeRaw`
        UPDATE document_chunks
        SET embedding = ${vectorString}::vector,
            embedding_provider = ${meta.provider}::"AiProviderName",
            embedding_model = ${meta.model},
            embedding_dimensions = ${meta.dimensions}
        WHERE id = ${chunk.id}::uuid
      `;
    }
  }

  private splitIntoBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    return batches;
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

  private async markAttemptFailed(
    record: EmbeddingJobRecord,
    error: unknown,
    attempt: number,
    maxAttempts: number,
  ): Promise<void> {
    const message = getJobErrorMessage(error);
    const isFinalAttempt = attempt >= maxAttempts;

    await this.prisma.backgroundJob.update({
      where: { id: record.id },
      data: {
        status: isFinalAttempt
          ? BackgroundJobStatus.FAILED
          : BackgroundJobStatus.QUEUED,
        errorMessage: message,
        finishedAt: isFinalAttempt ? new Date() : null,
      },
    });

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
