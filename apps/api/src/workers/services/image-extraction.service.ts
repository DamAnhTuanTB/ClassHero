import { Injectable, Logger } from "@nestjs/common";
import * as yauzl from "yauzl";
import { Readable } from "node:stream";

/**
 * Represents a single extracted image from the OCR mmd.zip bundle.
 */
export interface ExtractedImage {
  /** Original filename from the zip, e.g. "ae177c55-...-007_104_509_2239_1193.jpg" */
  filename: string;
  /** 1-indexed page number parsed from the filename */
  pageNumber: number;
  /** Bounding box from Mathpix (x, y, w, h in page pixel coordinates) */
  boundingBox: { x: number; y: number; w: number; h: number };
  /** Raw image buffer */
  data: Buffer;
  /** MIME type */
  mimeType: string;
}

export interface ParsedMathpixImageFilename {
  pageNumber: number;
  boundingBox: { x: number; y: number; w: number; h: number };
}

/**
 * Extract images from Mathpix mmd.zip bundle.
 *
 * Filename convention from Mathpix mmd.zip:
 *   {pdfId}-{pageNumber}_{height}_{width}_{topLeftY}_{topLeftX}.jpg
 *
 * Mathpix can return pageNumber as either 1 or 001.
 */
@Injectable()
export class ImageExtractionService {
  private readonly logger = new Logger(ImageExtractionService.name);

  /**
   * Extract all images from an mmd.zip buffer.
   * Returns images sorted by page number then position.
   */
  async extractImagesFromZip(mmdZipBuffer: Buffer): Promise<ExtractedImage[]> {
    const images: ExtractedImage[] = [];

    const entries = await this.readZipEntries(mmdZipBuffer);

    for (const entry of entries) {
      // Only process image files in the images/ directory
      if (!entry.fileName.startsWith("images/")) continue;
      if (entry.fileName === "images/") continue; // directory entry

      const basename = entry.fileName.split("/").pop()!;

      const parsed = parseMathpixImageFilename(basename);
      if (!parsed) {
        this.logger.warn(`Could not parse image filename: ${basename}`);
        continue;
      }

      const data = await this.readEntryData(mmdZipBuffer, entry);

      const ext = basename.split(".").pop()?.toLowerCase() ?? "jpg";
      const mimeType =
        ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : "image/jpeg";

      images.push({
        filename: basename,
        pageNumber: parsed.pageNumber,
        boundingBox: parsed.boundingBox,
        data,
        mimeType,
      });
    }

    // Sort by page number, then by y position (top to bottom)
    images.sort((a, b) => {
      if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
      return a.boundingBox.y - b.boundingBox.y;
    });

    this.logger.log(
      `Extracted ${images.length} images from mmd.zip across ${new Set(images.map((i) => i.pageNumber)).size} pages`,
    );

    return images;
  }

  /**
   * Group extracted images by page number.
   */
  groupByPage(images: ExtractedImage[]): Map<number, ExtractedImage[]> {
    const map = new Map<number, ExtractedImage[]>();
    for (const img of images) {
      const list = map.get(img.pageNumber) ?? [];
      list.push(img);
      map.set(img.pageNumber, list);
    }
    return map;
  }

  /**
   * Read all entries from a zip buffer using yauzl.
   */
  private readZipEntries(buffer: Buffer): Promise<yauzl.Entry[]> {
    return new Promise((resolve, reject) => {
      yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
        if (err || !zipfile) return reject(err ?? new Error("No zipfile"));

        const entries: yauzl.Entry[] = [];
        zipfile.readEntry();
        zipfile.on("entry", (entry: yauzl.Entry) => {
          entries.push(entry);
          zipfile.readEntry();
        });
        zipfile.on("end", () => resolve(entries));
        zipfile.on("error", reject);
      });
    });
  }

  /**
   * Read the data for a single zip entry.
   */
  private readEntryData(buffer: Buffer, entry: yauzl.Entry): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
        if (err || !zipfile) return reject(err ?? new Error("No zipfile"));

        zipfile.readEntry();
        zipfile.on("entry", (e: yauzl.Entry) => {
          if (e.fileName === entry.fileName) {
            zipfile.openReadStream(e, (readErr, readStream) => {
              if (readErr || !readStream)
                return reject(readErr ?? new Error("No stream"));

              const chunks: Buffer[] = [];
              (readStream as Readable).on("data", (chunk: Buffer) => chunks.push(chunk));
              (readStream as Readable).on("end", () => resolve(Buffer.concat(chunks)));
              (readStream as Readable).on("error", reject);
            });
          } else {
            zipfile.readEntry();
          }
        });
        zipfile.on("error", reject);
      });
    });
  }
}

/**
 * Parse Mathpix image filename to extract page number and bounding box.
 * Format: {pdfId}-{pageNumber}_{height}_{width}_{topLeftY}_{topLeftX}.{ext}
 */
export function parseMathpixImageFilename(
  filename: string,
): ParsedMathpixImageFilename | null {
  const withoutExt = filename.replace(/\.[^.]+$/, "");

  // The pdfId contains hyphens, so match the page-bbox suffix from the end.
  const match = withoutExt.match(/-(\d{1,6})_(\d+)_(\d+)_(\d+)_(\d+)$/);
  if (!match) return null;

  return {
    pageNumber: parseInt(match[1]!, 10),
    boundingBox: {
      x: parseInt(match[5]!, 10),
      y: parseInt(match[4]!, 10),
      w: parseInt(match[3]!, 10),
      h: parseInt(match[2]!, 10),
    },
  };
}
