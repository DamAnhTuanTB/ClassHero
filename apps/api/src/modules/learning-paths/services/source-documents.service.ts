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
import type { LessonSourceDocumentExtractionDto } from "#api/modules/learning-paths/dto/create-lesson.dto";
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
  assertNoOverlappingSourceExtractions,
  assertPageRangeOrder,
  assertSourceDocumentReadyForPageRanges,
  buildSourceDocumentReadinessSummary,
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

        let isCacheRun = false;
        if (file.checksum) {
          const provider =
            this.configService.get("OCR_PROVIDER", { infer: true }) ?? "mathpix";
          const descriptor = this.cacheService.createDescriptor(file.checksum, provider);
          isCacheRun = await this.cacheService.hasArtifact(descriptor);
        }

        const created = await tx.sourceDocument.create({
          data: {
            learningPathId,
            fileId: file.id,
            title: normalizeOptionalTitle(dto.title),
            status: DocumentStatus.PROCESSING,
            contentHash: file.checksum,
            metadataJson: toDocumentInputJson({
              uploadSource: "api.admin.source_documents.create",
              isCacheRun,
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
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    const pages =
      documents.length > 0
        ? await this.prisma.sourceDocumentPage.findMany({
            where: {
              sourceDocumentId: {
                in: documents.map((document) => document.id),
              },
            },
            select: {
              sourceDocumentId: true,
              status: true,
              metadataJson: true,
            },
          })
        : [];
    const pagesBySourceDocumentId = new Map<
      string,
      Array<(typeof pages)[number]>
    >();
    for (const page of pages) {
      const sourcePages = pagesBySourceDocumentId.get(page.sourceDocumentId) ?? [];
      sourcePages.push(page);
      pagesBySourceDocumentId.set(page.sourceDocumentId, sourcePages);
    }

    return documents.map((document) => ({
      ...serializeSourceDocument(document),
      readiness: buildSourceDocumentReadinessSummary(
        document,
        pagesBySourceDocumentId.get(document.id) ?? [],
      ),
    }));
  }

  async requestProcessing(
    sourceDocumentId: string,
    actorUserId: string,
    context: RequestContext = {},
    options: { forceNewOcr?: boolean } = {},
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

        if (options.forceNewOcr && current.contentHash) {
          const provider =
            this.configService.get("OCR_PROVIDER", { infer: true }) ?? "mathpix";
          const descriptor = this.cacheService.createDescriptor(
            current.contentHash,
            provider,
          );
          await this.cacheService.invalidateCache(descriptor).catch((err) => {
            this.logger.warn(
              `Failed to invalidate cache for ${current.contentHash}: ${err.message}`,
            );
          });
        }

        let isCacheRun = false;
        if (!options.forceNewOcr && current.contentHash) {
          const provider =
            this.configService.get("OCR_PROVIDER", { infer: true }) ?? "mathpix";
          const descriptor = this.cacheService.createDescriptor(
            current.contentHash,
            provider,
          );
          isCacheRun = await this.cacheService.hasArtifact(descriptor);
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
              forceNewOcr: options.forceNewOcr ?? false,
              isCacheRun,
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

        await tx.lessonDocument.updateMany({
          where: {
            sourceDocumentId,
            replacedAt: null,
          },
          data: {
            replacedAt: new Date(),
          },
        });

        await tx.lessonDocumentPageRange.deleteMany({
          where: {
            sourceDocumentId,
          },
        });

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
        const provider =
          this.configService.get("OCR_PROVIDER", { infer: true }) ?? "mathpix";
        const descriptor = this.cacheService.createDescriptor(
          contentHashToClear,
          provider,
        );
        await this.cacheService.invalidateCache(descriptor).catch((err) => {
          this.logger.warn(
            `Failed to invalidate cache for ${contentHashToClear}: ${err.message}`,
          );
        });
      }

      return { success: true };
    } catch (error) {
      handleDocumentPrismaError(error);
    }
  }

  async getCacheStatus(sourceDocumentId: string) {
    try {
      const sourceDocument = await this.findActiveSourceDocument(sourceDocumentId);
      if (!sourceDocument.contentHash) {
        return { hasCache: false };
      }

      const provider =
        this.configService.get("OCR_PROVIDER", { infer: true }) ?? "mathpix";
      const descriptor = this.cacheService.createDescriptor(
        sourceDocument.contentHash,
        provider,
      );
      const hasCache = await this.cacheService.hasArtifact(descriptor);

      return { hasCache };
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
          const previousRanges = await tx.lessonDocumentPageRange.findMany({
            where: {
              lessonId: range.lessonId,
              sourceDocumentId: sourceDocument.id,
            },
            select: { id: true },
          });
          const previousRangeIds = previousRanges.map((item) => item.id);
          if (previousRangeIds.length > 0) {
            await tx.lessonDocument.updateMany({
              where: {
                pageRangeId: {
                  in: previousRangeIds,
                },
                replacedAt: null,
              },
              data: {
                pageRangeId: null,
                replacedAt: now,
              },
            });
            await tx.lessonDocumentPageRange.deleteMany({
              where: {
                id: {
                  in: previousRangeIds,
                },
              },
            });
          }

          const savedRange = await tx.lessonDocumentPageRange.create({
            data: {
              lessonId: range.lessonId,
              sourceDocumentId: sourceDocument.id,
              pageStart: range.pageStart,
              pageEnd: range.pageEnd,
              createdById: actorUserId,
              metadataJson: toDocumentInputJson({
                source: "admin_page_range_mapping",
              }),
            },
            select: lessonDocumentPageRangeSelect,
          });

          savedRanges.push(savedRange);

          const lessonDocument = await this.upsertLessonDocumentFromSource(tx, {
            actorUserId,
            lessonId: range.lessonId,
            sourceDocument,
            pageStart: range.pageStart,
            pageEnd: range.pageEnd,
            pageRangeId: savedRange.id,
            sortOrder: 0,
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

  async syncLessonSourceExtractionsInTransaction(
    tx: Prisma.TransactionClient,
    {
      actorUserId,
      context = {},
      extractions,
      lessonId,
    }: {
      actorUserId: string;
      context?: RequestContext;
      extractions: LessonSourceDocumentExtractionDto[];
      lessonId: string;
    },
  ) {
    const extractionIds = extractions
      .map((extraction) => extraction.id)
      .filter((id): id is string => Boolean(id));

    if (new Set(extractionIds).size !== extractionIds.length) {
      throwBadRequest(
        "VALIDATION_ERROR",
        "Danh sách trích xuất chứa mã bị lặp",
      );
    }

    for (const extraction of extractions) {
      assertPageRangeOrder(extraction.pageStart, extraction.pageEnd);
    }
    assertNoOverlappingSourceExtractions(extractions);

    const lesson = await tx.lesson.findFirst({
      where: {
        id: lessonId,
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
        learningPathId: true,
      },
    });

    if (!lesson) {
      throwNotFound("NOT_FOUND", "Không tìm thấy buổi học");
    }

    const sourceDocumentIds = [
      ...new Set(extractions.map((extraction) => extraction.sourceDocumentId)),
    ];
    const sourceDocuments = await tx.sourceDocument.findMany({
      where: {
        id: {
          in: sourceDocumentIds,
        },
        learningPathId: lesson.learningPathId,
        deletedAt: null,
      },
      select: sourceDocumentSelect,
    });
    const sourceDocumentById = new Map(
      sourceDocuments.map((sourceDocument) => [sourceDocument.id, sourceDocument]),
    );

    if (sourceDocuments.length !== sourceDocumentIds.length) {
      throwBadRequest(
        "VALIDATION_ERROR",
        "Tài liệu nguồn phải thuộc cùng khóa học với buổi học",
      );
    }

    const pageLimitBySourceId = new Map<string, number>();
    for (const sourceDocument of sourceDocuments) {
      pageLimitBySourceId.set(
        sourceDocument.id,
        await assertSourceDocumentReadyForPageRanges(tx, sourceDocument),
      );
    }

    for (const extraction of extractions) {
      const pageLimit = pageLimitBySourceId.get(extraction.sourceDocumentId);
      if (!pageLimit || extraction.pageEnd > pageLimit) {
        throwBadRequest(
          "VALIDATION_ERROR",
          "Khoảng trang vượt quá số trang của tài liệu nguồn",
          {
            extractionId: extraction.id ?? null,
            sourceDocumentId: extraction.sourceDocumentId,
            pageStart: extraction.pageStart,
            pageEnd: extraction.pageEnd,
            pageCount: pageLimit ?? null,
          },
        );
      }
    }

    const existingRanges = await tx.lessonDocumentPageRange.findMany({
      where: {
        lessonId,
      },
      select: lessonDocumentPageRangeSelect,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    const existingRangeById = new Map(
      existingRanges.map((range) => [range.id, range]),
    );

    for (const extractionId of extractionIds) {
      if (!existingRangeById.has(extractionId)) {
        throwBadRequest(
          "VALIDATION_ERROR",
          "Khối trích xuất không thuộc buổi học đang sửa",
          { extractionId },
        );
      }
    }

    const now = new Date();
    const requestedIds = new Set(extractionIds);
    const removedRanges = existingRanges.filter(
      (range) => !requestedIds.has(range.id),
    );

    for (const range of removedRanges) {
      await tx.lessonDocument.updateMany({
        where: {
          pageRangeId: range.id,
          replacedAt: null,
        },
        data: {
          pageRangeId: null,
          replacedAt: now,
        },
      });
      await tx.lessonDocumentPageRange.delete({
        where: { id: range.id },
      });
    }

    const changedDocuments: LessonDocumentRecord[] = [];
    const savedRangeIds: string[] = [];

    for (const [index, extraction] of extractions.entries()) {
      const sortOrder = extraction.sortOrder ?? index;
      const existingRange = extraction.id
        ? existingRangeById.get(extraction.id)
        : undefined;
      const sourceDocument = sourceDocumentById.get(extraction.sourceDocumentId)!;
      const isUnchanged =
        existingRange?.sourceDocumentId === extraction.sourceDocumentId &&
        existingRange.pageStart === extraction.pageStart &&
        existingRange.pageEnd === extraction.pageEnd;

      if (existingRange && isUnchanged) {
        await tx.lessonDocument.updateMany({
          where: {
            pageRangeId: existingRange.id,
            replacedAt: null,
          },
          data: {
            sortOrder,
          },
        });
        savedRangeIds.push(existingRange.id);
        continue;
      }

      if (existingRange) {
        await tx.lessonDocument.updateMany({
          where: {
            pageRangeId: existingRange.id,
            replacedAt: null,
          },
          data: {
            pageRangeId: null,
            replacedAt: now,
          },
        });
      }

      const savedRange = existingRange
        ? await tx.lessonDocumentPageRange.update({
            where: { id: existingRange.id },
            data: {
              sourceDocumentId: extraction.sourceDocumentId,
              pageStart: extraction.pageStart,
              pageEnd: extraction.pageEnd,
              metadataJson: toDocumentInputJson({
                source: "lesson_editor_extraction",
                sortOrder,
              }),
            },
            select: lessonDocumentPageRangeSelect,
          })
        : await tx.lessonDocumentPageRange.create({
            data: {
              lessonId,
              sourceDocumentId: extraction.sourceDocumentId,
              pageStart: extraction.pageStart,
              pageEnd: extraction.pageEnd,
              createdById: actorUserId,
              metadataJson: toDocumentInputJson({
                source: "lesson_editor_extraction",
                sortOrder,
              }),
            },
            select: lessonDocumentPageRangeSelect,
          });

      const lessonDocument = await this.upsertLessonDocumentFromSource(tx, {
        actorUserId,
        lessonId,
        pageEnd: extraction.pageEnd,
        pageRangeId: savedRange.id,
        pageStart: extraction.pageStart,
        sortOrder,
        sourceDocument,
      });
      changedDocuments.push(lessonDocument);
      savedRangeIds.push(savedRange.id);
    }

    await tx.auditLog.create({
      data: {
        actorUserId,
        action: "LESSON_SOURCE_EXTRACTIONS_SYNCED",
        entityType: "Lesson",
        entityId: lessonId,
        after: toDocumentInputJson({
          extractionIds: savedRangeIds,
          removedExtractionIds: removedRanges.map((range) => range.id),
          lessonDocumentIds: changedDocuments.map((document) => document.id),
        }),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });

    return changedDocuments;
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
      isPrimary?: boolean;
    },
  ) {
    const existingRanges = await tx.lessonDocumentPageRange.findMany({
      where: { lessonId },
      select: {
        id: true,
        pageEnd: true,
        pageStart: true,
        sourceDocumentId: true,
        lessonDocument: {
          select: {
            sortOrder: true,
          },
        },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    const extractions: LessonSourceDocumentExtractionDto[] =
      existingRanges.length === 0
        ? [
            {
              pageEnd,
              pageStart,
              sortOrder: 0,
              sourceDocumentId,
            },
          ]
        : existingRanges.map((range, index) =>
            index === 0
              ? {
                  id: range.id,
                  pageEnd,
                  pageStart,
                  sortOrder: range.lessonDocument?.sortOrder ?? index,
                  sourceDocumentId,
                }
              : {
                  id: range.id,
                  pageEnd: range.pageEnd,
                  pageStart: range.pageStart,
                  sortOrder: range.lessonDocument?.sortOrder ?? index,
                  sourceDocumentId: range.sourceDocumentId,
                },
          );
    const documents = await this.syncLessonSourceExtractionsInTransaction(tx, {
      actorUserId,
      context,
      extractions,
      lessonId,
    });

    if (documents[0]) {
      return documents[0];
    }

    const retainedRangeId = existingRanges[0]?.id;
    return retainedRangeId
      ? tx.lessonDocument.findFirst({
          where: {
            lessonId,
            pageRangeId: retainedRangeId,
            replacedAt: null,
          },
          select: lessonDocumentSelect,
        })
      : null;
  }

  async removeSingleLessonPageRangeInTransaction(
    tx: Prisma.TransactionClient,
    lessonId: string,
    actorUserId: string,
  ) {
    // Soft delete the LessonDocument that was created from source_document_page_range
    const mappedDocs = await tx.lessonDocument.findMany({
      where: { lessonId, replacedAt: null },
    });

    const docToDelete = mappedDocs.find(
      (document) =>
        document.metadataJson &&
        typeof document.metadataJson === "object" &&
        (document.metadataJson as Record<string, unknown>).source ===
          "source_document_page_range",
    );

    if (docToDelete) {
      await tx.lessonDocument.update({
        where: { id: docToDelete.id },
        data: {
          replacedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId,
          action: "LESSON_PAGE_RANGE_REMOVED",
          entityType: "Lesson",
          entityId: lessonId,
          after: toDocumentInputJson({
            lessonDocumentId: docToDelete.id,
            removed: true,
          }),
        },
      });
    }

    // Delete the explicit mapping
    await tx.lessonDocumentPageRange.deleteMany({
      where: { lessonId },
    });
    
    return null;
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

  private async upsertLessonDocumentFromSource(
    tx: Prisma.TransactionClient,
    {
      actorUserId,
      lessonId,
      sourceDocument,
      pageStart,
      pageEnd,
      pageRangeId,
      sortOrder,
    }: {
      actorUserId: string;
      lessonId: string;
      sourceDocument: Awaited<
        ReturnType<SourceDocumentsService["findActiveSourceDocument"]>
      >;
      pageStart: number;
      pageEnd: number;
      pageRangeId: string;
      sortOrder: number;
    },
  ) {
    const metadataJson = toDocumentInputJson({
      source: "source_document_page_range",
      pageStart,
      pageEnd,
      pageRangeId,
      sortOrder,
    });
    const title =
      sourceDocument.title ?? `Trang ${pageStart}-${pageEnd} từ tài liệu nguồn`;

    const lessonDocument = await tx.lessonDocument.create({
      data: {
        lessonId,
        fileId: sourceDocument.fileId,
        sourceDocumentId: sourceDocument.id,
        pageRangeId,
        kind: LessonDocumentKind.PRIMARY_FROM_SOURCE,
        sortOrder,
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
        pageRangeId,
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
      throwNotFound(
        "OCR_ARTIFACTS_NOT_FOUND",
        "OCR artifacts not found for this document",
      );
    }

    const metadata = page.metadataJson as Record<string, unknown>;
    const artifacts = metadata.artifacts as Record<string, unknown> | undefined;
    const htmlZipKey = artifacts?.htmlZip as string | undefined;

    if (!htmlZipKey) {
      throwNotFound(
        "HTML_ARTIFACT_NOT_FOUND",
        "HTML artifact not found for this document",
      );
    }

    try {
      const zipBuffer = await this.storage.downloadObject(htmlZipKey);
      const htmlContent = await this.extractHtmlWithImagesFromZip(zipBuffer);
      return { html: htmlContent };
    } catch (error) {
      this.logger.error(`Failed to extract OCR HTML for ${sourceDocumentId}: ${error}`);
      throwNotFound(
        "OCR_HTML_EXTRACT_FAILED",
        "Failed to extract HTML from OCR artifacts",
      );
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
          if (
            entry.fileName.endsWith(".html") &&
            !entry.fileName.startsWith("__MACOSX")
          ) {
            zipfile.openReadStream(entry, (readErr, readStream) => {
              if (readErr || !readStream)
                return reject(readErr ?? new Error("No stream"));
              const chunks: Buffer[] = [];
              readStream.on("data", (chunk: Buffer) => chunks.push(chunk));
              readStream.on("end", () => {
                htmlContent = Buffer.concat(chunks).toString("utf-8");
                zipfile.readEntry();
              });
              readStream.on("error", reject);
            });
          } else if (
            entry.fileName.includes("images/") &&
            !entry.fileName.endsWith("/")
          ) {
            zipfile.openReadStream(entry, (readErr, readStream) => {
              if (readErr || !readStream)
                return reject(readErr ?? new Error("No stream"));
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
            htmlContent = htmlContent
              .split(`src="${fileName}"`)
              .join(`src="${base64Url}"`);
            htmlContent = htmlContent
              .split(`src='${fileName}'`)
              .join(`src='${base64Url}'`);

            htmlContent = htmlContent
              .split(`src="./${fileName}"`)
              .join(`src="${base64Url}"`);
            htmlContent = htmlContent
              .split(`src='./${fileName}'`)
              .join(`src='${base64Url}'`);
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

    const metadata: Record<string, unknown> =
      typeof page.metadataJson === "object" && page.metadataJson !== null
        ? (page.metadataJson as Record<string, unknown>)
        : {};

    const printedPage =
      typeof metadata.printedPage === "object" && metadata.printedPage !== null
        ? (metadata.printedPage as Record<string, unknown>)
        : {};

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
