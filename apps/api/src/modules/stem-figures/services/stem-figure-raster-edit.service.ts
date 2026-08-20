import { createHash } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  FilePurpose,
  FileStatus,
  FileVisibility,
  Prisma,
  StemFigureStatus,
} from "@prisma/client";
import sharp from "sharp";

import {
  throwBadRequest,
  throwConflict,
  throwNotFound,
  throwServiceUnavailable,
} from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import type { EnvConfig } from "#api/config/env.validation";
import { ObjectStorageService } from "#api/modules/files/services/object-storage.service";
import type { UploadedFileBuffer } from "#api/modules/files/types/uploaded-file.types";
import { stemFigureRenderPlanSchema } from "#api/modules/ai/types/lesson-summary.types";
import { reconcileLessonSummaryReviewIssues } from "#api/modules/learning-paths/utils/lesson-summary-review";
import type { StemFigureRasterEditDto } from "#api/modules/stem-figures/dto/stem-figure-raster-edit.dto";
import {
  stemFigureSelect,
  type StemFigureRecord,
} from "#api/modules/stem-figures/selectors/stem-figure.selects";
import { resolveStemFigureCurrentAssetKind } from "#api/modules/stem-figures/serializers/stem-figure.serializers";
import { StemFiguresService } from "#api/modules/stem-figures/services/stem-figures.service";
import {
  applyConservativeRasterEnhancement,
  createSimpleBackgroundRemovalOverlay,
  parseStemFigureRasterEditOperations,
  STEM_FIGURE_RASTER_EDIT_MAX_PIXELS,
  STEM_FIGURE_RASTER_EDIT_PIPELINE_VERSION,
  STEM_FIGURE_RASTER_MASK_MAX_BYTES,
  STEM_FIGURE_RASTER_PREVIEW_MAX_EDGE,
  StemFigureRasterEditValidationError,
  type StemFigureRasterEditOperations,
} from "#api/modules/stem-figures/utils/stem-figure-raster-edit";
import { ensureStemFigureSummaryReference } from "#api/modules/stem-figures/utils/stem-figure-summary-reference";

const RASTER_VALIDATOR_VERSION = "stem-raster-validator-v1";

@Injectable()
export class StemFigureRasterEditService {
  private readonly logger = new Logger(StemFigureRasterEditService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService)
    private readonly config: ConfigService<EnvConfig, true>,
    @Inject(ObjectStorageService)
    private readonly storage: ObjectStorageService,
    @Inject(StemFiguresService)
    private readonly figures: StemFiguresService,
  ) {}

  async preview(
    lessonId: string,
    figureId: string,
    dto: StemFigureRasterEditDto,
    maskFile: UploadedFileBuffer | undefined,
  ) {
    const startedAt = performance.now();
    const operations = this.parseOperations(dto.operations);
    const figure = await this.requireEditableFigure(lessonId, figureId, dto);
    const bytes = await this.downloadCurrentAsset(figure);
    const processed = await this.processRaster({
      bytes,
      maskFile,
      operations,
      preview: true,
    });
    const durationMs = Math.round(performance.now() - startedAt);
    this.logger.log(
      JSON.stringify({
        metric: "raster_edit_preview_duration_ms",
        durationMs,
        operations: enabledOperationNames(operations),
        sourcePixels: processed.sourcePixels,
        outputBytes: processed.buffer.length,
        maskCoverageRatio: processed.maskCoverageRatio,
        backgroundVariance: processed.backgroundVariance,
      }),
    );
    return {
      pipelineVersion: STEM_FIGURE_RASTER_EDIT_PIPELINE_VERSION,
      previewDataUrl: `data:image/webp;base64,${processed.buffer.toString("base64")}`,
      width: processed.width,
      height: processed.height,
      maskCoverageRatio: processed.maskCoverageRatio,
      backgroundVariance: processed.backgroundVariance,
      warnings: buildWarnings(operations),
    };
  }

  async apply(
    lessonId: string,
    figureId: string,
    actorUserId: string,
    dto: StemFigureRasterEditDto,
    maskFile: UploadedFileBuffer | undefined,
  ) {
    const startedAt = performance.now();
    const operations = this.parseOperations(dto.operations);
    const figure = await this.requireEditableFigure(lessonId, figureId, dto);
    const currentRevision = figure.currentRevision!;
    const currentFile = currentRevision.deliveryFile!;
    const bytes = await this.downloadCurrentAsset(figure);
    const processed = await this.processRaster({
      bytes,
      maskFile,
      operations,
      preview: false,
    });
    const checksum = createHash("sha256").update(processed.buffer).digest("hex");
    const sourceVersion = await this.nextSourceVersion(figure.id);
    const objectKey = this.storage.createObjectKey({
      environment: this.config.get("NODE_ENV", { infer: true }),
      originalName: `stem-figure-${figure.id}-${sourceVersion}-edited.webp`,
      purpose: FilePurpose.AI_DIAGRAM,
    });
    await this.storage.uploadBuffer(objectKey, processed.buffer, "image/webp");

    let auditId: string;
    let revisionId: string;
    try {
      const persisted = await this.prisma.$transaction(async (transaction) => {
        const guardedFigure = await transaction.stemFigure.findFirst({
          where: {
            id: figure.id,
            lessonId,
            deletedAt: null,
            currentRevisionId: dto.baseCurrentRevisionId ?? null,
            pendingRevisionId: dto.basePendingRevisionId ?? null,
          },
          select: {
            id: true,
            lessonSummaryId: true,
            blockPath: true,
            figureIndex: true,
            planJson: true,
          },
        });
        if (!guardedFigure) {
          throwConflict(
            "STEM_FIGURE_REVISION_CONFLICT",
            "Hình đã có revision mới. Hãy tải lại trước khi áp dụng.",
          );
        }
        const storedFile = await transaction.file.create({
          data: {
            provider: this.storage.fileProvider,
            purpose: FilePurpose.AI_DIAGRAM,
            bucket: this.storage.bucketName,
            objectKey,
            originalName: `stem-figure-${figure.id}-edited.webp`,
            mimeType: "image/webp",
            sizeBytes: BigInt(processed.buffer.length),
            visibility: FileVisibility.PUBLIC,
            status: FileStatus.READY,
            uploadedById: actorUserId,
            publicUrl: this.storage.getPublicUrl(objectKey),
            checksum,
            metadataJson: {
              uploadSource: "stem-figure.raster-edit",
              derivedFromRevisionId: currentRevision.id,
              editPipelineVersion: STEM_FIGURE_RASTER_EDIT_PIPELINE_VERSION,
              editOperations: enabledOperationNames(operations),
              maskCoverageRatio: processed.maskCoverageRatio,
              backgroundVariance: processed.backgroundVariance,
              textbookSourceObjectKey: readTextbookSourceObjectKey(
                currentFile.metadataJson,
              ),
              width: processed.width,
              height: processed.height,
            },
          },
          select: { id: true },
        });
        const revision = await transaction.stemFigureRevision.create({
          data: {
            stemFigureId: figure.id,
            sourceKind: "ADMIN_UPLOAD",
            origin: "ADMIN_UPLOAD",
            status: "SUCCEEDED",
            sourceHash: checksum,
            sourceVersion,
            altText: currentRevision.altText,
            caption: currentRevision.caption,
            deliveryFileId: storedFile.id,
            sanitizedSvgHash: checksum,
            rendererVersion: STEM_FIGURE_RASTER_EDIT_PIPELINE_VERSION,
            validatorVersion: RASTER_VALIDATOR_VERSION,
            referenceSnapshotJson:
              (currentRevision.referenceSnapshotJson as Prisma.InputJsonValue | null) ??
              undefined,
            referenceSnapshotHash: currentRevision.referenceSnapshotHash,
            generationBriefHash: currentRevision.generationBriefHash,
            createdById: actorUserId,
            finishedAt: new Date(),
          },
          select: { id: true },
        });
        await transaction.stemFigure.update({
          where: { id: figure.id },
          data: {
            status: StemFigureStatus.SUCCEEDED,
            currentRevisionId: revision.id,
            pendingRevisionId: null,
            lastErrorCategory: null,
            lastErrorCode: null,
            lastErrorMessage: null,
          },
        });
        await this.updateSummaryReference(transaction, guardedFigure, currentRevision);
        const audit = await transaction.auditLog.create({
          data: {
            actorUserId,
            action: "STEM_FIGURE_RASTER_EDIT_APPLIED",
            entityType: "STEM_FIGURE",
            entityId: figure.id,
            before: {
              revisionId: currentRevision.id,
              fileId: currentRevision.deliveryFileId,
            },
            after: {
              revisionId: revision.id,
              fileId: storedFile.id,
              pipelineVersion: STEM_FIGURE_RASTER_EDIT_PIPELINE_VERSION,
              operations: enabledOperationNames(operations),
            },
            metadata: {
              maskCoverageRatio: processed.maskCoverageRatio,
              backgroundVariance: processed.backgroundVariance,
              sourcePixels: processed.sourcePixels,
              outputBytes: processed.buffer.length,
            },
          },
          select: { id: true },
        });
        return { auditId: audit.id, revisionId: revision.id };
      });
      auditId = persisted.auditId;
      revisionId = persisted.revisionId;
    } catch (error) {
      await this.storage.deleteObject(objectKey).catch(() => undefined);
      throw error;
    }

    const durationMs = Math.round(performance.now() - startedAt);
    this.logger.log(
      JSON.stringify({
        metric: "raster_edit_apply_duration_ms",
        durationMs,
        operations: enabledOperationNames(operations),
        sourcePixels: processed.sourcePixels,
        outputBytes: processed.buffer.length,
        maskCoverageRatio: processed.maskCoverageRatio,
        backgroundVariance: processed.backgroundVariance,
      }),
    );
    return {
      figure: await this.figures.getForAdmin(lessonId, figureId),
      auditId,
      revisionId,
    };
  }

  private parseOperations(value: string) {
    try {
      return parseStemFigureRasterEditOperations(value);
    } catch (error) {
      this.rethrowRasterValidation(error);
    }
  }

  private async requireEditableFigure(
    lessonId: string,
    figureId: string,
    dto: StemFigureRasterEditDto,
  ) {
    const figure = await this.prisma.stemFigure.findFirst({
      where: { id: figureId, lessonId, deletedAt: null },
      select: stemFigureSelect,
    });
    if (!figure) {
      throwNotFound("STEM_FIGURE_NOT_FOUND", "Không tìm thấy hình STEM.");
    }
    const working = figure.pendingRevision ?? figure.currentRevision;
    if (
      figure.currentRevisionId !== (dto.baseCurrentRevisionId ?? null) ||
      figure.pendingRevisionId !== (dto.basePendingRevisionId ?? null) ||
      working?.sourceVersion !== dto.baseSourceVersion
    ) {
      throwConflict(
        "STEM_FIGURE_REVISION_CONFLICT",
        "Hình đã có revision mới. Hãy tải lại trước khi chỉnh sửa.",
      );
    }
    if (
      figure.status !== StemFigureStatus.SUCCEEDED ||
      figure.pendingRevisionId !== null ||
      figure.currentRevision?.status !== "SUCCEEDED" ||
      !figure.currentRevision.deliveryFile ||
      resolveStemFigureCurrentAssetKind(figure.currentRevision) !== "TEXTBOOK_SOURCE"
    ) {
      throwBadRequest(
        "STEM_FIGURE_RASTER_EDIT_UNSUPPORTED",
        "Chỉ có thể chỉnh ảnh raster sách giáo khoa đã xử lý thành công.",
      );
    }
    return figure;
  }

  private async downloadCurrentAsset(figure: StemFigureRecord) {
    const objectKey = figure.currentRevision?.deliveryFile?.objectKey;
    if (!objectKey) {
      throwBadRequest(
        "STEM_FIGURE_RASTER_EDIT_UNSUPPORTED",
        "Hình chưa có file raster để chỉnh sửa.",
      );
    }
    try {
      return await this.storage.downloadObject(objectKey);
    } catch {
      throwServiceUnavailable(
        "STEM_FIGURE_RASTER_ASSET_UNAVAILABLE",
        "Không tải được ảnh hiện tại. Vui lòng thử lại sau.",
      );
    }
  }

  private async processRaster(input: {
    bytes: Buffer;
    maskFile: UploadedFileBuffer | undefined;
    operations: StemFigureRasterEditOperations;
    preview: boolean;
  }) {
    const maxBytes = Math.floor(
      this.config.get("MAX_IMAGE_UPLOAD_MB", { infer: true }) * 1024 * 1024,
    );
    if (input.bytes.length > maxBytes) {
      throwBadRequest(
        "STEM_FIGURE_RASTER_EDIT_UNSUPPORTED",
        "Ảnh hiện tại vượt dung lượng chỉnh sửa cho phép.",
      );
    }
    if (input.operations.removeSimpleDetails && !input.maskFile) {
      throwBadRequest("STEM_FIGURE_RASTER_MASK_INVALID", "Hãy tô vùng chi tiết cần xóa.");
    }
    if (!input.operations.removeSimpleDetails && input.maskFile) {
      throwBadRequest(
        "STEM_FIGURE_RASTER_MASK_INVALID",
        "Vùng chọn chỉ được gửi khi bật công cụ xóa chi tiết thừa.",
      );
    }
    if (
      input.maskFile &&
      input.maskFile.buffer.length > STEM_FIGURE_RASTER_MASK_MAX_BYTES
    ) {
      throwBadRequest(
        "STEM_FIGURE_RASTER_MASK_INVALID",
        "Vùng chọn vượt dung lượng cho phép.",
      );
    }

    let metadata;
    try {
      metadata = await sharp(input.bytes, { failOn: "error" }).metadata();
    } catch {
      throwBadRequest(
        "STEM_FIGURE_RASTER_EDIT_UNSUPPORTED",
        "Ảnh hiện tại không giải mã được.",
      );
    }
    if (
      !metadata.width ||
      !metadata.height ||
      !["jpeg", "png", "webp"].includes(metadata.format ?? "") ||
      metadata.width * metadata.height > STEM_FIGURE_RASTER_EDIT_MAX_PIXELS
    ) {
      throwBadRequest(
        "STEM_FIGURE_RASTER_EDIT_UNSUPPORTED",
        "Kích thước hoặc định dạng ảnh chưa được công cụ hỗ trợ.",
      );
    }

    const sourcePipeline = sharp(input.bytes, { failOn: "error" }).rotate();
    if (input.preview) {
      sourcePipeline.resize({
        width: STEM_FIGURE_RASTER_PREVIEW_MAX_EDGE,
        height: STEM_FIGURE_RASTER_PREVIEW_MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      });
    }
    const decoded = await sourcePipeline
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const width = decoded.info.width;
    const height = decoded.info.height;
    let maskCoverageRatio: number | null = null;
    let backgroundVariance: number | null = null;
    let overlay: Buffer | null = null;

    if (input.operations.removeSimpleDetails && input.maskFile) {
      const mask = await this.decodeMask(input.maskFile, width, height);
      try {
        const removal = createSimpleBackgroundRemovalOverlay({
          rgba: decoded.data,
          mask,
          width,
          height,
        });
        overlay = removal.overlay;
        maskCoverageRatio = removal.maskCoverageRatio;
        backgroundVariance = removal.backgroundVariance;
      } catch (error) {
        this.rethrowRasterValidation(error);
      }
    }

    let pipeline = sharp(decoded.data, {
      raw: { width, height, channels: 4 },
      failOn: "error",
    });
    if (overlay) {
      pipeline = pipeline.composite([
        { input: overlay, raw: { width, height, channels: 4 } },
      ]);
    }
    if (input.operations.enhance) {
      pipeline = applyConservativeRasterEnhancement(pipeline);
    }
    const buffer = await pipeline.webp({ lossless: true, effort: 4 }).toBuffer();
    return {
      buffer,
      width,
      height,
      sourcePixels: width * height,
      maskCoverageRatio,
      backgroundVariance,
    };
  }

  private async decodeMask(
    file: UploadedFileBuffer,
    targetWidth: number,
    targetHeight: number,
  ) {
    let metadata;
    try {
      metadata = await sharp(file.buffer, { failOn: "error" }).metadata();
    } catch {
      throwBadRequest("STEM_FIGURE_RASTER_MASK_INVALID", "Vùng chọn không giải mã được.");
    }
    if (
      file.mimetype !== "image/png" ||
      metadata.format !== "png" ||
      !metadata.width ||
      !metadata.height ||
      metadata.width > STEM_FIGURE_RASTER_PREVIEW_MAX_EDGE ||
      metadata.height > STEM_FIGURE_RASTER_PREVIEW_MAX_EDGE
    ) {
      throwBadRequest(
        "STEM_FIGURE_RASTER_MASK_INVALID",
        "Vùng chọn phải là PNG hợp lệ trong giới hạn xem trước.",
      );
    }
    const sourceRatio = targetWidth / targetHeight;
    const maskRatio = metadata.width / metadata.height;
    if (Math.abs(sourceRatio - maskRatio) / sourceRatio > 0.01) {
      throwBadRequest(
        "STEM_FIGURE_RASTER_MASK_INVALID",
        "Tỷ lệ vùng chọn không khớp với ảnh hiện tại.",
      );
    }
    const decoded = await sharp(file.buffer, { failOn: "error" })
      .resize(targetWidth, targetHeight, { fit: "fill", kernel: "nearest" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const binary = new Uint8Array(targetWidth * targetHeight);
    for (let index = 0; index < binary.length; index += 1) {
      binary[index] = (decoded.data[index * 4 + 3] ?? 0) >= 96 ? 1 : 0;
    }
    return binary;
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
    revision: NonNullable<StemFigureRecord["currentRevision"]>,
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
      altText: revision.altText,
      caption: revision.caption,
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

  private async nextSourceVersion(figureId: string) {
    const latest = await this.prisma.stemFigureRevision.findFirst({
      where: { stemFigureId: figureId },
      orderBy: { sourceVersion: "desc" },
      select: { sourceVersion: true },
    });
    return (latest?.sourceVersion ?? 0) + 1;
  }

  private rethrowRasterValidation(error: unknown): never {
    if (error instanceof StemFigureRasterEditValidationError) {
      throwBadRequest(error.code, error.message, error.details);
    }
    throw error;
  }
}

function readTextbookSourceObjectKey(value: Prisma.JsonValue): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throwBadRequest(
      "STEM_FIGURE_RASTER_EDIT_UNSUPPORTED",
      "Ảnh hiện tại không còn provenance sách giáo khoa.",
    );
  }
  const objectKey = (value as Prisma.JsonObject).textbookSourceObjectKey;
  if (typeof objectKey !== "string" || objectKey.trim().length === 0) {
    throwBadRequest(
      "STEM_FIGURE_RASTER_EDIT_UNSUPPORTED",
      "Ảnh hiện tại không còn provenance sách giáo khoa.",
    );
  }
  return objectKey;
}

function enabledOperationNames(operations: StemFigureRasterEditOperations) {
  return [
    ...(operations.removeSimpleDetails ? ["REMOVE_SIMPLE_DETAILS"] : []),
    ...(operations.enhance ? ["ENHANCE"] : []),
  ];
}

function buildWarnings(operations: StemFigureRasterEditOperations) {
  return [
    ...(operations.enhance
      ? ["Làm nét chỉ cải thiện pixel hiện có, không phục dựng chi tiết đã mất."]
      : []),
    ...(operations.removeSimpleDetails
      ? ["Công cụ xóa chỉ phù hợp với chi tiết nhỏ trên nền gần đồng nhất."]
      : []),
  ];
}
