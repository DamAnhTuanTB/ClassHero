import { createHash, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DocumentStatus } from "@prisma/client";
import { PDFDocument } from "pdf-lib";
import { PDFParse } from "pdf-parse";

import { PrismaService } from "#api/common/prisma/prisma.service";
import type { EnvConfig } from "#api/config/env.validation";
import type {
  LessonSourcePacket,
  LessonSourcePacketModelManifest,
  LessonSourcePacketPage,
} from "#api/modules/ai/types/lesson-source-packet.types";
import { hashAiValue } from "#api/modules/ai/utils/ai-hash";
import { ObjectStorageService } from "#api/modules/files/services/object-storage.service";

export type LessonSourcePacketErrorCode =
  | "LESSON_NOT_FOUND"
  | "AI_PDF_SOURCE_NOT_READY"
  | "AI_PDF_SOURCE_EMPTY"
  | "AI_PDF_PACKET_TOO_LARGE"
  | "AI_PDF_PACKET_TOO_MANY_PAGES";

export class LessonSourcePacketError extends Error {
  constructor(
    readonly code: LessonSourcePacketErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "LessonSourcePacketError";
  }
}

@Injectable()
export class LessonSourcePacketService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ObjectStorageService)
    private readonly storage: ObjectStorageService,
    @Inject(ConfigService)
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async build(lessonId: string, documentIds: string[]): Promise<LessonSourcePacket> {
    const documents = await this.loadDocuments(lessonId, documentIds);
    const output = await PDFDocument.create();
    output.setTitle("Temporary lesson source packet");
    output.setAuthor("learning-path-mvp");
    output.setCreator("lesson-source-packet-v1");
    output.setProducer("lesson-source-packet-v1");
    output.setCreationDate(new Date(0));
    output.setModificationDate(new Date(0));

    const sourceBuffers = new Map<string, Buffer>();
    const sourcePdfs = new Map<string, PDFDocument>();
    const pages: LessonSourcePacketPage[] = [];
    for (let segmentOrder = 0; segmentOrder < documents.length; segmentOrder += 1) {
      const document = documents[segmentOrder]!;
      let sourceBuffer = sourceBuffers.get(document.file.id);
      if (!sourceBuffer) {
        sourceBuffer = await this.storage.downloadObject(document.file.objectKey);
        sourceBuffers.set(document.file.id, sourceBuffer);
      }
      let sourcePdf = sourcePdfs.get(document.file.id);
      if (!sourcePdf) {
        try {
          sourcePdf = await PDFDocument.load(sourceBuffer, { updateMetadata: false });
        } catch (error) {
          throw new LessonSourcePacketError(
            "AI_PDF_SOURCE_NOT_READY",
            `Không thể đọc PDF ${document.file.originalName}.`,
            { documentId: document.id, reason: toErrorMessage(error) },
          );
        }
        sourcePdfs.set(document.file.id, sourcePdf);
      }
      const selectedPageNumbers = resolvePageNumbers(document, sourcePdf.getPageCount());
      const copiedPages = await output.copyPages(
        sourcePdf,
        selectedPageNumbers.map((pageNumber) => pageNumber - 1),
      );
      const sourceKey = `D${String(segmentOrder + 1).padStart(2, "0")}`;
      for (let index = 0; index < copiedPages.length; index += 1) {
        output.addPage(copiedPages[index]!);
        const sourcePdfPageNumber = selectedPageNumbers[index]!;
        pages.push({
          packetPageNumber: pages.length + 1,
          sourceKey,
          lessonDocumentId: document.id,
          sourceDocumentId: document.sourceDocumentId,
          sourceFileId: document.file.id,
          sourcePdfPageNumber,
          printedPageLabel:
            document.sourceDocument?.pages.find(
              (page) => page.pageNumber === sourcePdfPageNumber,
            )?.printedPageLabel ?? null,
          pageRangeId: document.pageRangeId,
          documentTitle: document.title?.trim() || document.file.originalName,
          segmentOrder,
        });
      }
    }
    if (pages.length === 0) {
      throw new LessonSourcePacketError(
        "AI_PDF_SOURCE_EMPTY",
        "Packet PDF phải có ít nhất một trang.",
      );
    }
    const maxPages = this.config.get("AI_SUMMARY_PACKET_MAX_PAGES", { infer: true });
    if (pages.length > maxPages) {
      throw new LessonSourcePacketError(
        "AI_PDF_PACKET_TOO_MANY_PAGES",
        `Packet có ${pages.length} trang, vượt giới hạn ${maxPages} trang.`,
        { pageCount: pages.length, maxPages },
      );
    }

    const bytes = Buffer.from(
      await output.save({ useObjectStreams: false, addDefaultPage: false }),
    );
    const maxBytes =
      this.config.get("AI_SUMMARY_PACKET_MAX_MB", { infer: true }) * 1024 * 1024;
    if (bytes.length > maxBytes) {
      throw new LessonSourcePacketError(
        "AI_PDF_PACKET_TOO_LARGE",
        "Packet PDF vượt giới hạn dung lượng; hãy thu hẹp nguồn đã chọn.",
        { sizeBytes: bytes.length, maxBytes },
      );
    }
    await assertSearchable(bytes);

    const packetHash = sha256(bytes);
    const manifest = {
      version: 1 as const,
      lessonId,
      packetHash,
      pageCount: pages.length,
      pages,
    };
    const modelManifest: LessonSourcePacketModelManifest = {
      version: 1,
      pages: pages.map((page) => ({
        packetPageNumber: page.packetPageNumber,
        sourceKey: page.sourceKey,
        documentTitle: page.documentTitle,
        sourcePdfPageNumber: page.sourcePdfPageNumber,
        printedPageLabel: page.printedPageLabel,
      })),
    };
    const manifestHash = hashAiValue(modelManifest);
    const filename = "lesson-source.pdf";
    const objectKey = `temporary/lesson-summary-packets/${lessonId}/${randomUUID()}-${packetHash.slice(0, 16)}.pdf`;
    await this.storage.uploadBuffer(objectKey, bytes, "application/pdf");
    const sourceSnapshot = {
      lessonId,
      documents: documents.map((document) => ({
        id: document.id,
        updatedAt: document.updatedAt.toISOString(),
        fileId: document.file.id,
        fileChecksum: document.file.checksum,
        sourceDocumentId: document.sourceDocumentId,
        activeOcrArtifactId: document.activeOcrArtifactId,
        pageRange: document.pageRange
          ? {
              id: document.pageRange.id,
              pageStart: document.pageRange.pageStart,
              pageEnd: document.pageRange.pageEnd,
              updatedAt: document.pageRange.updatedAt.toISOString(),
            }
          : null,
      })),
    };
    return {
      filename,
      objectKey,
      bytes,
      packetHash,
      manifestHash,
      manifest,
      modelManifest,
      sourceSnapshot,
      sourceHash: hashAiValue(sourceSnapshot),
    };
  }

  async computeCurrentSourceHash(lessonId: string, documentIds: string[]) {
    const documents = await this.loadDocuments(lessonId, documentIds);
    return hashAiValue({
      lessonId,
      documents: documents.map((document) => ({
        id: document.id,
        updatedAt: document.updatedAt.toISOString(),
        fileId: document.file.id,
        fileChecksum: document.file.checksum,
        sourceDocumentId: document.sourceDocumentId,
        activeOcrArtifactId: document.activeOcrArtifactId,
        pageRange: document.pageRange
          ? {
              id: document.pageRange.id,
              pageStart: document.pageRange.pageStart,
              pageEnd: document.pageRange.pageEnd,
              updatedAt: document.pageRange.updatedAt.toISOString(),
            }
          : null,
      })),
    });
  }

  cleanup(objectKey: string) {
    return this.storage.deleteObject(objectKey);
  }

  download(objectKey: string) {
    return this.storage.downloadObject(objectKey);
  }

  private async loadDocuments(lessonId: string, documentIds: string[]) {
    const uniqueDocumentIds = [...new Set(documentIds)];
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, deletedAt: null, learningPath: { deletedAt: null } },
      select: { id: true },
    });
    if (!lesson) {
      throw new LessonSourcePacketError("LESSON_NOT_FOUND", "Không tìm thấy buổi học.");
    }
    const documents = await this.prisma.lessonDocument.findMany({
      where: {
        id: { in: uniqueDocumentIds },
        lessonId,
        status: DocumentStatus.READY,
        replacedAt: null,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        kind: true,
        title: true,
        sourceDocumentId: true,
        pageRangeId: true,
        activeOcrArtifactId: true,
        updatedAt: true,
        file: {
          select: {
            id: true,
            objectKey: true,
            originalName: true,
            mimeType: true,
            checksum: true,
            status: true,
          },
        },
        pageRange: {
          select: { id: true, pageStart: true, pageEnd: true, updatedAt: true },
        },
        sourceDocument: {
          select: {
            id: true,
            status: true,
            activeOcrArtifactId: true,
            pages: {
              orderBy: { pageNumber: "asc" },
              select: { pageNumber: true, metadataJson: true },
            },
          },
        },
      },
    });
    if (uniqueDocumentIds.length === 0 || documents.length !== uniqueDocumentIds.length) {
      throw new LessonSourcePacketError(
        "AI_PDF_SOURCE_NOT_READY",
        "Mọi tài liệu được chọn phải thuộc bài học và ở trạng thái READY.",
        { lessonId, documentIds: uniqueDocumentIds },
      );
    }
    return documents.map((document) => {
      const activeOcrArtifactId =
        document.activeOcrArtifactId ??
        document.sourceDocument?.activeOcrArtifactId ??
        null;
      const hasSourceDocument = document.sourceDocumentId !== null;
      const hasPageRange = document.pageRange !== null;
      if (
        document.file.mimeType !== "application/pdf" ||
        document.file.status === "DELETED" ||
        !document.file.checksum ||
        !activeOcrArtifactId ||
        hasSourceDocument !== hasPageRange ||
        (hasSourceDocument && document.sourceDocument?.status !== DocumentStatus.READY)
      ) {
        throw new LessonSourcePacketError(
          "AI_PDF_SOURCE_NOT_READY",
          `Tài liệu ${document.title ?? document.file.originalName} chưa đủ điều kiện searchable PDF.`,
          { documentId: document.id },
        );
      }
      return {
        ...document,
        activeOcrArtifactId,
        sourceDocument: document.sourceDocument
          ? {
              ...document.sourceDocument,
              pages: document.sourceDocument.pages.map((page) => ({
                pageNumber: page.pageNumber,
                printedPageLabel: readPrintedPageLabel(page.metadataJson),
              })),
            }
          : null,
      };
    });
  }
}

function resolvePageNumbers(
  document: {
    pageRange: { pageStart: number; pageEnd: number } | null;
  },
  pageCount: number,
) {
  if (!document.pageRange) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }
  if (
    document.pageRange.pageStart < 1 ||
    document.pageRange.pageEnd > pageCount ||
    document.pageRange.pageStart > document.pageRange.pageEnd
  ) {
    throw new LessonSourcePacketError(
      "AI_PDF_SOURCE_NOT_READY",
      "Khoảng trang không còn khớp PDF canonical.",
      { ...document.pageRange, pageCount },
    );
  }
  return Array.from(
    { length: document.pageRange.pageEnd - document.pageRange.pageStart + 1 },
    (_, index) => document.pageRange!.pageStart + index,
  );
}

async function assertSearchable(buffer: Buffer) {
  const clone = new Uint8Array(buffer.length);
  clone.set(buffer);
  const parser = new PDFParse({ data: clone });
  try {
    const text = await parser.getText();
    const searchablePages = text.pages.filter((page) => page.text.trim().length >= 8);
    if (searchablePages.length / Math.max(1, text.total) < 0.5) {
      throw new LessonSourcePacketError(
        "AI_PDF_SOURCE_NOT_READY",
        "Packet PDF không có lớp text searchable đủ trên các trang nội dung.",
      );
    }
  } finally {
    await parser.destroy();
  }
}

function readPrintedPageLabel(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const printedPage = (value as Record<string, unknown>).printedPage;
  if (!printedPage || typeof printedPage !== "object" || Array.isArray(printedPage)) {
    return null;
  }
  const label = (printedPage as Record<string, unknown>).printedPageLabel;
  return typeof label === "string" && label.trim() ? label.trim() : null;
}

function sha256(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
