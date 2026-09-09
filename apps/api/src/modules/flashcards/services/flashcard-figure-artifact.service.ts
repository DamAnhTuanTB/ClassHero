import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  FilePurpose,
  FileStatus,
  FileVisibility,
  FlashcardFigureRevisionStatus,
  FlashcardFigureRevisionOrigin,
  FlashcardFigureStatus,
  type Prisma,
} from "@prisma/client";

import { badRequestException } from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import type { EnvConfig } from "#api/config/env.validation";
import { ObjectStorageService } from "#api/modules/files/services/object-storage.service";

@Injectable()
export class FlashcardFigureArtifactService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ObjectStorageService) private readonly storage: ObjectStorageService,
    @Inject(ConfigService) private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async promoteSvg(input: {
    figureId: string;
    revisionId: string;
    svg: string;
    actorUserId?: string | null;
  }) {
    const buffer = Buffer.from(input.svg, "utf8");
    const checksum = createHash("sha256").update(buffer).digest("hex");
    const objectKey = this.storage.createObjectKey({
      environment: this.config.get("NODE_ENV", { infer: true }),
      originalName: `flashcard-figure-${input.figureId}-${input.revisionId}.svg`,
      purpose: FilePurpose.AI_DIAGRAM,
    });
    await this.storage.uploadBuffer(objectKey, buffer, "image/svg+xml");
    try {
      return await this.prisma.$transaction(async (tx) => {
        const figure = await tx.flashcardFigure.findFirstOrThrow({
          where: {
            id: input.figureId,
            deletedAt: null,
            pendingRevisionId: input.revisionId,
          },
          select: { id: true },
        });
        const file = await tx.file.create({
          data: {
            provider: this.storage.fileProvider,
            purpose: FilePurpose.AI_DIAGRAM,
            bucket: this.storage.bucketName,
            objectKey,
            originalName: `flashcard-figure-${figure.id}.svg`,
            mimeType: "image/svg+xml",
            sizeBytes: BigInt(buffer.length),
            visibility: FileVisibility.PUBLIC,
            status: FileStatus.READY,
            uploadedById: input.actorUserId ?? null,
            publicUrl: this.storage.getPublicUrl(objectKey),
            checksum,
            metadataJson: {
              uploadSource: "flashcard-figure.auto-promote",
              figureId: figure.id,
              revisionId: input.revisionId,
            },
          },
          select: { id: true, publicUrl: true },
        });
        await tx.flashcardFigureRevision.update({
          where: { id: input.revisionId },
          data: {
            status: FlashcardFigureRevisionStatus.SUCCEEDED,
            deliveryFileId: file.id,
            previewSvg: null,
            sanitizedSvgHash: checksum,
            finishedAt: new Date(),
          },
        });
        await tx.flashcardFigure.update({
          where: { id: figure.id },
          data: {
            status: FlashcardFigureStatus.SUCCEEDED,
            currentRevisionId: input.revisionId,
            pendingRevisionId: null,
            lastErrorCategory: null,
            lastErrorCode: null,
            lastErrorMessage: null,
          },
        });
        return { fileId: file.id, publicUrl: file.publicUrl, checksum };
      });
    } catch (error) {
      await this.storage.deleteObject(objectKey).catch(() => undefined);
      throw error;
    }
  }

  async attachAdminUpload(input: {
    figureId: string;
    fileId: string;
    actorUserId: string;
    altText: string;
    caption?: string | null;
  }, transaction?: Prisma.TransactionClient) {
    const attach = async (tx: Prisma.TransactionClient) => {
      const figure = await tx.flashcardFigure.findFirstOrThrow({
        where: { id: input.figureId, deletedAt: null },
        select: { id: true },
      });
      const file = await tx.file.findFirst({
        where: {
          id: input.fileId,
          purpose: FilePurpose.QUESTION_IMAGE,
          status: { in: [FileStatus.UPLOADED, FileStatus.READY] },
          mimeType: { startsWith: "image/" },
          deletedAt: null,
        },
        select: { id: true, status: true },
      });
      if (!file) {
        throw badRequestException(
          "FLASHCARD_FIGURE_FILE_NOT_READY",
          "File hình lời giải không hợp lệ hoặc chưa sẵn sàng.",
        );
      }
      if (file.status === FileStatus.UPLOADED) {
        await tx.file.update({
          where: { id: file.id },
          data: { status: FileStatus.READY },
        });
      }
      const latest = await tx.flashcardFigureRevision.findFirst({
        where: { flashcardFigureId: figure.id },
        orderBy: { sourceVersion: "desc" },
        select: { sourceVersion: true },
      });
      const revision = await tx.flashcardFigureRevision.create({
        data: {
          flashcardFigureId: figure.id,
          sourceKind: "ADMIN_UPLOAD",
          origin: FlashcardFigureRevisionOrigin.ADMIN_UPLOAD,
          status: FlashcardFigureRevisionStatus.SUCCEEDED,
          sourceVersion: (latest?.sourceVersion ?? 0) + 1,
          altText: input.altText,
          caption: input.caption ?? null,
          deliveryFileId: file.id,
          createdById: input.actorUserId,
          finishedAt: new Date(),
        },
        select: { id: true },
      });
      await tx.flashcardFigure.update({
        where: { id: figure.id },
        data: {
          status: FlashcardFigureStatus.SUCCEEDED,
          currentRevisionId: revision.id,
          pendingRevisionId: null,
          lastErrorCategory: null,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      });
      return revision;
    };

    return transaction ? attach(transaction) : this.prisma.$transaction(attach);
  }
}
