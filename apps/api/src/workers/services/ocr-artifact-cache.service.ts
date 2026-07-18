import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EnvConfig } from "#api/config/env.validation";
import { ObjectStorageService } from "#api/modules/files/services/object-storage.service";
import type { OcrArtifactBundle } from "#api/workers/services/mathpix-ocr.service";

interface ArtifactCacheMetadata {
  pdfId: string;
  numPages: number;
  processingTimeMs: number;
  provider: string;
  createdAt: string;
}

/**
 * Cache OCR artifact bundles in object storage keyed by content_hash.
 * Prevents re-processing the same PDF with the same provider.
 *
 * Storage layout:
 *   {prefix}/{provider}/{contentHash}/artifact.mmd
 *   {prefix}/{provider}/{contentHash}/artifact.mmd.zip
 *   {prefix}/{provider}/{contentHash}/lines.json
 *   {prefix}/{provider}/{contentHash}/artifact.html.zip
 *   {prefix}/{provider}/{contentHash}/artifact.html.zip
 *   {prefix}/{provider}/{contentHash}/metadata.json
 */
@Injectable()
export class OcrArtifactCacheService {
  private readonly logger = new Logger(OcrArtifactCacheService.name);
  private readonly prefix: string;
  private readonly enabled: boolean;

  constructor(
    @Inject(ObjectStorageService)
    private readonly storage: ObjectStorageService,
    @Inject(ConfigService)
    private readonly configService: ConfigService<EnvConfig, true>,
  ) {
    this.prefix = this.configService.get("OCR_ARTIFACT_PREFIX", {
      infer: true,
    });
    this.enabled = this.configService.get("OCR_ARTIFACT_CACHE_ENABLED", {
      infer: true,
    });
  }

  /**
   * Check if an artifact bundle exists in cache for this content hash + provider.
   */
  async hasArtifact(
    contentHash: string,
    provider: string,
  ): Promise<boolean> {
    if (!this.enabled) return false;

    const metadataKey = this.buildKey(contentHash, provider, "metadata.json");
    const exists = await this.storage.headObject(metadataKey);

    if (exists) {
      this.logger.log(
        `Cache HIT for ${provider}/${contentHash.substring(0, 12)}...`,
      );
    }

    return exists;
  }

  /**
   * Save a complete artifact bundle to cache.
   */
  async saveBundle(
    contentHash: string,
    provider: string,
    bundle: OcrArtifactBundle,
  ): Promise<void> {
    if (!this.enabled) return;

    const base = `${this.prefix}/${provider}/${contentHash}`;
    this.logger.log(`Saving artifact bundle to cache: ${base}/`);

    const metadata: ArtifactCacheMetadata = {
      pdfId: bundle.pdfId,
      numPages: bundle.numPages,
      processingTimeMs: bundle.processingTimeMs,
      provider,
      createdAt: new Date().toISOString(),
    };

    await Promise.all([
      this.storage.uploadBuffer(
        `${base}/artifact.mmd`,
        bundle.mmd,
        "text/markdown",
      ),
      this.storage.uploadBuffer(
        `${base}/artifact.mmd.zip`,
        bundle.mmdZip,
        "application/zip",
      ),
      this.storage.uploadBuffer(
        `${base}/lines.json`,
        bundle.linesJson,
        "application/json",
      ),
      this.storage.uploadBuffer(
        `${base}/artifact.html.zip`,
        bundle.htmlZip,
        "application/zip",
      ),
      this.storage.uploadBuffer(
        `${base}/metadata.json`,
        Buffer.from(JSON.stringify(metadata, null, 2)),
        "application/json",
      ),
    ]);

    this.logger.log(`Artifact bundle saved to cache: ${base}/`);
  }

  /**
   * Load a complete artifact bundle from cache.
   * Throws if any artifact is missing.
   */
  async loadBundle(
    contentHash: string,
    provider: string,
  ): Promise<OcrArtifactBundle> {
    const base = `${this.prefix}/${provider}/${contentHash}`;
    this.logger.log(`Loading artifact bundle from cache: ${base}/`);

    const [mmd, mmdZip, linesJson, htmlZip, metadataBuffer] =
      await Promise.all([
        this.storage.downloadObject(`${base}/artifact.mmd`),
        this.storage.downloadObject(`${base}/artifact.mmd.zip`),
        this.storage.downloadObject(`${base}/lines.json`),
        this.storage.downloadObject(`${base}/artifact.html.zip`),
        this.storage.downloadObject(`${base}/metadata.json`),
      ]);

    const metadata = JSON.parse(
      metadataBuffer.toString("utf8"),
    ) as ArtifactCacheMetadata;

    return {
      mmd,
      mmdZip,
      linesJson,
      htmlZip,
      pdfId: metadata.pdfId,
      numPages: metadata.numPages,
      processingTimeMs: metadata.processingTimeMs,
    };
  }

  private buildKey(
    contentHash: string,
    provider: string,
    fileName: string,
  ): string {
    return `${this.prefix}/${provider}/${contentHash}/${fileName}`;
  }
}
