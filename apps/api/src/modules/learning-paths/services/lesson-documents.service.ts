import { Inject, Injectable } from "@nestjs/common";
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
import { BackgroundJobQueueService } from "#api/modules/jobs/services/background-job-queue.service";
import { CreateLessonDocumentDto } from "#api/modules/learning-paths/dto/create-lesson-document.dto";
import { ReplacePrimaryLessonDocumentDto } from "#api/modules/learning-paths/dto/replace-primary-lesson-document.dto";
import {
  lessonDocumentPageRangeSelect,
  lessonDocumentSelect,
  sourceDocumentSelect,
} from "#api/modules/learning-paths/selectors/document.selects";
import {
  serializeLessonDocument,
  serializeLessonDocumentPageRange,
} from "#api/modules/learning-paths/serializers/document.serializers";
import type { LessonDocumentRecord } from "#api/modules/learning-paths/types/document.types";
import { UpdateLessonDocumentDto } from "#api/modules/learning-paths/dto/update-lesson-document.dto";
import type { RequestContext } from "#api/modules/learning-paths/types/lesson.types";
import {
  assertPageRangeOrder,
  assertSourceDocumentReadyForPageRanges,
  handleDocumentPrismaError,
  normalizeOptionalTitle,
  throwDocumentFileNotFound,
  throwLessonDocumentNotFound,
  throwSourceDocumentNotFound,
  toDocumentInputJson,
} from "#api/modules/learning-paths/utils/document.helpers";
import { throwLessonNotFound } from "#api/modules/learning-paths/utils/lesson.helpers";

@Injectable()
export class LessonDocumentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(BackgroundJobQueueService)
    private readonly backgroundJobQueue: BackgroundJobQueueService,
  ) {}

  async listForLesson(lessonId: string) {
    await this.assertLessonExists(this.prisma, lessonId);

    const documents = await this.prisma.lessonDocument.findMany({
      where: {
        lessonId,
        replacedAt: null,
      },
      select: lessonDocumentSelect,
      orderBy: [{ createdAt: "asc" }],
    });

    return documents.map(serializeLessonDocument);
  }

  async listForLearningPath(learningPathId: string) {
    const learningPath = await this.prisma.learningPath.findFirst({
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

    const documents = await this.prisma.lessonDocument.findMany({
      where: {
        replacedAt: null,
        lesson: {
          learningPathId,
          deletedAt: null,
          chapter: {
            deletedAt: null,
          },
          learningPath: {
            deletedAt: null,
          },
        },
      },
      select: lessonDocumentSelect,
      orderBy: [{ lessonId: "asc" }, { createdAt: "asc" }],
    });

    return documents.map(serializeLessonDocument);
  }

  async replacePrimaryDocument(
    lessonId: string,
    actorUserId: string,
    dto: ReplacePrimaryLessonDocumentDto,
    context: RequestContext = {},
  ) {
    try {
      const document = await this.prisma.$transaction(async (tx) => {
        const lesson = await this.assertLessonExists(tx, lessonId);
        const now = new Date();

        if (this.isSourceReplacement(dto)) {
          assertPageRangeOrder(dto.pageStart, dto.pageEnd);

          const sourceDocument = await tx.sourceDocument.findFirst({
            where: {
              id: dto.sourceDocumentId,
              learningPathId: lesson.learningPathId,
              deletedAt: null,
            },
            select: sourceDocumentSelect,
          });

          if (!sourceDocument) {
            throwSourceDocumentNotFound();
          }

          const pageLimit = await assertSourceDocumentReadyForPageRanges(
            tx,
            sourceDocument,
          );
          if (dto.pageEnd > pageLimit) {
            throwBadRequest(
              "VALIDATION_ERROR",
              "Khoảng trang vượt quá số trang của tài liệu nguồn",
              {
                pageStart: dto.pageStart,
                pageEnd: dto.pageEnd,
                pageCount: pageLimit,
              },
            );
          }

          await tx.lessonDocumentPageRange.deleteMany({
            where: {
              lessonId,
              sourceDocumentId: {
                not: sourceDocument.id,
              },
            },
          });

          const pageRange = await tx.lessonDocumentPageRange.upsert({
            where: {
              lessonId_sourceDocumentId: {
                lessonId,
                sourceDocumentId: sourceDocument.id,
              },
            },
            create: {
              lessonId,
              sourceDocumentId: sourceDocument.id,
              pageStart: dto.pageStart,
              pageEnd: dto.pageEnd,
              createdById: actorUserId,
              metadataJson: toDocumentInputJson({
                source: "primary_document_replacement",
              }),
            },
            update: {
              pageStart: dto.pageStart,
              pageEnd: dto.pageEnd,
              metadataJson: toDocumentInputJson({
                source: "primary_document_replacement",
              }),
            },
            select: lessonDocumentPageRangeSelect,
          });

          await this.replaceActivePrimaryDocuments(tx, lessonId, now);
          const created = await tx.lessonDocument.create({
            data: {
              lessonId,
              fileId: sourceDocument.fileId,
              sourceDocumentId: sourceDocument.id,
              kind: LessonDocumentKind.PRIMARY_REPLACEMENT,
              title:
                normalizeOptionalTitle(dto.title) ??
                sourceDocument.title ??
                `Tài liệu chính trang ${dto.pageStart}-${dto.pageEnd}`,
              status: DocumentStatus.PROCESSING,
              contentHash: sourceDocument.contentHash,
              metadataJson: toDocumentInputJson({
                source: "source_document_primary_replacement",
                pageStart: dto.pageStart,
                pageEnd: dto.pageEnd,
                pageRange: serializeLessonDocumentPageRange(pageRange),
              }),
            },
            select: lessonDocumentSelect,
          });

          const withJob = await this.attachDocumentJob(tx, {
            actorUserId,
            lessonId,
            document: created,
            action: "LESSON_PRIMARY_REPLACEMENT_FROM_SOURCE",
            inputMeta: {
              sourceDocumentId: sourceDocument.id,
              pageStart: dto.pageStart,
              pageEnd: dto.pageEnd,
            },
          });

          await this.auditDocumentChange(tx, {
            actorUserId,
            action: "LESSON_PRIMARY_DOCUMENT_REPLACED",
            document: withJob,
            context,
          });

          return withJob;
        }

        if (this.isFileReplacement(dto)) {
          const file = await this.getLessonDocumentFile(tx, dto.fileId);

          await tx.lessonDocumentPageRange.deleteMany({
            where: {
              lessonId,
            },
          });
          await this.replaceActivePrimaryDocuments(tx, lessonId, now);

          const created = await tx.lessonDocument.create({
            data: {
              lessonId,
              fileId: file.id,
              kind: LessonDocumentKind.PRIMARY_REPLACEMENT,
              title: normalizeOptionalTitle(dto.title),
              status: DocumentStatus.PROCESSING,
              contentHash: file.checksum,
              metadataJson: toDocumentInputJson({
                source: "uploaded_primary_replacement",
              }),
            },
            select: lessonDocumentSelect,
          });

          const withJob = await this.attachDocumentJob(tx, {
            actorUserId,
            lessonId,
            document: created,
            action: "LESSON_PRIMARY_REPLACEMENT_UPLOAD",
            inputMeta: {
              fileId: file.id,
            },
          });

          await this.auditDocumentChange(tx, {
            actorUserId,
            action: "LESSON_PRIMARY_DOCUMENT_REPLACED",
            document: withJob,
            context,
          });

          return withJob;
        }

        throwBadRequest(
          "VALIDATION_ERROR",
          "Cần gửi sourceDocumentId + pageStart/pageEnd hoặc fileId để thay thế tài liệu chính",
        );
      });

      await this.enqueueProcessingJobs([document.processingJobId]);

      return serializeLessonDocument(document);
    } catch (error) {
      handleDocumentPrismaError(error);
    }
  }

  async createSupplementalDocument(
    lessonId: string,
    actorUserId: string,
    dto: CreateLessonDocumentDto,
    context: RequestContext = {},
  ) {
    if (
      dto.kind &&
      dto.kind !== LessonDocumentKind.SUPPLEMENT &&
      dto.kind !== LessonDocumentKind.PRIMARY_REPLACEMENT &&
      dto.kind !== LessonDocumentKind.HOMEWORK
    ) {
      throwBadRequest(
        "VALIDATION_ERROR",
        "Endpoint này chỉ dùng để upload tài liệu bổ sung, tài liệu chính hoặc bài tập về nhà",
      );
    }

    try {
      const document = await this.prisma.$transaction(async (tx) => {
        await this.assertLessonExists(tx, lessonId);
        const file = await this.getLessonDocumentFile(tx, dto.fileId);
        const isStorageOnly = dto.processingMode === "STORAGE_ONLY";

        const kind = dto.kind || LessonDocumentKind.SUPPLEMENT;

        if (kind === LessonDocumentKind.PRIMARY_REPLACEMENT) {
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
              replacedAt: new Date(),
            },
          });
        }

        const created = await tx.lessonDocument.create({
          data: {
            lessonId,
            fileId: file.id,
            kind,
            title: normalizeOptionalTitle(dto.title),
            status: isStorageOnly ? DocumentStatus.READY : DocumentStatus.PROCESSING,
            contentHash: file.checksum,
            processedAt: isStorageOnly ? new Date() : undefined,
            metadataJson: toDocumentInputJson({
              source: "supplemental_lesson_document_upload",
              processingMode: isStorageOnly ? "storage_only" : "processing",
            }),
          },
          select: lessonDocumentSelect,
        });

        const document = isStorageOnly
          ? created
          : await this.attachDocumentJob(tx, {
              actorUserId,
              lessonId,
              document: created,
              action: "LESSON_SUPPLEMENT_PROCESSING",
              inputMeta: {
                fileId: file.id,
              },
            });

        await this.auditDocumentChange(tx, {
          actorUserId,
          action: "LESSON_SUPPLEMENT_DOCUMENT_CREATED",
          document,
          context,
        });

        return document;
      });

      await this.enqueueProcessingJobs([document.processingJobId]);

      return serializeLessonDocument(document);
    } catch (error) {
      handleDocumentPrismaError(error);
    }
  }

  async updateSupplementalDocument(
    lessonId: string,
    documentId: string,
    actorUserId: string,
    dto: UpdateLessonDocumentDto,
    context: RequestContext = {},
  ) {
    if (Object.keys(dto).length === 0) {
      throwBadRequest("VALIDATION_ERROR", "Cần cung cấp dữ liệu cập nhật");
    }

    if (
      dto.kind &&
      dto.kind !== LessonDocumentKind.SUPPLEMENT &&
      dto.kind !== LessonDocumentKind.PRIMARY_REPLACEMENT &&
      dto.kind !== LessonDocumentKind.HOMEWORK
    ) {
      throwBadRequest(
        "VALIDATION_ERROR",
        "Endpoint này chỉ dùng để cập nhật tài liệu bổ sung, tài liệu chính hoặc bài tập về nhà",
      );
    }

    try {
      const document = await this.prisma.$transaction(async (tx) => {
        await this.assertLessonExists(tx, lessonId);

        const existing = await tx.lessonDocument.findFirst({
          where: {
            id: documentId,
            lessonId,
            kind: {
              in: [
                LessonDocumentKind.SUPPLEMENT,
                LessonDocumentKind.PRIMARY_REPLACEMENT,
                LessonDocumentKind.HOMEWORK,
              ],
            },
          },
          select: lessonDocumentSelect,
        });

        if (!existing) {
          throwLessonDocumentNotFound();
        }

        const kind = dto.kind ?? existing.kind;

        if (
          kind === LessonDocumentKind.PRIMARY_REPLACEMENT &&
          existing.kind !== LessonDocumentKind.PRIMARY_REPLACEMENT
        ) {
          await tx.lessonDocument.updateMany({
            where: {
              lessonId,
              kind: LessonDocumentKind.PRIMARY_FROM_SOURCE,
              replacedAt: null,
            },
            data: {
              replacedAt: new Date(),
            },
          });

          await tx.lessonDocument.updateMany({
            where: {
              lessonId,
              kind: LessonDocumentKind.PRIMARY_REPLACEMENT,
              replacedAt: null,
            },
            data: {
              kind: LessonDocumentKind.SUPPLEMENT,
            },
          });
        }

        const updated = await tx.lessonDocument.update({
          where: { id: documentId },
          data: {
            ...(dto.kind !== undefined ? { kind } : {}),
            ...(dto.title !== undefined
              ? { title: normalizeOptionalTitle(dto.title) }
              : {}),
            replacedAt: null,
          },
          select: lessonDocumentSelect,
        });

        await this.auditDocumentChange(tx, {
          actorUserId,
          action: "LESSON_SUPPLEMENT_DOCUMENT_UPDATED",
          document: updated,
          context,
        });

        return updated;
      });

      return serializeLessonDocument(document);
    } catch (error) {
      handleDocumentPrismaError(error);
    }
  }

  async deleteSupplementalDocument(
    lessonId: string,
    documentId: string,
    actorUserId: string,
    context: RequestContext = {},
  ) {
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.assertLessonExists(tx, lessonId);
        const document = await tx.lessonDocument.findFirst({
          where: {
            id: documentId,
            lessonId,
            replacedAt: null,
          },
          select: lessonDocumentSelect,
        });

        if (!document) {
          throwLessonDocumentNotFound();
        }

        if (
          document.kind !== LessonDocumentKind.SUPPLEMENT &&
          document.kind !== LessonDocumentKind.HOMEWORK
        ) {
          throwConflict(
            "CONFLICT",
            "Chỉ được xóa tài liệu bổ sung hoặc bài tập về nhà bằng endpoint này",
          );
        }

        await tx.lessonDocument.delete({
          where: {
            id: document.id,
          },
        });

        await tx.auditLog.create({
          data: {
            actorUserId,
            action: "LESSON_SUPPLEMENT_DOCUMENT_DELETED",
            entityType: "LessonDocument",
            entityId: document.id,
            before: toDocumentInputJson(serializeLessonDocument(document)),
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
          },
        });
      });

      return { success: true };
    } catch (error) {
      handleDocumentPrismaError(error);
    }
  }

  private async assertLessonExists(
    tx: Prisma.TransactionClient | PrismaService,
    lessonId: string,
  ) {
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
      throwLessonNotFound();
    }

    return lesson;
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

  private replaceActivePrimaryDocuments(
    tx: Prisma.TransactionClient,
    lessonId: string,
    replacedAt: Date,
  ) {
    return tx.lessonDocument.updateMany({
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
        replacedAt,
      },
    });
  }

  private async attachDocumentJob(
    tx: Prisma.TransactionClient,
    {
      actorUserId,
      lessonId,
      document,
      action,
      inputMeta,
    }: {
      actorUserId: string;
      lessonId: string;
      document: LessonDocumentRecord;
      action: string;
      inputMeta: Record<string, unknown>;
    },
  ) {
    const job = await tx.backgroundJob.create({
      data: {
        queue: BackgroundJobQueue.DOCUMENT_PROCESSING,
        status: BackgroundJobStatus.QUEUED,
        ownerUserId: actorUserId,
        lessonId,
        resourceType: "LESSON_DOCUMENT",
        resourceId: document.id,
        inputMeta: toDocumentInputJson({
          action,
          lessonId,
          lessonDocumentId: document.id,
          ...inputMeta,
        }),
      },
      select: {
        id: true,
      },
    });

    return tx.lessonDocument.update({
      where: {
        id: document.id,
      },
      data: {
        processingJobId: job.id,
      },
      select: lessonDocumentSelect,
    });
  }

  private auditDocumentChange(
    tx: Prisma.TransactionClient,
    {
      actorUserId,
      action,
      document,
      context,
    }: {
      actorUserId: string;
      action: string;
      document: LessonDocumentRecord;
      context: RequestContext;
    },
  ) {
    return tx.auditLog.create({
      data: {
        actorUserId,
        action,
        entityType: "LessonDocument",
        entityId: document.id,
        after: toDocumentInputJson(serializeLessonDocument(document)),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });
  }

  private enqueueProcessingJobs(jobIds: Array<string | null>) {
    const enqueueIds = jobIds.filter((jobId): jobId is string => Boolean(jobId));
    if (enqueueIds.length === 0) {
      return [];
    }

    return this.backgroundJobQueue.enqueueMany(enqueueIds);
  }

  private isSourceReplacement(
    dto: ReplacePrimaryLessonDocumentDto,
  ): dto is ReplacePrimaryLessonDocumentDto & {
    sourceDocumentId: string;
    pageStart: number;
    pageEnd: number;
  } {
    return (
      Boolean(dto.sourceDocumentId) &&
      dto.pageStart !== undefined &&
      dto.pageEnd !== undefined &&
      dto.fileId === undefined
    );
  }

  private isFileReplacement(
    dto: ReplacePrimaryLessonDocumentDto,
  ): dto is ReplacePrimaryLessonDocumentDto & { fileId: string } {
    return (
      Boolean(dto.fileId) &&
      dto.sourceDocumentId === undefined &&
      dto.pageStart === undefined &&
      dto.pageEnd === undefined
    );
  }
}
