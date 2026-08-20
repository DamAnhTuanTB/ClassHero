import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { PDFDocument } from "pdf-lib";
import { PDFParse } from "pdf-parse";
import sharp from "sharp";

import { ObjectStorageService } from "#api/modules/files/services/object-storage.service";
import type { SearchablePdfEquivalenceReport } from "#api/modules/learning-paths/types/searchable-pdf.types";
import type { OcrImageManifest } from "#api/workers/utils/ocr-image-manifest";

const GEOMETRY_TOLERANCE = 0.01;
const CENTROID_TOLERANCE = 0.035;
const SCALE_TOLERANCE = 0.06;

@Injectable()
export class SearchablePdfEquivalenceService {
  constructor(
    @Inject(ObjectStorageService)
    private readonly storage: ObjectStorageService,
  ) {}

  async validate(input: {
    original: Buffer;
    candidate: Buffer;
    imageManifestObjectKey?: string | null;
  }): Promise<{ report: SearchablePdfEquivalenceReport; contactSheet: Buffer }> {
    const [originalPdf, candidatePdf] = await Promise.all([
      PDFDocument.load(input.original, { updateMetadata: false }),
      PDFDocument.load(input.candidate, { updateMetadata: false }),
    ]);
    const originalPages = originalPdf.getPages();
    const candidatePages = candidatePdf.getPages();
    const hardFailures: string[] = [];
    const warnings: string[] = [];

    if (originalPages.length !== candidatePages.length) {
      hardFailures.push(
        `Số trang thay đổi: ${originalPages.length} → ${candidatePages.length}.`,
      );
    }

    const comparablePageCount = Math.min(originalPages.length, candidatePages.length);
    const pageGeometry = Array.from({ length: comparablePageCount }, (_, index) => {
      const original = originalPages[index]!;
      const candidate = candidatePages[index]!;
      const originalGeometry = readGeometry(original, index + 1);
      const candidateGeometry = readGeometry(candidate, index + 1);
      if (!sameGeometry(originalGeometry, candidateGeometry)) {
        hardFailures.push(`Geometry trang vật lý ${index + 1} không còn tương đương.`);
      }
      return candidateGeometry;
    });

    const [originalRendered, candidateRendered, textResult] = await Promise.all([
      renderPdf(input.original),
      renderPdf(input.candidate),
      extractPdfText(input.candidate),
    ]);
    const visualComparisons = await Promise.all(
      Array.from({ length: comparablePageCount }, async (_, index) =>
        compareRenderedPages(
          index + 1,
          originalRendered[index]!,
          candidateRendered[index]!,
        ),
      ),
    );
    const shiftedPages = visualComparisons
      .filter((page) => !page.layoutEquivalent)
      .map((page) => page.pageNumber);
    if (shiftedPages.length > 0) {
      hardFailures.push(
        `Phát hiện dịch/scale layout ở trang: ${shiftedPages.slice(0, 20).join(", ")}.`,
      );
    }
    const lowSimilarityPages = visualComparisons
      .filter((page) => page.perceptualSimilarity < 0.82)
      .map((page) => page.pageNumber);
    if (lowSimilarityPages.length > 0) {
      warnings.push(
        `Độ tương đồng thị giác thấp ở trang: ${lowSimilarityPages.slice(0, 20).join(", ")}; cần review contact sheet.`,
      );
    }

    const emptyTextPageNumbers = textResult.pages
      .filter((page) => page.text.trim().length < 8)
      .map((page) => page.num);
    const searchablePageCount = candidatePages.length - emptyTextPageNumbers.length;
    const searchablePageRatio =
      candidatePages.length === 0 ? 0 : searchablePageCount / candidatePages.length;
    if (searchablePageRatio < 0.5) {
      hardFailures.push("Lớp text searchable bị thiếu trên phần lớn trang.");
    } else if (emptyTextPageNumbers.length > 0) {
      warnings.push(
        `${emptyTextPageNumbers.length} trang không có text đáng kể; kiểm tra bìa/trang trắng.`,
      );
    }

    const cropAudit = await this.auditCrops({
      imageManifestObjectKey: input.imageManifestObjectKey,
      candidateRendered,
    });
    if (cropAudit.failedImageIds.length > 0) {
      hardFailures.push(
        `${cropAudit.failedImageIds.length} crop OCR usable không còn nằm trong bounds trang mới.`,
      );
    }

    return {
      report: {
        version: 1,
        originalChecksum: sha256(input.original),
        candidateChecksum: sha256(input.candidate),
        pageCount: candidatePages.length,
        geometryEquivalent: !hardFailures.some((item) => item.includes("Geometry")),
        layoutEquivalent: shiftedPages.length === 0,
        searchablePageCount,
        searchablePageRatio,
        emptyTextPageNumbers,
        pageGeometry,
        visualComparisons,
        cropAudit,
        hardFailures,
        warnings,
      },
      contactSheet: await buildContactSheet(originalRendered, candidateRendered),
    };
  }

  private async auditCrops(input: {
    imageManifestObjectKey?: string | null;
    candidateRendered: Buffer[];
  }) {
    if (!input.imageManifestObjectKey) {
      return { checked: 0, passed: 0, failedImageIds: [] };
    }
    const raw = await this.storage.downloadObject(input.imageManifestObjectKey);
    const manifest = JSON.parse(raw.toString("utf8")) as OcrImageManifest;
    const usable = manifest.images.filter((image) => image.isUsableForAi);
    const failedImageIds: string[] = [];
    for (const image of usable) {
      const page = input.candidateRendered[image.pageNumber - 1];
      const box = image.normalizedBoundingBox;
      if (
        !page ||
        !box ||
        box.x < 0 ||
        box.y < 0 ||
        box.w <= 0 ||
        box.h <= 0 ||
        box.x + box.w > 1.001 ||
        box.y + box.h > 1.001
      ) {
        failedImageIds.push(image.imageId);
      }
    }
    return {
      checked: usable.length,
      passed: usable.length - failedImageIds.length,
      failedImageIds,
    };
  }
}

async function renderPdf(buffer: Buffer) {
  const parser = new PDFParse({ data: cloneBytes(buffer) });
  try {
    const result = await parser.getScreenshot({
      desiredWidth: 512,
      imageDataUrl: false,
      imageBuffer: true,
    });
    return result.pages.map((page) => Buffer.from(page.data));
  } finally {
    await parser.destroy();
  }
}

async function extractPdfText(buffer: Buffer) {
  const parser = new PDFParse({ data: cloneBytes(buffer) });
  try {
    return await parser.getText();
  } finally {
    await parser.destroy();
  }
}

async function compareRenderedPages(
  pageNumber: number,
  original: Buffer,
  candidate: Buffer,
) {
  const [left, right] = await Promise.all([
    toAnalysisPixels(original),
    toAnalysisPixels(candidate),
  ]);
  let absoluteDifference = 0;
  for (let index = 0; index < left.pixels.length; index += 1) {
    absoluteDifference += Math.abs(left.pixels[index]! - right.pixels[index]!);
  }
  const perceptualSimilarity =
    1 - absoluteDifference / (left.pixels.length * 255);
  const centroidShift = Math.hypot(
    left.centroid.x - right.centroid.x,
    left.centroid.y - right.centroid.y,
  );
  const scaleDelta = Math.max(
    Math.abs(left.spread.x - right.spread.x),
    Math.abs(left.spread.y - right.spread.y),
  );
  return {
    pageNumber,
    perceptualSimilarity,
    centroidShift,
    scaleDelta,
    layoutEquivalent:
      centroidShift <= CENTROID_TOLERANCE && scaleDelta <= SCALE_TOLERANCE,
  };
}

async function toAnalysisPixels(buffer: Buffer) {
  const { data } = await sharp(buffer)
    .resize(128, 128, { fit: "fill" })
    .grayscale()
    .normalize()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let totalInk = 0;
  let weightedX = 0;
  let weightedY = 0;
  for (let y = 0; y < 128; y += 1) {
    for (let x = 0; x < 128; x += 1) {
      const ink = 255 - data[y * 128 + x]!;
      totalInk += ink;
      weightedX += x * ink;
      weightedY += y * ink;
    }
  }
  const centerX = totalInk === 0 ? 63.5 : weightedX / totalInk;
  const centerY = totalInk === 0 ? 63.5 : weightedY / totalInk;
  let spreadX = 0;
  let spreadY = 0;
  for (let y = 0; y < 128; y += 1) {
    for (let x = 0; x < 128; x += 1) {
      const ink = 255 - data[y * 128 + x]!;
      spreadX += (x - centerX) ** 2 * ink;
      spreadY += (y - centerY) ** 2 * ink;
    }
  }
  return {
    pixels: data,
    centroid: { x: centerX / 128, y: centerY / 128 },
    spread: {
      x: totalInk === 0 ? 0 : Math.sqrt(spreadX / totalInk) / 128,
      y: totalInk === 0 ? 0 : Math.sqrt(spreadY / totalInk) / 128,
    },
  };
}

async function buildContactSheet(original: Buffer[], candidate: Buffer[]) {
  const pageIndexes = selectRepresentativeIndexes(
    Math.min(original.length, candidate.length),
  );
  const tileWidth = 256;
  const tileHeight = 362;
  const gap = 12;
  const composites: sharp.OverlayOptions[] = [];
  for (let row = 0; row < pageIndexes.length; row += 1) {
    const index = pageIndexes[row]!;
    const [left, right] = await Promise.all([
      sharp(original[index]).resize(tileWidth, tileHeight, { fit: "contain" }).png().toBuffer(),
      sharp(candidate[index]).resize(tileWidth, tileHeight, { fit: "contain" }).png().toBuffer(),
    ]);
    const top = gap + row * (tileHeight + gap);
    composites.push({ input: left, left: gap, top });
    composites.push({ input: right, left: gap * 2 + tileWidth, top });
  }
  return sharp({
    create: {
      width: tileWidth * 2 + gap * 3,
      height: Math.max(gap * 2 + tileHeight, gap + pageIndexes.length * (tileHeight + gap)),
      channels: 3,
      background: "#e5e7eb",
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

function selectRepresentativeIndexes(pageCount: number) {
  if (pageCount <= 12) return Array.from({ length: pageCount }, (_, index) => index);
  return Array.from(
    new Set(
      Array.from({ length: 12 }, (_, index) =>
        Math.round((index * (pageCount - 1)) / 11),
      ),
    ),
  );
}

function readGeometry(page: ReturnType<PDFDocument["getPages"]>[number], pageNumber: number) {
  const mediaBox = page.getMediaBox();
  const cropBox = page.getCropBox();
  return {
    pageNumber,
    mediaBox,
    cropBox,
    rotation: page.getRotation().angle,
  };
}

function sameGeometry(
  left: ReturnType<typeof readGeometry>,
  right: ReturnType<typeof readGeometry>,
) {
  return (
    left.rotation === right.rotation &&
    boxEquivalent(left.mediaBox, right.mediaBox) &&
    boxEquivalent(left.cropBox, right.cropBox)
  );
}

function boxEquivalent(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
) {
  return (["x", "y", "width", "height"] as const).every(
    (key) => Math.abs(left[key] - right[key]) <= GEOMETRY_TOLERANCE,
  );
}

function cloneBytes(buffer: Buffer) {
  const clone = new Uint8Array(buffer.length);
  clone.set(buffer);
  return clone;
}

function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}
