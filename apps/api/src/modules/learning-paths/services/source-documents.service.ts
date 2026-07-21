import { Inject, Injectable, Logger } from "@nestjs/common";
import * as yauzl from "yauzl";
import type { Entry as YauzlEntry } from "yauzl";
import {
  BackgroundJobQueue,
  BackgroundJobStatus,
  DocumentStatus,
  FilePurpose,
  FileStatus,
  LessonDocumentKind,
  Prisma,
} from "@prisma/client";
import {
  throwBadRequest,
  throwConflict,
  throwNotFound,
} from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { ConfigService } from "@nestjs/config";
import { BackgroundJobQueueService } from "#api/modules/jobs/services/background-job-queue.service";
import { ObjectStorageService } from "#api/modules/files/services/object-storage.service";
import { OcrArtifactCacheService } from "#api/workers/services/ocr-artifact-cache.service";
import { CreateSourceDocumentDto } from "#api/modules/learning-paths/dto/create-source-document.dto";
import { UpdateLessonPageRangesDto } from "#api/modules/learning-paths/dto/update-lesson-page-ranges.dto";
import { ConfirmPrintedPageDto } from "#api/modules/learning-paths/dto/confirm-printed-page.dto";
import {
  lessonDocumentPageRangeSelect,
  lessonDocumentSelect,
  sourceDocumentPageSelect,
  sourceDocumentSelect,
} from "#api/modules/learning-paths/selectors/document.selects";
import {
  serializeLessonDocument,
  serializeLessonDocumentPageRange,
  serializeSourceDocument,
  serializeSourceDocumentPage,
} from "#api/modules/learning-paths/serializers/document.serializers";
import type {
  LessonDocumentRecord,
  PageRangeSaveResponse,
} from "#api/modules/learning-paths/types/document.types";
import type { RequestContext } from "#api/modules/learning-paths/types/lesson.types";
import {
  assertNoDuplicateLessonRanges,
  assertPageRangeOrder,
  assertSourceDocumentReadyForPageRanges,
  buildPageRangeWarnings,
  handleDocumentPrismaError,
  normalizeOptionalTitle,
  throwDocumentFileNotFound,
  throwSourceDocumentNotFound,
  toDocumentInputJson,
} from "#api/modules/learning-paths/utils/document.helpers";

@Injectable()
export class SourceDocumentsService {
  private readonly logger = new Logger(SourceDocumentsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(BackgroundJobQueueService)
    private readonly backgroundJobQueue: BackgroundJobQueueService,
    @Inject(ObjectStorageService)
    private readonly storage: ObjectStorageService,
    @Inject(OcrArtifactCacheService)
    private readonly cacheService: OcrArtifactCacheService,
    @Inject(ConfigService)
    private readonly configService: ConfigService,
  ) {}

  async createForLearningPath(
    learningPathId: string,
    actorUserId: string,
    dto: CreateSourceDocumentDto,
    context: RequestContext = {},
  ) {
    try {
      const sourceDocument = await this.prisma.$transaction(async (tx) => {
        await this.assertLearningPathExists(tx, learningPathId);
        const file = await this.getLessonDocumentFile(tx, dto.fileId);

        const created = await tx.sourceDocument.create({
          data: {
            learningPathId,
            fileId: file.id,
            title: normalizeOptionalTitle(dto.title),
            status: DocumentStatus.PROCESSING,
            contentHash: file.checksum,
            metadataJson: toDocumentInputJson({
              uploadSource: "api.admin.source_documents.create",
            }),
          },
          select: sourceDocumentSelect,
        });

        const job = await this.createDocumentJob(tx, {
          ownerUserId: actorUserId,
          resourceType: "SOURCE_DOCUMENT",
          resourceId: created.id,
          inputMeta: {
            action: "SOURCE_PAGE_EXTRACTION",
            sourceDocumentId: created.id,
            learningPathId,
            fileId: file.id,
          },
        });

        const withJob = await tx.sourceDocument.update({
          where: { id: created.id },
          data: {
            processingJobId: job.id,
          },
          select: sourceDocumentSelect,
        });

        await tx.auditLog.create({
          data: {
            actorUserId,
            action: "SOURCE_DOCUMENT_CREATED",
            entityType: "SourceDocument",
            entityId: withJob.id,
            after: toDocumentInputJson(serializeSourceDocument(withJob)),
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
          },
        });

        return withJob;
      });

      await this.enqueueProcessingJobs([sourceDocument.processingJobId]);

      return serializeSourceDocument(sourceDocument);
    } catch (error) {
      handleDocumentPrismaError(error);
    }
  }

  async listForLearningPath(learningPathId: string) {
    await this.assertLearningPathExists(this.prisma, learningPathId);

    const documents = await this.prisma.sourceDocument.findMany({
      where: {
        learningPathId,
        deletedAt: null,
      },
      select: sourceDocumentSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    return documents.map(serializeSourceDocument);
  }

  async requestProcessing(
    sourceDocumentId: string,
    actorUserId: string,
    context: RequestContext = {},
  ) {
    try {
      const sourceDocument = await this.prisma.$transaction(async (tx) => {
        const current = await this.findActiveSourceDocument(sourceDocumentId, tx);

        if (
          current.processingJob?.status === BackgroundJobStatus.QUEUED ||
          current.processingJob?.status === BackgroundJobStatus.RUNNING
        ) {
          throwConflict("CONFLICT", "Tài liệu nguồn đang được xử lý");
        }

        const job = await this.createDocumentJob(tx, {
          ownerUserId: actorUserId,
          resourceType: "SOURCE_DOCUMENT",
          resourceId: current.id,
          inputMeta: {
            action: "SOURCE_PAGE_EXTRACTION",
            sourceDocumentId: current.id,
            learningPathId: current.learningPathId,
            fileId: current.fileId,
            requestedFrom: "api.admin.source_documents.process",
          },
        });

        const updated = await tx.sourceDocument.update({
          where: { id: current.id },
          data: {
            status: DocumentStatus.PROCESSING,
            processingJobId: job.id,
            processedAt: null,
            metadataJson: mergeDocumentMetadata(current.metadataJson, {
              processingRequestedAt: new Date().toISOString(),
              processingRequestSource: "api.admin.source_documents.process",
            }),
          },
          select: sourceDocumentSelect,
        });

        await tx.auditLog.create({
          data: {
            actorUserId,
            action: "SOURCE_DOCUMENT_PROCESSING_REQUESTED",
            entityType: "SourceDocument",
            entityId: updated.id,
            before: toDocumentInputJson(serializeSourceDocument(current)),
            after: toDocumentInputJson(serializeSourceDocument(updated)),
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
          },
        });

        return updated;
      });

      await this.enqueueProcessingJobs([sourceDocument.processingJobId]);

      return serializeSourceDocument(sourceDocument);
    } catch (error) {
      handleDocumentPrismaError(error);
    }
  }

  async deleteSourceDocument(
    sourceDocumentId: string,
    actorUserId: string,
    context: RequestContext = {},
  ) {
    try {
      let contentHashToClear: string | null = null;

      await this.prisma.$transaction(async (tx) => {
        const sourceDocument = await tx.sourceDocument.findFirst({
          where: {
            id: sourceDocumentId,
            deletedAt: null,
            learningPath: {
              deletedAt: null,
            },
          },
          select: sourceDocumentSelect,
        });

        if (!sourceDocument) {
          throwSourceDocumentNotFound();
        }

        const activeUsageCount = await tx.lessonDocument.count({
          where: {
            sourceDocumentId,
            replacedAt: null,
          },
        });
        const pageRangeCount = await tx.lessonDocumentPageRange.count({
          where: {
            sourceDocumentId,
          },
        });

        if (activeUsageCount > 0 || pageRangeCount > 0) {
          throwConflict(
            "CONFLICT",
            "Không thể xóa tài liệu nguồn đang được gán vào buổi học",
          );
        }

        const deleted = await tx.sourceDocument.update({
          where: { id: sourceDocument.id },
          data: {
            deletedAt: new Date(),
          },
          select: sourceDocumentSelect,
        });

        await tx.auditLog.create({
          data: {
            actorUserId,
            action: "SOURCE_DOCUMENT_DELETED",
            entityType: "SourceDocument",
            entityId: deleted.id,
            before: toDocumentInputJson(serializeSourceDocument(sourceDocument)),
            after: toDocumentInputJson(serializeSourceDocument(deleted)),
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
          },
        });

        contentHashToClear = sourceDocument.contentHash;
      });

      if (contentHashToClear) {
        const provider = this.configService.get("OCR_PROVIDER", { infer: true }) ?? "mathpix";
        const descriptor = this.cacheService.createDescriptor(contentHashToClear, provider);
        await this.cacheService.invalidateCache(descriptor).catch((err) => {
          this.logger.warn(`Failed to invalidate cache for ${contentHashToClear}: ${err.message}`);
        });
      }

      return { success: true };
    } catch (error) {
      handleDocumentPrismaError(error);
    }
  }

  async listPages(sourceDocumentId: string) {
    await this.findActiveSourceDocument(sourceDocumentId);

    const pages = await this.prisma.sourceDocumentPage.findMany({
      where: {
        sourceDocumentId,
      },
      select: sourceDocumentPageSelect,
      orderBy: {
        pageNumber: "asc",
      },
    });

    return pages.map(serializeSourceDocumentPage);
  }

  async updateLessonPageRanges(
    sourceDocumentId: string,
    actorUserId: string,
    dto: UpdateLessonPageRangesDto,
    context: RequestContext = {},
  ): Promise<PageRangeSaveResponse> {
    assertNoDuplicateLessonRanges(dto.ranges);

    for (const range of dto.ranges) {
      assertPageRangeOrder(range.pageStart, range.pageEnd);
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const sourceDocument = await this.findActiveSourceDocument(sourceDocumentId, tx);
        const pageLimit = await assertSourceDocumentReadyForPageRanges(
          tx,
          sourceDocument,
        );

        for (const range of dto.ranges) {
          if (range.pageEnd > pageLimit) {
            throwBadRequest(
              "VALIDATION_ERROR",
              "Khoảng trang vượt quá số trang của tài liệu nguồn",
              {
                lessonId: range.lessonId,
                pageStart: range.pageStart,
                pageEnd: range.pageEnd,
                pageCount: pageLimit,
              },
            );
          }
        }

        const lessonIds = dto.ranges.map((range) => range.lessonId);
        await this.assertLessonsBelongToLearningPath(
          tx,
          lessonIds,
          sourceDocument.learningPathId,
        );

        const now = new Date();
        const savedRanges = [];
        const lessonDocuments: LessonDocumentRecord[] = [];

        for (const range of dto.ranges) {
          await tx.lessonDocumentPageRange.deleteMany({
            where: {
              lessonId: range.lessonId,
              sourceDocumentId: {
                not: sourceDocument.id,
              },
            },
          });

          const savedRange = await tx.lessonDocumentPageRange.upsert({
            where: {
              lessonId_sourceDocumentId: {
                lessonId: range.lessonId,
                sourceDocumentId: sourceDocument.id,
              },
            },
            create: {
              lessonId: range.lessonId,
              sourceDocumentId: sourceDocument.id,
              pageStart: range.pageStart,
              pageEnd: range.pageEnd,
              createdById: actorUserId,
              metadataJson: toDocumentInputJson({
                source: "admin_page_range_mapping",
              }),
            },
            update: {
              pageStart: range.pageStart,
              pageEnd: range.pageEnd,
              metadataJson: toDocumentInputJson({
                source: "admin_page_range_mapping",
              }),
            },
            select: lessonDocumentPageRangeSelect,
          });

          savedRanges.push(savedRange);

          const lessonDocument = await this.upsertPrimaryFromSourceDocument(tx, {
            actorUserId,
            lessonId: range.lessonId,
            sourceDocument,
            pageStart: range.pageStart,
            pageEnd: range.pageEnd,
            now,
          });

          lessonDocuments.push(lessonDocument);
        }

        await tx.auditLog.create({
          data: {
            actorUserId,
            action: "SOURCE_DOCUMENT_PAGE_RANGES_UPDATED",
            entityType: "SourceDocument",
            entityId: sourceDocument.id,
            after: toDocumentInputJson({
              ranges: savedRanges.map(serializeLessonDocumentPageRange),
              lessonDocumentIds: lessonDocuments.map((item) => item.id),
            }),
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
          },
        });

        return {
          sourceDocument,
          ranges: savedRanges,
          lessonDocuments,
          warnings: buildPageRangeWarnings(dto.ranges, pageLimit),
        };
      });

      await this.enqueueProcessingJobs(
        result.lessonDocuments.map((document) => document.processingJobId),
      );

      return {
        sourceDocument: serializeSourceDocument(result.sourceDocument),
        ranges: result.ranges.map(serializeLessonDocumentPageRange),
        lessonDocuments: result.lessonDocuments.map(serializeLessonDocument),
        warnings: result.warnings,
      };
    } catch (error) {
      handleDocumentPrismaError(error);
    }
  }

  async assignSingleLessonPageRangeInTransaction(
    tx: Prisma.TransactionClient,
    {
      actorUserId,
      context = {},
      lessonId,
      pageEnd,
      pageStart,
      sourceDocumentId,
    }: {
      actorUserId: string;
      context?: RequestContext;
      lessonId: string;
      pageEnd: number;
      pageStart: number;
      sourceDocumentId: string;
    },
  ) {
    assertPageRangeOrder(pageStart, pageEnd);

    const sourceDocument = await this.findActiveSourceDocument(sourceDocumentId, tx);
    const pageLimit = await assertSourceDocumentReadyForPageRanges(tx, sourceDocument);

    if (pageEnd > pageLimit) {
      throwBadRequest(
        "VALIDATION_ERROR",
        "Khoảng trang vượt quá số trang của tài liệu nguồn",
        {
          lessonId,
          pageStart,
          pageEnd,
          pageCount: pageLimit,
        },
      );
    }

    await this.assertLessonsBelongToLearningPath(
      tx,
      [lessonId],
      sourceDocument.learningPathId,
    );

    await tx.lessonDocumentPageRange.deleteMany({
      where: {
        lessonId,
        sourceDocumentId: {
          not: sourceDocument.id,
        },
      },
    });

    const savedRange = await tx.lessonDocumentPageRange.upsert({
      where: {
        lessonId_sourceDocumentId: {
          lessonId,
          sourceDocumentId: sourceDocument.id,
        },
      },
      create: {
        lessonId,
        sourceDocumentId: sourceDocument.id,
        pageStart,
        pageEnd,
        createdById: actorUserId,
        metadataJson: toDocumentInputJson({
          source: "lesson_editor_page_range",
        }),
      },
      update: {
        pageStart,
        pageEnd,
        metadataJson: toDocumentInputJson({
          source: "lesson_editor_page_range",
        }),
      },
      select: lessonDocumentPageRangeSelect,
    });

    const lessonDocument = await this.upsertPrimaryFromSourceDocument(tx, {
      actorUserId,
      lessonId,
      now: new Date(),
      pageEnd,
      pageStart,
      sourceDocument,
    });

    await tx.auditLog.create({
      data: {
        actorUserId,
        action: "LESSON_PAGE_RANGE_UPDATED",
        entityType: "Lesson",
        entityId: lessonId,
        after: toDocumentInputJson({
          pageRange: serializeLessonDocumentPageRange(savedRange),
          lessonDocumentId: lessonDocument.id,
        }),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });

    return lessonDocument;
  }

  enqueueLessonDocumentProcessingJobs(
    documents: Array<LessonDocumentRecord | null | undefined>,
  ) {
    return this.enqueueProcessingJobs(
      documents.map((document) => document?.processingJobId ?? null),
    );
  }

  private async assertLearningPathExists(
    tx: Pick<PrismaService, "learningPath"> | Prisma.TransactionClient,
    learningPathId: string,
  ) {
    const learningPath = await tx.learningPath.findFirst({
      where: {
        id: learningPathId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!learningPath) {
      throwNotFound("NOT_FOUND", "Không tìm thấy lộ trình học");
    }
  }

  private async getLessonDocumentFile(tx: Prisma.TransactionClient, fileId: string) {
    const file = await tx.file.findFirst({
      where: {
        id: fileId,
        deletedAt: null,
      },
      select: {
        id: true,
        purpose: true,
        status: true,
        checksum: true,
      },
    });

    if (!file) {
      throwDocumentFileNotFound();
    }

    if (file.purpose !== FilePurpose.LESSON_DOCUMENT) {
      throwBadRequest("FILE_PURPOSE_NOT_ALLOWED", "File phải là tài liệu bài học");
    }

    if (file.status === FileStatus.DELETED) {
      throwDocumentFileNotFound();
    }

    return file;
  }

  private async findActiveSourceDocument(
    sourceDocumentId: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const sourceDocument = await tx.sourceDocument.findFirst({
      where: {
        id: sourceDocumentId,
        deletedAt: null,
        learningPath: {
          deletedAt: null,
        },
      },
      select: sourceDocumentSelect,
    });

    if (!sourceDocument) {
      throwSourceDocumentNotFound();
    }

    return sourceDocument;
  }

  private async assertLessonsBelongToLearningPath(
    tx: Prisma.TransactionClient,
    lessonIds: string[],
    learningPathId: string,
  ) {
    if (lessonIds.length === 0) {
      return;
    }

    const lessons = await tx.lesson.findMany({
      where: {
        id: {
          in: lessonIds,
        },
        learningPathId,
        deletedAt: null,
        chapter: {
          deletedAt: null,
        },
        learningPath: {
          deletedAt: null,
        },
      },
      select: {
        id: true,
      },
    });
    const foundIds = new Set(lessons.map((lesson) => lesson.id));
    const missingIds = lessonIds.filter((lessonId) => !foundIds.has(lessonId));

    if (missingIds.length > 0) {
      throwBadRequest(
        "VALIDATION_ERROR",
        "Buổi học phải thuộc cùng lộ trình với tài liệu nguồn",
        { lessonIds: missingIds },
      );
    }
  }

  private async upsertPrimaryFromSourceDocument(
    tx: Prisma.TransactionClient,
    {
      actorUserId,
      lessonId,
      sourceDocument,
      pageStart,
      pageEnd,
      now,
    }: {
      actorUserId: string;
      lessonId: string;
      sourceDocument: Awaited<
        ReturnType<SourceDocumentsService["findActiveSourceDocument"]>
      >;
      pageStart: number;
      pageEnd: number;
      now: Date;
    },
  ) {
    const activePrimary = await tx.lessonDocument.findFirst({
      where: {
        lessonId,
        kind: {
          in: [
            LessonDocumentKind.PRIMARY_FROM_SOURCE,
            LessonDocumentKind.PRIMARY_REPLACEMENT,
          ],
        },
        replacedAt: null,
      },
      select: {
        id: true,
        kind: true,
        sourceDocumentId: true,
      },
    });

    let lessonDocumentId = activePrimary?.id;

    if (
      activePrimary &&
      (activePrimary.kind !== LessonDocumentKind.PRIMARY_FROM_SOURCE ||
        activePrimary.sourceDocumentId !== sourceDocument.id)
    ) {
      await tx.lessonDocument.updateMany({
        where: {
          lessonId,
          kind: {
            in: [
              LessonDocumentKind.PRIMARY_FROM_SOURCE,
              LessonDocumentKind.PRIMARY_REPLACEMENT,
            ],
          },
          replacedAt: null,
        },
        data: {
          replacedAt: now,
        },
      });
      lessonDocumentId = undefined;
    }

    const metadataJson = toDocumentInputJson({
      source: "source_document_page_range",
      pageStart,
      pageEnd,
    });
    const title =
      sourceDocument.title ?? `Trang ${pageStart}-${pageEnd} từ tài liệu nguồn`;

    const lessonDocument = lessonDocumentId
      ? await tx.lessonDocument.update({
          where: { id: lessonDocumentId },
          data: {
            fileId: sourceDocument.fileId,
            sourceDocumentId: sourceDocument.id,
            title,
            status: DocumentStatus.PROCESSING,
            extractError: null,
            contentHash: sourceDocument.contentHash,
            chunkCount: 0,
            processedAt: null,
            metadataJson,
          },
          select: lessonDocumentSelect,
        })
      : await tx.lessonDocument.create({
          data: {
            lessonId,
            fileId: sourceDocument.fileId,
            sourceDocumentId: sourceDocument.id,
            kind: LessonDocumentKind.PRIMARY_FROM_SOURCE,
            title,
            status: DocumentStatus.PROCESSING,
            contentHash: sourceDocument.contentHash,
            metadataJson,
          },
          select: lessonDocumentSelect,
        });

    const job = await this.createDocumentJob(tx, {
      ownerUserId: actorUserId,
      lessonId,
      resourceType: "LESSON_DOCUMENT",
      resourceId: lessonDocument.id,
      inputMeta: {
        action: "LESSON_CHUNKING_FROM_SOURCE",
        lessonId,
        lessonDocumentId: lessonDocument.id,
        sourceDocumentId: sourceDocument.id,
        pageStart,
        pageEnd,
      },
    });

    return tx.lessonDocument.update({
      where: { id: lessonDocument.id },
      data: {
        processingJobId: job.id,
      },
      select: lessonDocumentSelect,
    });
  }

  private createDocumentJob(
    tx: Prisma.TransactionClient,
    {
      ownerUserId,
      lessonId,
      resourceType,
      resourceId,
      inputMeta,
    }: {
      ownerUserId: string;
      lessonId?: string;
      resourceType: string;
      resourceId: string;
      inputMeta: Record<string, unknown>;
    },
  ) {
    return tx.backgroundJob.create({
      data: {
        queue: BackgroundJobQueue.DOCUMENT_PROCESSING,
        status: BackgroundJobStatus.QUEUED,
        ownerUserId,
        lessonId,
        resourceType,
        resourceId,
        inputMeta: toDocumentInputJson(inputMeta),
      },
      select: {
        id: true,
      },
    });
  }

  private enqueueProcessingJobs(jobIds: Array<string | null>) {
    const enqueueIds = jobIds.filter((jobId): jobId is string => Boolean(jobId));
    return this.backgroundJobQueue.enqueueMany(enqueueIds);
  }

  /**
   * Get rendered HTML output from Mathpix OCR html.zip artifact.
   * Returns the full HTML string for rendering in the frontend.
   */
  async getOcrHtml(sourceDocumentId: string): Promise<{ html: string }> {
    // Find a page with artifacts metadata to get the htmlZip key
    const page = await this.prisma.sourceDocumentPage.findFirst({
      where: {
        sourceDocumentId,
        metadataJson: { not: Prisma.DbNull },
      },
      select: { metadataJson: true },
      orderBy: { pageNumber: "asc" },
    });

    if (!page?.metadataJson) {
      throwNotFound("OCR_ARTIFACTS_NOT_FOUND", "OCR artifacts not found for this document");
    }

    const metadata = page.metadataJson as Record<string, unknown>;
    const artifacts = metadata.artifacts as Record<string, unknown> | undefined;
    const htmlZipKey = artifacts?.htmlZip as string | undefined;

    if (!htmlZipKey) {
      throwNotFound("HTML_ARTIFACT_NOT_FOUND", "HTML artifact not found for this document");
    }

    try {
      const zipBuffer = await this.storage.downloadObject(htmlZipKey);
      const htmlContent = await this.extractHtmlWithImagesFromZip(zipBuffer);
      return { html: htmlContent };
    } catch (error) {
      this.logger.error(
        `Failed to extract OCR HTML for ${sourceDocumentId}: ${error}`,
      );
      throwNotFound("OCR_HTML_EXTRACT_FAILED", "Failed to extract HTML from OCR artifacts");
    }
  }

  /**
   * Extract the main HTML file content and its images from a Mathpix html.zip buffer.
   * Replaces image sources in the HTML with their base64 representations.
   */
  private extractHtmlWithImagesFromZip(zipBuffer: Buffer): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      yauzl.fromBuffer(zipBuffer, { lazyEntries: true }, (err, zipfile) => {
        if (err || !zipfile) return reject(err ?? new Error("No zipfile"));

        let htmlContent = "";
        const imageMap = new Map<string, string>();

        zipfile.readEntry();

        zipfile.on("entry", (entry: YauzlEntry) => {
          if (entry.fileName.endsWith(".html") && !entry.fileName.startsWith("__MACOSX")) {
            zipfile.openReadStream(entry, (readErr, readStream) => {
              if (readErr || !readStream) return reject(readErr ?? new Error("No stream"));
              const chunks: Buffer[] = [];
              readStream.on("data", (chunk: Buffer) => chunks.push(chunk));
              readStream.on("end", () => {
                htmlContent = Buffer.concat(chunks).toString("utf-8");
                zipfile.readEntry();
              });
              readStream.on("error", reject);
            });
          } else if (entry.fileName.includes("images/") && !entry.fileName.endsWith("/")) {
            zipfile.openReadStream(entry, (readErr, readStream) => {
              if (readErr || !readStream) return reject(readErr ?? new Error("No stream"));
              const chunks: Buffer[] = [];
              readStream.on("data", (chunk: Buffer) => chunks.push(chunk));
              readStream.on("end", () => {
                const imgBuffer = Buffer.concat(chunks);
                const ext = entry.fileName.split(".").pop()?.toLowerCase() || "jpeg";
                const mimeType = ext === "png" ? "image/png" : "image/jpeg";
                const base64 = imgBuffer.toString("base64");
                
                // Trích xuất phần "images/filename.ext" từ đường dẫn thật trong zip
                // Mathpix HTML thường trỏ src="images/filename.ext"
                const match = entry.fileName.match(/images\/[^/]+$/);
                const srcKey = match ? match[0] : entry.fileName;
                
                imageMap.set(srcKey, `data:${mimeType};base64,${base64}`);
                zipfile.readEntry();
              });
              readStream.on("error", reject);
            });
          } else {
            zipfile.readEntry();
          }
        });

        zipfile.on("end", () => {
          if (!htmlContent) {
            reject(new Error("No HTML file found in zip"));
            return;
          }

          // Replace all image sources with their base64 representation
          for (const [fileName, base64Url] of imageMap.entries()) {
            htmlContent = htmlContent.split(`src="${fileName}"`).join(`src="${base64Url}"`);
            htmlContent = htmlContent.split(`src='${fileName}'`).join(`src='${base64Url}'`);
            
            htmlContent = htmlContent.split(`src="./${fileName}"`).join(`src="${base64Url}"`);
            htmlContent = htmlContent.split(`src='./${fileName}'`).join(`src='${base64Url}'`);
          }

          resolve(htmlContent);
        });

        zipfile.on("error", reject);
      });
    });
  }

  async confirmPrintedPage(
    sourceDocumentId: string,
    pageId: string,
    dto: ConfirmPrintedPageDto,
  ) {
    const page = await this.prisma.sourceDocumentPage.findUnique({
      where: {
        id: pageId,
        sourceDocumentId,
      },
      select: {
        id: true,
        metadataJson: true,
      },
    });

    if (!page) {
      throwNotFound("PAGE_NOT_FOUND", "Trang tài liệu không tồn tại");
    }

    const metadata =
      typeof page.metadataJson === "object" && page.metadataJson !== null
        ? (page.metadataJson as Record<string, any>)
        : {};

    const printedPage = metadata.printedPage || {};
    
    const updatedPrintedPage = {
      ...printedPage,
      printedPageLabel: dto.printedPageLabel ?? null,
      printedPageNumber: dto.printedPageNumber ?? null,
      warning: null,
      confidence: 1.0,
      source: "manual",
    };

    const updatedMetadataJson = toDocumentInputJson({
      ...metadata,
      printedPage: updatedPrintedPage,
    });

    const updatedPageRow = await this.prisma.sourceDocumentPage.update({
      where: { id: page.id },
      data: {
        metadataJson: updatedMetadataJson ?? Prisma.DbNull,
      },
      select: sourceDocumentPageSelect,
    });

    return serializeSourceDocumentPage(updatedPageRow);
  }
}

function mergeDocumentMetadata(
  metadataJson: unknown,
  patch: Record<string, unknown>,
): Prisma.InputJsonValue {
  if (
    typeof metadataJson === "object" &&
    metadataJson !== null &&
    !Array.isArray(metadataJson)
  ) {
    return toDocumentInputJson({ ...metadataJson, ...patch })!;
  }

  return toDocumentInputJson(patch)!;
}
