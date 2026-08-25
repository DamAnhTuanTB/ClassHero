import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  FilePurpose,
  FileStatus,
  FileVisibility,
  QuizFigureRevisionStatus,
  QuizFigureStatus,
} from "@prisma/client";

import { PrismaService } from "#api/common/prisma/prisma.service";
import type { EnvConfig } from "#api/config/env.validation";
import { ObjectStorageService } from "#api/modules/files/services/object-storage.service";

@Injectable()
export class QuizFigureArtifactService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ObjectStorageService) private readonly storage: ObjectStorageService,
    @Inject(ConfigService) private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async readDeliveryObject(objectKey: string) {
    return this.storage.downloadObject(objectKey);
  }

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
      originalName: `quiz-figure-${input.figureId}-${input.revisionId}.svg`,
      purpose: FilePurpose.AI_DIAGRAM,
    });
    await this.storage.uploadBuffer(objectKey, buffer, "image/svg+xml");
    try {
      return await this.prisma.$transaction(async (tx) => {
        const figure = await tx.quizFigure.findFirstOrThrow({
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
            originalName: `quiz-figure-${figure.id}.svg`,
            mimeType: "image/svg+xml",
            sizeBytes: BigInt(buffer.length),
            visibility: FileVisibility.PUBLIC,
            status: FileStatus.READY,
            uploadedById: input.actorUserId ?? null,
            publicUrl: this.storage.getPublicUrl(objectKey),
            checksum,
            metadataJson: {
              uploadSource: "quiz-figure.auto-promote",
              figureId: figure.id,
              revisionId: input.revisionId,
            },
          },
          select: { id: true, publicUrl: true },
        });
        await tx.quizFigureRevision.update({
          where: { id: input.revisionId },
          data: {
            status: QuizFigureRevisionStatus.SUCCEEDED,
            deliveryFileId: file.id,
            previewSvg: null,
            sanitizedSvgHash: checksum,
            finishedAt: new Date(),
          },
        });
        await tx.quizFigure.update({
          where: { id: figure.id },
          data: {
            status: QuizFigureStatus.SUCCEEDED,
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
  }) {
    return this.prisma.$transaction(async (tx) => {
      const figure = await tx.quizFigure.findFirstOrThrow({
        where: { id: input.figureId, deletedAt: null },
        select: { id: true, currentRevisionId: true },
      });
      const file = await tx.file.findFirstOrThrow({
        where: {
          id: input.fileId,
          status: FileStatus.READY,
          mimeType: { startsWith: "image/" },
        },
        select: { id: true },
      });
      const latest = await tx.quizFigureRevision.findFirst({
        where: { quizFigureId: figure.id },
        orderBy: { sourceVersion: "desc" },
        select: { sourceVersion: true },
      });
      const revision = await tx.quizFigureRevision.create({
        data: {
          quizFigureId: figure.id,
          sourceKind: "ADMIN_UPLOAD",
          origin: "ADMIN_UPLOAD",
          status: "SUCCEEDED",
          sourceVersion: (latest?.sourceVersion ?? 0) + 1,
          altText: input.altText,
          caption: input.caption ?? null,
          deliveryFileId: file.id,
          createdById: input.actorUserId,
          finishedAt: new Date(),
        },
        select: { id: true },
      });
      await tx.quizFigure.update({
        where: { id: figure.id },
        data: {
          status: "SUCCEEDED",
          currentRevisionId: revision.id,
          pendingRevisionId: null,
        },
      });
      return revision;
    });
  }
}
