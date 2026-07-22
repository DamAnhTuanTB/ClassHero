/**
 * M4.4 live Mathpix + MinIO verification.
 *
 * Runs the production OCR artifact services against a real PDF:
 * PDF -> Mathpix -> artifacts cached in object storage -> normalized pages ->
 * image extraction from mmd.zip -> images uploaded to object storage.
 *
 * Usage:
 *   M4_4_LIVE_PDF_PATH=/tmp/sample.pdf \
 *   M4_4_LIVE_FORCE_MATHPIX=true \
 *   pnpm --filter @learning-path/api test:m4.4:live
 */
import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { ConfigService } from "@nestjs/config";
import { config } from "dotenv";
import { validateEnv, type EnvConfig } from "../src/config/env.validation";
import { ObjectStorageService } from "../src/modules/files/services/object-storage.service";
import { ImageExtractionService } from "../src/workers/services/image-extraction.service";
import {
  MathpixOcrService,
  type OcrArtifactBundle,
} from "../src/workers/services/mathpix-ocr.service";
import {
  OcrArtifactCacheService,
  type OcrArtifactCacheManifest,
} from "../src/workers/services/ocr-artifact-cache.service";
import { buildOcrArtifactAudit } from "../src/workers/utils/ocr-artifact-audit";
import { PdfMetadataService } from "../src/workers/services/pdf-metadata.service";
import { buildOcrImageManifest } from "../src/workers/utils/ocr-image-manifest";
import {
  normalizeOcrPages,
  summarizeOcrPage,
} from "../src/workers/utils/ocr-artifact-normalizer";
import { resolveOcrVisualReference } from "../src/workers/utils/ocr-visual-resolver";

type UploadedImageSummary = {
  pageNumber: number;
  objectKey: string;
  filename: string;
  boundingBox: { x: number; y: number; w: number; h: number };
  size: number;
  mimeType: string;
};

const DEFAULT_PDF_PATH = resolve(__dirname, "Toan-7-Tap-1-lam-net.pdf");

async function main() {
  config({ path: resolve(__dirname, "../.env"), quiet: true });
  const env = validateEnv(process.env);

  if (!env.OCR_PAID_ENABLED) {
    throw new Error("OCR_PAID_ENABLED must be true for the live Mathpix test.");
  }

  if (env.FILE_STORAGE_PROVIDER !== "minio_local") {
    throw new Error(
      `FILE_STORAGE_PROVIDER must be minio_local for this MinIO verification, got ${env.FILE_STORAGE_PROVIDER}.`,
    );
  }

  const pdfPath = resolve(process.env.M4_4_LIVE_PDF_PATH ?? DEFAULT_PDF_PATH);
  const forceMathpix = process.env.M4_4_LIVE_FORCE_MATHPIX === "true";

  if (!existsSync(pdfPath)) {
    throw new Error(
      `Live PDF not found: ${pdfPath}. Set M4_4_LIVE_PDF_PATH to a real PDF file.`,
    );
  }

  const configService = new ConfigService<EnvConfig, true>(env, true);
  const storage = new ObjectStorageService(configService);
  const pdfMetadata = new PdfMetadataService();
  const mathpixOcr = new MathpixOcrService(configService);
  const artifactCache = new OcrArtifactCacheService(storage, configService);
  const imageExtraction = new ImageExtractionService();

  const pdfBuffer = readFileSync(pdfPath);
  const pageCount = await pdfMetadata.getPageCount(pdfBuffer);
  const contentHash = pdfMetadata.computeContentHash(pdfBuffer);
  const descriptor = artifactCache.createDescriptor(contentHash, env.OCR_PROVIDER);
  const artifactKeys = artifactCache.buildArtifactKeys(descriptor);
  const inputKey = `live-tests/m4.4/${contentHash.slice(0, 12)}/${safeFileName(basename(pdfPath))}`;

  await storage.uploadBuffer(inputKey, pdfBuffer, "application/pdf");
  const inputUploaded = await storage.headObject(inputKey);

  const cacheAvailable = await artifactCache.hasArtifact(descriptor);
  let bundle: OcrArtifactBundle;
  let manifest: OcrArtifactCacheManifest;
  let cacheHit = cacheAvailable;

  if (cacheAvailable && !forceMathpix) {
    const cached = await artifactCache.loadBundle(descriptor);
    bundle = cached;
    manifest = cached.manifest;
  } else {
    cacheHit = false;
    const startTime = Date.now();
    const { pdfId } = await mathpixOcr.submitPdf(pdfBuffer, basename(pdfPath));
    const { numPages } = await mathpixOcr.pollUntilComplete(pdfId);
    bundle = await mathpixOcr.downloadAllArtifacts(
      pdfId,
      numPages || pageCount,
      startTime,
    );
    manifest = await artifactCache.saveBundle(descriptor, bundle);
  }

  const normalizedPages = normalizeOcrPages(bundle, pageCount);
  const pagesJsonKey = await artifactCache.saveNormalizedPages(
    descriptor,
    normalizedPages.map((page) => ({
      ...summarizeOcrPage(page),
      text: page.text,
      mathpixMarkdown: page.mathpixMarkdown,
      markdown: page.markdown,
      lines: page.lines,
    })),
  );

  const extractedImages = await imageExtraction.extractImagesFromZip(bundle.mmdZip);
  const ownerId = `live-m4-4-${contentHash.slice(0, 12)}`;
  const uploadedImages = await Promise.all(
    extractedImages.map(async (image): Promise<UploadedImageSummary> => {
      const objectKey = `document-images/${ownerId}/page-${String(image.pageNumber).padStart(3, "0")}/${image.filename}`;
      await storage.uploadBuffer(objectKey, image.data, image.mimeType);
      return {
        pageNumber: image.pageNumber,
        objectKey,
        filename: image.filename,
        boundingBox: image.boundingBox,
        size: image.data.length,
        mimeType: image.mimeType,
      };
    }),
  );
  const imageManifest = buildOcrImageManifest({
    contentHash,
    provider: descriptor.provider,
    modelVersion: descriptor.modelVersion,
    optionsHash: descriptor.optionsHash,
    artifactBaseKey: descriptor.baseKey,
    artifactKeys: {
      mmdZip: artifactKeys.mmdZip,
      htmlZip: artifactKeys.htmlZip,
      linesJson: artifactKeys.linesJson,
      pagesJson: pagesJsonKey,
      imageManifestJson: artifactKeys.imageManifestJson,
      artifactAuditJson: artifactKeys.artifactAuditJson,
    },
    pdfId: bundle.pdfId,
    pageCount,
    ownerId: `live-m4-4-${contentHash.slice(0, 12)}`,
    linesJson: bundle.linesJson,
    pages: normalizedPages,
    images: uploadedImages,
  });
  const imageManifestKey = await artifactCache.saveImageManifest(
    descriptor,
    imageManifest,
  );
  const artifactAudit = buildOcrArtifactAudit({
    contentHash,
    provider: descriptor.provider,
    modelVersion: descriptor.modelVersion,
    optionsHash: descriptor.optionsHash,
    artifactBaseKey: descriptor.baseKey,
    artifactKeys: {
      ...artifactKeys,
      pagesJson: pagesJsonKey,
      imageManifestJson: imageManifestKey,
    },
    expectedPageCount: pageCount,
    pages: normalizedPages,
    imageManifest,
  });
  const artifactAuditKey = await artifactCache.saveArtifactAudit(
    descriptor,
    artifactAudit,
  );
  const printedPage35Visual = resolveOcrVisualReference({
    manifest: imageManifest,
    printedPageNumber: 35,
    query: "hinh figure image",
    kind: "visual",
    maxCandidates: 5,
  });

  const allArtifactKeys = [
    ...new Set([
      ...Object.values(artifactKeys),
      pagesJsonKey,
      imageManifestKey,
      artifactAuditKey,
    ]),
  ];
  const artifactChecks = await Promise.all(
    allArtifactKeys.map(async (objectKey) => ({
      objectKey,
      exists: await storage.headObject(objectKey),
    })),
  );
  const uploadedImageChecks = await Promise.all(
    uploadedImages.map(async (image) => ({
      objectKey: image.objectKey,
      exists: await storage.headObject(image.objectKey),
    })),
  );

  const pagesWithImages = [
    ...new Set(uploadedImages.map((image) => image.pageNumber)),
  ].sort((a, b) => a - b);
  const samplePages = normalizedPages.slice(0, 3).map((page) => ({
    pageNumber: page.pageNumber,
    printedPage: page.printedPage,
    textLength: page.text.length,
    lineCount: page.lineCount,
    confidence: page.confidence,
    qualityFlags: page.qualityFlags,
  }));

  console.log(
    JSON.stringify(
      {
        status: "ok",
        provider: env.OCR_PROVIDER,
        storageProvider: env.FILE_STORAGE_PROVIDER,
        forceMathpix,
        cacheHit,
        input: {
          pdfPath,
          pageCount,
          sizeKb: Math.round(pdfBuffer.length / 1024),
          contentHashPrefix: contentHash.slice(0, 16),
          objectKey: inputKey,
          uploaded: inputUploaded,
        },
        mathpix: {
          pdfIdPrefix: bundle.pdfId.slice(0, 8),
          numPages: bundle.numPages,
          processingTimeMs: bundle.processingTimeMs,
        },
        artifacts: {
          baseKey: manifest.baseKey,
          allPresent: artifactChecks.every((check) => check.exists),
          count: artifactChecks.length,
          keys: artifactChecks,
        },
        normalizedPages: {
          objectKey: pagesJsonKey,
          count: normalizedPages.length,
          samplePages,
        },
        images: {
          total: uploadedImages.length,
          pagesWithImages,
          allUploaded: uploadedImageChecks.every((check) => check.exists),
          imageManifestKey,
          artifactAuditKey,
          imageManifestSummary: imageManifest.summary,
          artifactAuditStatus: artifactAudit.status,
          artifactAuditSummary: artifactAudit.summary,
          artifactAuditIssues: artifactAudit.issues,
          printedPage35Visual: {
            status: printedPage35Visual.status,
            candidateCount: printedPage35Visual.candidates.length,
            pageFallbacks: printedPage35Visual.pageFallbacks,
            warnings: printedPage35Visual.warnings,
            topCandidates: printedPage35Visual.candidates.map((candidate) => ({
              imageId: candidate.imageId,
              pageNumber: candidate.pageNumber,
              printedPage: candidate.printedPage,
              orderInPage: candidate.orderInPage,
              objectKey: candidate.objectKey,
              kind: candidate.kind,
              isUsableForAi: candidate.isUsableForAi,
              qualityFlags: candidate.qualityFlags,
            })),
          },
          sampleManifestImages: imageManifest.images.slice(0, 3).map((image) => ({
            imageId: image.imageId,
            pageNumber: image.pageNumber,
            printedPage: image.printedPage,
            orderInPage: image.orderInPage,
            kind: image.kind,
            boundingBox: image.boundingBox,
            normalizedBoundingBox: image.normalizedBoundingBox,
            isUsableForAi: image.isUsableForAi,
            qualityFlags: image.qualityFlags,
            captionCandidate: image.captionCandidate,
            nearbyLineIds: image.nearbyLineIds,
          })),
          sampleKeys: uploadedImages.slice(0, 10).map((image) => image.objectKey),
        },
      },
      null,
      2,
    ),
  );
}

function safeFileName(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return normalized || "file.pdf";
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ status: "failed", error: message }, null, 2));
  process.exit(1);
});
