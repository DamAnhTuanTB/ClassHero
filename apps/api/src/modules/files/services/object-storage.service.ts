import { randomUUID } from "node:crypto";
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
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

  /**
   * Download an object from storage and return its contents as a Buffer.
   */
  async downloadObject(objectKey: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
      }),
    );

    if (!response.Body) {
      throw new Error(`Object ${objectKey} has no body`);
    }

    const stream = response.Body as NodeJS.ReadableStream;
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  /**
   * Check if an object exists in storage.
   */
  async headObject(objectKey: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: objectKey,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Upload a Buffer to storage with the given key and content type.
   */
  async uploadBuffer(
    objectKey: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.ensureLocalBucket();

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
        Body: buffer,
        ContentLength: buffer.length,
        ContentType: contentType,
      }),
    );
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
