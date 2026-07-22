/**
 * M4.4 OCR Pipeline E2E Test
 *
 * Tests the core OCR services independently without starting the full NestJS app.
 * Requires: Mathpix API keys in .env, MinIO running, a test PDF file.
 *
 * Usage: npx tsx apps/api/test/m4.4-ocr-pipeline.e2e.test.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, beforeAll } from "vitest";
import { PdfMetadataService } from "../src/workers/services/pdf-metadata.service";

const TEST_PDF_PATH = resolve(__dirname, "Toan-7-Tap-1-lam-net.pdf");
const describePdfMetadata = existsSync(TEST_PDF_PATH) ? describe : describe.skip;

describePdfMetadata("M4.4 OCR Pipeline - PdfMetadataService", () => {
  let pdfMetadata: PdfMetadataService;
  let pdfBuffer: Buffer;

  beforeAll(() => {
    pdfBuffer = readFileSync(TEST_PDF_PATH);
    pdfMetadata = new PdfMetadataService();
  });

  it("should get page count from PDF", async () => {
    const pageCount = await pdfMetadata.getPageCount(pdfBuffer);
    console.log(`Page count: ${pageCount}`);
    expect(pageCount).toBeGreaterThan(0);
    expect(pageCount).toBeLessThan(500); // Sanity check
  });

  it("should compute content hash", () => {
    const hash = pdfMetadata.computeContentHash(pdfBuffer);
    console.log(`Content hash: ${hash}`);
    expect(hash).toHaveLength(64); // SHA-256 hex
    // Same buffer should produce same hash
    const hash2 = pdfMetadata.computeContentHash(pdfBuffer);
    expect(hash).toBe(hash2);
  });
});

describe("M4.4 OCR Pipeline - Quality Scoring", () => {
  it("should score Vietnamese math text highly", async () => {
    const { scorePageQuality } = await import("../src/workers/utils/quality-score");
    const goodText = `
Bài 1: Tập hợp Q các số hữu tỉ

Số hữu tỉ là số viết được dưới dạng phân số $\\frac{a}{b}$ với $a, b \\in \\mathbb{Z}$, $b \\neq 0$.

Ví dụ: $0.5 = \\frac{1}{2}$; $-3 = \\frac{-3}{1}$; $0 = \\frac{0}{1}$.

Trên trục số, mỗi số hữu tỉ được biểu diễn bởi một điểm. Ngược lại, mỗi điểm trên trục số biểu diễn một số hữu tỉ.
    `;
    const score = scorePageQuality(goodText);
    console.log(`Good Vietnamese math text score: ${score}`);
    expect(score).toBeGreaterThanOrEqual(0.8);
  });

  it("should score empty text as 0", async () => {
    const { scorePageQuality } = await import("../src/workers/utils/quality-score");
    expect(scorePageQuality("")).toBe(0);
    expect(scorePageQuality(null)).toBe(0);
    expect(scorePageQuality(undefined)).toBe(0);
  });

  it("should penalize garbage text", async () => {
    const { scorePageQuality } = await import("../src/workers/utils/quality-score");
    const garbled = "\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD abc \uFFFD\uFFFD";
    const score = scorePageQuality(garbled);
    console.log(`Garbage text score: ${score}`);
    expect(score).toBeLessThan(0.5);
  });
});

describe("M4.4 OCR Pipeline - Chunking", () => {
  it("should chunk text by headings", async () => {
    const { chunkText } = await import("../src/workers/utils/chunking");
    const text = `
## Chương 1: Số hữu tỉ

Số hữu tỉ là số viết được dưới dạng phân số. Tập hợp các số hữu tỉ được ký hiệu là Q.

## Chương 2: Số thực

Tập hợp các số thực bao gồm cả số hữu tỉ và số vô tỉ. Ký hiệu R.

## Chương 3: Biểu thức đại số

Biểu thức đại số là biểu thức chứa chữ và số.
    `;
    const chunks = chunkText(text);
    console.log(`Chunks created: ${chunks.length}`);
    chunks.forEach((c, i) =>
      console.log(`  Chunk ${i}: ${c.tokenCount} tokens, hash=${c.contentHash}`),
    );

    expect(chunks.length).toBeGreaterThanOrEqual(1);
    // Each chunk should have content
    for (const chunk of chunks) {
      expect(chunk.content.trim().length).toBeGreaterThan(0);
      expect(chunk.tokenCount).toBeGreaterThan(0);
      expect(chunk.contentHash).toHaveLength(16);
    }
  });

  it("should handle text without headings (paragraph-based)", async () => {
    const { chunkText } = await import("../src/workers/utils/chunking");
    const text = `
Đây là đoạn văn thứ nhất. Nội dung về toán học lớp 7.

Đây là đoạn văn thứ hai. Nội dung về hình học.

Đây là đoạn văn thứ ba. Nội dung về đại số.
    `;
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it("should return empty array for empty text", async () => {
    const { chunkText } = await import("../src/workers/utils/chunking");
    expect(chunkText("")).toHaveLength(0);
    expect(chunkText("   ")).toHaveLength(0);
  });
});
