import { DocumentStatus, LessonDocumentKind } from "@prisma/client";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";

import {
  LessonSourcePacketError,
  LessonSourcePacketService,
} from "#api/modules/ai/services/lesson-source-packet.service";
import { buildLessonSummaryStructuredInput } from "#api/modules/ai/utils/lesson-summary-prompt";

describe("M9.2 lesson source PDF packet", () => {
  it("uses every page from a directly uploaded primary PDF", async () => {
    const uploadedPdf = await searchablePdf([
      "Uploaded primary page one",
      "Uploaded primary page two",
    ]);
    const document = sourceDocument({
      id: "doc-uploaded-primary",
      kind: LessonDocumentKind.PRIMARY_FROM_SOURCE,
      objectKey: "source/uploaded-primary.pdf",
      fileId: "file-uploaded-primary",
      pageRange: null,
      sourceDocumentId: null,
    });
    const storage = {
      downloadObject: vi.fn(async () => uploadedPdf),
      uploadBuffer: vi.fn(async () => undefined),
      deleteObject: vi.fn(async () => undefined),
    };
    const service = new LessonSourcePacketService(
      {
        lesson: { findFirst: vi.fn(async () => ({ id: "lesson-1" })) },
        lessonDocument: { findMany: vi.fn(async () => [document]) },
      } as never,
      storage as never,
      packetConfig() as never,
    );

    const packet = await service.build("lesson-1", [document.id]);

    expect(packet.filename).toBe("lesson-source.pdf");
    expect(packet.filename).not.toContain("lesson-1");
    expect(packet.manifest.pages).toEqual([
      expect.objectContaining({
        lessonDocumentId: document.id,
        sourcePdfPageNumber: 1,
      }),
      expect.objectContaining({
        lessonDocumentId: document.id,
        sourcePdfPageNumber: 2,
      }),
    ]);
  });

  it("copies exact source ranges in stable order and produces deterministic hashes", async () => {
    const primaryPdf = await searchablePdf(["Page one", "Page two", "Page three"]);
    const supplementPdf = await searchablePdf(["Supplement one", "Supplement two"]);
    const documents = [
      sourceDocument({
        id: "doc-primary",
        kind: LessonDocumentKind.PRIMARY_FROM_SOURCE,
        objectKey: "source/primary.pdf",
        fileId: "file-primary",
        pageRange: { id: "range-1", pageStart: 2, pageEnd: 3 },
      }),
      sourceDocument({
        id: "doc-supplement",
        kind: LessonDocumentKind.SUPPLEMENT,
        objectKey: "source/supplement.pdf",
        fileId: "file-supplement",
        pageRange: null,
        sourceDocumentId: null,
      }),
    ];
    const storage = {
      downloadObject: vi.fn(async (objectKey: string) => {
        if (objectKey === "source/primary.pdf") return primaryPdf;
        if (objectKey === "source/supplement.pdf") return supplementPdf;
        throw new Error(`Unexpected object key ${objectKey}`);
      }),
      uploadBuffer: vi.fn(async () => undefined),
      deleteObject: vi.fn(async () => undefined),
    };
    const service = new LessonSourcePacketService(
      {
        lesson: { findFirst: vi.fn(async () => ({ id: "lesson-1" })) },
        lessonDocument: { findMany: vi.fn(async () => documents) },
      } as never,
      storage as never,
      packetConfig() as never,
    );

    const first = await service.build("lesson-1", ["doc-supplement", "doc-primary"]);
    const second = await service.build("lesson-1", ["doc-primary", "doc-supplement"]);

    expect(first.manifest.pages).toEqual([
      expect.objectContaining({
        packetPageNumber: 1,
        sourceKey: "D01",
        lessonDocumentId: "doc-primary",
        sourcePdfPageNumber: 2,
        printedPageLabel: "32",
      }),
      expect.objectContaining({
        packetPageNumber: 2,
        sourceKey: "D01",
        lessonDocumentId: "doc-primary",
        sourcePdfPageNumber: 3,
        printedPageLabel: "33",
      }),
      expect.objectContaining({
        packetPageNumber: 3,
        sourceKey: "D02",
        lessonDocumentId: "doc-supplement",
        sourcePdfPageNumber: 1,
      }),
      expect.objectContaining({
        packetPageNumber: 4,
        sourceKey: "D02",
        lessonDocumentId: "doc-supplement",
        sourcePdfPageNumber: 2,
      }),
    ]);
    expect(first.packetHash).toBe(second.packetHash);
    expect(first.manifestHash).toBe(second.manifestHash);
    expect(first.sourceHash).toBe(second.sourceHash);
    expect(storage.uploadBuffer).toHaveBeenCalledTimes(2);
    expect(storage.uploadBuffer).toHaveBeenCalledWith(
      expect.stringContaining("temporary/lesson-summary-packets/lesson-1/"),
      expect.any(Buffer),
      "application/pdf",
    );
  });

  it("merges distinct extracted page ranges from different primary source PDFs", async () => {
    const firstSourcePdf = await searchablePdf([
      "First source page one",
      "First source page two",
      "First source page three",
      "First source page four",
    ]);
    const secondSourcePdf = await searchablePdf([
      "Second source page one",
      "Second source page two",
      "Second source page three",
      "Second source page four",
      "Second source page five",
    ]);
    const documents = [
      sourceDocument({
        id: "doc-range-from-source-a",
        kind: LessonDocumentKind.PRIMARY_FROM_SOURCE,
        objectKey: "source/source-a.pdf",
        fileId: "file-source-a",
        pageRange: { id: "range-source-a", pageStart: 2, pageEnd: 3 },
        sourceDocumentId: "source-document-a",
      }),
      sourceDocument({
        id: "doc-range-from-source-b",
        kind: LessonDocumentKind.PRIMARY_FROM_SOURCE,
        objectKey: "source/source-b.pdf",
        fileId: "file-source-b",
        pageRange: { id: "range-source-b", pageStart: 4, pageEnd: 5 },
        sourceDocumentId: "source-document-b",
      }),
    ];
    const storage = {
      downloadObject: vi.fn(async (objectKey: string) => {
        if (objectKey === "source/source-a.pdf") return firstSourcePdf;
        if (objectKey === "source/source-b.pdf") return secondSourcePdf;
        throw new Error(`Unexpected object key ${objectKey}`);
      }),
      uploadBuffer: vi.fn(async () => undefined),
      deleteObject: vi.fn(async () => undefined),
    };
    const service = new LessonSourcePacketService(
      {
        lesson: { findFirst: vi.fn(async () => ({ id: "lesson-ranges" })) },
        lessonDocument: { findMany: vi.fn(async () => documents) },
      } as never,
      storage as never,
      packetConfig() as never,
    );

    const packet = await service.build("lesson-ranges", [
      "doc-range-from-source-b",
      "doc-range-from-source-a",
    ]);
    const mergedPdf = await PDFDocument.load(packet.bytes, { updateMetadata: false });

    expect(packet.manifest.pages).toEqual([
      expect.objectContaining({
        packetPageNumber: 1,
        sourceKey: "D01",
        lessonDocumentId: "doc-range-from-source-a",
        sourceDocumentId: "source-document-a",
        sourcePdfPageNumber: 2,
        pageRangeId: "range-source-a",
      }),
      expect.objectContaining({
        packetPageNumber: 2,
        sourceKey: "D01",
        lessonDocumentId: "doc-range-from-source-a",
        sourceDocumentId: "source-document-a",
        sourcePdfPageNumber: 3,
        pageRangeId: "range-source-a",
      }),
      expect.objectContaining({
        packetPageNumber: 3,
        sourceKey: "D02",
        lessonDocumentId: "doc-range-from-source-b",
        sourceDocumentId: "source-document-b",
        sourcePdfPageNumber: 4,
        pageRangeId: "range-source-b",
      }),
      expect.objectContaining({
        packetPageNumber: 4,
        sourceKey: "D02",
        lessonDocumentId: "doc-range-from-source-b",
        sourceDocumentId: "source-document-b",
        sourcePdfPageNumber: 5,
        pageRangeId: "range-source-b",
      }),
    ]);
    expect(packet.modelManifest.pages.map((page) => page.sourcePdfPageNumber)).toEqual([
      2, 3, 4, 5,
    ]);
    expect(mergedPdf.getPageCount()).toBe(4);
    expect(storage.downloadObject).toHaveBeenCalledTimes(2);
    expect(storage.uploadBuffer).toHaveBeenCalledOnce();
  });

  it("merges multiple extracted ranges and multiple standalone PDFs into one Phase 1 provider attachment", async () => {
    const sourcePdfs = new Map<string, Buffer>([
      [
        "source/source-a.pdf",
        await searchablePdf([
          "Source A page one",
          "Source A page two",
          "Source A page three",
        ]),
      ],
      [
        "source/source-b.pdf",
        await searchablePdf([
          "Source B page one",
          "Source B page two",
          "Source B page three",
          "Source B page four",
          "Source B page five",
        ]),
      ],
      ["source/supplement-a.pdf", await searchablePdf(["Supplement A page one"])],
      [
        "source/supplement-b.pdf",
        await searchablePdf(["Supplement B page one", "Supplement B page two"]),
      ],
    ]);
    const documents = [
      sourceDocument({
        id: "doc-range-a",
        kind: LessonDocumentKind.PRIMARY_FROM_SOURCE,
        objectKey: "source/source-a.pdf",
        fileId: "file-range-a",
        pageRange: { id: "range-a", pageStart: 2, pageEnd: 3 },
        sourceDocumentId: "source-document-a",
      }),
      sourceDocument({
        id: "doc-range-b",
        kind: LessonDocumentKind.PRIMARY_FROM_SOURCE,
        objectKey: "source/source-b.pdf",
        fileId: "file-range-b",
        pageRange: { id: "range-b", pageStart: 4, pageEnd: 5 },
        sourceDocumentId: "source-document-b",
      }),
      sourceDocument({
        id: "doc-supplement-a",
        kind: LessonDocumentKind.SUPPLEMENT,
        objectKey: "source/supplement-a.pdf",
        fileId: "file-supplement-a",
        pageRange: null,
        sourceDocumentId: null,
      }),
      sourceDocument({
        id: "doc-supplement-b",
        kind: LessonDocumentKind.SUPPLEMENT,
        objectKey: "source/supplement-b.pdf",
        fileId: "file-supplement-b",
        pageRange: null,
        sourceDocumentId: null,
      }),
    ];
    const storage = {
      downloadObject: vi.fn(async (objectKey: string) => {
        const pdf = sourcePdfs.get(objectKey);
        if (!pdf) throw new Error(`Unexpected object key ${objectKey}`);
        return pdf;
      }),
      uploadBuffer: vi.fn(async () => undefined),
      deleteObject: vi.fn(async () => undefined),
    };
    const service = new LessonSourcePacketService(
      {
        lesson: { findFirst: vi.fn(async () => ({ id: "lesson-combined" })) },
        lessonDocument: { findMany: vi.fn(async () => documents) },
      } as never,
      storage as never,
      packetConfig() as never,
    );

    const packet = await service.build(
      "lesson-combined",
      documents.map(({ id }) => id).reverse(),
    );
    const providerInput = buildLessonSummaryStructuredInput({
      lessonId: "lesson-combined",
      lessonTitle: "Bài kiểm thử nhiều nguồn",
      targetGrade: 9,
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      documentIds: documents.map(({ id }) => id),
      sourceHash: packet.sourceHash,
      packet,
      configuration: {
        style: "student_friendly",
        styleInstructions: "",
        length: "standard",
        targetWordCount: null,
        extraInstructions: "",
      },
    });

    expect(
      packet.manifest.pages.map((page) => [
        page.sourceKey,
        page.lessonDocumentId,
        page.sourcePdfPageNumber,
      ]),
    ).toEqual([
      ["D01", "doc-range-a", 2],
      ["D01", "doc-range-a", 3],
      ["D02", "doc-range-b", 4],
      ["D02", "doc-range-b", 5],
      ["D03", "doc-supplement-a", 1],
      ["D04", "doc-supplement-b", 1],
      ["D04", "doc-supplement-b", 2],
    ]);
    expect(storage.downloadObject).toHaveBeenCalledTimes(4);
    expect(storage.uploadBuffer).toHaveBeenCalledOnce();
    expect(providerInput.inputFiles).toEqual([
      {
        filename: packet.filename,
        mimeType: "application/pdf",
        fileData: packet.bytes.toString("base64"),
        detail: "high",
      },
    ]);
    expect(providerInput).not.toHaveProperty("inputImages");
  });

  it("rejects a missing lesson or an empty/incomplete document selection", async () => {
    const storage = {
      downloadObject: vi.fn(),
      uploadBuffer: vi.fn(),
      deleteObject: vi.fn(),
    };
    const missingLesson = new LessonSourcePacketService(
      {
        lesson: { findFirst: vi.fn(async () => null) },
        lessonDocument: { findMany: vi.fn() },
      } as never,
      storage as never,
      packetConfig() as never,
    );
    await expect(missingLesson.build("missing", ["doc-1"])).rejects.toMatchObject<
      Partial<LessonSourcePacketError>
    >({ code: "LESSON_NOT_FOUND" });

    for (const documentIds of [[], ["doc-1", "doc-missing"]]) {
      const incompleteSelection = new LessonSourcePacketService(
        {
          lesson: { findFirst: vi.fn(async () => ({ id: "lesson-1" })) },
          lessonDocument: { findMany: vi.fn(async () => []) },
        } as never,
        storage as never,
        packetConfig() as never,
      );
      await expect(
        incompleteSelection.build("lesson-1", documentIds),
      ).rejects.toMatchObject<Partial<LessonSourcePacketError>>({
        code: "AI_PDF_SOURCE_NOT_READY",
      });
    }
    expect(storage.downloadObject).not.toHaveBeenCalled();
    expect(storage.uploadBuffer).not.toHaveBeenCalled();
  });

  it("rejects sources without an active searchable OCR artifact before upload", async () => {
    const document = sourceDocument({
      id: "doc-primary",
      kind: LessonDocumentKind.PRIMARY_FROM_SOURCE,
      objectKey: "source/primary.pdf",
      fileId: "file-primary",
      pageRange: { id: "range-1", pageStart: 1, pageEnd: 1 },
    });
    document.activeOcrArtifactId = null;
    document.sourceDocument!.activeOcrArtifactId = null;
    const storage = {
      downloadObject: vi.fn(),
      uploadBuffer: vi.fn(),
      deleteObject: vi.fn(),
    };
    const service = new LessonSourcePacketService(
      {
        lesson: { findFirst: vi.fn(async () => ({ id: "lesson-1" })) },
        lessonDocument: { findMany: vi.fn(async () => [document]) },
      } as never,
      storage as never,
      packetConfig() as never,
    );

    await expect(service.build("lesson-1", ["doc-primary"])).rejects.toMatchObject<
      Partial<LessonSourcePacketError>
    >({ code: "AI_PDF_SOURCE_NOT_READY" });
    expect(storage.downloadObject).not.toHaveBeenCalled();
    expect(storage.uploadBuffer).not.toHaveBeenCalled();
  });

  it.each([
    [
      "non-PDF file",
      (document: ReturnType<typeof sourceDocument>) => {
        document.file.mimeType = "image/png";
      },
    ],
    [
      "deleted file",
      (document: ReturnType<typeof sourceDocument>) => {
        document.file.status = "DELETED";
      },
    ],
    [
      "missing checksum",
      (document: ReturnType<typeof sourceDocument>) => {
        document.file.checksum = null;
      },
    ],
    [
      "source-linked document without a page range",
      (document: ReturnType<typeof sourceDocument>) => {
        document.pageRange = null;
        document.pageRangeId = null;
      },
    ],
    [
      "primary source document not ready",
      (document: ReturnType<typeof sourceDocument>) => {
        document.sourceDocument!.status = DocumentStatus.PROCESSING;
      },
    ],
  ])("rejects an ineligible searchable source: %s", async (_label, mutate) => {
    const document = sourceDocument({
      id: "doc-invalid",
      kind: LessonDocumentKind.PRIMARY_FROM_SOURCE,
      objectKey: "source/invalid.pdf",
      fileId: "file-invalid",
      pageRange: { id: "range-invalid", pageStart: 1, pageEnd: 1 },
    });
    mutate(document);
    const storage = {
      downloadObject: vi.fn(),
      uploadBuffer: vi.fn(),
      deleteObject: vi.fn(),
    };
    const service = new LessonSourcePacketService(
      {
        lesson: { findFirst: vi.fn(async () => ({ id: "lesson-1" })) },
        lessonDocument: { findMany: vi.fn(async () => [document]) },
      } as never,
      storage as never,
      packetConfig() as never,
    );

    await expect(service.build("lesson-1", [document.id])).rejects.toMatchObject<
      Partial<LessonSourcePacketError>
    >({ code: "AI_PDF_SOURCE_NOT_READY" });
    expect(storage.downloadObject).not.toHaveBeenCalled();
    expect(storage.uploadBuffer).not.toHaveBeenCalled();
  });

  it.each([
    ["corrupt PDF", Buffer.from("not-a-pdf"), { pageStart: 1, pageEnd: 1 }],
    ["range starts before page one", null, { pageStart: 0, pageEnd: 1 }],
    ["range ends after the PDF", null, { pageStart: 1, pageEnd: 3 }],
    ["range is reversed", null, { pageStart: 2, pageEnd: 1 }],
  ])("rejects unreadable packet input: %s", async (_label, suppliedPdf, range) => {
    const pdf = suppliedPdf ?? (await searchablePdf(["Page one", "Page two"]));
    const document = sourceDocument({
      id: "doc-unreadable",
      kind: LessonDocumentKind.PRIMARY_FROM_SOURCE,
      objectKey: "source/unreadable.pdf",
      fileId: "file-unreadable",
      pageRange: { id: "range-unreadable", ...range },
    });
    const storage = {
      downloadObject: vi.fn(async () => pdf),
      uploadBuffer: vi.fn(),
      deleteObject: vi.fn(),
    };
    const service = new LessonSourcePacketService(
      {
        lesson: { findFirst: vi.fn(async () => ({ id: "lesson-1" })) },
        lessonDocument: { findMany: vi.fn(async () => [document]) },
      } as never,
      storage as never,
      packetConfig() as never,
    );

    await expect(service.build("lesson-1", [document.id])).rejects.toMatchObject<
      Partial<LessonSourcePacketError>
    >({ code: "AI_PDF_SOURCE_NOT_READY" });
    expect(storage.uploadBuffer).not.toHaveBeenCalled();
  });

  it("rejects a PDF packet whose pages do not contain a sufficient searchable text layer", async () => {
    const pdf = await nonSearchablePdf(2);
    const document = sourceDocument({
      id: "doc-no-searchable-text",
      kind: LessonDocumentKind.PRIMARY_FROM_SOURCE,
      objectKey: "source/no-searchable-text.pdf",
      fileId: "file-no-searchable-text",
      pageRange: { id: "range-no-searchable-text", pageStart: 1, pageEnd: 2 },
    });
    const storage = {
      downloadObject: vi.fn(async () => pdf),
      uploadBuffer: vi.fn(),
      deleteObject: vi.fn(),
    };
    const service = new LessonSourcePacketService(
      {
        lesson: { findFirst: vi.fn(async () => ({ id: "lesson-1" })) },
        lessonDocument: { findMany: vi.fn(async () => [document]) },
      } as never,
      storage as never,
      packetConfig() as never,
    );

    await expect(service.build("lesson-1", [document.id])).rejects.toMatchObject<
      Partial<LessonSourcePacketError>
    >({ code: "AI_PDF_SOURCE_NOT_READY" });
    expect(storage.uploadBuffer).not.toHaveBeenCalled();
  });

  it("rejects excessive page counts and packet sizes before storage upload", async () => {
    const pdf = await searchablePdf(["Page one", "Page two"]);
    const document = sourceDocument({
      id: "doc-primary",
      kind: LessonDocumentKind.PRIMARY_FROM_SOURCE,
      objectKey: "source/primary.pdf",
      fileId: "file-primary",
      pageRange: { id: "range-1", pageStart: 1, pageEnd: 2 },
    });
    const storage = {
      downloadObject: vi.fn(async () => pdf),
      uploadBuffer: vi.fn(),
      deleteObject: vi.fn(),
    };
    const prisma = {
      lesson: { findFirst: vi.fn(async () => ({ id: "lesson-1" })) },
      lessonDocument: { findMany: vi.fn(async () => [document]) },
    };
    const pageLimited = new LessonSourcePacketService(
      prisma as never,
      storage as never,
      packetConfig({ maxPages: 1 }) as never,
    );
    await expect(pageLimited.build("lesson-1", [document.id])).rejects.toMatchObject<
      Partial<LessonSourcePacketError>
    >({ code: "AI_PDF_PACKET_TOO_MANY_PAGES" });

    const sizeLimited = new LessonSourcePacketService(
      prisma as never,
      storage as never,
      packetConfig({ maxMb: 0.000001 }) as never,
    );
    await expect(sizeLimited.build("lesson-1", [document.id])).rejects.toMatchObject<
      Partial<LessonSourcePacketError>
    >({ code: "AI_PDF_PACKET_TOO_LARGE" });
    expect(storage.uploadBuffer).not.toHaveBeenCalled();
  });

  it("deletes only the generated temporary packet key through storage", async () => {
    const storage = { deleteObject: vi.fn(async () => undefined) };
    const service = new LessonSourcePacketService(
      {} as never,
      storage as never,
      packetConfig() as never,
    );
    const objectKey = "temporary/lesson-summary-packets/lesson-1/packet.pdf";
    await service.cleanup(objectKey);
    expect(storage.deleteObject).toHaveBeenCalledWith(objectKey);
  });

  it("downloads the exact packet key through storage", async () => {
    const bytes = Buffer.from("packet");
    const storage = { downloadObject: vi.fn(async () => bytes) };
    const service = new LessonSourcePacketService(
      {} as never,
      storage as never,
      packetConfig() as never,
    );

    await expect(service.download("temporary/lesson/packet.pdf")).resolves.toBe(bytes);
    expect(storage.downloadObject).toHaveBeenCalledWith("temporary/lesson/packet.pdf");
  });
});

function packetConfig(options: { maxPages?: number; maxMb?: number } = {}) {
  return {
    get: vi.fn((key: string) => {
      if (key === "AI_SUMMARY_PACKET_MAX_PAGES") return options.maxPages ?? 120;
      if (key === "AI_SUMMARY_PACKET_MAX_MB") return options.maxMb ?? 45;
      throw new Error(`Unexpected config key ${key}`);
    }),
  };
}

function sourceDocument(input: {
  id: string;
  kind: LessonDocumentKind;
  objectKey: string;
  fileId: string;
  pageRange: { id: string; pageStart: number; pageEnd: number } | null;
  sourceDocumentId?: string | null;
}) {
  const sourceDocumentId =
    input.sourceDocumentId === undefined ? "source-document-1" : input.sourceDocumentId;
  return {
    id: input.id,
    kind: input.kind,
    title: input.id,
    sourceDocumentId,
    pageRangeId: input.pageRange?.id ?? null,
    activeOcrArtifactId: "ocr-artifact-1" as string | null,
    updatedAt: new Date("2026-08-13T00:00:00.000Z"),
    file: {
      id: input.fileId,
      objectKey: input.objectKey,
      originalName: `${input.id}.pdf`,
      mimeType: "application/pdf",
      checksum: `${input.fileId}-checksum` as string | null,
      status: "READY" as string,
    },
    pageRange: input.pageRange
      ? { ...input.pageRange, updatedAt: new Date("2026-08-13T00:00:00.000Z") }
      : null,
    sourceDocument: sourceDocumentId
      ? {
          id: sourceDocumentId,
          status: DocumentStatus.READY as DocumentStatus,
          activeOcrArtifactId: "ocr-artifact-1" as string | null,
          pages: [
            { pageNumber: 1, metadataJson: printedPage("31") },
            { pageNumber: 2, metadataJson: printedPage("32") },
            { pageNumber: 3, metadataJson: printedPage("33") },
          ],
        }
      : null,
  };
}

function printedPage(printedPageLabel: string) {
  return { printedPage: { printedPageLabel } };
}

async function searchablePdf(pageTexts: string[]) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const text of pageTexts) {
    const page = pdf.addPage([595, 842]);
    page.drawText(`${text} searchable textbook content`, {
      x: 48,
      y: 790,
      size: 14,
      font,
    });
  }
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

async function nonSearchablePdf(pageCount: number) {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) {
    pdf.addPage([595, 842]);
  }
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}
