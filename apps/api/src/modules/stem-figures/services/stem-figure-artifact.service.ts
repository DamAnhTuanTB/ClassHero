import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  FilePurpose,
  FileStatus,
  FileVisibility,
  StemFigureRevisionStatus,
  StemFigureStatus,
  Prisma,
} from "@prisma/client";

import { throwBadRequest } from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import type { EnvConfig } from "#api/config/env.validation";
import { ObjectStorageService } from "#api/modules/files/services/object-storage.service";
import { stemFigureRenderPlanSchema } from "#api/modules/ai/types/lesson-summary.types";
import { reconcileLessonSummaryReviewIssues } from "#api/modules/learning-paths/utils/lesson-summary-review";
import {
  ensureStemFigureSummaryReference,
} from "#api/modules/stem-figures/utils/stem-figure-summary-reference";

@Injectable()
export class StemFigureArtifactService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ObjectStorageService)
    private readonly storage: ObjectStorageService,
    @Inject(ConfigService)
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async promoteSvg(input: {
    figureId: string;
    revisionId: string;
    svg: string;
    actorUserId?: string | null;
    expectedCurrentRevisionId?: string | null;
    automatic: boolean;
    metadata?: { altText: string; caption: string | null };
  }) {
    const buffer = Buffer.from(input.svg, "utf8");
    const checksum = createHash("sha256").update(buffer).digest("hex");
    const objectKey = this.objectKey(`${input.figureId}-${input.revisionId}.svg`);
    await this.storage.uploadBuffer(objectKey, buffer, "image/svg+xml");
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const figure = await transaction.stemFigure.findFirst({
          where: {
            id: input.figureId,
            deletedAt: null,
            pendingRevisionId: input.revisionId,
            ...(input.expectedCurrentRevisionId !== undefined
              ? { currentRevisionId: input.expectedCurrentRevisionId }
              : {}),
          },
          select: {
            id: true,
            lessonSummaryId: true,
            blockPath: true,
            figureIndex: true,
            planJson: true,
          },
        });
        if (!figure) {
          throwBadRequest(
            "STEM_FIGURE_REVISION_CONFLICT",
            "Hình đã thay đổi trong lúc áp dụng. Hãy tải lại trước khi tiếp tục.",
          );
        }
        const revision = await transaction.stemFigureRevision.findFirst({
          where: {
            id: input.revisionId,
            stemFigureId: input.figureId,
            status: input.automatic
              ? StemFigureRevisionStatus.RENDERING
              : StemFigureRevisionStatus.DRAFT_READY,
          },
          select: {
            id: true,
            sanitizedSvgHash: true,
            altText: true,
            caption: true,
          },
        });
        if (!revision || revision.sanitizedSvgHash !== checksum) {
          throwBadRequest(
            "STEM_FIGURE_REVISION_CONFLICT",
            "Bản SVG không còn khớp với revision đã kiểm tra.",
          );
        }
        const appliedAltText = input.metadata?.altText ?? revision.altText;
        const appliedCaption = input.metadata?.caption ?? revision.caption;
        const file = await transaction.file.create({
          data: this.fileData({
            objectKey,
            originalName: `stem-figure-${input.figureId}.svg`,
            mimeType: "image/svg+xml",
            buffer,
            actorUserId: input.actorUserId,
            uploadSource: input.automatic
              ? "stem-figure.auto-promote"
              : "stem-figure.admin-apply",
            figureId: input.figureId,
            revisionId: input.revisionId,
            visibility: FileVisibility.PUBLIC,
          }),
          select: { id: true },
        });
        await transaction.stemFigureRevision.update({
          where: { id: input.revisionId },
          data: {
            status: StemFigureRevisionStatus.SUCCEEDED,
            deliveryFileId: file.id,
            previewSvg: null,
            finishedAt: new Date(),
            ...(input.metadata
              ? { altText: appliedAltText, caption: appliedCaption }
              : {}),
          },
        });
        await transaction.stemFigure.update({
          where: { id: input.figureId },
          data: {
            status: StemFigureStatus.SUCCEEDED,
            currentRevisionId: input.revisionId,
            pendingRevisionId: null,
            lastErrorCategory: null,
            lastErrorCode: null,
            lastErrorMessage: null,
          },
        });
        await this.updateSummaryReference(
          transaction,
          figure,
          appliedAltText,
          appliedCaption,
        );
        return { fileId: file.id, checksum };
      });
    } catch (error) {
      await this.storage.deleteObject(objectKey).catch(() => undefined);
      throw error;
    }
  }

  async updateCurrentMetadata(input: {
    figureId: string;
    revisionId: string;
    altText: string;
    caption: string | null;
  }) {
    return this.prisma.$transaction(async (transaction) => {
      const figure = await transaction.stemFigure.findFirst({
        where: {
          id: input.figureId,
          deletedAt: null,
          currentRevisionId: input.revisionId,
        },
        select: {
          id: true,
          lessonSummaryId: true,
          blockPath: true,
          figureIndex: true,
          planJson: true,
        },
      });
      if (!figure) {
        throwBadRequest(
          "STEM_FIGURE_REVISION_CONFLICT",
          "Hình đã thay đổi trong lúc áp dụng. Hãy tải lại trước khi tiếp tục.",
        );
      }
      const revision = await transaction.stemFigureRevision.findFirst({
        where: {
          id: input.revisionId,
          stemFigureId: input.figureId,
          status: StemFigureRevisionStatus.SUCCEEDED,
        },
        select: { id: true },
      });
      if (!revision) {
        throwBadRequest(
          "STEM_FIGURE_REVISION_CONFLICT",
          "Phiên bản hình hiện tại không còn khớp. Hãy tải lại trước khi tiếp tục.",
        );
      }
      await transaction.stemFigureRevision.update({
        where: { id: revision.id },
        data: { altText: input.altText, caption: input.caption },
      });
      await this.updateSummaryReference(
        transaction,
        figure,
        input.altText,
        input.caption,
      );
      return { revisionId: revision.id };
    });
  }

  private async updateSummaryReference(
    transaction: Prisma.TransactionClient,
    figure: {
      id: string;
      lessonSummaryId: string | null;
      blockPath: string;
      figureIndex: number;
      planJson: Prisma.JsonValue;
    },
    altText: string,
    caption: string | null,
  ) {
    if (!figure.lessonSummaryId) return;
    const summary = await transaction.lessonSummary.findUnique({
      where: { id: figure.lessonSummaryId },
      select: { contentJson: true },
    });
    if (!summary) return;
    const plan = stemFigureRenderPlanSchema.parse(figure.planJson);
    const content = ensureStemFigureSummaryReference(summary.contentJson, {
      blockPath: figure.blockPath,
      figureIndex: figure.figureIndex,
      figureId: figure.id,
      figureOrigin: plan.figureOrigin,
      altText,
      caption,
    });
    await transaction.lessonSummary.update({
      where: { id: figure.lessonSummaryId },
      data: {
        contentJson: reconcileLessonSummaryReviewIssues(
          content as Record<string, unknown>,
        ) as Prisma.InputJsonValue,
      },
    });
  }

  private objectKey(originalName: string) {
    return this.storage.createObjectKey({
      environment: this.config.get("NODE_ENV", { infer: true }),
      originalName,
      purpose: FilePurpose.AI_DIAGRAM,
    });
  }

  private fileData(input: {
    objectKey: string;
    originalName: string;
    mimeType: string;
    buffer: Buffer;
    actorUserId?: string | null;
    uploadSource: string;
    figureId: string;
    revisionId: string;
    visibility: FileVisibility;
  }) {
    return {
      provider: this.storage.fileProvider,
      purpose: FilePurpose.AI_DIAGRAM,
      bucket: this.storage.bucketName,
      objectKey: input.objectKey,
      originalName: input.originalName,
      mimeType: input.mimeType,
      sizeBytes: BigInt(input.buffer.length),
      visibility: input.visibility,
      status: FileStatus.READY,
      uploadedById: input.actorUserId ?? null,
      publicUrl:
        input.visibility === FileVisibility.PUBLIC
          ? this.storage.getPublicUrl(input.objectKey)
          : null,
      checksum: createHash("sha256").update(input.buffer).digest("hex"),
      metadataJson: {
        uploadSource: input.uploadSource,
        figureId: input.figureId,
        revisionId: input.revisionId,
      },
    } as const;
  }
}
