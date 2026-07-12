import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  FilePurpose,
  FileStatus,
  FileVisibility,
  Prisma,
  UserRole,
} from "@prisma/client";
import {
  throwBadRequest,
  throwForbidden,
  throwNotFound,
} from "#api/common/errors/api-exception";
import type { AuthenticatedUser } from "#api/common/auth/authenticated-request";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { EnvConfig } from "#api/config/env.validation";
import { ObjectStorageService } from "#api/modules/files/services/object-storage.service";
import type {
  FileResponse,
  UploadedFileBuffer,
} from "#api/modules/files/types/uploaded-file.types";

const imageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const pdfMimeTypes = new Set(["application/pdf"]);

const fileSelect = {
  id: true,
  provider: true,
  purpose: true,
  bucket: true,
  objectKey: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  visibility: true,
  status: true,
  uploadedById: true,
  publicUrl: true,
  checksum: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.FileSelect;

export type FileAccessRecord = {
  objectKey: string;
  publicUrl: string | null;
};

@Injectable()
export class FilesService {
  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService<EnvConfig, true>,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(ObjectStorageService)
    private readonly objectStorage: ObjectStorageService,
  ) {}

  async uploadFile({
    actor,
    file,
    purpose,
  }: {
    actor: AuthenticatedUser;
    file: UploadedFileBuffer | undefined;
    purpose: FilePurpose;
  }) {
    if (!file) {
      throwBadRequest("VALIDATION_ERROR", "Vui lòng chọn file để upload");
    }

    this.assertCanUpload(actor.role, purpose);
    this.assertFileAllowed(file, purpose);

    const objectKey = this.objectStorage.createObjectKey({
      environment: this.configService.get("NODE_ENV", { infer: true }),
      originalName: file.originalname,
      purpose,
    });
    const checksum = createHash("sha256").update(file.buffer).digest("hex");

    await this.objectStorage.uploadObject({
      body: file.buffer,
      contentLength: file.size,
      contentType: file.mimetype,
      objectKey,
    });

    const uploadedFile = await this.prisma.file.create({
      data: {
        provider: this.objectStorage.fileProvider,
        purpose,
        bucket: this.objectStorage.bucketName,
        objectKey,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: BigInt(file.size),
        visibility: FileVisibility.PRIVATE,
        status: FileStatus.UPLOADED,
        uploadedById: actor.id,
        publicUrl: this.objectStorage.getPublicUrl(objectKey),
        checksum,
        metadataJson: {
          uploadSource: "api.files.upload",
        },
      },
      select: fileSelect,
    });

    return this.serializeFile(uploadedFile);
  }

  async getSignedUrl(fileId: string, actor: AuthenticatedUser) {
    const file = await this.prisma.file.findFirst({
      where: {
        id: fileId,
        deletedAt: null,
      },
      select: fileSelect,
    });

    if (!file) {
      throwNotFound("NOT_FOUND", "Không tìm thấy file");
    }

    this.assertCanRead(actor, file);

    const url = await this.resolveAccessUrl(file);

    return {
      url,
      expiresAt: new Date(Date.now() + this.objectStorage.signedUrlTtlSeconds * 1000),
    };
  }

  async resolveAccessUrl(file: FileAccessRecord | null | undefined) {
    if (!file) {
      return null;
    }

    if (file.publicUrl) {
      return file.publicUrl;
    }

    return this.objectStorage.createSignedGetUrl(file.objectKey);
  }

  serializeFile(
    file: Prisma.FileGetPayload<{ select: typeof fileSelect }>,
  ): FileResponse {
    return {
      id: file.id,
      provider: file.provider,
      purpose: file.purpose,
      bucket: file.bucket,
      objectKey: file.objectKey,
      originalName: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: Number(file.sizeBytes),
      visibility: file.visibility,
      status: file.status,
      uploadedById: file.uploadedById,
      publicUrl: file.publicUrl,
      checksum: file.checksum,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    };
  }

  private assertCanUpload(role: UserRole, purpose: FilePurpose) {
    if (purpose === FilePurpose.AI_DIAGRAM) {
      throwForbidden("FORBIDDEN", "Client không được upload file AI diagram trực tiếp");
    }

    if (
      role === UserRole.ADMIN &&
      (purpose === FilePurpose.LESSON_DOCUMENT ||
        purpose === FilePurpose.EDITOR_IMAGE ||
        purpose === FilePurpose.QUESTION_IMAGE)
    ) {
      return;
    }

    if (
      role === UserRole.STUDENT &&
      (purpose === FilePurpose.AVATAR || purpose === FilePurpose.NOTE_IMAGE)
    ) {
      return;
    }

    throwForbidden("FORBIDDEN", "Bạn không có quyền upload loại file này");
  }

  private assertCanRead(
    actor: AuthenticatedUser,
    file: Prisma.FileGetPayload<{ select: typeof fileSelect }>,
  ) {
    if (
      actor.role === UserRole.ADMIN &&
      (file.purpose === FilePurpose.LESSON_DOCUMENT ||
        file.purpose === FilePurpose.EDITOR_IMAGE ||
        file.purpose === FilePurpose.QUESTION_IMAGE)
    ) {
      return;
    }

    if (
      file.uploadedById === actor.id &&
      (file.purpose === FilePurpose.AVATAR || file.purpose === FilePurpose.NOTE_IMAGE)
    ) {
      return;
    }

    throwForbidden("FORBIDDEN", "Bạn không có quyền xem file này");
  }

  private assertFileAllowed(file: UploadedFileBuffer, purpose: FilePurpose) {
    const maxSizeBytes = this.getMaxSizeBytes(purpose);
    const allowedMimeTypes = this.getAllowedMimeTypes(purpose);

    if (!allowedMimeTypes.has(file.mimetype)) {
      throwBadRequest("FILE_TYPE_NOT_ALLOWED", "Định dạng file chưa được hỗ trợ");
    }

    if (file.size > maxSizeBytes) {
      throwBadRequest("FILE_TOO_LARGE", "File vượt quá dung lượng cho phép");
    }
  }

  private getAllowedMimeTypes(purpose: FilePurpose) {
    if (purpose === FilePurpose.LESSON_DOCUMENT) {
      return pdfMimeTypes;
    }

    return imageMimeTypes;
  }

  private getMaxSizeBytes(purpose: FilePurpose) {
    if (purpose === FilePurpose.LESSON_DOCUMENT) {
      return this.megabytesToBytes(
        this.configService.get("MAX_PDF_UPLOAD_MB", { infer: true }),
      );
    }

    if (purpose === FilePurpose.AVATAR) {
      return this.megabytesToBytes(
        this.configService.get("MAX_AVATAR_UPLOAD_MB", { infer: true }),
      );
    }

    return this.megabytesToBytes(
      this.configService.get("MAX_IMAGE_UPLOAD_MB", { infer: true }),
    );
  }

  private megabytesToBytes(value: number) {
    return Math.floor(value * 1024 * 1024);
  }
}
