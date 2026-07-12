import { randomUUID } from "node:crypto";
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FileProvider, FilePurpose } from "@prisma/client";
import { EnvConfig } from "#api/config/env.validation";

type UploadObjectInput = {
  body: Buffer;
  contentLength: number;
  contentType: string;
  objectKey: string;
};

@Injectable()
export class ObjectStorageService {
  private readonly client: S3Client;
  private ensureBucketPromise: Promise<void> | null = null;

  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService<EnvConfig, true>,
  ) {
    this.client = new S3Client({
      endpoint: this.configService.get("S3_ENDPOINT", { infer: true }),
      region: this.configService.get("S3_REGION", { infer: true }),
      forcePathStyle: this.configService.get("S3_FORCE_PATH_STYLE", { infer: true }),
      credentials: {
        accessKeyId: this.configService.get("S3_ACCESS_KEY_ID", { infer: true }),
        secretAccessKey: this.configService.get("S3_SECRET_ACCESS_KEY", {
          infer: true,
        }),
      },
    });
  }

  get bucketName() {
    return this.configService.get("S3_BUCKET_NAME", { infer: true });
  }

  get fileProvider() {
    return this.configService.get("FILE_STORAGE_PROVIDER", { infer: true }) ===
      "minio_local"
      ? FileProvider.MINIO_LOCAL
      : FileProvider.CLOUDFLARE_R2;
  }

  get signedUrlTtlSeconds() {
    return this.configService.get("FILE_SIGNED_URL_TTL_SECONDS", { infer: true });
  }

  createObjectKey({
    environment,
    originalName,
    purpose,
  }: {
    environment: string;
    originalName: string;
    purpose: FilePurpose;
  }) {
    const now = new Date();
    const year = String(now.getUTCFullYear());
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const safeName = createSafeFileName(originalName);

    return `uploads/${environment}/${purpose.toLowerCase()}/${year}/${month}/${randomUUID()}-${safeName}`;
  }

  async uploadObject(input: UploadObjectInput) {
    await this.ensureLocalBucket();

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: input.objectKey,
        Body: input.body,
        ContentLength: input.contentLength,
        ContentType: input.contentType,
      }),
    );
  }

  async createSignedGetUrl(objectKey: string) {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
      }),
      {
        expiresIn: this.signedUrlTtlSeconds,
      },
    );
  }

  getPublicUrl(objectKey: string) {
    const publicBaseUrl = this.configService.get("FILE_PUBLIC_BASE_URL", {
      infer: true,
    });

    if (!publicBaseUrl) {
      return null;
    }

    return `${publicBaseUrl.replace(/\/$/, "")}/${objectKey}`;
  }

  private async ensureLocalBucket() {
    if (this.fileProvider !== FileProvider.MINIO_LOCAL) {
      return;
    }

    this.ensureBucketPromise ??= this.ensureBucketExists();
    await this.ensureBucketPromise;
  }

  private async ensureBucketExists() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucketName }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucketName }));
    }
  }
}

function createSafeFileName(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return normalized || "file";
}
