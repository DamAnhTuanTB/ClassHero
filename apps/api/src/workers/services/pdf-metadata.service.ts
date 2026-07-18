import { createHash } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { PDFParse } from "pdf-parse";

/**
 * Lightweight PDF metadata extraction using pdf-parse.
 * Only used for page count and content hash — text extraction comes from paid OCR.
 */
@Injectable()
export class PdfMetadataService {
  private readonly logger = new Logger(PdfMetadataService.name);

  /**
   * Get the number of pages in a PDF buffer.
   */
  async getPageCount(buffer: Buffer): Promise<number> {
    // Clone to prevent ArrayBuffer detachment (pdf-parse v2 takes ownership)
    const clone = new Uint8Array(buffer.length);
    clone.set(buffer);
    const parser = new PDFParse({ data: clone });
    const info = await parser.getInfo();
    await parser.destroy();
    return info.total;
  }

  /**
   * Compute SHA-256 content hash of a buffer (hex string).
   * Used as cache key for OCR artifact deduplication.
   */
  computeContentHash(buffer: Buffer): string {
    return createHash("sha256").update(buffer).digest("hex");
  }
}
