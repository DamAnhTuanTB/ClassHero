import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import {
  BackgroundJobQueue,
  BackgroundJobStatus,
  DocumentStatus,
  LessonDocumentKind,
  Prisma,
} from "@prisma/client";
import { Job } from "bullmq";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "#api/common/prisma/prisma.service";
import type { EnvConfig } from "#api/config/env.validation";
import type {
  BackgroundJobBullmqData,
  BackgroundJobBullmqResult,
} from "#api/jobs/background-job-queues";
import { DocumentProcessingProcessor } from "#api/workers/processors/document-processing.processor";
import type { EmbeddingJobEnqueuer } from "#api/workers/services/embedding-job-enqueuer.service";
import { parseMathpixImageFilename } from "#api/workers/services/image-extraction.service";
import type { OcrArtifactBundle } from "#api/workers/services/mathpix-ocr.service";
import { buildOcrArtifactAudit } from "#api/workers/utils/ocr-artifact-audit";
import { buildOcrImageManifest } from "#api/workers/utils/ocr-image-manifest";
import { resolveOcrVisualReference } from "#api/workers/utils/ocr-visual-resolver";
import {
  applyPrintedPageSequenceMapping,
  inferPrintedPageReference,
} from "#api/workers/utils/ocr-printed-page";

describe("M4.4 document processing worker", () => {
  it("chunks source-document ranges with the lessonId from inputMeta", async () => {
    const prisma = createSourceChunkingPrismaMock();
    const processor = createProcessor(prisma);

    await processor.process(
      createBullmqJob({
        backgroundJobId: "job-source-chunk",
      }),
    );

    expect(prisma.lessonDocumentPageRange.findFirstOrThrow).toHaveBeenCalledWith({
      where: {
        id: "range-1",
        lessonId: "lesson-1",
        sourceDocumentId: "source-1",
      },
    });

    expect(prisma.documentChunk.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          documentId: "lesson-document-1",
          lessonId: "lesson-1",
          metadataJson: expect.objectContaining({
            sourceDocumentId: "source-1",
            pageStart: 2,
            pageEnd: 3,
            textSource: "paid_ocr",
            printedPageMappingSummary: expect.objectContaining({
              knownCount: 2,
              pages: expect.arrayContaining([
                expect.objectContaining({
                  pdfPageNumber: 2,
                  printedPageNumber: 32,
                }),
              ]),
            }),
            sourcePages: expect.arrayContaining([
              expect.objectContaining({
                pageNumber: 2,
                printedPage: expect.objectContaining({
                  printedPageNumber: 32,
                }),
              }),
            ]),
          }),
        }),
      ]),
    });

    expect(prisma.lessonDocument.update).toHaveBeenLastCalledWith({
      where: { id: "lesson-document-1" },
      data: expect.objectContaining({
        status: DocumentStatus.PROCESSING,
        chunkCount: expect.any(Number),
        contentHash: expect.any(String),
        embeddingProvider: null,
      }),
    });
  });

  it("processes supplemental lesson documents from cached paid OCR artifacts", async () => {
    const prisma = createDirectDocumentPrismaMock();
    const bundle = createOcrBundle();
    const { artifactKeys, processor, mathpixOcr } = createProcessorWithBundle(
      prisma,
      bundle,
    );

    await processor.process(
      createBullmqJob({
        backgroundJobId: "job-supplement",
      }),
    );

    expect(mathpixOcr.submitPdf).not.toHaveBeenCalled();
    expect(prisma.documentChunk.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          documentId: "supplement-document-1",
          lessonId: "lesson-1",
          metadataJson: expect.objectContaining({
            textSource: "paid_ocr",
            ocrArtifact: expect.objectContaining({
              artifactAuditKey: artifactKeys.artifactAuditJson,
              artifactKeys: expect.objectContaining({
                md: artifactKeys.md,
                pagesJson: artifactKeys.pagesJson,
                manifestJson: artifactKeys.manifestJson,
                artifactAuditJson: artifactKeys.artifactAuditJson,
              }),
            }),
          }),
        }),
      ]),
    });

    expect(prisma.lessonDocument.update).toHaveBeenLastCalledWith({
      where: { id: "supplement-document-1" },
      data: expect.objectContaining({
        status: DocumentStatus.PROCESSING,
        extractedText: expect.stringContaining("Nội dung trang 1"),
        contentHash: "content-hash",
        metadataJson: expect.objectContaining({
          ocr: expect.objectContaining({
            normalizedPagesKey: artifactKeys.pagesJson,
            artifactAuditKey: artifactKeys.artifactAuditJson,
            artifactKeys: expect.objectContaining({
              md: artifactKeys.md,
            }),
          }),
          visualAssets: expect.objectContaining({
            imageManifestKey: artifactKeys.imageManifestJson,
            artifactAuditKey: artifactKeys.artifactAuditJson,
            artifactAuditStatus: expect.any(String),
          }),
          printedPageMappingSummary: expect.objectContaining({
            pageCount: 2,
            unknownCount: 2,
            missingCount: 2,
          }),
          pages: expect.arrayContaining([
            expect.objectContaining({
              pageNumber: 1,
              confidence: 0.95,
            }),
          ]),
        }),
      }),
    });
  });
});

describe("M4.4 Mathpix image filename parsing", () => {
  it("parses both padded and unpadded Mathpix page numbers", () => {
    expect(
      parseMathpixImageFilename(
        "85ce7444-c0e6-4d87-9667-d62d6a79f60a-1_586_1146_978_492.jpg",
      ),
    ).toEqual({
      pageNumber: 1,
      boundingBox: { x: 492, y: 978, w: 1146, h: 586 },
    });

    expect(
      parseMathpixImageFilename(
        "ae177c55-83dc-4c94-a8f8-73b2c5ae18af-007_104_509_2239_1193.jpg",
      ),
    ).toEqual({
      pageNumber: 7,
      boundingBox: { x: 1193, y: 2239, w: 509, h: 104 },
    });
  });
});

describe("M4.4 OCR image manifest", () => {
  it("stores page, bbox, normalized bbox, nearby text and inferred kind", () => {
    const printedPage = inferPrintedPageReference({
      pdfPageNumber: 1,
      text: "Hình 2.1: Tam giác ABC\n35",
      lines: [
        {
          lineIndex: 0,
          lineId: "line-caption",
          text: "Hình 2.1: Tam giác ABC",
          type: "caption",
          confidence: 0.96,
        },
        {
          lineIndex: 1,
          lineId: "line-page-number",
          text: "35",
          type: "text",
          confidence: 0.95,
        },
      ],
    });
    const manifest = buildOcrImageManifest({
      contentHash: "content-hash",
      provider: "mathpix",
      modelVersion: "mathpix-v3-pdf",
      optionsHash: "options-hash",
      artifactBaseKey: "ocr-artifacts/mathpix/content-hash/options-hash",
      artifactKeys: {
        mmdZip: "ocr-artifacts/mathpix/content-hash/options-hash/artifact.mmd.zip",
        htmlZip: "ocr-artifacts/mathpix/content-hash/options-hash/artifact.html.zip",
        linesJson: "ocr-artifacts/mathpix/content-hash/options-hash/lines.json",
        pagesJson: "ocr-artifacts/mathpix/content-hash/options-hash/pages.json",
        imageManifestJson:
          "ocr-artifacts/mathpix/content-hash/options-hash/image-manifest.json",
      },
      pdfId: "mathpix-pdf-1",
      pageCount: 1,
      ownerId: "source-document-1",
      linesJson: Buffer.from(
        JSON.stringify({
          pages: [
            {
              page: 1,
              page_width: 1000,
              page_height: 1400,
              lines: [
                {
                  id: "line-caption",
                  text: "Hình 2.1: Tam giác ABC",
                  confidence: 0.96,
                  type: "caption",
                  region: {
                    top_left_x: 220,
                    top_left_y: 805,
                    width: 400,
                    height: 40,
                  },
                },
              ],
            },
          ],
        }),
      ),
      pages: [
        {
          pageNumber: 1,
          printedPage,
          text: "Hình 2.1: Tam giác ABC\n35",
          mathpixMarkdown: null,
          markdown: null,
          lineCount: 2,
          confidence: 0.96,
          qualityFlags: [],
          layoutRef: {
            artifact: "lines.json",
            pageIndex: 0,
            pageNumber: 1,
            lineCount: 2,
            lineRefs: ["line-caption", "line-page-number"],
          },
          lines: [],
        },
      ],
      images: [
        {
          pageNumber: 1,
          objectKey:
            "document-images/source-document-1/page-001/mathpix-1_200_300_500_450.jpg",
          filename: "mathpix-1_200_300_500_450.jpg",
          boundingBox: { x: 200, y: 300, w: 500, h: 450 },
          size: 12345,
          mimeType: "image/jpeg",
        },
      ],
    });

    expect(manifest.summary).toMatchObject({
      totalImages: 1,
      usableImageCount: 1,
      pagesWithImages: [1],
    });
    expect(manifest.images[0]).toMatchObject({
      pageNumber: 1,
      printedPage: expect.objectContaining({
        pdfPageNumber: 1,
        printedPageNumber: 35,
        printedPageLabel: "35",
      }),
      orderInPage: 1,
      normalizedBoundingBox: { x: 0.2, y: 0.214286, w: 0.5, h: 0.321429 },
      pageDimensions: {
        width: 1000,
        height: 1400,
        source: "lines.json",
      },
      nearbyLineIds: ["line-caption"],
      captionCandidate: "Hình 2.1: Tam giác ABC",
      kind: "figure",
      qualityFlags: [],
      isUsableForAi: true,
    });
    expect(manifest.images[0]?.nearbyText).toContain("Tam giác ABC");
  });

  it("sanitizes Mathpix includegraphics blocks from visual captions", () => {
    const manifest = buildOcrImageManifest({
      contentHash: "content-hash",
      provider: "mathpix",
      modelVersion: "mathpix-v3-pdf",
      optionsHash: "options-hash",
      artifactBaseKey: "ocr-artifacts/mathpix/content-hash/options-hash",
      artifactKeys: {
        mmdZip: "ocr-artifacts/mathpix/content-hash/options-hash/artifact.mmd.zip",
        htmlZip: "ocr-artifacts/mathpix/content-hash/options-hash/artifact.html.zip",
        linesJson: "ocr-artifacts/mathpix/content-hash/options-hash/lines.json",
        pagesJson: "ocr-artifacts/mathpix/content-hash/options-hash/pages.json",
        imageManifestJson:
          "ocr-artifacts/mathpix/content-hash/options-hash/image-manifest.json",
      },
      pdfId: "mathpix-pdf-1",
      pageCount: 1,
      ownerId: "source-document-1",
      linesJson: Buffer.from(
        JSON.stringify({
          pages: [
            {
              page: 1,
              page_width: 1000,
              page_height: 1400,
              lines: [
                {
                  id: "line-figure",
                  text: [
                    "\\begin{figure}",
                    "\\includegraphics{https://cdn.mathpix.com/cropped/file.jpg}",
                    "\\caption{Hình 2.5\\end{itemize}}",
                    "\\end{figure}",
                  ].join("\n"),
                  confidence: 0.96,
                  type: "figure",
                  region: {
                    top_left_x: 100,
                    top_left_y: 520,
                    width: 300,
                    height: 40,
                  },
                },
              ],
            },
          ],
        }),
      ),
      pages: [],
      images: [
        {
          pageNumber: 1,
          objectKey:
            "document-images/source-document-1/page-001/mathpix-1_500_100_300_400.jpg",
          filename: "mathpix-1_500_100_300_400.jpg",
          boundingBox: { x: 100, y: 100, w: 300, h: 400 },
          size: 12345,
          mimeType: "image/jpeg",
        },
      ],
    });

    expect(manifest.images[0]?.captionCandidate).toBe("Hình 2.5");
    expect(manifest.images[0]?.nearbyText).not.toContain("cdn.mathpix.com");
    expect(manifest.images[0]?.nearbyText).not.toContain("includegraphics");
  });

  it("resolves provider image candidates by printed page number", () => {
    const printedPage = inferPrintedPageReference({
      pdfPageNumber: 36,
      text: "Hình 1: Listen and repeat\n35",
      lines: [
        {
          lineIndex: 0,
          lineId: "caption",
          text: "Hình 1: Listen and repeat",
          type: "caption",
          confidence: 0.98,
        },
        {
          lineIndex: 20,
          lineId: "footer",
          text: "35",
          type: "page_info",
          confidence: 0.99,
        },
      ],
    });
    const manifest = buildOcrImageManifest({
      contentHash: "content-hash",
      provider: "mathpix",
      modelVersion: "mathpix-v3-pdf",
      optionsHash: "options-hash",
      artifactBaseKey: "ocr-artifacts/mathpix/content-hash/options-hash",
      artifactKeys: {
        mmdZip: "ocr-artifacts/mathpix/content-hash/options-hash/artifact.mmd.zip",
        htmlZip: "ocr-artifacts/mathpix/content-hash/options-hash/artifact.html.zip",
        linesJson: "ocr-artifacts/mathpix/content-hash/options-hash/lines.json",
        pagesJson: "ocr-artifacts/mathpix/content-hash/options-hash/pages.json",
        imageManifestJson:
          "ocr-artifacts/mathpix/content-hash/options-hash/image-manifest.json",
      },
      pdfId: "mathpix-pdf-1",
      pageCount: 36,
      ownerId: "source-document-1",
      linesJson: Buffer.from(
        JSON.stringify({
          pages: Array.from({ length: 36 }, (_, index) => ({
            page: index + 1,
            page_width: 1000,
            page_height: 1400,
            lines:
              index === 35
                ? [
                    {
                      id: "caption",
                      text: "Hình 1: Listen and repeat",
                      confidence: 0.98,
                      type: "caption",
                      region: {
                        top_left_x: 120,
                        top_left_y: 640,
                        width: 500,
                        height: 40,
                      },
                    },
                  ]
                : [],
          })),
        }),
      ),
      pages: [
        {
          pageNumber: 36,
          printedPage,
          text: "Hình 1: Listen and repeat\n35",
          mathpixMarkdown: null,
          markdown: null,
          lineCount: 2,
          confidence: 0.98,
          qualityFlags: [],
          layoutRef: {
            artifact: "lines.json",
            pageIndex: 35,
            pageNumber: 36,
            lineCount: 2,
            lineRefs: ["caption", "footer"],
          },
          lines: [],
        },
      ],
      images: [
        {
          pageNumber: 36,
          objectKey:
            "document-images/source-document-1/page-036/mathpix-36_420_500_200_120.jpg",
          filename: "mathpix-36_420_500_200_120.jpg",
          boundingBox: { x: 120, y: 200, w: 500, h: 420 },
          size: 12345,
          mimeType: "image/jpeg",
        },
      ],
    });

    const resolved = resolveOcrVisualReference({
      manifest,
      printedPageNumber: 35,
      query: "hinh listen",
      kind: "visual",
      maxCandidates: 3,
    });

    expect(resolved.status).toBe("resolved");
    expect(resolved.candidates[0]).toMatchObject({
      pageNumber: 36,
      objectKey:
        "document-images/source-document-1/page-036/mathpix-36_420_500_200_120.jpg",
      printedPage: expect.objectContaining({
        printedPageNumber: 35,
      }),
      isUsableForAi: true,
    });
    expect(resolved.pageFallbacks).toEqual([
      expect.objectContaining({
        pageNumber: 36,
        imageCount: 1,
      }),
    ]);
  });

  it("builds an audit artifact for OCR pages and provider image quality", () => {
    const printedPage = inferPrintedPageReference({
      pdfPageNumber: 1,
      text: "Hình 2.1\n35",
      lines: [
        {
          lineIndex: 0,
          lineId: "caption",
          text: "Hình 2.1",
          type: "caption",
          confidence: 0.95,
        },
        {
          lineIndex: 1,
          lineId: "footer",
          text: "35",
          type: "page_info",
          confidence: 0.95,
        },
      ],
    });
    const pages = [
      {
        pageNumber: 1,
        printedPage,
        text: "Hình 2.1\n35",
        mathpixMarkdown: null,
        markdown: null,
        lineCount: 2,
        confidence: 0.95,
        qualityFlags: [],
        layoutRef: {
          artifact: "lines.json" as const,
          pageIndex: 0,
          pageNumber: 1,
          lineCount: 2,
          lineRefs: ["caption", "footer"],
        },
        lines: [],
      },
    ];
    const manifest = buildOcrImageManifest({
      contentHash: "content-hash",
      provider: "mathpix",
      modelVersion: "mathpix-v3-pdf",
      optionsHash: "options-hash",
      artifactBaseKey: "ocr-artifacts/mathpix/content-hash/options-hash",
      artifactKeys: {
        mmdZip: "ocr-artifacts/mathpix/content-hash/options-hash/artifact.mmd.zip",
        htmlZip: "ocr-artifacts/mathpix/content-hash/options-hash/artifact.html.zip",
        linesJson: "ocr-artifacts/mathpix/content-hash/options-hash/lines.json",
        pagesJson: "ocr-artifacts/mathpix/content-hash/options-hash/pages.json",
        imageManifestJson:
          "ocr-artifacts/mathpix/content-hash/options-hash/image-manifest.json",
        artifactAuditJson:
          "ocr-artifacts/mathpix/content-hash/options-hash/artifact-audit.json",
      },
      pdfId: "mathpix-pdf-1",
      pageCount: 1,
      ownerId: "source-document-1",
      linesJson: Buffer.from(
        JSON.stringify({
          pages: [
            {
              page: 1,
              page_width: 1000,
              page_height: 1400,
              lines: [],
            },
          ],
        }),
      ),
      pages,
      images: [
        {
          pageNumber: 1,
          objectKey:
            "document-images/source-document-1/page-001/mathpix-1_50_300_1450_900.jpg",
          filename: "mathpix-1_50_300_1450_900.jpg",
          boundingBox: { x: 900, y: 1450, w: 300, h: 50 },
          size: 12345,
          mimeType: "image/jpeg",
        },
      ],
    });

    const audit = buildOcrArtifactAudit({
      contentHash: "content-hash",
      provider: "mathpix",
      modelVersion: "mathpix-v3-pdf",
      optionsHash: "options-hash",
      artifactBaseKey: "ocr-artifacts/mathpix/content-hash/options-hash",
      artifactKeys: {
        mmd: "ocr-artifacts/mathpix/content-hash/options-hash/artifact.mmd",
        md: "ocr-artifacts/mathpix/content-hash/options-hash/artifact.md",
        mmdZip: "ocr-artifacts/mathpix/content-hash/options-hash/artifact.mmd.zip",
        linesJson: "ocr-artifacts/mathpix/content-hash/options-hash/lines.json",
        htmlZip: "ocr-artifacts/mathpix/content-hash/options-hash/artifact.html.zip",
        pagesJson: "ocr-artifacts/mathpix/content-hash/options-hash/pages.json",
        imageManifestJson:
          "ocr-artifacts/mathpix/content-hash/options-hash/image-manifest.json",
        artifactAuditJson:
          "ocr-artifacts/mathpix/content-hash/options-hash/artifact-audit.json",
        metadataJson: "ocr-artifacts/mathpix/content-hash/options-hash/metadata.json",
        manifestJson: "ocr-artifacts/mathpix/content-hash/options-hash/manifest.json",
      },
      expectedPageCount: 1,
      pages,
      imageManifest: manifest,
    });

    expect(audit.status).toBe("failed");
    expect(audit.summary).toMatchObject({
      expectedPageCount: 1,
      normalizedPageCount: 1,
      providerImageCount: 1,
      usableProviderImageCount: 0,
      imagesWithInvalidNormalizedBoxCount: 1,
    });
    expect(audit.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          code: "image_invalid_normalized_bbox",
        }),
      ]),
    );
  });
});

describe("M4.4 printed page inference", () => {
  it("infers printed page number from OCR boundary lines", () => {
    expect(
      inferPrintedPageReference({
        pdfPageNumber: 42,
        text: "Phân số bằng nhau\n35",
        lines: [
          {
            lineIndex: 0,
            lineId: "title",
            text: "Phân số bằng nhau",
            type: "text",
            confidence: 0.94,
          },
          {
            lineIndex: 12,
            lineId: "footer-page",
            text: "35",
            type: "text",
            confidence: 0.96,
          },
        ],
      }),
    ).toMatchObject({
      pdfPageNumber: 42,
      printedPageNumber: 35,
      printedPageLabel: "35",
      source: "ocr_inferred",
      evidenceLineIds: ["footer-page"],
      warning: null,
    });
  });

  it("marks printed page as missing when OCR has no boundary marker", () => {
    expect(
      inferPrintedPageReference({
        pdfPageNumber: 5,
        text: "Bài tập về phân số",
        lines: [
          {
            lineIndex: 0,
            lineId: "body",
            text: "Bài tập về phân số",
            type: "text",
            confidence: 0.91,
          },
        ],
      }),
    ).toMatchObject({
      pdfPageNumber: 5,
      printedPageNumber: null,
      printedPageLabel: null,
      source: "unknown",
      warning: "missing",
    });
  });

  it("prefers page_info markers over table cells near the page boundary", () => {
    expect(
      inferPrintedPageReference({
        pdfPageNumber: 106,
        text: "BÀI TẬP\n35\n105",
        lines: [
          {
            lineIndex: 0,
            lineId: "heading",
            text: "BÀI TẬP",
            type: "section_header",
            confidence: 1,
          },
          {
            lineIndex: 80,
            lineId: "table-cell",
            text: "35",
            type: "simple_cell",
            confidence: 1,
          },
          {
            lineIndex: 85,
            lineId: "footer-page",
            text: "105",
            type: "page_info",
            confidence: 1,
          },
        ],
      }),
    ).toMatchObject({
      pdfPageNumber: 106,
      printedPageNumber: 105,
      printedPageLabel: "105",
      source: "ocr_inferred",
      evidenceLineIds: ["footer-page"],
      warning: null,
    });
  });

  it("fills missing printed page numbers from the dominant PDF-to-book offset", () => {
    const mapped = applyPrintedPageSequenceMapping([
      {
        pdfPageNumber: 10,
        printedPageNumber: 9,
        printedPageLabel: "9",
        source: "ocr_inferred",
        confidence: 0.95,
        evidenceLineIds: ["p10-footer"],
        evidenceText: "9",
        warning: null,
      },
      {
        pdfPageNumber: 11,
        printedPageNumber: 10,
        printedPageLabel: "10",
        source: "ocr_inferred",
        confidence: 0.95,
        evidenceLineIds: ["p11-footer"],
        evidenceText: "10",
        warning: null,
      },
      {
        pdfPageNumber: 12,
        printedPageNumber: 11,
        printedPageLabel: "11",
        source: "ocr_inferred",
        confidence: 0.95,
        evidenceLineIds: ["p12-footer"],
        evidenceText: "11",
        warning: null,
      },
      {
        pdfPageNumber: 13,
        printedPageNumber: null,
        printedPageLabel: null,
        source: "unknown",
        confidence: null,
        evidenceLineIds: [],
        evidenceText: null,
        warning: "missing",
      },
      {
        pdfPageNumber: 14,
        printedPageNumber: 13,
        printedPageLabel: "13",
        source: "ocr_inferred",
        confidence: 0.62,
        evidenceLineIds: ["p14-footer", "p14-cell"],
        evidenceText: "13",
        warning: "ambiguous",
      },
    ]);

    expect(mapped[3]).toMatchObject({
      pdfPageNumber: 13,
      printedPageNumber: 12,
      printedPageLabel: "12",
      source: "offset_rule",
      warning: null,
    });
    expect(mapped[4]).toMatchObject({
      pdfPageNumber: 14,
      printedPageNumber: 13,
      source: "offset_rule",
      warning: null,
    });
  });

  it("rewrites large OCR outliers when a strong document offset is established", () => {
    const anchors = Array.from({ length: 20 }, (_, index) => {
      const pdfPageNumber = index + 10;
      const printedPageNumber = pdfPageNumber - 1;

      return {
        pdfPageNumber,
        printedPageNumber,
        printedPageLabel: String(printedPageNumber),
        source: "ocr_inferred" as const,
        confidence: 0.96,
        evidenceLineIds: [`p${pdfPageNumber}-footer`],
        evidenceText: String(printedPageNumber),
        warning: null,
      };
    });

    const mapped = applyPrintedPageSequenceMapping([
      ...anchors,
      {
        pdfPageNumber: 73,
        printedPageNumber: 7,
        printedPageLabel: "7",
        source: "ocr_inferred",
        confidence: 0.98,
        evidenceLineIds: ["p73-unit-number"],
        evidenceText: "7",
        warning: null,
      },
    ]);

    expect(mapped.at(-1)).toMatchObject({
      pdfPageNumber: 73,
      printedPageNumber: 72,
      printedPageLabel: "72",
      source: "offset_rule",
      warning: null,
    });
    expect(mapped.at(-1)?.evidenceText).toContain("ocr=7");
  });
});

function createSourceChunkingPrismaMock() {
  const record = {
    id: "job-source-chunk",
    queue: BackgroundJobQueue.DOCUMENT_PROCESSING,
    status: BackgroundJobStatus.QUEUED,
    lessonId: "lesson-1",
    resourceType: "LESSON_DOCUMENT",
    resourceId: "lesson-document-1",
    inputMeta: {
      action: "LESSON_PRIMARY_FROM_SOURCE_PROCESSING",
      lessonId: "lesson-1",
      lessonDocumentId: "lesson-document-1",
      sourceDocumentId: "source-1",
      pageRangeId: "range-1",
    } satisfies Prisma.InputJsonObject,
    result: null,
    attempts: 0,
    maxAttempts: 1,
  };

  return {
    backgroundJob: {
      findUnique: vi.fn(async () => record),
      update: vi.fn(async (input: { data: Record<string, unknown> }) => ({
        ...record,
        ...input.data,
      })),
    },
    lessonDocumentPageRange: {
      findFirstOrThrow: vi.fn(async () => ({
        id: "range-1",
        lessonId: "lesson-1",
        sourceDocumentId: "source-1",
        pageRangeId: "range-1",
        pageStart: 2,
        pageEnd: 3,
      })),
    },
    lessonDocument: {
      findFirstOrThrow: vi.fn(async () => ({
        id: "lesson-document-1",
        lessonId: "lesson-1",
        fileId: "source-file-1",
        sourceDocumentId: "source-1",
        kind: LessonDocumentKind.PRIMARY_FROM_SOURCE,
        metadataJson: { existing: true },
        file: {
          objectKey: "uploads/source.pdf",
        },
      })),
      update: vi.fn(async (input: unknown) => input),
      findUnique: vi.fn(async () => ({ metadataJson: {} })),
    },
    sourceDocumentPage: {
      findMany: vi.fn(async () => [
        createSourcePage(2, "Nội dung trang 2"),
        createSourcePage(3, "Nội dung trang 3"),
      ]),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    sourceDocument: {
      findUniqueOrThrow: vi.fn(async () => ({
        contentHash: "source-content-hash",
        fileId: "source-file-1",
        file: {
          objectKey: "uploads/source.pdf",
        },
      })),
    },
    documentChunk: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
      createMany: vi.fn(async () => ({ count: 1 })),
    },
    aiExplanation: {
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
  } as unknown as PrismaService & {
    lessonDocumentPageRange: { findFirstOrThrow: ReturnType<typeof vi.fn> };
    lessonDocument: { update: ReturnType<typeof vi.fn> };
    documentChunk: { createMany: ReturnType<typeof vi.fn> };
  };
}

function createDirectDocumentPrismaMock() {
  const record = {
    id: "job-supplement",
    queue: BackgroundJobQueue.DOCUMENT_PROCESSING,
    status: BackgroundJobStatus.QUEUED,
    lessonId: "lesson-1",
    resourceType: "LESSON_DOCUMENT",
    resourceId: "supplement-document-1",
    inputMeta: {
      action: "LESSON_SUPPLEMENT_PROCESSING",
      lessonId: "lesson-1",
      lessonDocumentId: "supplement-document-1",
      fileId: "supplement-file-1",
    } satisfies Prisma.InputJsonObject,
    result: null,
    attempts: 0,
    maxAttempts: 1,
  };

  return {
    backgroundJob: {
      findUnique: vi.fn(async () => record),
      update: vi.fn(async (input: { data: Record<string, unknown> }) => ({
        ...record,
        ...input.data,
      })),
    },
    lessonDocument: {
      findFirstOrThrow: vi.fn(async () => ({
        id: "supplement-document-1",
        lessonId: "lesson-1",
        fileId: "supplement-file-1",
        kind: LessonDocumentKind.SUPPLEMENT,
        title: "Phiếu bài tập",
        metadataJson: { source: "supplemental_lesson_document_upload" },
        file: {
          objectKey: "uploads/supplement.pdf",
          originalName: "supplement.pdf",
        },
      })),
      update: vi.fn(async (input: unknown) => input),
      findUnique: vi.fn(async () => ({ metadataJson: {} })),
    },
    documentChunk: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
      createMany: vi.fn(async () => ({ count: 1 })),
    },
    aiExplanation: {
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
  } as unknown as PrismaService & {
    lessonDocument: { update: ReturnType<typeof vi.fn> };
    documentChunk: { createMany: ReturnType<typeof vi.fn> };
  };
}

function createSourcePage(pageNumber: number, text: string) {
  const printedPageNumber = pageNumber + 30;

  return {
    pageNumber,
    text,
    textSource: "paid_ocr",
    status: DocumentStatus.READY,
    qualityScore: 0.9,
    metadataJson: {
      printedPage: {
        pdfPageNumber: pageNumber,
        printedPageNumber,
        printedPageLabel: String(printedPageNumber),
        source: "ocr_inferred",
        confidence: 0.9,
        evidenceLineIds: [`p${pageNumber}-footer`],
        evidenceText: String(printedPageNumber),
        warning: null,
      },
      artifacts: {
        linesJson: "ocr/lines.json",
      },
      layout: {
        artifact: "lines.json",
        pageNumber,
      },
      visual: {
        pageImageFallback: {
          renderOnDemand: true,
        },
      },
    },
  };
}

function createProcessor(prisma: PrismaService) {
  return createProcessorWithBundle(prisma, createOcrBundle()).processor;
}

function createProcessorWithBundle(prisma: PrismaService, bundle: OcrArtifactBundle) {
  const descriptor = {
    contentHash: "content-hash",
    provider: "mathpix",
    modelVersion: "mathpix-v3-pdf",
    languageHints: ["vi", "en"],
    options: {
      conversion_formats: {
        "mmd.zip": true,
        md: true,
        "html.zip": true,
      },
    },
    outputFormats: ["mmd", "mmd.zip", "lines.json", "md", "html.zip"],
    optionsHash: "options-hash",
    baseKey: "ocr-artifacts/mathpix/content-hash/options-hash",
  };
  const artifactKeys = {
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
  const manifest = {
    schemaVersion: 1 as const,
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
    createdAt: new Date(0).toISOString(),
  };
  const mathpixOcr = {
    submitPdf: vi.fn(),
    pollUntilComplete: vi.fn(),
    downloadAllArtifacts: vi.fn(),
  };
  const processor = new DocumentProcessingProcessor(
    prisma,
    {
      get: vi.fn((key: keyof EnvConfig) => {
        if (key === "OCR_PROVIDER") return "mathpix";
        if (key === "OCR_PAID_ENABLED") return false;
        return undefined;
      }),
    } as unknown as ConfigService<EnvConfig, true>,
    {
      downloadObject: vi.fn(async () => Buffer.from("pdf")),
      uploadBuffer: vi.fn(async () => undefined),
    } as never,
    mathpixOcr as never,
    {
      getPageCount: vi.fn(async () => bundle.numPages),
      computeContentHash: vi.fn(() => "content-hash"),
    } as never,
    {
      createDescriptor: vi.fn(() => descriptor),
      buildArtifactKeys: vi.fn(() => artifactKeys),
      hasArtifact: vi.fn(async () => true),
      loadBundle: vi.fn(async () => ({ ...bundle, manifest })),
      saveBundle: vi.fn(),
      saveNormalizedPages: vi.fn(async () => artifactKeys.pagesJson),
      saveImageManifest: vi.fn(async () => artifactKeys.imageManifestJson),
      saveArtifactAudit: vi.fn(async () => artifactKeys.artifactAuditJson),
    } as never,
    {
      extractImagesFromZip: vi.fn(async () => []),
      groupByPage: vi.fn(() => new Map()),
    } as never,
    {
      enqueueEmbeddingJob: vi.fn(async () => ({ jobId: "embedding-job-1" })),
    } as unknown as EmbeddingJobEnqueuer,
  );

  return {
    artifactKeys,
    mathpixOcr,
    processor,
  };
}

function createOcrBundle(): OcrArtifactBundle {
  return {
    mmd: Buffer.from("Nội dung trang 1\\newpageNội dung trang 2"),
    md: Buffer.from("Nội dung trang 1\\newpageNội dung trang 2"),
    mmdZip: Buffer.from("zip"),
    linesJson: Buffer.from(
      JSON.stringify({
        pages: [
          {
            lines: [
              {
                id: "p1-l1",
                text: "Nội dung trang 1",
                confidence: 0.95,
                type: "text",
                bbox: { x: 1, y: 2, w: 3, h: 4 },
              },
            ],
          },
          {
            lines: [
              {
                id: "p2-l1",
                text: "Nội dung trang 2",
                confidence: 0.91,
                type: "text",
                bbox: { x: 5, y: 6, w: 7, h: 8 },
              },
            ],
          },
        ],
      }),
    ),
    htmlZip: Buffer.from("html"),
    pdfId: "mathpix-pdf-1",
    numPages: 2,
    processingTimeMs: 456,
  };
}

function createBullmqJob({ backgroundJobId }: { backgroundJobId: string }) {
  return {
    id: backgroundJobId,
    data: { backgroundJobId },
    attemptsMade: 0,
    opts: { attempts: 1 },
  } as unknown as Job<BackgroundJobBullmqData, BackgroundJobBullmqResult>;
}
