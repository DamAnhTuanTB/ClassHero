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
import { lessonDocumentSelect } from "#api/modules/learning-paths/selectors/document.selects";
import { serializeLessonDocument } from "#api/modules/learning-paths/serializers/document.serializers";
import type { LessonDocumentRecord } from "#api/modules/learning-paths/types/document.types";
import { UpdateLessonDocumentDto } from "#api/modules/learning-paths/dto/update-lesson-document.dto";
import type { RequestContext } from "#api/modules/learning-paths/types/lesson.types";
import {
  handleDocumentPrismaError,
  normalizeOptionalTitle,
  throwDocumentFileNotFound,
  throwLessonDocumentNotFound,
  toDocumentInputJson,
} from "#api/modules/learning-paths/utils/document.helpers";
import { throwLessonNotFound } from "#api/modules/learning-paths/utils/lesson.helpers";
import { SourceDocumentsService } from "#api/modules/learning-paths/services/source-documents.service";

@Injectable()
export class LessonDocumentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(BackgroundJobQueueService)
    private readonly backgroundJobQueue: BackgroundJobQueueService,
    @Inject(SourceDocumentsService)
    private readonly sourceDocumentsService: SourceDocumentsService,
  ) {}

  async listForLesson(lessonId: string) {
    await this.assertLessonExists(this.prisma, lessonId);

    const documents = await this.prisma.lessonDocument.findMany({
      where: {
        lessonId,
        replacedAt: null,
      },
      select: lessonDocumentSelect,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
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
          learningPath: {
            deletedAt: null,
          },
          OR: [{ chapterId: null }, { chapter: { deletedAt: null } }],
        },
      },
      select: lessonDocumentSelect,
      orderBy: [{ lessonId: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
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
        await this.assertLessonExists(tx, lessonId);

        if (this.isSourceReplacement(dto)) {
          const created =
            await this.sourceDocumentsService.assignSingleLessonPageRangeInTransaction(
              tx,
              {
                actorUserId,
                context,
                lessonId,
                pageEnd: dto.pageEnd,
                pageStart: dto.pageStart,
                sourceDocumentId: dto.sourceDocumentId,
              },
            );

          if (!created) {
            throwBadRequest("VALIDATION_ERROR", "Không thể tạo tài liệu trích xuất");
          }

          await this.auditDocumentChange(tx, {
            actorUserId,
            action: "LESSON_SOURCE_EXTRACTION_REPLACED",
            document: created,
            context,
          });

          return created;
        }

        if (this.isFileReplacement(dto)) {
          const file = await this.getLessonDocumentFile(tx, dto.fileId);

          const created = await tx.lessonDocument.create({
            data: {
              lessonId,
              fileId: file.id,
              kind: LessonDocumentKind.PRIMARY_FROM_SOURCE,
              title: normalizeOptionalTitle(dto.title),
              status: DocumentStatus.PROCESSING,
              contentHash: file.checksum,
              metadataJson: toDocumentInputJson({
                source: "uploaded_primary_document",
                processingMode: "processing",
              }),
            },
            select: lessonDocumentSelect,
          });

          const withJob = await this.attachDocumentJob(tx, {
            actorUserId,
            lessonId,
            document: created,
            action: "LESSON_PRIMARY_UPLOAD_PROCESSING",
            inputMeta: {
              fileId: file.id,
            },
          });

          await this.auditDocumentChange(tx, {
            actorUserId,
            action: "LESSON_PRIMARY_DOCUMENT_CREATED",
            document: withJob,
            context,
          });

          return withJob;
        }

        throwBadRequest(
          "VALIDATION_ERROR",
          "Cần gửi sourceDocumentId + pageStart/pageEnd hoặc fileId cho tài liệu nền tảng",
        );
      });

      await this.enqueueProcessingJobs([document.processingJobId]);

      return serializeLessonDocument(document);
    } catch (error) {
      handleDocumentPrismaError(error);
    }
  }

  async createLessonDocument(
    lessonId: string,
    actorUserId: string,
    dto: CreateLessonDocumentDto,
    context: RequestContext = {},
  ) {
    try {
      const document = await this.prisma.$transaction(async (tx) => {
        await this.assertLessonExists(tx, lessonId);
        const file = await this.getLessonDocumentFile(tx, dto.fileId);
        const isStorageOnly = dto.processingMode === "STORAGE_ONLY";

        const kind = dto.kind || LessonDocumentKind.SUPPLEMENT;
        const source =
          kind === LessonDocumentKind.PRIMARY_FROM_SOURCE
            ? "uploaded_primary_document"
            : kind === LessonDocumentKind.HOMEWORK
              ? "uploaded_homework_document"
              : "uploaded_supplement_document";

        const created = await tx.lessonDocument.create({
          data: {
            lessonId,
            fileId: file.id,
            kind,
            sortOrder: dto.sortOrder ?? 0,
            title: normalizeOptionalTitle(dto.title),
            status: isStorageOnly ? DocumentStatus.READY : DocumentStatus.PROCESSING,
            contentHash: file.checksum,
            processedAt: isStorageOnly ? new Date() : undefined,
            metadataJson: toDocumentInputJson({
              source,
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
              action:
                kind === LessonDocumentKind.PRIMARY_FROM_SOURCE
                  ? "LESSON_PRIMARY_UPLOAD_PROCESSING"
                  : "LESSON_SUPPLEMENT_PROCESSING",
              inputMeta: {
                fileId: file.id,
              },
            });

        await this.auditDocumentChange(tx, {
          actorUserId,
          action: "LESSON_DOCUMENT_CREATED",
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

  async updateLessonDocument(
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
      dto.kind !== LessonDocumentKind.PRIMARY_FROM_SOURCE &&
      dto.kind !== LessonDocumentKind.SUPPLEMENT &&
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
                LessonDocumentKind.PRIMARY_FROM_SOURCE,
                LessonDocumentKind.SUPPLEMENT,
                LessonDocumentKind.HOMEWORK,
              ],
            },
          },
          select: lessonDocumentSelect,
        });

        if (!existing) {
          throwLessonDocumentNotFound();
        }

        if (existing.pageRangeId || existing.sourceDocumentId) {
          throwConflict(
            "CONFLICT",
            "Tài liệu trích xuất phải được cập nhật qua collection khối trích xuất của buổi học",
          );
        }

        const kind = dto.kind ?? existing.kind;

        const updated = await tx.lessonDocument.update({
          where: { id: documentId },
          data: {
            ...(dto.kind !== undefined ? { kind } : {}),
            ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
            ...(dto.title !== undefined
              ? { title: normalizeOptionalTitle(dto.title) }
              : {}),
            replacedAt: null,
          },
          select: lessonDocumentSelect,
        });

        await this.auditDocumentChange(tx, {
          actorUserId,
          action: "LESSON_DOCUMENT_UPDATED",
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

  async deleteLessonDocument(
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
          document.kind === LessonDocumentKind.PRIMARY_FROM_SOURCE &&
          document.sourceDocumentId
        ) {
          throwConflict(
            "CONFLICT",
            "Tài liệu nền tảng từ khoảng trang phải được xóa bằng flow khoảng trang",
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
            action: "LESSON_DOCUMENT_DELETED",
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
        learningPath: {
          deletedAt: null,
        },
        OR: [{ chapterId: null }, { chapter: { deletedAt: null } }],
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
