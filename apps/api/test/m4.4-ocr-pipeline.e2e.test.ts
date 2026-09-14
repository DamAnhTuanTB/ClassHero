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

  it("recognizes starred Mathpix headings as section boundaries", async () => {
    const { chunkText } = await import("../src/workers/utils/chunking");
    const firstSection = `\\section*{PHẦN MỘT}\n${"Nội dung phần một ".repeat(18)}`;
    const secondSection = `\\section*{PHẦN HAI}\n${"Nội dung phần hai ".repeat(18)}`;

    const chunks = chunkText(`${firstSection}\n${secondSection}`, {
      targetTokens: 100,
      maxTokens: 120,
      minTokens: 1,
    });

    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.content).toContain("\\section*{PHẦN MỘT}");
    expect(chunks[0]?.content).not.toContain("\\section*{PHẦN HAI}");
    expect(chunks[1]?.content).toMatch(/^\\section\*\{PHẦN HAI\}/u);
  });

  it("uses the semantic overlap profile for document chunks", async () => {
    const { DOCUMENT_CHUNKING_PROFILE } = await import("../src/workers/utils/chunking");

    expect(DOCUMENT_CHUNKING_PROFILE).toEqual({
      version: "semantic-overlap-v2",
      targetTokens: 700,
      maxTokens: 1_000,
      minTokens: 100,
      overlapTokens: 100,
    });
  });

  it("copies a safe sentence suffix into the next non-structural chunk", async () => {
    const { chunkText } = await import("../src/workers/utils/chunking");
    const bridge = "Mệnh đề cầu nối quan trọng.";
    const firstParagraph = `${"A".repeat(160)}. ${bridge}`;
    const secondParagraph = `${"B".repeat(160)}. Nội dung tiếp theo.`;

    const chunks = chunkText(`${firstParagraph}\n\n${secondParagraph}`, {
      targetTokens: 60,
      maxTokens: 80,
      minTokens: 1,
      overlapTokens: 12,
    });

    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.overlapTokenCount).toBe(0);
    expect(chunks[1]?.content).toMatch(new RegExp(`^${bridge}`, "u"));
    expect(chunks[1]?.overlapTokenCount).toBeGreaterThan(0);
    expect(chunks[1]?.tokenCount).toBeLessThanOrEqual(80);
  });

  it("keeps overlap when an explanation continues on the next physical page", async () => {
    const { chunkText } = await import("../src/workers/utils/chunking");
    const bridge = "Kết quả này được dùng ở trang sau.";
    const firstPage = `PDF page 1\n${"A".repeat(160)}. ${bridge}`;
    const secondPage = `PDF page 2\n${"B".repeat(160)}. Nội dung tiếp theo.`;

    const chunks = chunkText(`${firstPage}\n${secondPage}`, {
      targetTokens: 60,
      maxTokens: 90,
      minTokens: 1,
      overlapTokens: 15,
    });
    const secondPageChunk = chunks.find((chunk) => chunk.content.includes("PDF page 2"));

    expect(secondPageChunk?.content).toMatch(new RegExp(`^${bridge}`, "u"));
    expect(secondPageChunk?.overlapTokenCount).toBeGreaterThan(0);
  });

  it("does not carry overlap across a new Mathpix section", async () => {
    const { chunkText } = await import("../src/workers/utils/chunking");
    const bridge = "Không được mang sang phần mới.";
    const firstSection = `${"A".repeat(180)}. ${bridge}`;
    const secondSection = `PDF page 2\n\\section*{PHẦN MỚI}\n${"B".repeat(180)}.`;

    const chunks = chunkText(`${firstSection}\n${secondSection}`, {
      targetTokens: 60,
      maxTokens: 90,
      minTokens: 1,
      overlapTokens: 15,
    });
    const newSectionChunk = chunks.find((chunk) =>
      chunk.content.includes("\\section*{PHẦN MỚI}"),
    );

    expect(newSectionChunk).toBeDefined();
    expect(newSectionChunk?.content).not.toContain(bridge);
    expect(newSectionChunk?.overlapTokenCount).toBe(0);
  });

  it("keeps a short semantic section separate from the previous page", async () => {
    const { chunkText } = await import("../src/workers/utils/chunking");
    const firstPage = `PDF page 1\n${"Nội dung phần trước. ".repeat(36)}`;
    const secondPage = [
      "PDF page 2",
      "\\section*{PHẦN MỚI NGẮN}",
      "Một ý ngắn nhưng thuộc chủ đề khác.",
    ].join("\n");

    const chunks = chunkText(`${firstPage}\n${secondPage}`, {
      targetTokens: 240,
      maxTokens: 300,
      minTokens: 100,
      overlapTokens: 30,
    });
    const newSectionChunk = chunks.find((chunk) =>
      chunk.content.includes("\\section*{PHẦN MỚI NGẮN}"),
    );

    expect(chunks).toHaveLength(2);
    expect(newSectionChunk?.content).toMatch(
      /^PDF page 2\n\\section\*\{PHẦN MỚI NGẮN\}/u,
    );
    expect(newSectionChunk?.overlapTokenCount).toBe(0);
    expect(newSectionChunk?.content).not.toContain("Nội dung phần trước");
  });

  it("keeps ordinary chunks under maxTokens while targeting smaller contexts", async () => {
    const { chunkText } = await import("../src/workers/utils/chunking");
    const paragraphs = Array.from(
      { length: 12 },
      (_, index) => `Đoạn ${index + 1}. ${"Nội dung giáo dục có liên quan. ".repeat(45)}`,
    );
    const chunks = chunkText(paragraphs.join("\n\n"));

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.tokenCount <= 1_000)).toBe(true);
    expect(chunks.some((chunk) => chunk.overlapTokenCount > 0)).toBe(true);
  });

  it("does not split a balanced Mathpix list environment", async () => {
    const { chunkText } = await import("../src/workers/utils/chunking");
    const list = String.raw`\begin{itemize}
\item[9.18.] Cho $A B C D$ là tứ giác nội tiếp.
\item[9.19.] Chứng minh hai góc bằng nhau.
\end{itemize}`;
    const text = [
      "Mở đầu. ".repeat(30),
      list,
      "Nội dung sau danh sách. ".repeat(30),
    ].join("\n");

    const chunks = chunkText(text, {
      targetTokens: 60,
      maxTokens: 90,
      minTokens: 1,
    });
    const listChunks = chunks.filter((chunk) => chunk.content.includes("\\item[9.18.]"));

    expect(listChunks).toHaveLength(1);
    expect(listChunks[0]?.content).toContain("\\begin{itemize}");
    expect(listChunks[0]?.content).toContain("\\item[9.19.]");
    expect(listChunks[0]?.content).toContain("\\end{itemize}");
    expect(
      chunks.every(
        (chunk) =>
          chunk.content.includes("\\begin{itemize}") ===
          chunk.content.includes("\\end{itemize}"),
      ),
    ).toBe(true);
  });

  it.each([
    ["dollar display", "$$\na + b = c.\nd + e = f.\n$$", "$$"],
    ["bracket display", "\\[\na + b = c.\nd + e = f.\n\\]", "\\["],
  ])("does not split balanced %s math", async (_label, display, opener) => {
    const { chunkText } = await import("../src/workers/utils/chunking");
    const chunks = chunkText(
      ["Mở đầu. ".repeat(30), display, "Kết thúc. ".repeat(30)].join("\n"),
      {
        targetTokens: 50,
        maxTokens: 80,
        minTokens: 1,
        overlapTokens: 0,
      },
    );
    const displayChunks = chunks.filter((chunk) => chunk.content.includes(opener));

    expect(displayChunks).toHaveLength(1);
    expect(displayChunks[0]?.content).toContain(display.trim());
  });

  it("should return empty array for empty text", async () => {
    const { chunkText } = await import("../src/workers/utils/chunking");
    expect(chunkText("")).toHaveLength(0);
    expect(chunkText("   ")).toHaveLength(0);
  });
});
