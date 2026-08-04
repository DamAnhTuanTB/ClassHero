import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import {
  BackgroundJobQueue,
  BackgroundJobStatus,
  DocumentStatus,
  Prisma,
  ProviderCatalogCategory,
  ProviderUsageMetric,
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
import {
  MathpixOcrService,
  type OcrArtifactBundle,
} from "#api/workers/services/mathpix-ocr.service";
import { PdfMetadataService } from "#api/workers/services/pdf-metadata.service";
import { OcrArtifactCacheService } from "#api/workers/services/ocr-artifact-cache.service";
import { ImageExtractionService } from "#api/workers/services/image-extraction.service";
import { EmbeddingJobEnqueuer } from "#api/workers/services/embedding-job-enqueuer.service";
import type {
  OcrArtifactCacheDescriptor,
  OcrArtifactCacheManifest,
  OcrArtifactKeys,
} from "#api/workers/services/ocr-artifact-cache.service";
import {
  normalizeOcrPages,
  summarizeOcrPage,
  type NormalizedOcrPage,
} from "#api/workers/utils/ocr-artifact-normalizer";
import {
  buildOcrArtifactAudit,
  type OcrArtifactAudit,
} from "#api/workers/utils/ocr-artifact-audit";
import {
  buildOcrImageManifest,
  type OcrImageManifest,
  type OcrImageManifestImage,
} from "#api/workers/utils/ocr-image-manifest";
import type { PrintedPageReference } from "#api/workers/utils/ocr-printed-page";
import {
  computeTextHash,
  scorePageQualityWithConfidence,
} from "#api/workers/utils/quality-score";
import { chunkText } from "#api/workers/utils/chunking";
import { ProviderUsageService } from "#api/modules/provider-operations/services/provider-usage.service";
import { isProviderBudgetError } from "#api/modules/provider-operations/utils/provider-budget-error";

const PAID_OCR_TEXT_SOURCE = "paid_ocr";

const workerJobSelect = {
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

type WorkerJobRecord = Prisma.BackgroundJobGetPayload<{
  select: typeof workerJobSelect;
}>;

interface OcrProcessingResult {
  pageCount: number;
  contentHash: string;
  pages: NormalizedOcrPage[];
  provider: string;
  cacheHit: boolean;
  descriptor: OcrArtifactCacheDescriptor;
  manifest: OcrArtifactCacheManifest;
  artifactKeys: OcrArtifactKeys;
  normalizedPagesKey: string;
  bundlePdfId: string;
  processingTimeMs: number;
  mmdZip: Buffer;
  linesJson: Buffer;
}

interface StoredOcrImage {
  pageNumber: OcrImageManifestImage["pageNumber"];
  printedPage: OcrImageManifestImage["printedPage"];
  objectKey: OcrImageManifestImage["objectKey"];
  filename: OcrImageManifestImage["filename"];
  boundingBox: OcrImageManifestImage["boundingBox"];
  normalizedBoundingBox: OcrImageManifestImage["normalizedBoundingBox"];
  pageDimensions: OcrImageManifestImage["pageDimensions"];
  orderInPage: OcrImageManifestImage["orderInPage"];
  imageId: OcrImageManifestImage["imageId"];
  nearbyLineIds: OcrImageManifestImage["nearbyLineIds"];
  nearbyText: OcrImageManifestImage["nearbyText"];
  captionCandidate: OcrImageManifestImage["captionCandidate"];
  kind: OcrImageManifestImage["kind"];
  kindSource: OcrImageManifestImage["kindSource"];
  qualityFlags: OcrImageManifestImage["qualityFlags"];
  isUsableForAi: OcrImageManifestImage["isUsableForAi"];
  size: OcrImageManifestImage["size"];
  mimeType: OcrImageManifestImage["mimeType"];
}

interface StoredOcrImageSummary {
  ownerId: string;
  totalImages: number;
  pagesWithImages: number[];
  byPage: Record<number, StoredOcrImage[]>;
  imageManifestKey: string | null;
  artifactAuditKey: string | null;
  manifest: OcrImageManifest | null;
  artifactAudit: OcrArtifactAudit | null;
}

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
    @Inject(EmbeddingJobEnqueuer)
    private readonly embeddingEnqueuer: EmbeddingJobEnqueuer,
    @Optional()
    @Inject(ProviderUsageService)
    private readonly providerUsage?: ProviderUsageService,
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
        case "LESSON_PRIMARY_FROM_SOURCE_PROCESSING":
          result = await this.handleLessonChunking(runningJob);
          break;
        // Transitional compatibility for jobs queued before ADR-0009.
        case "LESSON_PRIMARY_REPLACEMENT_FROM_SOURCE":
          result = await this.handleLessonChunking(runningJob);
          break;
        case "LESSON_PRIMARY_UPLOAD_PROCESSING":
          result = await this.handleDirectLessonDocumentOcr(runningJob);
          break;
        // Transitional compatibility for jobs queued before ADR-0009.
        case "LESSON_PRIMARY_REPLACEMENT_UPLOAD":
        case "LESSON_SUPPLEMENT_PROCESSING":
          result = await this.handleDirectLessonDocumentOcr(runningJob);
          break;
        default:
          throw new UnrecoverableError(
            `Unsupported DOCUMENT_PROCESSING action: ${action ?? "null"}`,
          );
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
      const isBudgetBlocked = isProviderBudgetError(error);
      await this.markAttemptFailed(
        runningJob,
        error,
        attempt,
        isBudgetBlocked ? attempt : maxAttempts,
      );
      if (isBudgetBlocked) {
        throw new UnrecoverableError(error.message);
      }
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

    const sourceDoc = await this.prisma.sourceDocument.findUniqueOrThrow({
      where: { id: sourceDocId },
      select: {
        id: true,
        fileId: true,
        metadataJson: true,
        file: {
          select: {
            id: true,
            objectKey: true,
            originalName: true,
          },
        },
      },
    });

    const ocr = await this.processPdfWithPaidOcr({
      objectKey: sourceDoc.file.objectKey,
      originalName: sourceDoc.file.originalName ?? "document.pdf",
      ownerId: sourceDocId,
      ownerType: "SOURCE_DOCUMENT",
      ownerMetadata: sourceDoc.metadataJson,
      backgroundJobId: record.id,
      sourceDocumentId: sourceDocId,
      onProgress: async (progress) => {
        await this.prisma.backgroundJob.update({
          where: { id: record.id },
          data: { result: { progress } },
        });
      },
    });

    await this.prisma.sourceDocument.update({
      where: { id: sourceDocId },
      data: {
        pageCount: ocr.pageCount,
        contentHash: ocr.contentHash,
        status: DocumentStatus.PROCESSING,
      },
    });

    await this.createPageRecords(sourceDocId, ocr.pageCount);

    for (let pageIndex = 0; pageIndex < ocr.pageCount; pageIndex += 1) {
      const page = ocr.pages[pageIndex]!;
      const qualityScore = scorePageQualityWithConfidence(
        page.text,
        Buffer.from(JSON.stringify({ pages: ocr.pages })),
        pageIndex,
      );

      await this.prisma.sourceDocumentPage.update({
        where: {
          sourceDocumentId_pageNumber: {
            sourceDocumentId: sourceDocId,
            pageNumber: page.pageNumber,
          },
        },
        data: {
          text: page.text || null,
          mathpixMarkdown: page.mathpixMarkdown || null,
          textSource: PAID_OCR_TEXT_SOURCE,
          qualityScore,
          status: DocumentStatus.READY,
          extractError: null,
          metadataJson: this.toJson({
            textSource: PAID_OCR_TEXT_SOURCE,
            ocr: this.buildOcrMetadata(ocr),
            page: summarizeOcrPage(page),
            printedPage: page.printedPage,
            quality: {
              score: qualityScore,
              confidence: page.confidence,
              flags: page.qualityFlags,
            },
            artifacts: this.buildPageArtifactRefs(ocr, page.pageNumber),
            layout: page.layoutRef,
            visual: this.buildPageVisualFallback({
              sourceFileId: sourceDoc.fileId,
              sourceObjectKey: sourceDoc.file.objectKey,
              pageNumber: page.pageNumber,
            }),
          }),
        },
      });
    }

    const imageSummary = await this.extractAndStoreImages({
      ocr,
      ownerId: sourceDocId,
      sourceDocumentId: sourceDocId,
    });

    await this.prisma.sourceDocument.update({
      where: { id: sourceDocId },
      data: {
        status: DocumentStatus.READY,
        processedAt: new Date(),
        metadataJson: this.toJson({
          ...asRecord(sourceDoc.metadataJson),
          ocr: this.buildOcrMetadata(ocr),
          contentHash: ocr.contentHash,
          pageCount: ocr.pageCount,
          qualitySummary: this.buildQualitySummary(ocr.pages),
          printedPageMappingSummary: this.buildPrintedPageMappingSummary(ocr.pages),
          visualAssets: {
            providerImageCount: imageSummary.totalImages,
            pagesWithImages: imageSummary.pagesWithImages,
            imageManifestKey: imageSummary.imageManifestKey,
            imageManifestSummary: imageSummary.manifest?.summary ?? null,
            artifactAuditKey: imageSummary.artifactAuditKey,
            artifactAuditSummary: imageSummary.artifactAudit?.summary ?? null,
            artifactAuditStatus: imageSummary.artifactAudit?.status ?? null,
            pageImageFallback: {
              sourceFileId: sourceDoc.fileId,
              sourceObjectKey: sourceDoc.file.objectKey,
              renderOnDemand: true,
            },
          },
        }),
      },
    });

    this.logger.log(
      `[SOURCE_PAGE_EXTRACTION] Completed for ${sourceDocId}: ${ocr.pageCount} pages processed`,
    );

    return {
      status: "SUCCEEDED",
      queue: record.queue,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      action: "SOURCE_PAGE_EXTRACTION",
      message: `Processed ${ocr.pageCount} pages via ${ocr.provider} OCR (cache ${ocr.cacheHit ? "HIT" : "MISS"})`,
      handledAt: new Date().toISOString(),
    };
  }

  // ─── LESSON_CHUNKING_FROM_SOURCE ───────────────────────────────

  private async handleLessonChunking(
    record: WorkerJobRecord,
  ): Promise<BackgroundJobBullmqResult> {
    const inputMeta = asRecord(record.inputMeta);
    const action = getJobAction(record.inputMeta);
    const lessonId = readString(inputMeta, "lessonId") ?? record.lessonId;
    const lessonDocumentId =
      readString(inputMeta, "lessonDocumentId") ?? record.resourceId;
    const inputSourceDocumentId = readString(inputMeta, "sourceDocumentId");
    const inputPageRangeId = readString(inputMeta, "pageRangeId");

    if (!lessonId) {
      throw new UnrecoverableError(
        `Missing lessonId for ${action ?? "source lesson chunking"}`,
      );
    }

    if (!lessonDocumentId) {
      throw new UnrecoverableError(
        `Missing lessonDocumentId/resourceId for ${action ?? "source lesson chunking"}`,
      );
    }

    this.logger.log(
      `[LESSON_CHUNKING] Starting for lesson=${lessonId}, document=${lessonDocumentId}, sourceDoc=${inputSourceDocumentId}`,
    );

    const lessonDoc = await this.prisma.lessonDocument.findFirstOrThrow({
      where: {
        id: lessonDocumentId,
        lessonId,
        replacedAt: null,
      },
      select: {
        id: true,
        lessonId: true,
        fileId: true,
        sourceDocumentId: true,
        pageRangeId: true,
        kind: true,
        metadataJson: true,
        file: {
          select: {
            objectKey: true,
          },
        },
      },
    });
    const sourceDocId = inputSourceDocumentId ?? lessonDoc.sourceDocumentId;
    const pageRangeId = inputPageRangeId ?? lessonDoc.pageRangeId;

    if (!sourceDocId || !pageRangeId) {
      throw new UnrecoverableError(
        `Missing sourceDocumentId/pageRangeId for ${action ?? "source lesson chunking"}`,
      );
    }

    const pageRange = await this.prisma.lessonDocumentPageRange.findFirstOrThrow({
      where: {
        id: pageRangeId,
        lessonId,
        sourceDocumentId: sourceDocId,
      },
    });

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
        textSource: true,
        status: true,
        qualityScore: true,
        metadataJson: true,
      },
    });

    const expectedPageNumbers = Array.from(
      { length: pageRange.pageEnd - pageRange.pageStart + 1 },
      (_, index) => pageRange.pageStart + index,
    );
    const foundPageNumbers = new Set(pages.map((page) => page.pageNumber));
    const missingPageNumbers = expectedPageNumbers.filter(
      (pageNumber) => !foundPageNumbers.has(pageNumber),
    );
    if (missingPageNumbers.length > 0) {
      throw new Error(
        `Source document ${sourceDocId} pages are missing for chunking: ${missingPageNumbers.join(", ")}`,
      );
    }

    const notReadyPages = pages.filter((page) => page.status !== DocumentStatus.READY);
    if (notReadyPages.length > 0) {
      throw new Error(
        `Source document ${sourceDocId} pages are not ready for chunking: ${notReadyPages
          .map((page) => page.pageNumber)
          .join(", ")}`,
      );
    }

    const fullText = pages
      .map((page) => {
        const text = page.text?.trim() ?? "";
        return text
          ? `${this.buildSourcePageTextHeading(
              page.pageNumber,
              page.metadataJson,
            )}\n${text}`
          : "";
      })
      .filter((text) => text.length > 0)
      .join("\n\n");

    if (fullText.trim().length === 0) {
      this.logger.warn(
        `No text content for lesson=${lessonId} pages ${pageRange.pageStart}-${pageRange.pageEnd}`,
      );
    }

    const sourceDoc = await this.prisma.sourceDocument.findUniqueOrThrow({
      where: { id: sourceDocId },
      select: {
        contentHash: true,
        fileId: true,
        file: {
          select: {
            objectKey: true,
          },
        },
      },
    });

    await this.prisma.lessonDocument.update({
      where: { id: lessonDoc.id },
      data: {
        status: DocumentStatus.PROCESSING,
        extractError: null,
      },
    });

    const chunks = chunkText(fullText);

    this.logger.log(
      `Chunked ${fullText.length} chars into ${chunks.length} chunks for lesson=${lessonId}`,
    );

    const contentHash = computeTextHash(
      [
        sourceDoc.contentHash ?? "source-without-hash",
        sourceDocId,
        lessonId,
        pageRange.pageStart,
        pageRange.pageEnd,
        fullText,
      ].join(":"),
    );

    await this.replaceDocumentChunks({
      lessonId,
      documentId: lessonDoc.id,
      chunks,
      metadata: {
        sourceDocumentId: sourceDocId,
        pageStart: pageRange.pageStart,
        pageEnd: pageRange.pageEnd,
        textSource: resolveTextSource(pages.map((page) => page.textSource)),
        sourceFileId: sourceDoc.fileId,
        sourceObjectKey: sourceDoc.file.objectKey,
        documentId: lessonDoc.id,
        lessonDocumentKind: lessonDoc.kind,
        qualityScore: averageNullable(pages.map((page) => page.qualityScore)),
        sourcePages: pages.map((page) => ({
          pageNumber: page.pageNumber,
          printedPage: this.readSourcePagePrintedPage(page.pageNumber, page.metadataJson),
          qualityScore: page.qualityScore,
          textSource: page.textSource,
          artifactRefs: readNestedRecord(page.metadataJson, "artifacts"),
          layoutRef: readNestedRecord(page.metadataJson, "layout"),
          visual: readNestedRecord(page.metadataJson, "visual"),
        })),
        visualAssets: this.buildSourceRangeVisualAssets({
          pages,
          sourceFileId: sourceDoc.fileId,
          sourceObjectKey: sourceDoc.file.objectKey,
        }),
        printedPageMappingSummary: this.buildSourceRangePrintedPageMappingSummary(pages),
      },
    });

    await this.markLessonExplanationsStale(lessonId);

    await this.prisma.lessonDocument.update({
      where: { id: lessonDoc.id },
      data: {
        status: chunks.length > 0 ? DocumentStatus.PROCESSING : DocumentStatus.READY,
        extractedText: fullText || null,
        extractError: null,
        chunkCount: chunks.length,
        processedAt: new Date(),
        contentHash,
        embeddingProvider: null,
        embeddingModel: null,
        embeddingDimensions: null,
        metadataJson: this.toJson({
          ...asRecord(lessonDoc.metadataJson),
          source: "source_document_page_range",
          ocr: {
            textSource: resolveTextSource(pages.map((page) => page.textSource)),
            sourceDocumentId: sourceDocId,
            pageStart: pageRange.pageStart,
            pageEnd: pageRange.pageEnd,
          },
          chunking: {
            chunkCount: chunks.length,
            contentHash,
            pageStart: pageRange.pageStart,
            pageEnd: pageRange.pageEnd,
            qualityScore: averageNullable(pages.map((page) => page.qualityScore)),
            printedPageMappingSummary:
              this.buildSourceRangePrintedPageMappingSummary(pages),
          },
          visualAssets: {
            ...this.buildSourceRangeVisualAssets({
              pages,
              sourceFileId: sourceDoc.fileId,
              sourceObjectKey: sourceDoc.file.objectKey,
            }),
          },
          printedPageMappingSummary:
            this.buildSourceRangePrintedPageMappingSummary(pages),
        }),
      },
    });

    this.logger.log(
      `[LESSON_CHUNKING] Completed: ${chunks.length} chunks created for lesson=${lessonId}`,
    );

    // Auto-enqueue EMBEDDING job (docs/06-ai-rag-spec.md §10.1)
    if (chunks.length > 0) {
      await this.embeddingEnqueuer.enqueueEmbeddingJob({
        lessonId,
        lessonDocumentId,
      });
    }

    return {
      status: "SUCCEEDED",
      queue: record.queue,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      action,
      message: `Created ${chunks.length} chunks from pages ${pageRange.pageStart}-${pageRange.pageEnd}`,
      handledAt: new Date().toISOString(),
    };
  }

  private async handleDirectLessonDocumentOcr(
    record: WorkerJobRecord,
  ): Promise<BackgroundJobBullmqResult> {
    const inputMeta = asRecord(record.inputMeta);
    const action = getJobAction(record.inputMeta);
    const lessonId = readString(inputMeta, "lessonId") ?? record.lessonId;
    const lessonDocumentId =
      readString(inputMeta, "lessonDocumentId") ?? record.resourceId;

    if (!lessonId || !lessonDocumentId) {
      throw new UnrecoverableError(
        `Missing lessonId or lessonDocumentId for ${action ?? "direct lesson OCR"}`,
      );
    }

    const lessonDoc = await this.prisma.lessonDocument.findFirstOrThrow({
      where: {
        id: lessonDocumentId,
        lessonId,
        replacedAt: null,
      },
      select: {
        id: true,
        lessonId: true,
        fileId: true,
        kind: true,
        title: true,
        metadataJson: true,
        file: {
          select: {
            objectKey: true,
            originalName: true,
          },
        },
      },
    });

    await this.prisma.lessonDocument.update({
      where: { id: lessonDoc.id },
      data: {
        status: DocumentStatus.PROCESSING,
        extractError: null,
      },
    });

    const ocr = await this.processPdfWithPaidOcr({
      objectKey: lessonDoc.file.objectKey,
      originalName:
        lessonDoc.file.originalName ?? lessonDoc.title ?? "lesson-document.pdf",
      ownerId: lessonDoc.id,
      ownerType: "LESSON_DOCUMENT",
      ownerMetadata: lessonDoc.metadataJson,
      backgroundJobId: record.id,
      onProgress: async (progress) => {
        await this.prisma.backgroundJob.update({
          where: { id: record.id },
          data: { result: { progress } },
        });
      },
    });

    const imageSummary = await this.extractAndStoreImages({
      ocr,
      ownerId: lessonDoc.id,
    });

    const fullText = ocr.pages
      .map((page) => this.buildOcrPageTextBlock(page))
      .filter((text) => text.length > 0)
      .join("\n\n");

    if (fullText.trim().length === 0) {
      this.logger.warn(`No text content for lesson document ${lessonDoc.id}`);
    }

    const chunks = chunkText(fullText);

    this.logger.log(
      `Chunked ${fullText.length} chars into ${chunks.length} chunks for document=${lessonDoc.id}`,
    );

    await this.replaceDocumentChunks({
      lessonId,
      documentId: lessonDoc.id,
      chunks,
      metadata: {
        documentId: lessonDoc.id,
        sourceDocumentId: null,
        pageStart: 1,
        pageEnd: ocr.pageCount,
        textSource: PAID_OCR_TEXT_SOURCE,
        sourceFileId: lessonDoc.fileId,
        sourceObjectKey: lessonDoc.file.objectKey,
        lessonDocumentKind: lessonDoc.kind,
        qualityScore: averageNullable(
          ocr.pages.map((page) =>
            scorePageQualityWithConfidence(
              page.text,
              Buffer.from(JSON.stringify({ pages: ocr.pages })),
              page.pageNumber - 1,
            ),
          ),
        ),
        ocrArtifact: this.buildOcrMetadata(ocr),
        sourcePages: ocr.pages.map((page) => ({
          ...summarizeOcrPage(page),
          artifactRefs: this.buildPageArtifactRefs(ocr, page.pageNumber),
        })),
        printedPageMappingSummary: this.buildPrintedPageMappingSummary(ocr.pages),
        visualAssets: {
          providerImageCount: imageSummary.totalImages,
          pagesWithImages: imageSummary.pagesWithImages,
          imageManifestKey: imageSummary.imageManifestKey,
          imageManifestSummary: imageSummary.manifest?.summary ?? null,
          artifactAuditKey: imageSummary.artifactAuditKey,
          artifactAuditSummary: imageSummary.artifactAudit?.summary ?? null,
          artifactAuditStatus: imageSummary.artifactAudit?.status ?? null,
        },
      },
    });

    await this.markLessonExplanationsStale(lessonId);

    await this.prisma.lessonDocument.update({
      where: { id: lessonDoc.id },
      data: {
        status: chunks.length > 0 ? DocumentStatus.PROCESSING : DocumentStatus.READY,
        extractedText: fullText || null,
        extractError: null,
        chunkCount: chunks.length,
        processedAt: new Date(),
        contentHash: ocr.contentHash,
        embeddingProvider: null,
        embeddingModel: null,
        embeddingDimensions: null,
        metadataJson: this.toJson({
          ...asRecord(lessonDoc.metadataJson),
          ocr: this.buildOcrMetadata(ocr),
          pageCount: ocr.pageCount,
          printedPageMappingSummary: this.buildPrintedPageMappingSummary(ocr.pages),
          chunking: {
            chunkCount: chunks.length,
            contentHash: ocr.contentHash,
            pageStart: 1,
            pageEnd: ocr.pageCount,
            qualitySummary: this.buildQualitySummary(ocr.pages),
            printedPageMappingSummary: this.buildPrintedPageMappingSummary(ocr.pages),
          },
          visualAssets: {
            providerImageCount: imageSummary.totalImages,
            pagesWithImages: imageSummary.pagesWithImages,
            imageManifestKey: imageSummary.imageManifestKey,
            imageManifestSummary: imageSummary.manifest?.summary ?? null,
            artifactAuditKey: imageSummary.artifactAuditKey,
            artifactAuditSummary: imageSummary.artifactAudit?.summary ?? null,
            artifactAuditStatus: imageSummary.artifactAudit?.status ?? null,
            providerImagesByPage: imageSummary.byPage,
            pageImageFallback: {
              sourceFileId: lessonDoc.fileId,
              sourceObjectKey: lessonDoc.file.objectKey,
              renderOnDemand: true,
            },
          },
          pages: ocr.pages.map(summarizeOcrPage),
        }),
      },
    });

    this.logger.log(
      `[DIRECT_LESSON_OCR] Completed: ${chunks.length} chunks created for lesson=${lessonId}`,
    );

    // Auto-enqueue EMBEDDING job (docs/06-ai-rag-spec.md §10.1)
    if (chunks.length > 0) {
      await this.embeddingEnqueuer.enqueueEmbeddingJob({
        lessonId,
        lessonDocumentId: lessonDoc.id,
      });
    }

    return {
      status: "SUCCEEDED",
      queue: record.queue,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      action,
      message: `Processed lesson document ${lessonDoc.id} and created ${chunks.length} chunks`,
      handledAt: new Date().toISOString(),
    };
  }

  // ─── Image Extraction ──────────────────────────────────────────

  /**
   * Extract images from mmd.zip, upload to MinIO, and update page records
   * with image metadata (paths, bounding boxes).
   */
  private async extractAndStoreImages({
    ocr,
    ownerId,
    sourceDocumentId,
  }: {
    ocr: OcrProcessingResult;
    ownerId: string;
    sourceDocumentId?: string;
  }): Promise<StoredOcrImageSummary> {
    const emptySummary: StoredOcrImageSummary = {
      ownerId,
      totalImages: 0,
      pagesWithImages: [],
      byPage: {},
      imageManifestKey: null,
      artifactAuditKey: null,
      manifest: null,
      artifactAudit: null,
    };

    try {
      const images = await this.imageExtraction.extractImagesFromZip(ocr.mmdZip);

      const imageBasePath = `document-images/${ownerId}`;
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
      const imageManifest = buildOcrImageManifest({
        contentHash: ocr.contentHash,
        provider: ocr.provider,
        modelVersion: ocr.descriptor.modelVersion,
        optionsHash: ocr.descriptor.optionsHash,
        artifactBaseKey: ocr.descriptor.baseKey,
        artifactKeys: {
          mmdZip: ocr.artifactKeys.mmdZip,
          htmlZip: ocr.artifactKeys.htmlZip,
          linesJson: ocr.artifactKeys.linesJson,
          pagesJson: ocr.normalizedPagesKey,
          imageManifestJson: ocr.artifactKeys.imageManifestJson,
          artifactAuditJson: ocr.artifactKeys.artifactAuditJson,
        },
        pdfId: ocr.bundlePdfId,
        pageCount: ocr.pageCount,
        ownerId,
        linesJson: ocr.linesJson,
        pages: ocr.pages,
        images: uploadedImages,
      });
      const imageManifestKey = await this.artifactCache.saveImageManifest(
        ocr.descriptor,
        imageManifest,
      );
      const artifactAudit = buildOcrArtifactAudit({
        contentHash: ocr.contentHash,
        provider: ocr.provider,
        modelVersion: ocr.descriptor.modelVersion,
        optionsHash: ocr.descriptor.optionsHash,
        artifactBaseKey: ocr.descriptor.baseKey,
        artifactKeys: {
          ...ocr.artifactKeys,
          pagesJson: ocr.normalizedPagesKey,
          imageManifestJson: imageManifestKey,
        },
        expectedPageCount: ocr.pageCount,
        pages: ocr.pages,
        imageManifest,
      });
      const artifactAuditKey = await this.artifactCache.saveArtifactAudit(
        ocr.descriptor,
        artifactAudit,
      );
      const uploadedByPage = groupStoredImagesByPage(imageManifest.images);

      if (images.length === 0) {
        this.logger.log(`No images found in mmd.zip for ${ownerId}`);
      }

      this.logger.log(`Uploaded ${uploadedImages.length} images to MinIO for ${ownerId}`);

      if (sourceDocumentId) {
        await this.attachImageManifestToSourcePages({
          sourceDocumentId,
          pageCount: ocr.pageCount,
          imageManifestKey,
          artifactAuditKey,
          imagesByPage: uploadedByPage,
        });
      }

      this.logger.log(`Image manifest saved for ${ownerId}: ${imageManifestKey}`);

      return {
        ownerId,
        totalImages: imageManifest.summary.totalImages,
        pagesWithImages: imageManifest.summary.pagesWithImages,
        byPage: uploadedByPage,
        imageManifestKey,
        artifactAuditKey,
        manifest: imageManifest,
        artifactAudit,
      };
    } catch (err) {
      this.logger.error(
        `Image extraction failed for ${ownerId}, continuing without images: ${err}`,
      );
      try {
        const failedManifest = buildOcrImageManifest({
          contentHash: ocr.contentHash,
          provider: ocr.provider,
          modelVersion: ocr.descriptor.modelVersion,
          optionsHash: ocr.descriptor.optionsHash,
          artifactBaseKey: ocr.descriptor.baseKey,
          artifactKeys: {
            mmdZip: ocr.artifactKeys.mmdZip,
            htmlZip: ocr.artifactKeys.htmlZip,
            linesJson: ocr.artifactKeys.linesJson,
            pagesJson: ocr.normalizedPagesKey,
            imageManifestJson: ocr.artifactKeys.imageManifestJson,
            artifactAuditJson: ocr.artifactKeys.artifactAuditJson,
          },
          pdfId: ocr.bundlePdfId,
          pageCount: ocr.pageCount,
          ownerId,
          linesJson: ocr.linesJson,
          pages: ocr.pages,
          images: [],
          extractionStatus: "failed",
          extractionError: err instanceof Error ? err.message : String(err),
        });
        const imageManifestKey = await this.artifactCache.saveImageManifest(
          ocr.descriptor,
          failedManifest,
        );
        const artifactAudit = buildOcrArtifactAudit({
          contentHash: ocr.contentHash,
          provider: ocr.provider,
          modelVersion: ocr.descriptor.modelVersion,
          optionsHash: ocr.descriptor.optionsHash,
          artifactBaseKey: ocr.descriptor.baseKey,
          artifactKeys: {
            ...ocr.artifactKeys,
            pagesJson: ocr.normalizedPagesKey,
            imageManifestJson: imageManifestKey,
          },
          expectedPageCount: ocr.pageCount,
          pages: ocr.pages,
          imageManifest: failedManifest,
        });
        const artifactAuditKey = await this.artifactCache.saveArtifactAudit(
          ocr.descriptor,
          artifactAudit,
        );
        if (sourceDocumentId) {
          await this.attachImageManifestToSourcePages({
            sourceDocumentId,
            pageCount: ocr.pageCount,
            imageManifestKey,
            artifactAuditKey,
            imagesByPage: {},
          });
        }

        return {
          ...emptySummary,
          imageManifestKey,
          artifactAuditKey,
          manifest: failedManifest,
          artifactAudit,
        };
      } catch (manifestErr) {
        this.logger.error(`Image manifest save failed for ${ownerId}: ${manifestErr}`);
        return emptySummary;
      }
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────

  private async attachImageManifestToSourcePages({
    sourceDocumentId,
    pageCount,
    imageManifestKey,
    artifactAuditKey,
    imagesByPage,
  }: {
    sourceDocumentId: string;
    pageCount: number;
    imageManifestKey: string;
    artifactAuditKey: string;
    imagesByPage: Record<number, StoredOcrImage[]>;
  }) {
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const imageEntries = imagesByPage[pageNumber] ?? [];
      const existing = await this.prisma.sourceDocumentPage.findUnique({
        where: {
          sourceDocumentId_pageNumber: {
            sourceDocumentId,
            pageNumber,
          },
        },
        select: { metadataJson: true },
      });

      const currentMeta = asRecord(existing?.metadataJson);
      const currentVisual = asRecord(currentMeta.visual);

      await this.prisma.sourceDocumentPage.update({
        where: {
          sourceDocumentId_pageNumber: {
            sourceDocumentId,
            pageNumber,
          },
        },
        data: {
          metadataJson: this.toJson({
            ...currentMeta,
            visual: {
              ...currentVisual,
              imageManifestKey,
              artifactAuditKey,
              providerImages: imageEntries,
              providerImageCount: imageEntries.length,
            },
            images: imageEntries,
            imageCount: imageEntries.length,
          }),
        },
      });
    }
  }

  private async processPdfWithPaidOcr({
    objectKey,
    originalName,
    ownerId,
    ownerType,
    ownerMetadata,
    backgroundJobId,
    sourceDocumentId,
    onProgress,
  }: {
    objectKey: string;
    originalName: string;
    ownerId: string;
    ownerType: "SOURCE_DOCUMENT" | "LESSON_DOCUMENT";
    ownerMetadata: Prisma.JsonValue | null;
    backgroundJobId: string;
    sourceDocumentId?: string;
    onProgress?: (progress: number) => Promise<void>;
  }): Promise<OcrProcessingResult> {
    this.logger.log(`Downloading PDF from storage: ${objectKey}`);
    const pdfBuffer = await this.storage.downloadObject(objectKey);
    const pageCount = await this.pdfMetadata.getPageCount(pdfBuffer);
    const contentHash = this.pdfMetadata.computeContentHash(pdfBuffer);
    const provider = this.configService.get("OCR_PROVIDER", { infer: true });
    const ocrEnabled = this.configService.get("OCR_PAID_ENABLED", {
      infer: true,
    });
    const descriptor = this.artifactCache.createDescriptor(contentHash, provider);
    const artifactKeys = this.artifactCache.buildArtifactKeys(descriptor);

    this.logger.log(
      `PDF metadata: ${pageCount} pages, hash=${contentHash.substring(0, 12)}..., artifact=${descriptor.optionsHash}`,
    );

    const cacheHit = await this.artifactCache.hasArtifact(descriptor);
    let bundle: OcrArtifactBundle;
    let manifest: OcrArtifactCacheManifest;

    const catalogItem = this.providerUsage
      ? await this.prisma.providerCatalogItem.findFirst({
          where: {
            category: ProviderCatalogCategory.OCR_SERVICE,
            provider: { equals: provider, mode: "insensitive" },
          },
          select: { id: true },
        })
      : null;
    const activePrice =
      catalogItem && this.providerUsage
        ? await this.providerUsage.getActiveRates(catalogItem.id)
        : { priceVersionId: null, rates: [] };

    if (cacheHit) {
      this.logger.log("Loading OCR artifacts from cache...");
      if (onProgress) {
        await onProgress(100);
      }
      const cached = await this.artifactCache.loadBundle(descriptor);
      bundle = cached;
      manifest = cached.manifest;
      if (this.providerUsage) {
        const event = await this.providerUsage.start({
          category: ProviderCatalogCategory.OCR_SERVICE,
          provider: provider.toUpperCase(),
          catalogItemId: catalogItem?.id,
          priceVersionId: activePrice.priceVersionId,
          backgroundJobId,
          sourceDocumentId,
          cacheStatus: "HIT",
        });
        await this.providerUsage.succeed(event.id, {
          pages: pageCount,
          requestCount: 0,
          rates: activePrice.rates,
          savedCost: true,
        });
      }
    } else if (ocrEnabled) {
      this.logger.log("Cache miss — submitting to Mathpix or resuming its pdf_id...");
      const startTime = Date.now();
      const runtime = asRecord(asRecord(ownerMetadata).ocrRuntime);
      const canResume =
        readString(runtime, "contentHash") === contentHash &&
        Boolean(readString(runtime, "pdfId"));
      let pdfId = canResume ? readString(runtime, "pdfId")! : "";
      let usageEventId = canResume ? readString(runtime, "usageEventId") : null;
      if (this.providerUsage) {
        const supportedMetrics = activePrice.rates
          .map((rate) => rate.metric)
          .filter(
            (metric) =>
              metric === ProviderUsageMetric.PAGE ||
              metric === ProviderUsageMetric.REQUEST,
          );
        const reservation = {
          idempotencyKey: `ocr:${backgroundJobId}:${contentHash}`,
          usageUpperBound: { pages: pageCount, requestCount: 1 },
          rates: activePrice.rates,
          requiredMetrics: [...new Set(supportedMetrics)],
          estimateUnavailableReason:
            supportedMetrics.length === 0
              ? "Chưa có đơn giá đọc tài liệu nên yêu cầu đã được dừng để bảo vệ ngân sách."
              : undefined,
        };
        const usageEvent = usageEventId
          ? await this.providerUsage.ensureReservation(usageEventId, reservation)
          : await this.providerUsage.reserveAndStart(
              {
                category: ProviderCatalogCategory.OCR_SERVICE,
                provider: provider.toUpperCase(),
                catalogItemId: catalogItem?.id,
                priceVersionId: activePrice.priceVersionId,
                backgroundJobId,
                sourceDocumentId,
                cacheStatus: "MISS",
              },
              reservation,
            );
        usageEventId = usageEvent.id;
      }

      try {
        if (!pdfId) {
          pdfId = (await this.mathpixOcr.submitPdf(pdfBuffer, originalName)).pdfId;
          await this.persistOcrRuntime(ownerType, ownerId, ownerMetadata, {
            pdfId,
            usageEventId,
            contentHash,
            status: "SUBMITTED",
            submittedAt: new Date().toISOString(),
          });
        }
        const { numPages } = await this.mathpixOcr.pollUntilComplete(
          pdfId,
          15 * 60 * 1000,
          onProgress,
        );
        bundle = await this.mathpixOcr.downloadAllArtifacts(
          pdfId,
          numPages || pageCount,
          startTime,
        );
        manifest = await this.artifactCache.saveBundle(descriptor, bundle);
        if (usageEventId && this.providerUsage) {
          await this.providerUsage.succeed(usageEventId, {
            pages: numPages || pageCount,
            requestCount: 1,
            rates: activePrice.rates,
            latencyMs: Date.now() - startTime,
            providerRequestId: pdfId,
            rawUsage: { pages: numPages || pageCount },
          });
        }
        await this.persistOcrRuntime(ownerType, ownerId, ownerMetadata, {
          pdfId,
          usageEventId,
          contentHash,
          status: "COMPLETED",
          completedAt: new Date().toISOString(),
        });
      } catch (error) {
        if (usageEventId && this.providerUsage) {
          await this.providerUsage.fail(usageEventId, error);
        }
        throw error;
      }
    } else {
      throw new UnrecoverableError(
        "Paid OCR is disabled (OCR_PAID_ENABLED=false) and no cached artifacts found. " +
          "Enable paid OCR or provide cached artifacts to process this document.",
      );
    }

    const pages = normalizeOcrPages(bundle, pageCount);

    const publicBaseUrl = this.configService.get("FILE_PUBLIC_BASE_URL", {
      infer: true,
    });
    if (publicBaseUrl && ownerId) {
      const baseUrl = publicBaseUrl.replace(/\/$/, "");
      for (const page of pages) {
        const replaceUrls = (text: string) => {
          return text.replace(
            /https:\/\/cdn\.mathpix\.com\/cropped\/([a-zA-Z0-9-]+)-(\d+)\.jpg\?height=(\d+)&width=(\d+)&top_left_y=(\d+)&top_left_x=(\d+)/g,
            (match, pdfId, pageNumStr, height, width, y, x) => {
              const pageNum = parseInt(pageNumStr, 10);
              const paddedPage = String(pageNum).padStart(3, "0");
              const filename = `${pdfId}-${pageNumStr}_${height}_${width}_${y}_${x}.jpg`;
              return `${baseUrl}/document-images/${ownerId}/page-${paddedPage}/${filename}`;
            },
          );
        };
        if (page.text) page.text = replaceUrls(page.text);
        if (page.mathpixMarkdown) {
          page.mathpixMarkdown = replaceUrls(page.mathpixMarkdown);
        }
      }
    }

    const normalizedPagesKey = await this.artifactCache.saveNormalizedPages(
      descriptor,
      pages.map((page) => ({
        ...summarizeOcrPage(page),
        text: page.text,
        mathpixMarkdown: page.mathpixMarkdown,
        markdown: page.markdown,
        lines: page.lines,
      })),
    );

    return {
      pageCount,
      contentHash,
      pages,
      provider,
      cacheHit,
      descriptor,
      manifest,
      artifactKeys,
      normalizedPagesKey,
      bundlePdfId: bundle.pdfId,
      processingTimeMs: bundle.processingTimeMs,
      mmdZip: bundle.mmdZip,
      linesJson: bundle.linesJson,
    };
  }

  private async persistOcrRuntime(
    ownerType: "SOURCE_DOCUMENT" | "LESSON_DOCUMENT",
    ownerId: string,
    ownerMetadata: Prisma.JsonValue | null,
    runtime: Record<string, unknown>,
  ) {
    const metadataJson = this.toJson({
      ...asRecord(ownerMetadata),
      ocrRuntime: runtime,
    });
    if (ownerType === "SOURCE_DOCUMENT") {
      await this.prisma.sourceDocument.update({
        where: { id: ownerId },
        data: { metadataJson },
      });
      return;
    }
    await this.prisma.lessonDocument.update({
      where: { id: ownerId },
      data: { metadataJson },
    });
  }

  private buildOcrMetadata(ocr: OcrProcessingResult) {
    return {
      textSource: PAID_OCR_TEXT_SOURCE,
      provider: ocr.provider,
      modelVersion: ocr.descriptor.modelVersion,
      languageHints: ocr.descriptor.languageHints,
      optionsHash: ocr.descriptor.optionsHash,
      options: ocr.descriptor.options,
      outputFormats: ocr.descriptor.outputFormats,
      cacheHit: ocr.cacheHit,
      contentHash: ocr.contentHash,
      pdfId: ocr.bundlePdfId,
      pageCount: ocr.pageCount,
      processingTimeMs: ocr.processingTimeMs,
      artifactBaseKey: ocr.descriptor.baseKey,
      artifactKeys: ocr.artifactKeys,
      manifestKey: ocr.manifest.artifactKeys.manifestJson,
      normalizedPagesKey: ocr.normalizedPagesKey,
      imageManifestKey: ocr.artifactKeys.imageManifestJson,
      artifactAuditKey: ocr.artifactKeys.artifactAuditJson,
    };
  }

  private buildPageArtifactRefs(ocr: OcrProcessingResult, pageNumber: number) {
    return {
      pageNumber,
      textSource: PAID_OCR_TEXT_SOURCE,
      artifactBaseKey: ocr.descriptor.baseKey,
      mmd: ocr.artifactKeys.mmd,
      md: ocr.artifactKeys.md,
      mmdZip: ocr.artifactKeys.mmdZip,
      linesJson: ocr.artifactKeys.linesJson,
      htmlZip: ocr.artifactKeys.htmlZip,
      pagesJson: ocr.normalizedPagesKey,
      imageManifestJson: ocr.artifactKeys.imageManifestJson,
      artifactAuditJson: ocr.artifactKeys.artifactAuditJson,
      manifestJson: ocr.artifactKeys.manifestJson,
      layoutRef: {
        artifactKey: ocr.artifactKeys.linesJson,
        pageIndex: pageNumber - 1,
        pageNumber,
      },
    };
  }

  private buildPageVisualFallback({
    sourceFileId,
    sourceObjectKey,
    pageNumber,
  }: {
    sourceFileId: string;
    sourceObjectKey: string;
    pageNumber: number;
  }) {
    return {
      providerImages: [],
      providerImageCount: 0,
      pageImageFallback: {
        sourceFileId,
        sourceObjectKey,
        pageNumber,
        renderOnDemand: true,
      },
    };
  }

  private buildSourcePageTextHeading(
    pageNumber: number,
    metadataJson: Prisma.JsonValue | null,
  ): string {
    return this.formatPageTextHeading(
      pageNumber,
      this.readSourcePagePrintedPage(pageNumber, metadataJson),
    );
  }

  private buildOcrPageTextBlock(page: NormalizedOcrPage): string {
    const text = page.text.trim();
    if (text.length === 0) {
      return "";
    }

    return `${this.formatPageTextHeading(page.pageNumber, page.printedPage)}\n${text}`;
  }

  private formatPageTextHeading(
    pdfPageNumber: number,
    printedPage: PrintedPageReference,
  ): string {
    if (printedPage.printedPageLabel) {
      return `Trang sách ${printedPage.printedPageLabel} (PDF page ${pdfPageNumber})`;
    }

    return `PDF page ${pdfPageNumber}`;
  }

  private buildPrintedPageMappingSummary(pages: NormalizedOcrPage[]) {
    return this.summarizePrintedPageReferences(pages.map((page) => page.printedPage));
  }

  private buildSourceRangePrintedPageMappingSummary(
    pages: Array<{ pageNumber: number; metadataJson: Prisma.JsonValue | null }>,
  ) {
    return this.summarizePrintedPageReferences(
      pages.map((page) =>
        this.readSourcePagePrintedPage(page.pageNumber, page.metadataJson),
      ),
    );
  }

  private readSourcePagePrintedPage(
    pageNumber: number,
    metadataJson: Prisma.JsonValue | null,
  ): PrintedPageReference {
    const metadata = asRecord(metadataJson);
    const pageMetadata = readNestedRecord(metadata, "page");
    const printedPage =
      readNestedRecord(metadata, "printedPage") ??
      (pageMetadata ? readNestedRecord(pageMetadata, "printedPage") : null);

    return this.normalizePrintedPageReference(pageNumber, printedPage);
  }

  private normalizePrintedPageReference(
    pageNumber: number,
    value: Record<string, unknown> | null,
  ): PrintedPageReference {
    if (!value) {
      return {
        pdfPageNumber: pageNumber,
        printedPageNumber: null,
        printedPageLabel: null,
        source: "unknown",
        confidence: null,
        evidenceLineIds: [],
        evidenceText: null,
        warning: "missing",
      };
    }

    const source = readString(value, "source");
    const warning = readString(value, "warning");

    return {
      pdfPageNumber: readJsonNumber(value, "pdfPageNumber") ?? pageNumber,
      printedPageNumber: readJsonNumber(value, "printedPageNumber"),
      printedPageLabel: readString(value, "printedPageLabel"),
      source:
        source === "ocr_inferred" ||
        source === "offset_rule" ||
        source === "admin_verified"
          ? source
          : "unknown",
      confidence: readJsonNumber(value, "confidence"),
      evidenceLineIds: readArray(value, "evidenceLineIds").filter(
        (item): item is string => typeof item === "string" && item.length > 0,
      ),
      evidenceText: readString(value, "evidenceText"),
      warning: warning === "missing" || warning === "ambiguous" ? warning : null,
    };
  }

  private summarizePrintedPageReferences(references: PrintedPageReference[]) {
    const known = references.filter(
      (page) => page.printedPageNumber !== null || page.printedPageLabel !== null,
    );

    return {
      pageCount: references.length,
      knownCount: known.length,
      unknownCount: references.length - known.length,
      inferredCount: references.filter((page) => page.source === "ocr_inferred").length,
      offsetRuleCount: references.filter((page) => page.source === "offset_rule").length,
      adminVerifiedCount: references.filter((page) => page.source === "admin_verified")
        .length,
      missingCount: references.filter((page) => page.warning === "missing").length,
      ambiguousCount: references.filter((page) => page.warning === "ambiguous").length,
      pages: references.map((page) => ({
        pdfPageNumber: page.pdfPageNumber,
        printedPageNumber: page.printedPageNumber,
        printedPageLabel: page.printedPageLabel,
        source: page.source,
        confidence: page.confidence,
        evidenceLineIds: page.evidenceLineIds,
        evidenceText: page.evidenceText,
        warning: page.warning,
      })),
    };
  }

  private buildQualitySummary(pages: NormalizedOcrPage[]) {
    const confidences = pages
      .map((page) => page.confidence)
      .filter((value): value is number => value !== null);
    const lowQualityPages = pages
      .filter((page) => page.qualityFlags.length > 0)
      .map((page) => ({
        pageNumber: page.pageNumber,
        flags: page.qualityFlags,
      }));

    return {
      pageCount: pages.length,
      averageConfidence: averageNullable(confidences),
      lowQualityPages,
    };
  }

  private buildSourceRangeVisualAssets({
    pages,
    sourceFileId,
    sourceObjectKey,
  }: {
    pages: Array<{ pageNumber: number; metadataJson: Prisma.JsonValue | null }>;
    sourceFileId: string;
    sourceObjectKey: string;
  }) {
    const providerImagesByPage: Record<number, unknown[]> = {};
    const imageManifestKeys = new Set<string>();
    const artifactAuditKeys = new Set<string>();

    for (const page of pages) {
      const visual = readNestedRecord(page.metadataJson, "visual");
      const images = readArray(visual, "providerImages");

      if (images.length > 0) {
        providerImagesByPage[page.pageNumber] = images;
      }

      const imageManifestKey = visual ? readString(visual, "imageManifestKey") : null;
      if (imageManifestKey) {
        imageManifestKeys.add(imageManifestKey);
      }

      const artifactAuditKey = visual ? readString(visual, "artifactAuditKey") : null;
      if (artifactAuditKey) {
        artifactAuditKeys.add(artifactAuditKey);
      }
    }

    const pagesWithImages = Object.keys(providerImagesByPage).map((pageNumber) =>
      Number(pageNumber),
    );

    return {
      providerImageCount: Object.values(providerImagesByPage).reduce(
        (sum, images) => sum + images.length,
        0,
      ),
      pagesWithImages,
      providerImagesByPage,
      imageManifestKeys: [...imageManifestKeys],
      artifactAuditKeys: [...artifactAuditKeys],
      pageImageFallback: {
        sourceFileId,
        sourceObjectKey,
        renderOnDemand: true,
      },
    };
  }

  private async replaceDocumentChunks({
    lessonId,
    documentId,
    chunks,
    metadata,
  }: {
    lessonId: string;
    documentId: string;
    chunks: ReturnType<typeof chunkText>;
    metadata: Record<string, unknown>;
  }) {
    await this.prisma.documentChunk.deleteMany({
      where: { documentId },
    });

    if (chunks.length === 0) {
      return;
    }

    await this.prisma.documentChunk.createMany({
      data: chunks.map((chunk) => ({
        documentId,
        lessonId,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        contentHash: chunk.contentHash,
        tokenCount: chunk.tokenCount,
        metadataJson: this.toJson({
          ...metadata,
          chunkIndex: chunk.chunkIndex,
          chunkContentHash: chunk.contentHash,
          tokenCount: chunk.tokenCount,
          embeddingStatus: "pending",
        }),
      })),
    });
  }

  private markLessonExplanationsStale(lessonId: string) {
    return this.prisma.aiExplanation.updateMany({
      where: {
        lessonId,
        staleAt: null,
      },
      data: {
        staleAt: new Date(),
      },
    });
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  /**
   * Create source_document_pages records for each page.
   */
  private async createPageRecords(sourceDocId: string, pageCount: number): Promise<void> {
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

  private buildFoundationResult(record: WorkerJobRecord): BackgroundJobBullmqResult {
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

  private buildSkippedResult(record: WorkerJobRecord): BackgroundJobBullmqResult {
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
    record: WorkerJobRecord,
    error: unknown,
    attempt: number,
    maxAttempts: number,
  ) {
    const hasRetryLeft = attempt < maxAttempts;
    const message = getJobErrorMessage(error);

    await this.prisma.backgroundJob.update({
      where: {
        id: record.id,
      },
      data: {
        status: hasRetryLeft ? BackgroundJobStatus.QUEUED : BackgroundJobStatus.FAILED,
        attempts: attempt,
        errorMessage: message,
        finishedAt: hasRetryLeft ? null : new Date(),
      },
    });

    if (!hasRetryLeft) {
      await this.markDocumentResourceFailed(record, message);
    }
  }

  private async markDocumentResourceFailed(record: WorkerJobRecord, message: string) {
    const action = getJobAction(record.inputMeta);
    const inputMeta = asRecord(record.inputMeta);
    const failedAt = new Date().toISOString();

    if (record.resourceType === "SOURCE_DOCUMENT" && record.resourceId) {
      const existing = await this.prisma.sourceDocument.findUnique({
        where: { id: record.resourceId },
        select: { metadataJson: true },
      });

      await this.prisma.sourceDocument.update({
        where: { id: record.resourceId },
        data: {
          status: DocumentStatus.FAILED,
          metadataJson: this.toJson({
            ...asRecord(existing?.metadataJson),
            failure: {
              action,
              message,
              failedAt,
            },
          }),
        },
      });

      await this.prisma.sourceDocumentPage.updateMany({
        where: {
          sourceDocumentId: record.resourceId,
          status: {
            not: DocumentStatus.READY,
          },
        },
        data: {
          status: DocumentStatus.FAILED,
          extractError: message,
        },
      });
      return;
    }

    const lessonDocumentId =
      readString(inputMeta, "lessonDocumentId") ??
      (record.resourceType === "LESSON_DOCUMENT" ? record.resourceId : null);

    if (!lessonDocumentId) {
      return;
    }

    const existing = await this.prisma.lessonDocument.findUnique({
      where: { id: lessonDocumentId },
      select: { metadataJson: true },
    });

    await this.prisma.lessonDocument.update({
      where: { id: lessonDocumentId },
      data: {
        status: DocumentStatus.FAILED,
        extractError: message,
        metadataJson: this.toJson({
          ...asRecord(existing?.metadataJson),
          failure: {
            action,
            message,
            failedAt,
          },
        }),
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
  const action = asRecord(inputMeta).action;
  return typeof action === "string" ? action : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function readString(value: Record<string, unknown>, key: string): string | null {
  const raw = value[key];
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

function readJsonNumber(value: Record<string, unknown>, key: string): number | null {
  const raw = value[key];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

function readNestedRecord(value: unknown, key: string): Record<string, unknown> | null {
  const nested = asRecord(value)[key];
  if (!nested || typeof nested !== "object" || Array.isArray(nested)) {
    return null;
  }

  return nested as Record<string, unknown>;
}

function readArray(value: Record<string, unknown> | null, key: string): unknown[] {
  const raw = value?.[key];
  return Array.isArray(raw) ? raw : [];
}

function groupStoredImagesByPage(
  images: OcrImageManifestImage[],
): Record<number, StoredOcrImage[]> {
  const byPage: Record<number, StoredOcrImage[]> = {};

  for (const image of images) {
    const pageImages = byPage[image.pageNumber] ?? [];
    pageImages.push({
      pageNumber: image.pageNumber,
      printedPage: image.printedPage,
      objectKey: image.objectKey,
      filename: image.filename,
      boundingBox: image.boundingBox,
      normalizedBoundingBox: image.normalizedBoundingBox,
      pageDimensions: image.pageDimensions,
      orderInPage: image.orderInPage,
      imageId: image.imageId,
      nearbyLineIds: image.nearbyLineIds,
      nearbyText: image.nearbyText,
      captionCandidate: image.captionCandidate,
      kind: image.kind,
      kindSource: image.kindSource,
      qualityFlags: image.qualityFlags,
      isUsableForAi: image.isUsableForAi,
      size: image.size,
      mimeType: image.mimeType,
    });
    byPage[image.pageNumber] = pageImages;
  }

  return byPage;
}

function averageNullable(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => typeof value === "number");
  if (valid.length === 0) {
    return null;
  }

  const average = valid.reduce((sum, value) => sum + value, 0) / valid.length;
  return Math.round(average * 100) / 100;
}

function resolveTextSource(values: Array<string | null>): string {
  const unique = new Set(values.filter((value): value is string => Boolean(value)));

  if (unique.size === 0) {
    return PAID_OCR_TEXT_SOURCE;
  }

  if (unique.size === 1) {
    return [...unique][0]!;
  }

  return "mixed";
}
