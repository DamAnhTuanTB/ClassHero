import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  BackgroundJobQueue,
  BackgroundJobStatus,
  DocumentStatus,
  LessonDocumentKind,
  Prisma,
} from "@prisma/client";
import { Job, UnrecoverableError } from "bullmq";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "#api/common/prisma/prisma.service";
import type {
  BackgroundJobBullmqData,
  BackgroundJobBullmqResult,
} from "#api/jobs/background-job-queues";
import { getJobErrorMessage } from "#api/jobs/job-error";
import { toJobJson } from "#api/jobs/job-json";
import type { EnvConfig } from "#api/config/env.validation";
import { ObjectStorageService } from "#api/modules/files/services/object-storage.service";
import { MathpixOcrService } from "#api/workers/services/mathpix-ocr.service";
import { PdfMetadataService } from "#api/workers/services/pdf-metadata.service";
import { OcrArtifactCacheService } from "#api/workers/services/ocr-artifact-cache.service";
import { ImageExtractionService } from "#api/workers/services/image-extraction.service";
import { scorePageQualityWithConfidence } from "#api/workers/utils/quality-score";
import { chunkText } from "#api/workers/utils/chunking";

const workerJobSelect = {
  id: true,
  queue: true,
  status: true,
  resourceType: true,
  resourceId: true,
  inputMeta: true,
  result: true,
  attempts: true,
  maxAttempts: true,
} satisfies Prisma.BackgroundJobSelect;

type WorkerJobRecord = Prisma.BackgroundJobGetPayload<{
  select: typeof workerJobSelect;
}>;

@Injectable()
export class DocumentProcessingProcessor {
  private readonly logger = new Logger(DocumentProcessingProcessor.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService)
    private readonly configService: ConfigService<EnvConfig, true>,
    @Inject(ObjectStorageService)
    private readonly storage: ObjectStorageService,
    @Inject(MathpixOcrService)
    private readonly mathpixOcr: MathpixOcrService,
    @Inject(PdfMetadataService)
    private readonly pdfMetadata: PdfMetadataService,
    @Inject(OcrArtifactCacheService)
    private readonly artifactCache: OcrArtifactCacheService,
    @Inject(ImageExtractionService)
    private readonly imageExtraction: ImageExtractionService,
  ) {}

  async process(
    job: Job<BackgroundJobBullmqData, BackgroundJobBullmqResult>,
  ): Promise<BackgroundJobBullmqResult> {
    const backgroundJob = await this.prisma.backgroundJob.findUnique({
      where: {
        id: job.data.backgroundJobId,
      },
      select: workerJobSelect,
    });

    if (!backgroundJob) {
      throw new UnrecoverableError(
        `Durable background job ${job.data.backgroundJobId} was not found`,
      );
    }

    if (backgroundJob.queue !== BackgroundJobQueue.DOCUMENT_PROCESSING) {
      throw new UnrecoverableError(
        `Job ${backgroundJob.id} belongs to ${backgroundJob.queue}, not DOCUMENT_PROCESSING`,
      );
    }

    if (backgroundJob.status === BackgroundJobStatus.CANCELLED) {
      throw new UnrecoverableError(`Job ${backgroundJob.id} was cancelled`);
    }

    if (backgroundJob.status === BackgroundJobStatus.SUCCEEDED) {
      return this.buildSkippedResult(backgroundJob);
    }

    const attempt = job.attemptsMade + 1;
    const maxAttempts = this.resolveMaxAttempts(job, backgroundJob);

    const runningJob = await this.prisma.backgroundJob.update({
      where: {
        id: backgroundJob.id,
      },
      data: {
        status: BackgroundJobStatus.RUNNING,
        bullmqJobId: String(job.id ?? backgroundJob.id),
        attempts: attempt,
        errorMessage: null,
        startedAt: new Date(),
      },
      select: workerJobSelect,
    });

    try {
      const action = getJobAction(runningJob.inputMeta);
      let result: BackgroundJobBullmqResult;

      switch (action) {
        case "SOURCE_PAGE_EXTRACTION":
          result = await this.handleSourcePageExtraction(runningJob);
          break;
        case "LESSON_CHUNKING_FROM_SOURCE":
          result = await this.handleLessonChunking(runningJob);
          break;
        default:
          result = this.buildFoundationResult(runningJob);
          break;
      }

      await this.prisma.backgroundJob.update({
        where: {
          id: runningJob.id,
        },
        data: {
          status: BackgroundJobStatus.SUCCEEDED,
          result: toJobJson(result),
          errorMessage: null,
          finishedAt: new Date(),
        },
      });

      return result;
    } catch (error) {
      await this.markAttemptFailed(runningJob.id, error, attempt, maxAttempts);
      throw error;
    }
  }

  // ─── SOURCE_PAGE_EXTRACTION ────────────────────────────────────

  private async handleSourcePageExtraction(
    record: WorkerJobRecord,
  ): Promise<BackgroundJobBullmqResult> {
    const sourceDocId = record.resourceId;
    if (!sourceDocId) {
      throw new UnrecoverableError("Missing resourceId for SOURCE_PAGE_EXTRACTION");
    }
    this.logger.log(
      `[SOURCE_PAGE_EXTRACTION] Starting for source document ${sourceDocId}`,
    );

    // 1. Load source document with file
    const sourceDoc = await this.prisma.sourceDocument.findUniqueOrThrow({
      where: { id: sourceDocId },
      select: {
        id: true,
        file: { select: { objectKey: true, originalName: true } },
      },
    });

    // 2. Download PDF from object storage
    this.logger.log(`Downloading PDF from storage: ${sourceDoc.file.objectKey}`);
    const pdfBuffer = await this.storage.downloadObject(
      sourceDoc.file.objectKey,
    );

    // 3. Get page count + content hash
    const pageCount = await this.pdfMetadata.getPageCount(pdfBuffer);
    const contentHash = this.pdfMetadata.computeContentHash(pdfBuffer);
    this.logger.log(
      `PDF metadata: ${pageCount} pages, hash=${contentHash.substring(0, 12)}...`,
    );

    // 4. Update source document
    await this.prisma.sourceDocument.update({
      where: { id: sourceDocId },
      data: {
        pageCount,
        contentHash,
        status: DocumentStatus.PROCESSING,
      },
    });

    // 5. Create source_document_pages records
    await this.createPageRecords(sourceDocId, pageCount);

    // 6. OCR — check cache first, then call Mathpix
    const provider = this.configService.get("OCR_PROVIDER", { infer: true });
    const ocrEnabled = this.configService.get("OCR_PAID_ENABLED", {
      infer: true,
    });

    let bundle;

    const cacheHit = await this.artifactCache.hasArtifact(
      contentHash,
      provider,
    );

    if (cacheHit) {
      this.logger.log("Loading OCR artifacts from cache...");
      bundle = await this.artifactCache.loadBundle(contentHash, provider);
    } else if (ocrEnabled) {
      this.logger.log("Cache miss — submitting to Mathpix...");
      const startTime = Date.now();

      const { pdfId } = await this.mathpixOcr.submitPdf(
        pdfBuffer,
        sourceDoc.file.originalName ?? "document.pdf",
      );
      const { numPages } = await this.mathpixOcr.pollUntilComplete(pdfId);
      bundle = await this.mathpixOcr.downloadAllArtifacts(
        pdfId,
        numPages,
        startTime,
      );

      // Save to cache
      await this.artifactCache.saveBundle(contentHash, provider, bundle);
    } else {
      throw new UnrecoverableError(
        "Paid OCR is disabled (OCR_PAID_ENABLED=false) and no cached artifacts found. " +
          "Enable paid OCR or provide cached artifacts to process this document.",
      );
    }

    // 7. Extract per-page text from lines.json (preferred) or fallback to MMD split
    const pageTexts = this.extractPageTexts(bundle, pageCount);

    this.logger.log(
      `Extracted text for ${pageTexts.length} pages, updating DB...`,
    );

    for (let i = 0; i < pageCount; i++) {
      const pageText = pageTexts[i] ?? "";
      const qualityScore = scorePageQualityWithConfidence(
        pageText,
        bundle.linesJson,
        i,
      );

      await this.prisma.sourceDocumentPage.update({
        where: {
          sourceDocumentId_pageNumber: {
            sourceDocumentId: sourceDocId,
            pageNumber: i + 1,
          },
        },
        data: {
          text: pageText || null,
          textSource: "mathpix_paid_ocr",
          qualityScore,
          status: DocumentStatus.READY,
          metadataJson: {
            provider,
            pdfId: bundle.pdfId,
            qualityScore,
            textLength: pageText.length,
          },
        },
      });
    }

    // 8. Extract images from mmd.zip and upload to MinIO
    await this.extractAndStoreImages(bundle.mmdZip, sourceDocId, pageCount);

    // 9. Mark source document as READY
    await this.prisma.sourceDocument.update({
      where: { id: sourceDocId },
      data: {
        status: DocumentStatus.READY,
        processedAt: new Date(),
        metadataJson: {
          ocrProvider: provider,
          mathpixPdfId: bundle.pdfId,
          processingTimeMs: bundle.processingTimeMs,
          pageCount: bundle.numPages,
          contentHash,
          cachedArtifact: cacheHit,
        },
      },
    });

    this.logger.log(
      `[SOURCE_PAGE_EXTRACTION] Completed for ${sourceDocId}: ${pageCount} pages processed`,
    );

    return {
      status: "SUCCEEDED",
      queue: record.queue,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      action: "SOURCE_PAGE_EXTRACTION",
      message: `Processed ${pageCount} pages via ${provider} OCR (cache ${cacheHit ? "HIT" : "MISS"})`,
      handledAt: new Date().toISOString(),
    };
  }

  // ─── LESSON_CHUNKING_FROM_SOURCE ───────────────────────────────

  private async handleLessonChunking(
    record: WorkerJobRecord,
  ): Promise<BackgroundJobBullmqResult> {
    const inputMeta = record.inputMeta as Record<string, unknown> | null;
    const lessonId = record.resourceId;
    const sourceDocId = inputMeta?.sourceDocumentId as string | undefined;

    if (!lessonId) {
      throw new UnrecoverableError("Missing resourceId for LESSON_CHUNKING_FROM_SOURCE");
    }

    this.logger.log(
      `[LESSON_CHUNKING] Starting for lesson=${lessonId}, sourceDoc=${sourceDocId}`,
    );

    if (!sourceDocId) {
      throw new UnrecoverableError(
        "Missing sourceDocumentId in inputMeta for LESSON_CHUNKING_FROM_SOURCE",
      );
    }

    // 1. Load page range
    const pageRange =
      await this.prisma.lessonDocumentPageRange.findUniqueOrThrow({
        where: {
          lessonId_sourceDocumentId: {
            lessonId,
            sourceDocumentId: sourceDocId,
          },
        },
      });

    // 2. Load source document pages (text already filled by SOURCE_PAGE_EXTRACTION)
    const pages = await this.prisma.sourceDocumentPage.findMany({
      where: {
        sourceDocumentId: sourceDocId,
        pageNumber: {
          gte: pageRange.pageStart,
          lte: pageRange.pageEnd,
        },
      },
      orderBy: { pageNumber: "asc" },
      select: {
        pageNumber: true,
        text: true,
        qualityScore: true,
      },
    });

    // 3. Concatenate page texts
    const fullText = pages
      .map((p) => p.text ?? "")
      .filter((t) => t.length > 0)
      .join("\n\n");

    if (fullText.trim().length === 0) {
      this.logger.warn(
        `No text content for lesson=${lessonId} pages ${pageRange.pageStart}-${pageRange.pageEnd}`,
      );
    }

    // 4. Find or create lesson document
    let lessonDoc = await this.prisma.lessonDocument.findFirst({
      where: {
        lessonId,
        sourceDocumentId: sourceDocId ?? undefined,
        kind: LessonDocumentKind.PRIMARY_FROM_SOURCE,
        replacedAt: null,
      },
    });

    if (!lessonDoc) {
      // Get the file from source document
      const sourceDoc = await this.prisma.sourceDocument.findUniqueOrThrow({
        where: { id: sourceDocId },
        select: { fileId: true },
      });

      lessonDoc = await this.prisma.lessonDocument.create({
        data: {
          lessonId,
          sourceDocumentId: sourceDocId ?? undefined,
          fileId: sourceDoc.fileId,
          kind: LessonDocumentKind.PRIMARY_FROM_SOURCE,
          status: DocumentStatus.PROCESSING,
          title: `Pages ${pageRange.pageStart}-${pageRange.pageEnd}`,
        },
      });
    } else {
      await this.prisma.lessonDocument.update({
        where: { id: lessonDoc.id },
        data: { status: DocumentStatus.PROCESSING },
      });
    }

    // 5. Delete old chunks
    await this.prisma.documentChunk.deleteMany({
      where: { documentId: lessonDoc.id },
    });

    // 6. Chunk text
    const chunks = chunkText(fullText);

    this.logger.log(
      `Chunked ${fullText.length} chars into ${chunks.length} chunks for lesson=${lessonId}`,
    );

    // 7. Create document chunks
    if (chunks.length > 0) {
      const docId = lessonDoc.id;
      await this.prisma.documentChunk.createMany({
        data: chunks.map((chunk) => ({
          documentId: docId,
          lessonId: lessonId,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          contentHash: chunk.contentHash,
          tokenCount: chunk.tokenCount,
          metadataJson: {
            sourceDocumentId: sourceDocId,
            pageStart: pageRange.pageStart,
            pageEnd: pageRange.pageEnd,
            textSource: "mathpix_paid_ocr",
          },
        })),
      });
    }

    // 8. Update lesson document
    await this.prisma.lessonDocument.update({
      where: { id: lessonDoc.id },
      data: {
        status: DocumentStatus.READY,
        chunkCount: chunks.length,
        processedAt: new Date(),
        contentHash: chunks.length > 0 ? chunks[0]!.contentHash : undefined,
      },
    });

    this.logger.log(
      `[LESSON_CHUNKING] Completed: ${chunks.length} chunks created for lesson=${lessonId}`,
    );

    return {
      status: "SUCCEEDED",
      queue: record.queue,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      action: "LESSON_CHUNKING_FROM_SOURCE",
      message: `Created ${chunks.length} chunks from pages ${pageRange.pageStart}-${pageRange.pageEnd}`,
      handledAt: new Date().toISOString(),
    };
  }

  // ─── Image Extraction ──────────────────────────────────────────

  /**
   * Extract images from mmd.zip, upload to MinIO, and update page records
   * with image metadata (paths, bounding boxes).
   */
  private async extractAndStoreImages(
    mmdZipBuffer: Buffer,
    sourceDocId: string,
    pageCount: number,
  ): Promise<void> {
    try {
      const images =
        await this.imageExtraction.extractImagesFromZip(mmdZipBuffer);

      if (images.length === 0) {
        this.logger.log(`No images found in mmd.zip for ${sourceDocId}`);
        return;
      }

      // Upload each image to MinIO
      const imageBasePath = `document-images/${sourceDocId}`;
      const uploadPromises = images.map(async (img) => {
        const objectKey = `${imageBasePath}/page-${String(img.pageNumber).padStart(3, "0")}/${img.filename}`;
        await this.storage.uploadBuffer(objectKey, img.data, img.mimeType);
        return {
          pageNumber: img.pageNumber,
          objectKey,
          filename: img.filename,
          boundingBox: img.boundingBox,
          size: img.data.length,
          mimeType: img.mimeType,
        };
      });

      const uploadedImages = await Promise.all(uploadPromises);

      this.logger.log(
        `Uploaded ${uploadedImages.length} images to MinIO for ${sourceDocId}`,
      );

      // Group by page and update each page's metadataJson
      const byPage = this.imageExtraction.groupByPage(images);

      for (const [pageNumber, pageImages] of byPage.entries()) {
        if (pageNumber < 1 || pageNumber > pageCount) continue;

        const imageEntries = uploadedImages
          .filter((u) => u.pageNumber === pageNumber)
          .map((u) => ({
            objectKey: u.objectKey,
            filename: u.filename,
            boundingBox: u.boundingBox,
            size: u.size,
            mimeType: u.mimeType,
          }));

        // Merge image metadata into existing metadataJson
        const existing = await this.prisma.sourceDocumentPage.findUnique({
          where: {
            sourceDocumentId_pageNumber: {
              sourceDocumentId: sourceDocId,
              pageNumber,
            },
          },
          select: { metadataJson: true },
        });

        const currentMeta =
          (existing?.metadataJson as Record<string, unknown>) ?? {};

        await this.prisma.sourceDocumentPage.update({
          where: {
            sourceDocumentId_pageNumber: {
              sourceDocumentId: sourceDocId,
              pageNumber,
            },
          },
          data: {
            metadataJson: {
              ...currentMeta,
              images: imageEntries,
              imageCount: imageEntries.length,
            },
          },
        });
      }

      this.logger.log(
        `Image metadata saved for ${byPage.size} pages of ${sourceDocId}`,
      );
    } catch (err) {
      // Image extraction failure should not fail the whole pipeline
      this.logger.error(
        `Image extraction failed for ${sourceDocId}, continuing without images: ${err}`,
      );
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────

  /**
   * Extract per-page text from OCR bundle.
   * Primary: lines.json `pages[].lines[].text` (per-page data from Mathpix)
   * Fallback: split MMD text by \\newpage separator
   */
  private extractPageTexts(
    bundle: { mmd: Buffer; linesJson: Buffer; pdfId?: string },
    expectedPages: number,
  ): string[] {
    // Try lines.json first — it has per-page structure
    try {
      const parsed = JSON.parse(bundle.linesJson.toString("utf8"));
      if (parsed.pages && Array.isArray(parsed.pages)) {
        const pages: string[] = [];
        for (let i = 0; i < parsed.pages.length; i++) {
          const page = parsed.pages[i];
          if (page && Array.isArray(page.lines)) {
            const pageText = page.lines
              .map((line: { text?: string }) => line.text ?? "")
              .join("\n");
            pages.push(pageText.trim());
          } else {
            pages.push("");
          }
        }

        if (pages.length > 0) {
          this.logger.log(
            `Extracted ${pages.length} pages from lines.json`,
          );
          return pages;
        }
      }
    } catch (err) {
      this.logger.warn(`Failed to parse lines.json: ${err}`);
    }

    // Fallback: split MMD by \\newpage
    this.logger.log("Falling back to MMD \\newpage splitting");
    const mmdText = bundle.mmd.toString("utf8");
    const pages = mmdText.split("\\newpage").map((p) => p.trim());

    if (pages.length !== expectedPages) {
      this.logger.warn(
        `MMD page count mismatch: got ${pages.length} sections, expected ${expectedPages}. ` +
          `Using available sections.`,
      );
    }

    return pages;
  }

  /**
   * Create source_document_pages records for each page.
   */
  private async createPageRecords(
    sourceDocId: string,
    pageCount: number,
  ): Promise<void> {
    // Delete existing pages (in case of re-processing)
    await this.prisma.sourceDocumentPage.deleteMany({
      where: { sourceDocumentId: sourceDocId },
    });

    const pageData = Array.from({ length: pageCount }, (_, i) => ({
      sourceDocumentId: sourceDocId,
      pageNumber: i + 1,
      status: DocumentStatus.UPLOADED as DocumentStatus,
    }));

    await this.prisma.sourceDocumentPage.createMany({
      data: pageData,
    });

    this.logger.log(`Created ${pageCount} page records for ${sourceDocId}`);
  }

  private buildFoundationResult(
    record: WorkerJobRecord,
  ): BackgroundJobBullmqResult {
    return {
      status: "SUCCEEDED",
      queue: record.queue,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      action: getJobAction(record.inputMeta),
      message: `Action "${getJobAction(record.inputMeta)}" not yet implemented.`,
      handledAt: new Date().toISOString(),
    };
  }

  private buildSkippedResult(
    record: WorkerJobRecord,
  ): BackgroundJobBullmqResult {
    return {
      status: "SKIPPED",
      queue: record.queue,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      action: getJobAction(record.inputMeta),
      message: "Durable background job already succeeded.",
      handledAt: new Date().toISOString(),
    };
  }

  private async markAttemptFailed(
    jobId: string,
    error: unknown,
    attempt: number,
    maxAttempts: number,
  ) {
    const hasRetryLeft = attempt < maxAttempts;

    await this.prisma.backgroundJob.update({
      where: {
        id: jobId,
      },
      data: {
        status: hasRetryLeft
          ? BackgroundJobStatus.QUEUED
          : BackgroundJobStatus.FAILED,
        attempts: attempt,
        errorMessage: getJobErrorMessage(error),
        finishedAt: hasRetryLeft ? null : new Date(),
      },
    });
  }

  private resolveMaxAttempts(
    job: Job<BackgroundJobBullmqData, BackgroundJobBullmqResult>,
    record: WorkerJobRecord,
  ) {
    const bullmqAttempts =
      typeof job.opts.attempts === "number" && job.opts.attempts > 0
        ? job.opts.attempts
        : undefined;

    return Math.max(bullmqAttempts ?? record.maxAttempts, 1);
  }
}

function getJobAction(inputMeta: Prisma.JsonValue | null): string | null {
  if (!inputMeta || typeof inputMeta !== "object" || Array.isArray(inputMeta)) {
    return null;
  }

  const action = (inputMeta as Record<string, unknown>).action;
  return typeof action === "string" ? action : null;
}
