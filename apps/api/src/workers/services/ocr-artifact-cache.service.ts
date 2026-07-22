import { Inject, Injectable, Logger } from "@nestjs/common";
import { createHash } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { EnvConfig } from "#api/config/env.validation";
import { ObjectStorageService } from "#api/modules/files/services/object-storage.service";
import {
  buildMathpixPdfOptions,
  MATHPIX_OUTPUT_FORMATS,
  MATHPIX_PDF_MODEL_VERSION,
  type OcrArtifactBundle,
} from "#api/workers/services/mathpix-ocr.service";
import {
  OCR_DERIVED_ARTIFACT_VERSION,
  OCR_NORMALIZED_PAGES_SCHEMA_VERSION,
} from "#api/workers/utils/ocr-artifact-versions";

export interface OcrArtifactCacheDescriptor {
  contentHash: string;
  provider: string;
  modelVersion: string;
  languageHints: string[];
  options: Record<string, unknown>;
  outputFormats: string[];
  optionsHash: string;
  baseKey: string;
}

export interface OcrArtifactKeys {
  mmd: string;
  md: string;
  mmdZip: string;
  linesJson: string;
  htmlZip: string;
  pagesJson: string;
  imageManifestJson: string;
  artifactAuditJson: string;
  metadataJson: string;
  manifestJson: string;
}

export interface OcrArtifactCacheManifest {
  schemaVersion: 1;
  contentHash: string;
  provider: string;
  modelVersion: string;
  languageHints: string[];
  options: Record<string, unknown>;
  outputFormats: string[];
  optionsHash: string;
  baseKey: string;
  artifactKeys: OcrArtifactKeys;
  pdfId: string;
  numPages: number;
  processingTimeMs: number;
  createdAt: string;
}

export type CachedOcrArtifactBundle = OcrArtifactBundle & {
  manifest: OcrArtifactCacheManifest;
};

/**
 * Cache OCR artifact bundles in object storage keyed by content_hash + OCR
 * provider/options. Artifacts are long-lived product data, not temporary files.
 *
 * Storage layout:
 *   {prefix}/{provider}/{contentHash}/{optionsHash}/artifact.mmd
 *   {prefix}/{provider}/{contentHash}/{optionsHash}/artifact.md
 *   {prefix}/{provider}/{contentHash}/{optionsHash}/artifact.mmd.zip
 *   {prefix}/{provider}/{contentHash}/{optionsHash}/lines.json
 *   {prefix}/{provider}/{contentHash}/{optionsHash}/artifact.html.zip
 *   {prefix}/{provider}/{contentHash}/{optionsHash}/pages.json
 *   {prefix}/{provider}/{contentHash}/{optionsHash}/image-manifest.json
 *   {prefix}/{provider}/{contentHash}/{optionsHash}/artifact-audit.json
 *   {prefix}/{provider}/{contentHash}/{optionsHash}/metadata.json
 *   {prefix}/{provider}/{contentHash}/{optionsHash}/manifest.json
 */
@Injectable()
export class OcrArtifactCacheService {
  private readonly logger = new Logger(OcrArtifactCacheService.name);
  private readonly prefix: string;
  private readonly enabled: boolean;
  private readonly languageHints: string[];

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
    const hints = this.configService.get("MATHPIX_LANGUAGE_HINTS", {
      infer: true,
    });
    this.languageHints = hints
      .split(",")
      .map((hint) => hint.trim())
      .filter(Boolean);
  }

  createDescriptor(contentHash: string, provider: string): OcrArtifactCacheDescriptor {
    const normalizedProvider = provider.toLowerCase();
    const modelVersion =
      normalizedProvider === "mathpix" ? MATHPIX_PDF_MODEL_VERSION : "default";
    const outputFormats =
      normalizedProvider === "mathpix" ? [...MATHPIX_OUTPUT_FORMATS] : [];
    const options =
      normalizedProvider === "mathpix"
        ? (buildMathpixPdfOptions(this.languageHints) as unknown as Record<
            string,
            unknown
          >)
        : {};
    const signaturePayload = {
      provider: normalizedProvider,
      modelVersion,
      languageHints: this.languageHints,
      options,
      outputFormats,
    };
    const optionsHash = createHash("sha256")
      .update(stableStringify(signaturePayload))
      .digest("hex")
      .slice(0, 16);

    return {
      contentHash,
      provider: normalizedProvider,
      modelVersion,
      languageHints: this.languageHints,
      options,
      outputFormats,
      optionsHash,
      baseKey: `${this.prefix}/${normalizedProvider}/${contentHash}/${optionsHash}`,
    };
  }

  buildArtifactKeys(descriptor: OcrArtifactCacheDescriptor): OcrArtifactKeys {
    return {
      mmd: `${descriptor.baseKey}/artifact.mmd`,
      md: `${descriptor.baseKey}/artifact.md`,
      mmdZip: `${descriptor.baseKey}/artifact.mmd.zip`,
      linesJson: `${descriptor.baseKey}/lines.json`,
      htmlZip: `${descriptor.baseKey}/artifact.html.zip`,
      pagesJson: `${descriptor.baseKey}/pages.json`,
      imageManifestJson: `${descriptor.baseKey}/image-manifest.json`,
      artifactAuditJson: `${descriptor.baseKey}/artifact-audit.json`,
      metadataJson: `${descriptor.baseKey}/metadata.json`,
      manifestJson: `${descriptor.baseKey}/manifest.json`,
    };
  }

  /**
   * Check if an artifact bundle exists in cache for this content hash + provider
   * + OCR options.
   */
  async hasArtifact(descriptor: OcrArtifactCacheDescriptor): Promise<boolean> {
    if (!this.enabled) return false;

    const artifactKeys = this.buildArtifactKeys(descriptor);
    const exists = await this.storage.headObject(artifactKeys.manifestJson);

    if (exists) {
      this.logger.log(
        `Cache HIT for ${descriptor.provider}/${descriptor.contentHash.substring(0, 12)}.../${descriptor.optionsHash}`,
      );
    }

    return exists;
  }

  /**
   * Invalidate the cache by deleting the manifest.json file.
   * This effectively causes a cache miss on the next lookup.
   */
  async invalidateCache(descriptor: OcrArtifactCacheDescriptor): Promise<void> {
    const artifactKeys = this.buildArtifactKeys(descriptor);
    await this.storage.deleteObject(artifactKeys.manifestJson);
    this.logger.log(
      `Cache INVALIDATED for ${descriptor.provider}/${descriptor.contentHash.substring(0, 12)}...`,
    );
  }

  /**
   * Save a complete artifact bundle to cache.
   */
  async saveBundle(
    descriptor: OcrArtifactCacheDescriptor,
    bundle: OcrArtifactBundle,
  ): Promise<OcrArtifactCacheManifest> {
    const artifactKeys = this.buildArtifactKeys(descriptor);

    this.logger.log(`Saving artifact bundle to cache: ${descriptor.baseKey}/`);

    const manifest: OcrArtifactCacheManifest = {
      schemaVersion: 1,
      contentHash: descriptor.contentHash,
      provider: descriptor.provider,
      modelVersion: descriptor.modelVersion,
      languageHints: descriptor.languageHints,
      options: descriptor.options,
      outputFormats: descriptor.outputFormats,
      optionsHash: descriptor.optionsHash,
      baseKey: descriptor.baseKey,
      artifactKeys,
      pdfId: bundle.pdfId,
      numPages: bundle.numPages,
      processingTimeMs: bundle.processingTimeMs,
      createdAt: new Date().toISOString(),
    };
    const manifestBuffer = Buffer.from(JSON.stringify(manifest, null, 2));

    await Promise.all([
      this.storage.uploadBuffer(artifactKeys.mmd, bundle.mmd, "text/markdown"),
      this.storage.uploadBuffer(artifactKeys.md, bundle.md, "text/markdown"),
      this.storage.uploadBuffer(artifactKeys.mmdZip, bundle.mmdZip, "application/zip"),
      this.storage.uploadBuffer(
        artifactKeys.linesJson,
        bundle.linesJson,
        "application/json",
      ),
      this.storage.uploadBuffer(artifactKeys.htmlZip, bundle.htmlZip, "application/zip"),
      this.storage.uploadBuffer(
        artifactKeys.metadataJson,
        manifestBuffer,
        "application/json",
      ),
      this.storage.uploadBuffer(
        artifactKeys.manifestJson,
        manifestBuffer,
        "application/json",
      ),
    ]);

    this.logger.log(`Artifact bundle saved to cache: ${descriptor.baseKey}/`);
    return manifest;
  }

  async saveNormalizedPages(
    descriptor: OcrArtifactCacheDescriptor,
    pages: unknown[],
  ): Promise<string> {
    const artifactKeys = this.buildArtifactKeys(descriptor);
    const payload = {
      schemaVersion: OCR_NORMALIZED_PAGES_SCHEMA_VERSION,
      derivedArtifactVersion: OCR_DERIVED_ARTIFACT_VERSION,
      createdAt: new Date().toISOString(),
      pages,
    };

    await this.storage.uploadBuffer(
      artifactKeys.pagesJson,
      Buffer.from(JSON.stringify(payload, null, 2)),
      "application/json",
    );
    return artifactKeys.pagesJson;
  }

  async saveImageManifest(
    descriptor: OcrArtifactCacheDescriptor,
    imageManifest: unknown,
  ): Promise<string> {
    const artifactKeys = this.buildArtifactKeys(descriptor);
    await this.storage.uploadBuffer(
      artifactKeys.imageManifestJson,
      Buffer.from(JSON.stringify(imageManifest, null, 2)),
      "application/json",
    );
    return artifactKeys.imageManifestJson;
  }

  async saveArtifactAudit(
    descriptor: OcrArtifactCacheDescriptor,
    audit: unknown,
  ): Promise<string> {
    const artifactKeys = this.buildArtifactKeys(descriptor);
    await this.storage.uploadBuffer(
      artifactKeys.artifactAuditJson,
      Buffer.from(JSON.stringify(audit, null, 2)),
      "application/json",
    );
    return artifactKeys.artifactAuditJson;
  }

  /**
   * Load a complete artifact bundle from cache.
   * Throws if any artifact is missing.
   */
  async loadBundle(
    descriptor: OcrArtifactCacheDescriptor,
  ): Promise<CachedOcrArtifactBundle> {
    const artifactKeys = this.buildArtifactKeys(descriptor);
    this.logger.log(`Loading artifact bundle from cache: ${descriptor.baseKey}/`);

    const [mmd, md, mmdZip, linesJson, htmlZip, manifestBuffer] = await Promise.all([
      this.storage.downloadObject(artifactKeys.mmd),
      this.storage.downloadObject(artifactKeys.md),
      this.storage.downloadObject(artifactKeys.mmdZip),
      this.storage.downloadObject(artifactKeys.linesJson),
      this.storage.downloadObject(artifactKeys.htmlZip),
      this.storage.downloadObject(artifactKeys.manifestJson),
    ]);

    const manifest = JSON.parse(
      manifestBuffer.toString("utf8"),
    ) as OcrArtifactCacheManifest;

    return {
      mmd,
      md,
      mmdZip,
      linesJson,
      htmlZip,
      pdfId: manifest.pdfId,
      numPages: manifest.numPages,
      processingTimeMs: manifest.processingTimeMs,
      manifest,
    };
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
    return `{${entries.join(",")}}`;
  }

  return JSON.stringify(value);
}
