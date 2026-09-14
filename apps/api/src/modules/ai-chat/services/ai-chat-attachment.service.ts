import { Inject, Injectable, Logger } from "@nestjs/common";
import { AiChatMessageRole, FilePurpose, FileStatus, Prisma } from "@prisma/client";
import sharp from "sharp";
import { throwBadRequest, throwForbidden } from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { ObjectStorageService } from "#api/modules/files/services/object-storage.service";
import type { AiInputImage } from "#api/modules/ai/types/ai-text.types";
import type { ResolvedAiChatRuntimeSettings } from "#api/modules/provider-operations/services/ai-chat-runtime-settings.service";

@Injectable()
export class AiChatAttachmentService {
  private readonly logger = new Logger(AiChatAttachmentService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ObjectStorageService) private readonly storage: ObjectStorageService,
  ) {}

  async validateAndPrepare(
    actorUserId: string,
    fileIds: string[],
    settings: ResolvedAiChatRuntimeSettings,
  ) {
    const uniqueIds = [...new Set(fileIds)];
    const maxImages = settings.maxImagesPerMessage;
    if (uniqueIds.length !== fileIds.length || uniqueIds.length > maxImages) {
      throwBadRequest(
        "AI_CHAT_IMAGE_LIMIT_EXCEEDED",
        `Mỗi tin nhắn chỉ được đính kèm tối đa ${maxImages} ảnh khác nhau.`,
      );
    }
    if (uniqueIds.length === 0) return { files: [], inputImages: [] };

    const files = await this.prisma.file.findMany({
      where: { id: { in: uniqueIds }, deletedAt: null },
      select: {
        id: true,
        uploadedById: true,
        purpose: true,
        status: true,
        mimeType: true,
        sizeBytes: true,
        objectKey: true,
        checksum: true,
        metadataJson: true,
        aiChatMessageAttachments: { select: { id: true }, take: 1 },
      },
    });
    if (files.length !== uniqueIds.length) {
      throwBadRequest("AI_CHAT_IMAGE_NOT_FOUND", "Có ảnh đính kèm không còn tồn tại.");
    }
    const byId = new Map(files.map((file) => [file.id, file]));
    const ordered = uniqueIds.map((id) => byId.get(id)!);
    const maxBytes = settings.maxImageBytes;
    for (const file of ordered) {
      if (
        file.uploadedById !== actorUserId ||
        file.purpose !== FilePurpose.CHAT_IMAGE ||
        file.aiChatMessageAttachments.length > 0
      ) {
        throwForbidden(
          "AI_CHAT_IMAGE_ACCESS_DENIED",
          "Bạn không có quyền dùng một trong các ảnh đính kèm.",
        );
      }
      if (file.status !== FileStatus.UPLOADED && file.status !== FileStatus.READY) {
        throwBadRequest("AI_CHAT_IMAGE_NOT_READY", "Ảnh đính kèm chưa sẵn sàng.");
      }
      if (
        !settings.allowedImageMimeTypes.some(
          (mimeType) => mimeType === file.mimeType,
        )
      ) {
        throwBadRequest(
          "FILE_TYPE_NOT_ALLOWED",
          "Định dạng ảnh không nằm trong thiết lập Chat AI hiện tại.",
        );
      }
      if (Number(file.sizeBytes) > maxBytes) {
        throwBadRequest(
          "FILE_TOO_LARGE",
          `Mỗi ảnh chat phải nhỏ hơn hoặc bằng ${formatMegabytes(maxBytes)} MB.`,
        );
      }
    }

    const inputImages = await Promise.all(ordered.map((file) => this.normalize(file)));

    return { files: ordered, inputImages };
  }

  async prepareMostRecentConversationImages(
    actorUserId: string,
    conversationId: string,
    settings: ResolvedAiChatRuntimeSettings,
  ) {
    const maxImages = settings.maxImagesPerMessage;
    const maxBytes = settings.maxImageBytes;
    const message = await this.prisma.aiChatMessage.findFirst({
      where: {
        sessionId: conversationId,
        role: AiChatMessageRole.USER,
        session: {
          deletedAt: null,
          OR: [{ studentUserId: actorUserId }, { adminUserId: actorUserId }],
        },
        attachments: { some: {} },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        attachments: {
          where: {
            file: {
              deletedAt: null,
              purpose: FilePurpose.CHAT_IMAGE,
              status: { in: [FileStatus.UPLOADED, FileStatus.READY] },
              sizeBytes: { lte: maxBytes },
              mimeType: { in: settings.allowedImageMimeTypes },
            },
          },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          take: maxImages,
          select: {
            file: {
              select: {
                id: true,
                mimeType: true,
                objectKey: true,
                checksum: true,
                metadataJson: true,
              },
            },
          },
        },
      },
    });

    const files = [] as Array<{
      id: string;
      mimeType: string;
      objectKey: string;
      checksum: string | null;
      metadataJson: Prisma.JsonValue | null;
    }>;
    const inputImages: AiInputImage[] = [];
    for (const attachment of message?.attachments ?? []) {
      try {
        inputImages.push(await this.normalize(attachment.file));
        files.push(attachment.file);
      } catch (error) {
        this.logger.warn(
          `Skipping unavailable historical chat image: ${error instanceof Error ? error.message : "unknown error"}`,
        );
      }
    }
    return { files, inputImages };
  }

  private async normalize(file: { objectKey: string; mimeType: string }) {
    const buffer = await this.storage.downloadObject(file.objectKey);
    let metadata: sharp.Metadata;
    try {
      metadata = await sharp(buffer, { failOn: "error" }).metadata();
    } catch {
      throwBadRequest("INVALID_CHAT_IMAGE", "File tải lên không phải ảnh hợp lệ.");
    }
    if (!metadata.width || !metadata.height || metadata.width * metadata.height > 40_000_000) {
      throwBadRequest(
        "CHAT_IMAGE_DIMENSIONS_EXCEEDED",
        "Ảnh có kích thước điểm ảnh quá lớn.",
      );
    }
    const normalized = await sharp(buffer, { failOn: "error" })
      .rotate()
      .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 86 })
      .toBuffer();
    return {
      imageUrl: `data:image/jpeg;base64,${normalized.toString("base64")}`,
      detail: "auto" as const,
    };
  }
}

function formatMegabytes(bytes: number) {
  return Number((bytes / 1024 / 1024).toFixed(2));
}
